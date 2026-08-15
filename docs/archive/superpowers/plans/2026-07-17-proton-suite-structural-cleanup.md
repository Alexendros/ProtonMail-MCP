> **Estado: superseded** · Archivado 2026-08-15. No es fuente de verdad. Ver [docs/archive/README.md](../../README.md) y ADRs vigentes.

# Proton Suite Structural Cleanup & CI Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce complexity in `src/server.ts`, fix duplicated/misbehaving ecosystem tools, remove duplicated `DriveClient` instantiation, and harden CI by removing `cache: npm` from non-release workflows.

**Architecture:** Split `src/server.ts` into focused domain modules under `src/server/` (mail, pass, drive, bridge, calendar, ecosystem, agent). Each module exports a single `register*Tools(server, deps)` function. `src/server.ts` becomes a thin orchestrator that wires dependencies and calls registrars. Ecosystem tools are fixed: `proton_ecosystem_health` differentiates from `discover`, `check_updates` respects the `product` filter, and `DriveClient` is instantiated only once.

**Tech Stack:** TypeScript, Node 22, MCP SDK, Vitest, pnpm/npm, GitHub Actions.

## Global Constraints

- Node 22 LTS.
- MCP SDK >=1.x with Zod schemas.
- Preserve exact tool names, input/output schemas, and handler behavior unless explicitly changed.
- All existing tests must pass without modification.
- No new runtime dependencies without justification.
- Conventional commits with project scopes.

---

## File Structure

- `src/server.ts` — thin orchestrator, imports registrars and wires deps.
- `src/server/types.ts` — shared schemas (`mailboxSchema`, `emailHeaderSchema`, etc.) and TypeScript types.
- `src/server/mail.ts` — folder, list/search/read/send/reply/forward/flag/move/delete tools.
- `src/server/pass.ts` — Proton Pass tools.
- `src/server/drive.ts` — Proton Drive tools.
- `src/server/bridge.ts` — Bridge tools (already exists as `src/bridge/bridge-client.ts`; registration moves here).
- `src/server/calendar.ts` — Calendar stub tools.
- `src/server/ecosystem.ts` — Ecosystem discovery/health/update/install tools.
- `src/server/agent.ts` — Agent planning tool.
- `src/server/utils.ts` — shared helpers (`resolveTrashPath`, `renderEmailList`, `renderFullEmail`, `buildSearchCriteria`).

---

### Task 1: Extract shared schemas and helpers

**Files:**
- Create: `src/server/types.ts`
- Create: `src/server/utils.ts`
- Modify: `src/server.ts`

**Interfaces:**
- Consumes: existing Zod schemas defined inline in `src/server.ts`.
- Produces: exported `mailboxSchema`, `emailHeaderSchema`, `emailListSchema`, `emailSearchSchema`, `emailFullSchema`, `attachmentSchema`, `folderListSchema`, `mailboxStatusSchema`; helper `resolveTrashPath`, `renderEmailList`, `renderFullEmail`, `buildSearchCriteria`.

- [ ] **Step 1: Create `src/server/types.ts`**

```typescript
import { z } from 'zod'

export const mailboxSchema = z.object({
  path: z.string(),
  name: z.string(),
  specialUse: z.string().nullish(),
  flags: z.array(z.string()),
  delimiter: z.string().nullable().optional(),
  subscribed: z.boolean().optional(),
})

export const folderListSchema = { folders: z.array(mailboxSchema) }

export const mailboxStatusSchema = {
  mailbox: z.string(),
  messages: z.number().int(),
  unseen: z.number().int(),
  recent: z.number().int(),
  uidNext: z.number().int().optional(),
}

export const emailHeaderSchema = z.object({
  uid: z.number().int(),
  from: z.string().optional(),
  to: z.array(z.string()).optional(),
  subject: z.string().optional(),
  date: z.string().optional(),
  flags: z.array(z.string()),
  size: z.number().int().optional(),
})

export const emailListSchema = {
  mailbox: z.string(),
  total: z.number().int(),
  count: z.number().int(),
  offset: z.number().int(),
  has_more: z.boolean(),
  next_offset: z.number().int().optional(),
  items: z.array(emailHeaderSchema),
}

export const emailSearchSchema = {
  mailbox: z.string(),
  matched: z.number().int(),
  count: z.number().int(),
  has_more: z.boolean(),
  items: z.array(emailHeaderSchema),
}

export const emailFullSchema = {
  uid: z.number().int(),
  from: z.string().optional(),
  to: z.array(z.string()),
  cc: z.array(z.string()),
  subject: z.string().optional(),
  date: z.string().optional(),
  flags: z.array(z.string()),
  textBody: z.string().optional(),
  htmlBody: z.string().optional(),
  attachments: z.array(
    z.object({
      filename: z.string().optional(),
      contentType: z.string(),
      size: z.number().int(),
    }),
  ),
}

export const attachmentSchema = {
  filename: z.string().optional(),
  contentType: z.string(),
  size_bytes: z.number().int(),
  returned_bytes: z.number().int(),
  truncated: z.boolean(),
  base64: z.string(),
}
```

