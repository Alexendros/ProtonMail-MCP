/**
 * Registro de las 13 MCP tools sobre un `McpServer`.
 *
 * Convenciones aplicadas a TODAS las tools:
 *  - **`inputSchema` con Zod**: el SDK convierte el schema Zod a JSON Schema
 *    draft-07 y lo expone en `tools/list`. El modelo ve tipos, descripciones
 *    y defaults — puede construir llamadas válidas sin adivinar.
 *  - **`annotations`**: cada tool declara al menos `readOnlyHint` y
 *    `openWorldHint`. Las mutativas añaden `destructiveHint` o
 *    `idempotentHint`. Esto permite al cliente MCP (y al humano que lo audita)
 *    razonar sobre efectos sin leer el handler.
 *  - **`response_format: "markdown" | "json"`** en las tools de lectura. Por
 *    defecto markdown — más natural para el modelo al resumir. JSON cuando
 *    el consumidor es un backend (ver `fetchUnreadSummary` en el Command
 *    Center).
 *
 * Instrucciones del servidor: el `instructions` que se pasa al constructor es
 * contexto que el modelo VE al listar tools. Por eso recordamos la necesidad
 * de llamar primero a `proton_list_folders` y de usar UIDs (no seq numbers).
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { AlertSystem } from './alerts/index.js'
import { BridgeClient } from './bridge/bridge-client.js'
import { type createLogger, type Config } from './config.js'
import { DriveClient } from './drive.js'
import { ImapClient } from './imap.js'
import { PassClient } from './pass.js'
import { registerAgentTools } from './server/agent.js'
import { registerCalendarTools } from './server/calendar.js'
import { registerDriveTools } from './server/drive.js'
import { registerEcosystemTools } from './server/ecosystem.js'
import { registerMailTools } from './server/mail.js'
import { registerPassTools } from './server/pass.js'
import { registerSuiteTool } from './server/suite.js'
import { SmtpClient } from './smtp.js'
import { VERSION } from './version.js'

type Logger = ReturnType<typeof createLogger>

export function buildServer(
  cfg: Config,
  log: Logger,
): {
  server: McpServer
  imap: ImapClient
  smtp: SmtpClient
  drive?: DriveClient
} {
  const bridgeCfg = cfg.products.mail.bridge
  let passwordResolver: () => Promise<string>
  if (cfg.products.pass.enabled && bridgeCfg.passPath) {
    const passClient = new PassClient(
      { storeDir: cfg.products.pass.storeDir },
      log,
    )
    const passPath = bridgeCfg.passPath
    passwordResolver = () => passClient.get(passPath)
  } else {
    passwordResolver = () => Promise.resolve(bridgeCfg.pass)
  }
  const resolvedBridgeCfg = { ...bridgeCfg, passwordResolver }

  const imap = new ImapClient(resolvedBridgeCfg, log)
  const smtp = new SmtpClient(resolvedBridgeCfg, log)

  const server = new McpServer(
    { name: 'protonsuite-agent', version: VERSION },
    {
      instructions:
        'Proton Suite agent with multiple products. Mail: via Proton Mail Bridge (IMAP/SMTP) — call proton_list_folders first, use UIDs. Pass: via pass-cli — never returns secret values, only confirms found/generated. Drive: via proton-drive CLI — staging directory is a local workspace, not a rclone mirror. Calendar stub. Before any write operation, review the plan in read-only mode.',
    },
  )

  // Wrapper de registro con traza por handler. `register` comparte la firma
  // (sobrecargada y genérica) de `server.registerTool`, así que cada call-site
  // conserva el tipado de `args` inferido desde su inputSchema; el casting a
  // `any` queda confinado aquí. Emite un `debug` con { tool, ms } al terminar
  // (éxito o error) — sin volcar args, que pueden traer cuerpos o direcciones.
  const register: typeof server.registerTool = ((name, config, cb) =>
    server.registerTool(
      name,
      config as never,
      (async (...callArgs: unknown[]) => {
        const startedAt = Date.now()
        try {
          return await (cb as (...a: unknown[]) => Promise<unknown>)(
            ...callArgs,
          )
        } finally {
          log.debug('tool', { tool: name, ms: Date.now() - startedAt })
        }
      }) as never,
    )) as typeof server.registerTool

  // ---------------------------------------------------------------------------
  // Registro de las 13 tools agrupado por dominio funcional. Cada helper
  // encapsula el register de su grupo; los handlers capturan `imap`/`smtp` por
  // closure, así que el cuerpo de `buildServer` solo orquesta.
  // ---------------------------------------------------------------------------
  const alerts = new AlertSystem(cfg.alerts, log)

  registerMailTools(server, { cfg, log, imap, smtp })
  registerAgentTools(server, { cfg, log, alerts })

  let driveClient: DriveClient | undefined
  if (cfg.products.drive.enabled) {
    driveClient = new DriveClient(cfg.products.drive, log)
  }

  registerPassTools(server, { cfg, log })
  registerCalendarTools(server, { log, enabled: cfg.products.calendar.enabled })
  registerDriveTools(server, { cfg, log, driveClient })
  registerSuiteTool(server, { cfg, log, imap, driveClient, passwordResolver, bridgeCfg })
  registerEcosystemTools(server, { log })

  if (cfg.products.mail.enabled) {
    const bridgeClient = new BridgeClient('protonmail-bridge-core', log)
    registerBridgeTools(register, bridgeClient, log)
  }

  return {
    server,
    imap,
    smtp,
    ...(driveClient !== undefined ? { drive: driveClient } : {}),
  }


}

// ---------------------------------------------------------------------------
// Bridge tools — 6 MCP tools for Proton Mail Bridge management
// ---------------------------------------------------------------------------

type RegisterFn = typeof McpServer.prototype.registerTool

export function registerBridgeTools(
  register: RegisterFn,
  bridge: BridgeClient,
  _log: ReturnType<typeof createLogger>,
) {
  register(
    'proton_bridge_health',
    {
      title: 'Bridge health check',
      description:
        'Checks if Proton Mail Bridge is running, ports are listening, and IMAP auth works.',
      inputSchema: {
        response_format: z.enum(['markdown', 'json']).default('markdown'),
      },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ response_format }) => {
      const h = await bridge.health()
      if (response_format === 'json') {
        return {
          content: [{ type: 'text', text: JSON.stringify(h, null, 2) }],
          structuredContent: h,
        }
      }
      const lines = [
        '# Proton Bridge Health',
        '',
        `- OK: ${h.ok}`,
        `- Process running: ${h.processRunning}`,
        `- IMAP listening: ${h.imapListening}`,
        `- SMTP listening: ${h.smtpListening}`,
        `- Auth OK: ${h.authOk}`,
      ]
      if (h.error) lines.push(`- Error: ${h.error}`)
      return { content: [{ type: 'text', text: lines.join('\n') }] }
    },
  )

  register(
    'proton_bridge_status',
    {
      title: 'Bridge full status',
      description:
        'Returns combined info + health of the Bridge process in a single call.',
      inputSchema: {
        response_format: z.enum(['markdown', 'json']).default('markdown'),
      },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ response_format }) => {
      const st = await bridge.status()
      if (response_format === 'json') {
        return {
          content: [{ type: 'text', text: JSON.stringify(st, null, 2) }],
          structuredContent: st,
        }
      }
      const lines = [
        '# Proton Bridge Status',
        '',
        `- User: ${st.user ?? '(none)'}`,
        `- Version: ${st.version ?? 'unknown'}`,
        `- Process running: ${st.processRunning}`,
        `- IMAP listening: ${st.imapListening}`,
        `- SMTP listening: ${st.smtpListening}`,
        `- Auth OK: ${st.authOk}`,
      ]
      return { content: [{ type: 'text', text: lines.join('\n') }] }
    },
  )

  register(
    'proton_bridge_info',
    {
      title: 'Bridge info',
      description:
        'Returns Bridge version, user, and connection ports from the CLI.',
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async () => {
      const info = await bridge.info()
      return {
        content: [
          {
            type: 'text',
            text: [
              '# Proton Bridge Info',
              '',
              `- User: ${info.user ?? '(none)'}`,
              `- Version: ${info.version ?? 'unknown'}`,
              `- IMAP port: ${info.imapPort ?? 'N/A'}`,
              `- SMTP port: ${info.smtpPort ?? 'N/A'}`,
            ].join('\n'),
          },
        ],
        structuredContent: info,
      }
    },
  )

  register(
    'proton_bridge_login',
    {
      title: 'Login to Bridge',
      description:
        'Performs interactive login against Proton Mail Bridge. Provide user and password; include TOTP if 2FA is required.',
      inputSchema: {
        user: z.email(),
        password: z.string(),
        totp: z.string().optional(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: true,
      },
    },
    async ({ user, password, totp }) => {
      const result = await bridge.login(user, password, totp)
      return {
        content: [
          {
            type: 'text',
            text: result.ok
              ? `Login successful: ${result.message}`
              : `Login failed: ${result.message}${result.needs2FA ? ' (2FA required)' : ''}`,
          },
        ],
        structuredContent: result,
      }
    },
  )

  register(
    'proton_bridge_logout',
    {
      title: 'Logout from Bridge',
      description: 'Logs out the current session from Proton Mail Bridge.',
      inputSchema: {},
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: true,
      },
    },
    async () => {
      const result = await bridge.logout()
      return {
        content: [
          {
            type: 'text',
            text: result.ok ? 'Logged out' : 'Logout failed',
          },
        ],
        structuredContent: result,
      }
    },
  )

  register(
    'proton_bridge_accounts',
    {
      title: 'List Bridge accounts',
      description:
        'Lists all Proton accounts currently configured in Bridge with their connection state.',
      inputSchema: {
        response_format: z.enum(['markdown', 'json']).default('markdown'),
      },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ response_format }) => {
      const accounts = await bridge.listAccounts()
      if (response_format === 'json') {
        return {
          content: [{ type: 'text', text: JSON.stringify(accounts, null, 2) }],
          structuredContent: { accounts },
        }
      }
      const lines = ['# Proton Bridge Accounts', '']
      if (accounts.length === 0) {
        lines.push('No accounts configured.')
      } else {
        for (const a of accounts) {
          lines.push(`- ${a.user}: ${a.state}`)
        }
      }
      return { content: [{ type: 'text', text: lines.join('\n') }] }
    },
  )
}
