/**
 * Generador de documentación del contrato MCP (tools/schemas).
 *
 * Construye el registro de tools con dobles de prueba (mock clients) — posible
 * porque las tools se registran sobre interfaces inyectables
 * (`src/clients/interfaces.ts`) — e inspecciona el registro resultante para
 * emitir `docs/api/mcp-tools.md` a partir de los schemas Zod declarados.
 *
 * NO requiere Bridge, pass, ni proton-drive: los handlers nunca se invocan,
 * solo se capturan los schemas declarados en `server.registerTool(...)`.
 *
 * Salida determinista (sin timestamps) → usable como CI gate
 * (`git diff --exit-code docs/api/mcp-tools.md`).
 *
 * Requiere `dist/` compilado (`pnpm build`). En CI: `pnpm build && pnpm docs:generate`.
 */
import { tmpdir } from 'node:os'
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import { loadConfig, createLogger } from '../dist/config.js'
import { VERSION } from '../dist/version.js'
import { AlertSystem } from '../dist/alerts/index.js'
import { registerMailTools } from '../dist/server/mail.js'
import { registerPassTools } from '../dist/server/pass.js'
import { registerCalendarTools } from '../dist/server/calendar.js'
import { registerDriveTools } from '../dist/server/drive.js'
import { registerSuiteTool } from '../dist/server/suite.js'
import { registerAgentTools } from '../dist/server/agent.js'
import { registerEcosystemTools } from '../dist/server/ecosystem.js'
import { registerBridgeTools } from '../dist/server/bridge.js'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = resolve(ROOT, 'docs/api/mcp-tools.md')

// Env mínima y válida para que loadConfig() pase la validación Zod. Los valores
// son ficticios: los handlers (que usan clientes reales) nunca se invocan.
process.env.PROTON_BRIDGE_USER = 'docs@proton.me'
process.env.PROTON_BRIDGE_PASS = 'docs'
process.env.PROTON_MAIL_FROM = 'docs@proton.me'
process.env.PROTON_PASS_ENABLED = 'true'
process.env.PROTON_PASS_STORE_DIR = resolve(tmpdir(), 'proton-docs-gen-pass')
process.env.ALERT_LOG_DIR = resolve(tmpdir(), 'proton-docs-gen-alerts')
process.env.DRIVE_ENABLED = 'true'
process.env.DRIVE_STAGING_DIR = resolve(tmpdir(), 'proton-docs-gen-drive')
process.env.PROTON_CALENDAR_ENABLED = 'true'
process.env.PROTON_CALENDAR_EXPERIMENTAL = 'true'
process.env.AGENT_DRY_RUN = 'true'
process.env.LOG_LEVEL = 'error'

const cfg = loadConfig()
const log = createLogger(cfg.logLevel)

// Captures tool registrations: registerTool(name, config, handler) → stores config.
const captured = []
const fakeServer = {
  registerTool: (name, config, _handler) => captured.push({ ...config, name }),
}
// registerBridgeTools recibe la función `register` directamente.
const fakeRegister = (name, config) => captured.push({ ...config, name })

// Doubles de prueba vacíos: los handlers que los usan no se invocan.
const mockImap = {}
const mockSmtp = {}
const mockDrive = {}
const mockPass = {}
const mockBridge = {}
const alerts = new AlertSystem(cfg.alerts, log)

const groups = []
function runGroup(label, fn) {
  const before = captured.length
  fn()
  for (const t of captured.slice(before)) groups.push({ group: label, ...t })
}

runGroup('Mail', () =>
  registerMailTools(fakeServer, { cfg, log, imap: mockImap, smtp: mockSmtp }),
)
runGroup('Pass', () => registerPassTools(fakeServer, { cfg, log }))
runGroup('Calendar', () =>
  registerCalendarTools(fakeServer, {
    log,
    enabled: true,
    experimental: true,
  }),
)
runGroup('Drive', () =>
  registerDriveTools(fakeServer, { cfg, log, driveClient: mockDrive }),
)
runGroup('Suite', () =>
  registerSuiteTool(fakeServer, {
    cfg,
    log,
    imap: mockImap,
    driveClient: mockDrive,
    passwordResolver: () => Promise.resolve(''),
    bridgeCfg: cfg.products.mail.bridge,
    passClient: mockPass,
  }),
)
runGroup('Agent', () => registerAgentTools(fakeServer, { cfg, log, alerts }))
runGroup('Ecosystem', () => registerEcosystemTools(fakeServer, { log }))
runGroup('Bridge', () => registerBridgeTools(fakeRegister, mockBridge, log))

// Dedupe por nombre conservando el primer orden de registro.
const seen = new Set()
const tools = []
for (const t of groups) {
  if (seen.has(t.name)) continue
  seen.add(t.name)
  tools.push(t)
}

// ---------------------------------------------------------------------------
// Render helpers (Zod 4 → JSON Schema via z.toJSONSchema)
// ---------------------------------------------------------------------------