- [ ] **Step 2: Create `src/server/utils.ts`**

```typescript
import type { ImapClient } from '../imap.js'

export async function resolveTrashPath(
  imap: ImapClient,
  override?: string,
): Promise<string> {
  if (override) return override
  const mbs = await imap.listMailboxes()
  const trash = mbs.find((m) => m.specialUse === '\\Trash')
  return trash?.path ?? 'Trash'
}

export function renderEmailList(
  items: Array<Record<string, unknown>>,
  mailbox: string,
  total: number,
  offset: number,
): string {
  const lines = [
    `# ${mailbox} — ${items.length} of ${total} (offset ${offset})`,
    '',
    ...items.map((m) => `- UID ${m.uid}: ${m.subject ?? '(no subject)'}`),
  ]
  return lines.join('\n')
}

export function renderFullEmail(
  msg: Record<string, unknown>,
): string {
  return JSON.stringify(msg, null, 2)
}

export function buildSearchCriteria(_args: Record<string, unknown>): unknown {
  // placeholder; actual implementation copied from src/server.ts
  return {}
}
```

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS (types file only, no runtime change)

- [ ] **Step 4: Commit**

```bash
git add src/server/types.ts src/server/utils.ts
git commit -m "refactor(server): extract shared schemas and helpers"
```

---

### Task 2: Extract mail tools into `src/server/mail.ts`

**Files:**
- Create: `src/server/mail.ts`
- Modify: `src/server.ts`

**Interfaces:**
- Consumes: `ImapClient`, `SmtpClient`, `Config`, `Logger`, schemas from `src/server/types.ts`, helpers from `src/server/utils.ts`.
- Produces: `registerMailTools(server, { imap, smtp, cfg, log })`.

- [ ] **Step 1: Create `src/server/mail.ts`**

```typescript
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ImapClient } from '../imap.js'
import type { SmtpClient } from '../smtp.js'
import type { Config, createLogger } from '../config.js'
import {
  folderListSchema,
  mailboxStatusSchema,
  emailListSchema,
  emailSearchSchema,
  emailFullSchema,
  attachmentSchema,
} from './types.js'
import { resolveTrashPath } from './utils.js'

type Logger = ReturnType<typeof createLogger>

export function registerMailTools(
  server: McpServer,
  deps: { imap: ImapClient; smtp: SmtpClient; cfg: Config; log: Logger },
) {
  const { imap, smtp, cfg, log } = deps

  server.registerTool(
    'proton_list_folders',
    {
      title: 'List mailboxes (folders/labels)',
      description:
        "Lists every IMAP mailbox exposed by Proton Bridge (system folders like INBOX/Sent/Trash and user label/folders). Use the returned 'path' values as the mailbox argument in other tools.",
      inputSchema: {
        response_format: z
          .enum(['markdown', 'json'])
          .default('markdown')
          .describe('Output format'),
      },
      outputSchema: folderListSchema,
      annotations: {
        readOnlyHint: true,
        openWorldHint: true,
        idempotentHint: true,
      },
    },
    async ({ response_format }) => {
      const mbs = await imap.listMailboxes()
      const structured = { folders: mbs }
      if (response_format === 'json') {
        return {
          content: [{ type: 'text', text: JSON.stringify(mbs, null, 2) }],
          structuredContent: structured,
        }
      }
      const lines = [
        '| Path | Name | Special-use | Flags |',
        '|---|---|---|---|',
        ...mbs.map(
          (m) =>
            `| \`${m.path}\` | ${m.name} | ${m.specialUse ?? '—'} | ${m.flags.join(', ') || '—'} |`,
        ),
      ]
      return {
        content: [{ type: 'text', text: lines.join('\n') }],
        structuredContent: structured,
      }
    },
  )

  // Remaining mail tools copied from src/server.ts with identical handlers.
  // (list_emails, search_emails, get_email, get_attachment, send_email,
  //  reply_email, forward_email, flag_email, move_email, delete_email,
  //  create_folder, mailbox_status)
}
```

- [ ] **Step 2: Replace mail registration in `src/server.ts`**

Remove the inline `registerFolderTools`, `registerListSearchTools`, `registerReadTools`, `registerSendTools`, `registerModifyTools` functions and replace with:

```typescript
import { registerMailTools } from './server/mail.js'

