/**
 * Calendar tools — STUB implementation.
 *
 * Proton Calendar uses an E2E-encrypted proprietary sync protocol, NOT
 * standard CalDAV. No third-party client (including this one) can
 * connect to Proton Calendar directly.
 *
 * Future: a non-Proton CalDAV backend (Nextcloud/iCloud/Fastmail) routed
 * via tsdav could be added. For now, three tools are registered so MCP
 * clients can discover them: they always return `{ available: false }`
 * with an explanatory message.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { createLogger } from '../config.js'

type Logger = ReturnType<typeof createLogger>

export function registerCalendarTools(
  server: McpServer,
  deps: { log: Logger; enabled: boolean },
) {
  if (!deps.enabled) return

  deps.log.warn(
    'Calendar tools are stubs — Proton Calendar uses E2E-encrypted sync, not standard CalDAV.',
  )

  const unavailable = JSON.stringify({
    available: false,
    reason:
      'Proton Calendar uses E2E-encrypted sync, not standard CalDAV. No third-party client can connect to Proton Calendar directly.',
  })

  for (const t of [
    'proton_calendar_list_events',
    'proton_calendar_create_event',
    'proton_calendar_list_calendars',
  ]) {
    server.registerTool(
      t,
      {
        title: t,
        description: `[STUB] ${t} — Proton Calendar does not expose standard CalDAV.`,
        inputSchema: {},
        annotations: { readOnlyHint: true, openWorldHint: true },
      },
      () => ({ content: [{ type: 'text', text: unavailable }] }),
    )
  }
}
