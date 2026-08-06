# Arquitectura de Proton Suite Agent

Documento dedicado de arquitectura. El `README.md` da la visión orientada
a uso; aquí se consolida el modelo interno, los flujos y las fronteras de
seguridad. Las decisiones de fondo se registran como ADRs (MADR) en
`docs/adr/` — ver especialmente:
- ADR-002: transporte dual stdio + HTTP per-session (fail-closed auth/origin).
- ADR-003: extracción de puertos/adaptadores (`src/clients/interfaces.ts`).
- ADR-004: validación de config al arranque y dry-run por defecto.
- ADR-005: Calendar CalDAV stub (bloqueado en Proton Bridge).

## 1. Propósito y encaje

`Proton Suite Agent` es un agente multi-producto con un **MCP server embebido**
para Proton Suite: Mail (Bridge IMAP/SMTP), Pass (pass-cli), Calendar (CalDAV
vía Bridge, próximamente) y Drive (API REST, próximamente). Ofrece lectura,
búsqueda, envío, organización, gestión de contraseñas y alertas de contenido
unificadas para todos los productos configurados.
Mail habla IMAP/SMTP contra **Proton Mail Bridge**. Pass se integra
con el estándar Unix `pass` CLI. Proton no ofrece API pública para la mayoría
de sus productos; Bridge resuelve Mail exponiendo IMAP/SMTP locales tras
realizar la criptografía en una máquina que controla el operador.

## 2. Capas

```
Consumidores MCP            stdio: cliente MCP local (agente IA, CLI)
                            HTTP : cliente MCP remoto / backend propio
        │ JSON-RPC                │ HTTPS + Bearer + Origin allowlist
        ▼                         ▼
Proton Suite Agent (TypeScript · @modelcontextprotocol/sdk@^1.29)
   config.ts · auth.ts · http.ts · server.ts
   imap.ts · smtp.ts · pass.ts · calendar.ts · drive.ts
   agent/* · alerts/*
        │ IMAP 1143 STARTTLS      │ SMTP 1025 STARTTLS      │ pass-cli (local)
        ▼                         ▼                         ▼
Proton Mail Bridge  ── FRONTERA CRIPTOGRÁFICA E2E ──   ~/.password-store
        │ OpenPGP + HTTPS
        ▼
Servidores Proton (cifrado E2E)
```

- **Consumidores MCP**: clientes que hablan JSON-RPC vía `stdio` (local) o
  `streamable HTTP` (remoto, con Bearer + allowlist de origen).
- **Proton Suite Agent**: este servidor. Multi-transporte, validación Zod,
  pools persistentes a Bridge, cliente pass-cli, agente autónomo y subsistema
  de alertas multi-producto.
- **Proton Mail Bridge**: corre en host/red controlados por el operador.
  Es la frontera criptográfica: todo lo que queda a su izquierda opera
  sobre correo en claro; nada se filtra a terceros.
- **pass-cli**: gestor de contraseñas Unix estándar. Los secretos se leen
  bajo demanda y nunca se exponen en respuestas MCP ni logs.
- **Servidores Proton**: almacenan el correo cifrado E2E.

## 3. Módulos (`src/`)

| Módulo        | Responsabilidad                                                                                           |
| ------------- | --------------------------------------------------------------------------------------------------------- |
| `index.ts`    | Arranque: elige stdio o HTTP, inicializa clientes por producto, signal handlers, guardrails de producción |
| `config.ts`   | Validación de env con Zod (schema por producto) + logger a stderr                                         |
| `auth.ts`     | `compareTokens` timing-safe + `extractBearer`                                                             |
| `http.ts`     | `buildHttpApp`: Express con per-session StreamableHTTP, rate-limit, origin allowlist                      |
| `imap.ts`     | `ImapClient`: pool imapflow + retry/backoff + mailbox locks                                               |
| `smtp.ts`     | `SmtpClient`: pool nodemailer + helpers de threading (reply/forward)                                      |
| `pass.ts`     | `PassClient`: wrapper sobre `pass` CLI — listar, obtener (sin exponer), generar, health                   |
| `calendar.ts` | `CalendarClient`: stub tipado para CalDAV vía Bridge (próximamente)                                       |
| `drive.ts`    | `DriveClient`: wrapper del binario oficial `proton-drive` (CLI de Proton Drive) para `filesystem list     | download | upload`, `sharing invite`y`auth status` |
| `server.ts`   | `McpServer` con registro condicional de tools por producto (Zod in, markdown/json out)                    |
| `agent/*`     | Parser de goals, setup, clasificación, organización y ejecución del agente multi-producto                 |
| `alerts/*`    | Reglas de contenido, detección de amenazas, webhook y fichero de alertas                                  |

