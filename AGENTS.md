# AGENTS.md — Proton Suite Agent

> Multi-product MCP server for Proton Suite: Mail (Bridge IMAP/SMTP), Pass
> (pass-cli), Drive (official CLI), Calendar (stub). Lets an AI agent operate
> the mailbox, manage passwords, sync files and classify mail — all local,
> without exfiltrating E2E content.

This file is the canonical context for any AI agent (or human) working in this
repo. It follows the open [`agents.md`](https://agents.md) convention: one
root-level file plus optional per-directory additions. There are no per-directory
`AGENTS.md` files yet.

## TL;DR for contributors

- **Stack:** TypeScript 5.7 strict (`ES2022`/`NodeNext`/`ESM`), Node ≥ 22,
  `@modelcontextprotocol/sdk@^1.29`, `imapflow`, `nodemailer`, `mailparser`,
  `zod`, `express` + `express-rate-limit`. Vitest (745 tests, **98%** coverage,
  95% gate). ESLint flat config (strict).
- **Build:** `pnpm install && pnpm build` → `dist/` (tsc). The source lives in
  `src/`, tests in `tests/`, docs in `docs/`, playbooks in `playbooks/`.
- **Entry points:** `src/index.ts` (MCP server, stdio/HTTP) and
  `src/agent-cli.ts` (autonomous agent CLI: `setup`, `organize`, `pass-audit`,
  `suite-status`, `drive-audit`, …).
- **Never break the stdio contract:** `stdout` is reserved for JSON-RPC. Logs
  go to **stderr** only (`createLogger` in `src/config.ts`).
- **Dry-run by default:** the autonomous agent never mutates unless
  `AGENT_DRY_RUN=false`. Review `proton_agent_plan` first.
- **Secrets:** never log them. `src/security.ts` (`SecretSafety`, `makeSecretLogger`).
  `PassClient` never returns secret values — only `{ found: true }`.
- **Calendar is a stub** because Proton Bridge does not yet expose CalDAV (see
  ADR-005). Do not implement CalDAV until Proton ships it.

## Repository layout

```
src/
  index.ts            # Boot: stdio or HTTP transport. Signal handlers, fail-closed guards.
  http.ts             # Express app: per-session StreamableHTTP transport, bearer auth,
  config.ts           #   origin allowlist, rate-limit (120/min/token), idle eviction (30m), /healthz.
                      #   Zod validation of all env vars; createLogger → stderr.
  config/             #   Product sub-schemas: bridge.ts, pass.ts, drive.ts, calendar.ts.
  server.ts           #   buildServer(): registers all MCP tools on an McpServer.
  server/             #   Per-domain tool registration: mail.ts, pass.ts, drive.ts,
                      #     calendar.ts, bridge.ts, ecosystem.ts, suite.ts, agent.ts
                      #     + types.ts (Zod response schemas), utils.ts (rendering/helpers).
  imap.ts             # ImapClient: imapflow pool + retry/backoff to Bridge.
  smtp.ts             # SmtpClient: nodemailer pool + reply/forward helpers.
  pass.ts             # PassClient: pass-cli wrapper (execFile, no shell, path validation).
  drive.ts            # DriveClient: proton-drive CLI wrapper, {ok:false,error} results.
  security.ts         # SecretSafety (safe paths), makeSecretLogger.
  constants.ts        # Centralized timeouts/buffer/rate-limit/retry tuning.
  clients/            # Ports: interfaces.ts (IImapClient, ISmtpClient, IDriveClient, IPassClient).
  agent/              # Autonomous agent: parser, organizer, classifier, executor.
  alerts/             # AlertSystem: rule-based content detection + sinks (file/webhook/ntfy).
  ecosystem/          # Proton binary discovery, install, update (bridge/pass/drive).
tests/
  *.test.ts           # Unit (default), **/*.integration.ts, **/*.e2e.ts (GreenMail + pass).
scripts/              # Bash: smoke.sh, e2e-greenmail.sh, e2e-pass.sh, diagnose-bridge.sh, install.sh.
docs/                 # ADRs (docs/adr/), security, superpowers, playbooks-style guides.
playbooks/            # Human-readable workflows for the agent.
```

> NOTE: the working tree contains an **in-progress refactor** that splits the
> monolithic `server.ts` into `src/server/*.ts` modules and introduces the
> `src/clients/interfaces.ts` ports layer. Prefer the new layout when adding
> tooling; do not regress it with a wholesale rename.

## How to build, run, test

```bash
pnpm install            # pnpm only (pnpm-workspace.yaml)
pnpm build              # tsc → dist/
pnpm typecheck          # tsc --noEmit (strict)
pnpm lint               # eslint ./src
pnpm test               # vitest run — 745 tests, 95% global gate, current 98%
pnpm test:integration   # vitest.integration.config.ts (GreenMail)
pnpm run test:e2e       # vitest.e2e.config.ts (GreenMail + pass CLI)
pnpm run smoke          # binary stdio initialize + tools/list smoke
pnpm docs:check         # verify docs/api/mcp-tools.md is in sync (CI gate)
```

- Coverage config: `vitest.config.ts` — `lines/branches/statements` gate = 95%.
  Keep ≥ 98%. Adding a source file without tests will trip the gate.
- Local E2E needs GreenMail (IMAP/SMTP) + `pass`/`gnupg`. See
  `scripts/e2e-greenmail.sh` and `scripts/e2e-pass.sh`.

## Conventions

- **ESLint:** flat config (`eslint.config.mjs`), strict. Zero errors. Imports
  ordered via `eslint-plugin-import-x`; use named exports; no relative
  extensions missing from paths. Run `pnpm lint:fix` before committing.
- **Commits:** Conventional Commits, enforced by `commitlint`
  (`commitlint.config.mjs`). Scopes: `imap`, `smtp`, `http`, `agent`, `alerts`,
  `pass`, `config`, `deps`, `release`, `ci`, `docs`, `tests`, `ecosystem`,
  `calendar`, `drive`, `bridge`, `security`, `ecosystem`. Prefix with `fix:`,
  `feat:`, `chore:`, `refactor:`, `docs:`, `test:`.
- **Releases:** Semantic Release (`release.yml`, `.releaserc.json`). Push to
  `main` → versioned release + GitHub release notes + CHANGELOG.
- **Branches:** feature branches; **rebase** onto `main` (no merge commits);
  squash-merge PRs. Prefix: `feat/`, `fix/`, `docs/`, `chore/`, `refactor/`,
  `agent/`.
- **Code style:** prefer `const`; ES modules (`"type": "module"`); named exports;
  no `any` without justification; `exactOptionalPropertyTypes` +
  `noUncheckedIndexedAccess` are ON — respect them (use optional chaining,
  guards).
- **Dependencies:** AGPL-3.0 compatible only. Run `pnpm license-check` /
  `pnpm license-check:prod`. Prefer stdlib/web over new deps.
- **Secrets in code:** never. Env-only, `.env` `0600`. Proton Bridge password
  resolved JIT via Pass (`PROTON_BRIDGE_PASS_PATH`) or the stdio wrapper
  (`connectors/stdio-wrapper.sh.example`).
- **Error handling:** adapters return `{ ok: boolean; error?: string }`
  (e.g. `src/drive.ts`). MCP tools map failures to `{ isError: true, content }`
  or thrown errors. The `register` wrapper in `src/server.ts` adds timing
  debug. Do not introduce a parallel `Result<T,E>` monad in existing adapters
  unless you migrate them wholesale (not recommended — see ADR-004).
- **Tool contracts:** every tool uses a Zod `inputSchema`; read tools accept
  `response_format: "markdown" | "json"` and emit `structuredContent`. See
  `src/server/types.ts` and the generated `docs/api/mcp-tools.md`.

## Gotchas & project-specific notes

- **stdout is JSON-RPC only.** In stdio mode, any `console.log`/`console.error`
  to stdout corrupts the protocol. The logger writes stderr. If you add a
  logger, keep it stderr-bound.
- **Use UIDs, not sequence numbers.** IMAP UIDs are stable across sessions;
  sequence numbers are not. The quickstart enforces this.
- **Proton Bridge is the crypto boundary.** Decryption happens in Bridge on a
  machine you control. Everything downstream operates on plaintext by design —
  do not "improve" this by reaching out to Proton directly.
- **Calendar = stub.** Proton Calendar uses E2E-encrypted sync with no third-party
  CalDAV. The stub registers placeholder tools and returns `{available:false}`.
  See ADR-005. Do not implement CalDAV against Proton until Bridge supports it;
  if you build a CalDAV client for testing, target a standard server
  (Radicale/Nextcloud) only under `tests/` and gate behind a feature flag.
- **Drive speaks the official CLI** (`proton-drive`), not the Proton API. Auth
  is the user's responsibility (`proton-drive auth login` once). Do not store
  Drive tokens.
- **HTTP transport is per-session.** Each `Mcp-Session-Id` gets its own
  `StreamableHTTPServerTransport` + `McpServer`; IMAP/SMTP pools are shared. See
  ADR-002.
- **`AGENT_DRY_RUN=true` default** is a security control, not a UX default. Do
  not change it without an explicit, reviewed reason (ADR-004).
- **`pass`/`gpg` are external binaries.** Tests mock them; E2E installs them via
  apt. Never hardcode their paths.

## Where decisions are recorded

Architecture decisions live as MADR ADRs in [`docs/adr/`](./docs/adr/). Start
there for the *why* behind the transport, ports/adapters, config validation, and
the Calendar stub.

## Related

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — C4-style narrative + threat model.
- [`SECURITY.md`](./SECURITY.md) — threat model, active controls.
- [`docs/agent-quickstart.md`](./docs/agent-quickstart.md) — tool reference for agents.
- [`docs/api/mcp-tools.md`](./docs/api/mcp-tools.md) — generated MCP tool contract.
