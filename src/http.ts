/**
 * Transporte HTTP del MCP con Express.
 *
 * Decisiones clave:
 *  - **Per-session transport**: cada cliente recibe su propio
 *    `StreamableHTTPServerTransport` + `McpServer`, indexados por el header
 *    `Mcp-Session-Id` que genera el SDK en el `initialize`. Sin esto, una
 *    rutina de Routines y una llamada manual del Command Center podrían
 *    pisarse estado mutuamente (capabilities, listas de tools, suscripciones).
 *  - **CORS preflight**: OPTIONS responde 204 con headers CORS ANTES del auth.
 *    Sin esto, browsers y clients JS abortan al recibir 401 al preflight,
 *    sin llegar nunca al POST real.
 *  - **Auth en middleware** antes del dispatcher MCP: un 401/403 se resuelve
 *    sin tocar el protocolo. Allowlist de Origin = mitigación de DNS
 *    rebinding; bearer timing-safe = no revelar la longitud del secreto.
 *  - **Rate limit por token** (no por IP): en producción detrás de un
 *    reverse proxy, la IP sería la del balanceador. El bearer es el
 *    identificador real del cliente.
 *  - **Idle eviction**: sesiones inactivas 30 min se cierran. Evita fugas de
 *    memoria si un cliente abandona la conexión sin limpiar.
 */
import { randomUUID } from "node:crypto";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import { rateLimit, ipKeyGenerator } from "express-rate-limit";
import { compareTokens, extractBearer } from "./auth.js";
import type { Config } from "./config.js";
import {
  registry as metricsRegistry,
  mcpRequestsTotal,
  mcpRequestDuration,
  mcpActiveSessions,
  mcpDryRunMode,
} from "./utils/metrics.js";
import { VERSION } from "./version.js";

interface Logger {
  debug: (m: string, e?: unknown) => void;
  info: (m: string, e?: unknown) => void;
  error: (m: string, e?: unknown) => void;
}

export interface HttpAppDeps {
  buildServer: () => McpServer;
  cfg: Config;
  log: Logger;
}

/**
 * Construye la app Express del MCP. Exportada (no inlined en `index.ts`) para
 * poder montarla en tests con `supertest` sin abrir un puerto real, ver
 * `tests/http-transport.test.ts`.
 *
 * Contrato: una sesión MCP = un transport = un McpServer propio. La session id
 * la genera el SDK en el `initialize` y viaja en el header `Mcp-Session-Id` en
 * cada request siguiente.
 */