### Claves de diseño

- **Frontera cripto**: la garantía E2E de Proton se preserva porque el
  descifrado ocurre en Bridge, en una máquina del operador. Sólo el agente
  autorizado ve correo descifrado.
- **Per-session HTTP transport**: un `StreamableHTTPServerTransport` por
  `Mcp-Session-Id` (recomendación del SDK), evitando bleed de estado entre
  clientes concurrentes; eviction tras 30 min idle.
- **Pools persistentes IMAP/SMTP**: una conexión a Bridge reutilizada entre
  llamadas, con reconexión por retry + backoff exponencial si Bridge se
  reinicia.
- **Stderr-only logs**: en modo `stdio`, `stdout` queda reservado al
  JSON-RPC; contaminarlo rompería el protocolo. Ningún cuerpo de request ni
  credencial se registra.

## 4. Las tools

> La lista completa, auto-generada y con los schemas JSON de cada tool, está en
> [`docs/api/mcp-tools.md`](./docs/api/mcp-tools.md) (generada con `pnpm docs:generate`).

Las tools de lectura aceptan `response_format: "markdown" | "json"`. Cada
una se registra con `annotations` del SDK (`readOnlyHint`,
`idempotentHint`, `destructiveHint`, `openWorldHint`) para que el modelo
razone sobre el efecto antes de invocar.

La tool `proton_agent_plan` es de solo lectura y expone el plan de
organización y alertas del agente sin aplicar cambios.

| Tool                    | Tipo                | Descripción                                                             |
| ----------------------- | ------------------- | ----------------------------------------------------------------------- |
| `proton_list_folders`   | read                | Lista mailboxes (INBOX, Sent, Trash, labels, custom)                    |
| `proton_create_folder`  | write               | Crea un mailbox nuevo                                                   |
| `proton_mailbox_status` | read                | Contadores: total / unseen / recent                                     |
| `proton_list_emails`    | read                | Lista paginada de mensajes recientes                                    |
| `proton_search_emails`  | read                | Búsqueda con filtros combinables                                        |
| `proton_get_email`      | read                | Mensaje completo: headers, cuerpo, metadata de adjuntos                 |
| `proton_get_attachment` | read                | Adjunto en base64; `max_bytes` 10 MB (cap 50 MB), `truncated` explícito |
| `proton_send_email`     | write               | Envía texto/HTML + adjuntos; `from` fijo (no spoofing)                  |
| `proton_reply_email`    | write               | Responde preservando threading (`In-Reply-To` + `References`)           |
| `proton_forward_email`  | write               | Reenvía opcionalmente con adjuntos originales                           |
| `proton_flag_email`     | write (idempotente) | read/unread/starred/unstarred/flags custom                              |
| `proton_move_email`     | write               | Mueve entre mailboxes por UID                                           |
| `proton_delete_email`   | **destructiva**     | `trash` (reversible) o `permanent` (expunge)                            |
| `proton_agent_plan`     | read                | Plan de organización y alertas del agente (sin aplicar cambios)         |

### Tools Drive (CLI oficial `proton-drive`)

Drive habla con el **CLI oficial** `proton-drive`, que actúa de wrapper del SDK
de Proton Drive. El agente ejecuta el binario (descargado de
`proton.me/support/drive-cli`) en lugar de hablar directamente con la API. El
CLI persiste su propio token en `~/.config/proton-drive`, así que el agente
no necesita credenciales para Drive: basta con que el operador haya hecho
`proton-drive auth login` una vez antes.

| Tool                         | Tipo             | Descripción                                                        |
| ---------------------------- | ---------------- | ------------------------------------------------------------------ |
| `proton_drive_status`        | read             | Estado del binario CLI + staging local (`auth status` + stats)     |
| `proton_drive_list_files`    | read             | Lista archivos de un path remoto (`filesystem list --json`)        |
| `proton_drive_download`      | write idempotent | Descarga un path remoto al staging (`filesystem download`)         |
| `proton_drive_upload`        | write            | Sube el staging a Proton Drive (`filesystem upload`)               |
| `proton_drive_share`         | write idempotent | Invita a un usuario Proton a un path (`sharing invite --user ...`) |
| `proton_drive_audit`         | read             | Inventario + duplicados + formatos obsoletos sobre el staging      |
| `proton_drive_organize`      | write            | Reorganiza el staging por tipo (dry-run por defecto)               |
| `proton_drive_format_report` | read             | Reporte de extensiones y formatos obsoletos del staging            |