function typeName(prop) {
  if (!prop) return 'unknown'
  if (prop.type) return Array.isArray(prop.type) ? prop.type.join(' | ') : String(prop.type)
  if (prop.$ref) return prop.$ref.replace(/^#\/\$defs\//, '').replace(/^#\/definitions\//, '')
  if (prop.const !== undefined) return `\`${JSON.stringify(prop.const)}\``
  if (Array.isArray(prop.enum))
    return `enum: ${prop.enum.map((e) => `\`${JSON.stringify(e)}\``).join(' | ')}`
  if (Array.isArray(prop.anyOf)) return prop.anyOf.map(typeName).join(' | ')
  if (Array.isArray(prop.oneOf)) return prop.oneOf.map(typeName).join(' | ')
  if (prop.items) return `array<${typeName(prop.items)}>`
  return 'object'
}

function paramsTable(schema) {
  const props = schema?.properties || {}
  const required = new Set(schema?.required || [])
  const keys = Object.keys(props)
  if (keys.length === 0) return '_This tool takes no arguments._'
  const rows = keys.map((name) => {
    const prop = props[name]
    const def = prop?.default !== undefined ? `\`${JSON.stringify(prop.default)}\`` : ''
    const desc = prop?.description || ''
    return `| \`${name}\` | ${typeName(prop)} | ${required.has(name) ? 'required' : 'optional'} | ${def} | ${desc} |`
  })
  return (
    '| Parameter | Type | Required | Default | Description |\n' +
    '|---|---|---|---|---|\n' +
    rows.join('\n')
  )
}

function hintsTable(annotations) {
  const a = annotations || {}
  const hints = []
  if (a.readOnlyHint !== undefined) hints.push(`readOnly: ${a.readOnlyHint}`)
  if (a.destructiveHint !== undefined) hints.push(`destructive: ${a.destructiveHint}`)
  if (a.idempotentHint !== undefined) hints.push(`idempotent: ${a.idempotentHint}`)
  if (a.openWorldHint !== undefined) hints.push(`openWorld: ${a.openWorldHint}`)
  return hints.length ? hints.join(' · ') : '_no hints_'
}

function renderTool(t) {
  const inputShape = t.inputSchema
  const outputShape = t.outputSchema
  const inputJson = inputShape
    ? z.toJSONSchema(z.object(inputShape), { target: 'jsonSchema2020' })
    : null
  const outputJson = outputShape
    ? z.toJSONSchema(z.object(outputShape), { target: 'jsonSchema2020' })
    : null
  const anchor = t.name.replace(/[^a-z0-9]+/gi, '').toLowerCase()
  return [
    `### \`${t.name}\` {#${anchor}}`,
    '',
    `**Title:** ${t.title || t.name}`,
    `**Hints:** ${hintsTable(t.annotations)}`,
    '',
    t.description ? `**Description:** ${t.description}\n` : '',
    '**Input parameters:**',
    '',
    paramsTable(inputJson),
    '',
    outputJson
      ? '**Output schema:**\n\n```json\n' + JSON.stringify(outputJson, null, 2) + '\n```\n'
      : '',
  ].join('\n')
}

// ---------------------------------------------------------------------------
// Document assembly
// ---------------------------------------------------------------------------

const byGroup = new Map()
for (const t of tools) {
  const arr = byGroup.get(t.group) || []
  arr.push(t)
  byGroup.set(t.group, arr)
}

const doc = []
doc.push('# MCP Tool Contract — Proton Suite Agent')
doc.push('')
doc.push(
  '> Auto-generated from the Zod schemas declared in `src/server/*.ts` via `scripts/generate-docs.mjs`. Do not edit by hand — run `pnpm build && pnpm docs:generate`. Version: ' +
    VERSION +
    '.',
)
doc.push('')
doc.push(`Total tools: **${tools.length}**.`)
doc.push('')
doc.push(
  'Tools are grouped by product domain. Each tool declares `inputSchema`',
)
doc.push(
  '(validated by Zod) and `annotations` (readOnly/destructive/idempotent/openWorld',
)
doc.push('hints) so MCP clients can reason about effects before invoking.')
doc.push('')
doc.push('## Table of contents')
doc.push('')
for (const [group, items] of byGroup) {
  doc.push(`### ${group}`)
  for (const t of items) {
    const anchor = t.name.replace(/[^a-z0-9]+/gi, '').toLowerCase()
    doc.push(`- [\`${t.name}\`](#${anchor})`)
  }
  doc.push('')
}

for (const [group, items] of byGroup) {
  doc.push(`## ${group}`)
  doc.push('')
  for (const t of items) doc.push(renderTool(t), '')
}

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, doc.join('\n') + '\n', 'utf8')
// eslint-disable-next-line no-console
console.log(`Wrote ${OUT} (${tools.length} tools)`)