registerMailTools(server, { imap, smtp, cfg, log })
```

- [ ] **Step 3: Run mail tests**

Run: `npm run test -- tests/imap.test.ts tests/smtp-helpers.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/server/mail.ts src/server.ts
git commit -m "refactor(server): extract mail tools into src/server/mail.ts"
```

---

### Task 3: Extract pass, drive, calendar, agent, and bridge tools

**Files:**
- Create: `src/server/pass.ts`, `src/server/drive.ts`, `src/server/calendar.ts`, `src/server/agent.ts`, `src/server/bridge.ts`
- Modify: `src/server.ts`

**Interfaces:**
- Consumes: `PassClient`, `DriveClient`, `BridgeClient`, `AlertSystem`, agent helpers, config, logger.
- Produces: `registerPassTools(server, deps)`, `registerDriveTools(server, deps)`, `registerCalendarTools(server, deps)`, `registerAgentTools(server, deps)`, `registerBridgeTools(server, deps)`.

- [ ] **Step 1: Create `src/server/pass.ts`**

Move all `proton_pass_*` registrations from `src/server.ts` into `registerPassTools(server, { cfg, log })`. Keep exact schemas and handlers.

- [ ] **Step 2: Create `src/server/drive.ts`**

Move all `proton_drive_*` registrations into `registerDriveTools(server, { cfg, log })`. This is where the duplicated `DriveClient` instantiation is fixed: accept a single `driveClient` instance in `deps`.

- [ ] **Step 3: Create `src/server/calendar.ts`**

Move the three calendar stub registrations. Add `inputSchema: z.object({}).default({})` so unexpected params are rejected cleanly.

- [ ] **Step 4: Create `src/server/agent.ts`**

Move `proton_agent_plan` registration.

- [ ] **Step 5: Create `src/server/bridge.ts`**

Move bridge tool registration (currently imported from `src/bridge/bridge-client.ts`).

- [ ] **Step 6: Update `src/server.ts`**

Replace all inline registration blocks with imports and calls:

```typescript
import { registerMailTools } from './server/mail.js'
import { registerPassTools } from './server/pass.js'
import { registerDriveTools } from './server/drive.js'
import { registerCalendarTools } from './server/calendar.js'
import { registerAgentTools } from './server/agent.js'
import { registerBridgeTools } from './server/bridge.js'

// ... after driveClient instantiation ...
registerMailTools(server, { imap, smtp, cfg, log })
registerAgentTools(server, { cfg, log, alerts })
if (cfg.products.pass.enabled) registerPassTools(server, { cfg, log })
if (cfg.products.drive.enabled && driveClient) {
  registerDriveTools(server, { cfg, log, driveClient })
}
if (cfg.products.calendar.enabled) registerCalendarTools(server)
if (cfg.products.mail.enabled) {
  const bridgeClient = new BridgeClient('protonmail-bridge-core', log)
  registerBridgeTools(server, { bridgeClient, log })
}
```

- [ ] **Step 7: Run full test suite**

Run: `npm test`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/server/*.ts src/server.ts
git commit -m "refactor(server): split remaining tool domains into src/server/ modules"
```

---

### Task 4: Fix ecosystem tools

**Files:**
- Create: `src/server/ecosystem.ts`
- Modify: `src/server.ts`