export function buildHttpApp(deps: HttpAppDeps): Express {
  const { buildServer, cfg, log } = deps;
  const expectedToken = cfg.transport.authToken ?? "";
  const allowedOrigins = new Set(cfg.transport.allowedOrigins);

  const app = express();
  app.use(express.json({ limit: "25mb" }));

  // Registro en memoria de sesiones activas. `lastUsed` alimenta la eviction.
  const sessions = new Map<string, { transport: StreamableHTTPServerTransport; server: McpServer; lastUsed: number }>();

  // 120 req/min por bearer; si no hay bearer (p. ej. preflight OPTIONS) se
  // recae en la IP via `ipKeyGenerator` de express-rate-limit, y en último
  // caso en "anon". draft-7 = headers estándar modernos `RateLimit`.
  const limiter = rateLimit({
    windowMs: 60_000,
    limit: 120,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    keyGenerator: (req) =>
      extractBearer(req.headers.authorization) ||
      ipKeyGenerator(req.ip ?? "") ||
      "anon",
    message: { error: "rate_limit_exceeded" },
  });

  // CORS preflight handler. DEBE ir antes de auth: los clientes web
  // hacen OPTIONS preflight sin Authorization header; si pasa por auth recibe
  // 401 y aborta. Aquí respondemos 204 con headers CORS si el Origin está
  // allowlisted, y dejamos que las requests no-OPTIONS sigan al auth.
  app.use("/mcp", (req: Request, res: Response, next: NextFunction): void => {
    const origin = req.headers.origin;
    if (origin && allowedOrigins.has(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, DELETE");
      res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, Mcp-Session-Id, Accept");
      res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");
      res.setHeader("Access-Control-Max-Age", "600");
    }
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    next();
  });

  // Gauge de dry-run (valor constante por sesión de vida del proceso).
  mcpDryRunMode.set({}, cfg.agent.dryRun ? 1 : 0);

  // Instrumentación Prometheus para requests MCP.
  // Captura method (del JSON-RPC body), status HTTP y duración.
  app.use("/mcp", (req: Request, res: Response, next: NextFunction): void => {
    const start = process.hrtime.bigint();
    const bodyObj = (req.body && typeof req.body === "object") ? req.body as Record<string, unknown> : null;
    const rpcMethod = (bodyObj && typeof bodyObj["method"] === "string") ? bodyObj["method"] : "unknown";
    res.on("finish", () => {
      const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;
      const status = String(res.statusCode);
      mcpRequestsTotal.inc({ transport: "http", method: rpcMethod, status });
      mcpRequestDuration.observe({ transport: "http", method: rpcMethod }, durationSeconds);
    });
    next();
  });

  // Orden importa: rate-limit ANTES de auth. Así un atacante que bombardee
  // con tokens inválidos también consume su cuota y deja de ser útil.
  app.use("/mcp", limiter, authMiddleware);

  app.all("/mcp", async (req: Request, res: Response) => {
    const sessionId = (req.headers["mcp-session-id"] as string | undefined) ?? undefined;
    try {
      const entry = sessionId ? sessions.get(sessionId) : undefined;

      // Caso 1: request sin sesión válida pero con body `initialize` →
      // creamos transport + server nuevos y los registramos al terminar.
      if (!entry && req.method === "POST" && isInitializeRequest(req.body)) {
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (id) => {
            log.debug("MCP session initialized", { id });
          },
        });
        const server = buildServer();
        await server.connect(transport as never);
        transport.onclose = () => {
          if (transport.sessionId) {
            sessions.delete(transport.sessionId);
            log.debug("MCP session closed", { id: transport.sessionId });
          }
        };
        await transport.handleRequest(req, res, req.body);
        if (transport.sessionId) {
          sessions.set(transport.sessionId, { transport, server, lastUsed: Date.now() });
        }
        return;
      }

      // Caso 2: request con session id desconocida o body no-initialize →
      // 400 con shape JSON-RPC para que el cliente sepa reinicializar.
      if (!entry) {
        res.status(400).json({ jsonrpc: "2.0", error: { code: -32000, message: "No valid session. Send an initialize request first." }, id: null });
        return;
      }

      // Caso 3: sesión existente. Actualizamos lastUsed y delegamos al SDK.
      entry.lastUsed = Date.now();
      await entry.transport.handleRequest(req, res, req.body);
    } catch (err) {
      log.error("Error handling MCP request", { message: (err as Error).message });
      if (!res.headersSent) {
        res.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: "internal_error" }, id: null });
      }
    }
  });

  // `/healthz` no pasa por el middleware de auth — lo usan uptime monitors
  // y el healthcheck de Docker. Expone el número de sesiones como métrica
  // barata para detectar fugas o cargas anómalas.
  app.get("/healthz", (_req: Request, res: Response) => {
    res.json({ ok: true, version: VERSION, sessions: sessions.size });
  });

  // `/metrics` requiere bearer auth (no exposición pública de métricas).
  app.get("/metrics", authMiddleware, (_req: Request, res: Response) => {
    mcpActiveSessions.set({}, sessions.size);
    res.type("text/plain; version=0.0.4").send(metricsRegistry.text());
  });

  // Eviction de sesiones idle. `setInterval().unref()` permite al proceso
  // salir limpiamente aunque el timer esté activo (no bloquea el event loop
  // al cerrar).
  setInterval(() => {
    const now = Date.now();
    const idleTimeout = 30 * 60 * 1000;
    for (const [id, entry] of sessions) {
      if (now - entry.lastUsed > idleTimeout) {
        entry.transport.close().catch(() => { /* noop */ });
        sessions.delete(id);
        log.debug("Evicted idle session", { id });
      }
    }
  }, 60_000).unref();

  return app;

  /**
   * Auth middleware. Orden y efectos:
   *  1. Si el cliente envía `Origin` y tenemos allowlist, validamos. Sin
   *     `Origin` (caso típico de cliente CLI o backend) aceptamos: no todos
   *     los clientes MCP envían el header, y el bearer ya es suficiente para
   *     los no-navegadores.
   *  2. Bearer comparado timing-safe (ver `auth.ts`). Fail-closed.
   */
  function authMiddleware(req: Request, res: Response, next: NextFunction): void {
    const origin = req.headers.origin;
    if (origin && allowedOrigins.size > 0 && !allowedOrigins.has(origin)) {
      res.status(403).json({ error: "origin_not_allowed" });
      return;
    }
    const token = extractBearer(req.headers.authorization);
    if (!compareTokens(token, expectedToken)) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    next();
  }
}