### Flujo de una llamada

1. El cliente abre transporte (`stdio` o `POST /mcp` con Bearer).
2. En HTTP: `auth.ts` valida el Bearer timing-safe, se comprueba el Origin
   contra la allowlist y el rate-limit por token.
3. `server.ts` deserializa los argumentos y los valida con el schema Zod de
   la tool.
4. La tool delega en `ImapClient` (`imap.ts`) o `SmtpClient` (`smtp.ts`),
   reutilizando el pool a Bridge.
5. Las tools de agente (`proton_agent_plan`) delegan en `agent/organizer.ts`
   y `alerts/*`, siempre en modo read-only.
6. Bridge resuelve sobre el vault cifrado y devuelve correo en claro al MCP.
7. La respuesta se serializa según `response_format` y vuelve por el
   transporte; los logs van a stderr.

## 5. Despliegue (Docker)

Dos contenedores en `docker-compose.yml`:

- **bridge**: Proton Mail Bridge headless. Imagen `Dockerfile.bridge`
  (extiende `shenxn/protonmail-bridge:build` con libfido2, dbus-x11,
  credential-helpers, libGL/libOpenGL y libs Qt XCB). Requiere un login
  one-off interactivo; el volumen persiste el vault.
- **agent**: este servidor en modo HTTP. Imagen `Dockerfile` (multi-stage
  `node:22-alpine`). Expone el MCP server y, opcionalmente, recibe variables
  de agente (`AGENT_*`, `ALERT_*`) para organización y alertas.

Red `proton-net` interna entre ambos; `proxy-network` externa para que el
reverse proxy (Traefik, Caddy, Nginx, etc.) emita el cert y exponga `/mcp`.
En `NODE_ENV=production` el servidor se niega a arrancar si
`MCP_ALLOWED_ORIGINS` está vacío.

## 6. No-objetivos

- No reimplementa criptografía Proton: delega toda la E2E en Bridge.
- No expone un endpoint HTTP público sin autenticación.
- No permite spoofing del remitente: `from` queda fijo al configurado.
- No envía contenido de correo a modelos o servicios externos para clasificación.
- No ejecuta acciones destructivas en modo autónomo sin confirmación humana
  (modo dry-run por defecto).
- No es un boilerplate genérico de correo; es un cliente específico de
  Proton vía Bridge.

## 7. Seguridad — modelo de amenazas (T1–T9)

Detalle completo y controles en `SECURITY.md`. Resumen:

| Id  | Amenaza                                   | Mitigación principal                                                            |
| --- | ----------------------------------------- | ------------------------------------------------------------------------------- |
| T1  | Robo del bearer MCP                       | Rotación `openssl rand -hex 32` + rate-limit 120/min/token                      |
| T2  | DNS rebinding                             | `MCP_ALLOWED_ORIGINS` exigido en producción                                     |
| T3  | Abuso de relay SMTP                       | Rate-limit + límite diario de Bridge + `from` fijo                              |
| T4  | Prompt injection vía cuerpo de email      | Tratar cuerpos como no confiables; HITL en tools destructivas                   |
| T5  | Robo de credenciales IMAP del entorno     | Secretos solo en deployment secrets / `.env` 0600; rotación vía Bridge          |
| T6  | Exfiltración vía adjuntos en contexto LLM | Cap `max_bytes` (10 MB, hard 50 MB) + revisión del operador                     |
| T7  | Downgrade TLS del canal Bridge local      | Bridge en `127.0.0.1` / red interna; `PROTON_BRIDGE_CA_PATH` para pinning       |
| T8  | Acción autónoma no autorizada             | Modo dry-run por defecto; `AGENT_DRY_RUN=false` requiere confirmación explícita |
| T9  | Hallucinación en clasificación            | Knowledge base local, reglas explicables y umbral de confianza configurable     |

La E2E de Proton se detiene en la frontera de Bridge: todo aguas abajo (este
MCP, el agente, cualquier dashboard) opera sobre texto en claro por diseño.

Los riesgos T8 y T9 son específicos del agente autónomo; ver el baseline de
seguridad de agentes IA en `SECURITY.md`.

## 8. Stack

TypeScript 5.7 (`strict`, `NodeNext`) · Node ≥22 ·
`@modelcontextprotocol/sdk@^1.29` · `imapflow` · `nodemailer` ·
`mailparser` · `zod` · `express` + `express-rate-limit` · Vitest +
`supertest`. CI: matrix Node 20/22 (typecheck, test, build, smoke,
license-check), `npm audit`, CodeQL, docker build; release a GHCR en push a `main`.