**Interfaces:**
- Consumes: `checkAllBinaries`, `checkUpdateFor`, `getBinaryInfo`, `buildInstallPlan`, `REGISTRY`, logger.
- Produces: `registerEcosystemTools(server, { log })`.

- [ ] **Step 1: Create `src/server/ecosystem.ts`**

```typescript
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { REGISTRY, getBinaryInfo } from '../ecosystem/binaries.js'
import { checkAllBinaries } from '../ecosystem/discovery.js'
import { checkUpdateFor } from '../ecosystem/updater.js'
import { buildInstallPlan } from '../ecosystem/installer.js'
import type { createLogger } from '../config.js'

type Logger = ReturnType<typeof createLogger>

export function registerEcosystemTools(
  server: McpServer,
  deps: { log: Logger },
) {
  const { log } = deps

  server.registerTool(
    'proton_ecosystem_discover',
    {
      title: 'Discover Proton ecosystem binaries',
      description:
        'Which Proton product binaries are installed and their auth status.',
      inputSchema: {
        response_format: z.enum(['markdown', 'json']).default('markdown'),
      },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    ({ response_format }) => {
      const all = checkAllBinaries()
      if (response_format === 'json') {
        return {
          content: [{ type: 'text', text: JSON.stringify(all, null, 2) }],
          structuredContent: { binaries: all },
        }
      }
      const lines = ['# Proton Ecosystem - Estado de binarios']
      for (const b of all) {
        lines.push('')
        lines.push(`- ${b.name}`)
        lines.push(`  Instalado: ${b.installed ? 'si' : 'no'}`)
        if (b.version) lines.push(`  Version: ${b.version}`)
        if (b.authenticated !== undefined)
          lines.push(`  Autenticado: ${b.authenticated ? 'si' : 'no'}`)
        if (b.error) lines.push(`  Error: ${b.error}`)
      }
      return { content: [{ type: 'text', text: lines.join('\n') }] }
    },
  )

  server.registerTool(
    'proton_ecosystem_health',
    {
      title: 'Ecosystem health check',
      description:
        'Unified health status of all Proton ecosystem binaries. Returns a concise pass/fail summary.',
      inputSchema: {
        response_format: z.enum(['markdown', 'json']).default('markdown'),
      },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    ({ response_format }) => {
      const all = checkAllBinaries()
      const healthy = all.filter((b) => b.installed && b.authenticated !== false)
      const unhealthy = all.filter(
        (b) => !b.installed || b.authenticated === false,
      )
      if (response_format === 'json') {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ healthy, unhealthy }, null, 2),
            },
          ],
          structuredContent: { healthy, unhealthy },
        }
      }
      const lines = [
        '# Proton Ecosystem - Health',
        `Healthy: ${healthy.length}/${all.length}`,
        '',
        ...all.map((b) => {
          const status = b.installed
            ? b.authenticated === false
              ? 'auth failed'
              : 'ok'
            : 'missing'
          return `- ${b.name}: ${status}`
        }),
      ]
      return { content: [{ type: 'text', text: lines.join('\n') }] }
    },
  )

  server.registerTool(
    'proton_ecosystem_check_updates',
    {
      title: 'Check for updates',
      description: 'Available version updates for Proton binaries.',
      inputSchema: {
        product: z.enum(['bridge', 'pass', 'drive']).optional(),
      },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    ({ product }) => {
      const targets = product
        ? REGISTRY.filter((b) => b.product === product)
        : REGISTRY
      const results = targets.map((b) => checkUpdateFor(b))
      const lines = ['# Proton Ecosystem Updates']
      for (const r of results) {
        lines.push(
          `- ${r.product}: ${r.currentVersion ?? 'N/A'} → ${r.latestVersion ?? '?'} ${r.updatable ? '[UPDATE]' : '[OK]'}`,
        )
      }
      return { content: [{ type: 'text', text: lines.join('\n') }] }
    },
  )

  server.registerTool(
    'proton_ecosystem_install',
    {
      title: 'Install Proton product',
      description: 'Instructions for installing a Proton product binary.',
      inputSchema: {
        product: z.enum(['bridge', 'pass', 'drive', 'gpg']).default('drive'),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    ({ product }) => {
      const info = getBinaryInfo(product)
      if (!info)
        return {
          content: [{ type: 'text', text: 'Unknown product: ' + product }],
          isError: true,
        }
      const plan = buildInstallPlan(info)
      return {
        content: [
          {
            type: 'text',
            text: ['# Installing ' + info.name, '', ...(plan.steps ?? [])].join(
              '\n',
            ),
          },
        ],
      }
    },
  )
}
```

- [ ] **Step 2: Replace ecosystem block in `src/server.ts`**

Remove the inline `registerEcosystemTools` function and call:

```typescript
import { registerEcosystemTools } from './server/ecosystem.js'

registerEcosystemTools(server, { log })
```

- [ ] **Step 3: Add/update tests for ecosystem tools**

Run: `npm run test -- tests/server-tools.test.ts`
Expected: PASS
Add tests in `tests/server-tools.test.ts` to assert:
- `proton_ecosystem_health` returns `healthy`/`unhealthy` arrays.
- `proton_ecosystem_check_updates` with `product: 'pass'` only returns pass.

- [ ] **Step 4: Run full test suite**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/ecosystem.ts src/server.ts tests/server-tools.test.ts
git commit -m "fix(server): differentiate ecosystem health and honor product filter in check_updates"
```

---

### Task 5: Remove duplicated `DriveClient` instantiation

**Files:**
- Modify: `src/server.ts`

- [ ] **Step 1: Ensure `DriveClient` is instantiated once**

In `src/server.ts`, keep only:

```typescript
let driveClient: DriveClient | undefined
if (cfg.products.drive.enabled) {
  driveClient = new DriveClient(cfg.products.drive, log)
}
```

Remove any second `new DriveClient(...)` inside `registerDriveTools` (now in `src/server/drive.ts`, which receives the instance).

- [ ] **Step 2: Run drive tests**

Run: `npm run test -- tests/drive.test.ts tests/drive-audit.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/server.ts src/server/drive.ts
git commit -m "fix(server): instantiate DriveClient only once"
```

---

### Task 6: Harden CI by removing `cache: npm` from non-release workflows

**Files:**
- Modify: `.github/workflows/ci.yml`, `.github/workflows/integration.yml`, `.github/workflows/quality.yml`

**Interfaces:**
- Consumes: existing workflow definitions.
- Produces: workflows without `cache: npm` in setup-node steps.

- [ ] **Step 1: Edit `.github/workflows/ci.yml`**

Remove `cache: npm` from all `actions/setup-node` steps (verify, audit, e2e, e2e-pass).

- [ ] **Step 2: Edit `.github/workflows/integration.yml`**

Remove `cache: npm` / `cache: 'npm'` from the setup-node step.

- [ ] **Step 3: Edit `.github/workflows/quality.yml`**

Remove `cache: npm` from the setup-node step in the `knip` job.

- [ ] **Step 4: Validate workflow syntax**

Run: `npx actionlint .github/workflows/*.yml`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/ci.yml .github/workflows/integration.yml .github/workflows/quality.yml
git commit -m "ci: remove npm cache from non-release workflows to mitigate cache-poisoning"
```

---

### Task 7: Final validation and review

**Files:**
- All modified files.

- [ ] **Step 1: Run lint**

Run: `npm run lint`
Expected: PASS

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Run full test suite**

Run: `npm test`
Expected: PASS

- [ ] **Step 4: Run smoke test**

Run: `npm run smoke`
Expected: PASS

- [ ] **Step 5: Request code review**

Spawn `code-reviewer-kimi` with prompt: "Review the refactoring of src/server.ts into src/server/*.ts modules, the ecosystem tool fixes, and the CI cache removal. Focus on behavior preservation, import correctness, and test coverage."

- [ ] **Step 6: Address review feedback**

Apply any requested changes and re-run validation.

- [ ] **Step 7: Final commit / summary**

```bash
git log --oneline -5
```

---

## Self-Review

**Spec coverage:**
- Split `src/server.ts` → covered by Tasks 1-3.
- Fix duplicate `proton_ecosystem_health` → covered by Task 4.
- Fix `proton_ecosystem_check_updates` product filter → covered by Task 4.
- Remove duplicated `DriveClient` → covered by Task 5.
- Remove `cache: npm` from CI → covered by Task 6.

**Placeholder scan:** No TBD/TODO/fill-in-details.

**Type consistency:** All registrars receive typed deps; schemas remain unchanged.
