# Changelog

Changelog generado automáticamente por [semantic-release](https://github.com/semantic-release/semantic-release) a partir de los [Conventional Commits](https://www.conventionalcommits.org/).

El formato sigue [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) y [SemVer 2.0.0](https://semver.org/).

## [Unreleased]

### Fixed

- **pipeline:** remove broken reusable workflow references to non-existent plantillas repo
- **coverage-badge:** remove unsupported `logoColor` property from shields.io endpoint
- **release:** restore proper semantic-release flow without manual CHANGELOG/tag step

- **ICalendarAdapter port** in `src/clients/interfaces.ts` (CalDAV seam, interface only — blocked per ADR-005).
- **Contract tests** (`tests/contract/`): validates live MCP tool surface via HTTP/SSE (approach A), 50-tool golden set, deterministic JSON Schema snapshot (`tool-catalog.snap`).
- **Observability**: Prometheus-style `/metrics` endpoint (bearer auth), MCP request/session instrumentation (`src/utils/metrics.ts`).

### Changed

- **Pre-commit** mirrors CI: `.husky/pre-commit` → lint-staged (eslint --fix on src) + typecheck + test suite (934 tests, 98% coverage).
- **ROADMAP.md** updated to v1.2.1.
- **TASKS.md** removed (stale, referenced non-existent worktree).

### Fixed

- **E2E drive tests**: `await` missing on async `DriveAuditor` calls in `tests/e2e/drive.e2e.ts`.
- **`.lintstagedrc.json`**: scope from `*.ts` (included tests) to `src/**/*.ts` (CI-aligned).

## [1.2.1] - 2026-07-20

### Fixed

- Restore truncated `agent.test.ts` after merge conflict.

## [1.2.0] - 2026-07-20

### Added

- **Branch Hunt 2** + ESLint `off→warn` bajo riesgo (coverage improvement).

## [1.1.0] - 2026-07-19

### Changed

- **TypeScript strict flags**: enabled `noImplicitOverride` + `exactOptionalPropertyTypes` in tsconfig.

## [1.0.1] - 2026-07-17

## [1.2.1] - 2026-07-20

- SHA-256 hash for Pass duplicate detection, `--force` on insert/generate.
- `fs.readdir` for Pass `list()`, reject `..` paths, fix e2e path.

## [1.0.0] - 2026-07-12

### BREAKING

- **Rebrand a Proton Suite Agent v1.0.0**: el proyecto abarca Mail, Pass, Calendar y Drive. Package renombrado a `@alexendros/protonsuite-agent`, binarios `protonsuite-*`, repo `agent-protonsuite`. Commit BREAKING CHANGE desde v0.5.0 → bump semver major a v1.0.0.

* restore truncated agent.test.ts after merge conflict

## [1.2.0] - 2026-07-20

### Features

* **coverage:** Branch Hunt 2 + ESLint off→warn bajo riesgo

## [1.1.0] - 2026-07-19

### Features

* **types:** enable noImplicitOverride + exactOptionalPropertyTypes in tsconfig

## [1.0.1] - 2026-07-17

### Bug Fixes

* sha-256 hash for pass duplicate detection, --force on insert/generate
* use fs.readdir for pass list, reject '..' paths, fix e2e path

## [1.0.0] - 2026-07-12

### BREAKING CHANGES

* package name, repository name and license changed

### Features

* rebrand completo a Proton Suite Agent v0.7.0
* **agent:** ecosystem module, full Pass/Drive CLI surface, BridgeClient
* **agent:** drive goals drive-audit, drive-organize, drive-sync
* **agent:** add check-imap goal and improve Bridge diagnostics
* **agent:** state labels and folder-only organization plan
* real Drive MCP tools — audit, status, organize, format-report, sync
* add bridge MCP tools and integration testing infrastructure
* **config:** drive config schema and DriveClient rclone base
* **config:** drive sync pull/push/status/mount
* **tests:** add drive-auditor scan, duplicates, format report, organize plan

### Bug Fixes

* **deps,ci:** nodemailer 6→9 (8 CVEs), unicorn 59→65 (ReDoS)
* **security:** Fases 1-3 de auditoría crítica
* **agent:** apply labels via copy and avoid duplicate category folders
* **agent:** drive sync metrics from stderr, ignore-existing on push, README + handler tests
* **agent:** log scan errors and use relative paths in DriveAuditor
* **agent:** suite-status reports Drive as rclone-backed, not stub
* **agent:** test drive gate and fix sync copy
* **ci:** audit critical-only, install pass in e2e, remove npm publish
* **config:** derive drive enabled from rcloneRemote and use execFileSync in checkDeps
* **deps:** prevent dependabot major bump grouping
* **docs:** correct drive-audit push example and audit output wording
* knip exit-code, dockerfile runtime install, remove stale dep
* **release:** remove @semantic-release/git to fix protected branch GH006
* actualizar referencias a Iniciativas-Alexendros/plantillas

## [0.8.0] - 2026-07-20

### Added

- **Cobertura de tests 98.00%** (+36.3pp desde 61.7%): 889 tests en 43 archivos
- **Tests para agent/organizer.ts** (17 tests): buildOrganizationPlan con mock ImapClient
- **Tests para agent/executor.ts** (6 tests): probar cada goal con configs válidas/inválidas
- **Tests para server/suite.ts** (14 tests): proton_suite_status cross-producto
- **Tests para server/mail.ts** (12 tests): mock ImapClient completo
- **Tests para server/ecosystem.ts** (13 tests): discoverBinarios
- **Tests para server/agent.ts** (5 tests): tool proton_agent_plan
- **Tests para server/pass.ts** (15 tests): mock PassClient
- **Tests para server/drive.ts** (+11 tests): DriveClient mock
- **Tests para ecosystem/discovery.ts** (40 tests): resolveBinPath, checkBinary, etc.
- **Tests para ecosystem/installer.ts** (18 tests): installOnUbuntu
- **Tests para ecosystem/updater.ts** (22 tests): checkUpdateFor, fetchLatestVersion
- **Tests para drive.ts** (24 tests): DriveClient.listFiles/download/upload/etc.
- **Tests para pass.ts** (25 tests): PassClient.list/get/insert/generate/delete/edit/health
- **Tests para alerts/rules.ts** (20 tests): classifyEmail, detectThreats
- **Tests para http.ts** (+14 tests): CORS, session, auth, error handling
- **Drive OAuth tools MCP**: proton_drive_auth_status y proton_drive_auth_login
- **Split de src/config.ts** en sub-módulos por servicio
- **CLI de agente expandido**: src/agent-cli.ts con --help y subcomandos
- **Coverage gate 95%**: vitest config con thresholds globales
- **Sistema de alertas multi-sink** (src/alerts/ntfy.ts)
- **Workflow integration.yml**: tests de integración para Bridge/Drive/Suite

### Changed

- **ESLint endurecimiento completo en src/** (14 reglas off→error)
- **TypeScript strict flags**: noUncheckedIndexedAccess, noPropertyAccessFromIndexSignature, etc.
- **Coverage badge migrado a gh-pages**: endpoint badge dinámico con shields.io
- **Dockerfile**: imagen base node:22-alpine LTS
- **Migración completa de npm a pnpm**: todos los workflows actualizados
- **Hash de duplicados en PassClient**: de djb2 a SHA-256

### Fixed

- **CVE nodemailer 6→9** (8 CVEs) y **unicorn 59→65** (ReDoS)
- **http.ts**: cerrado último gap de branches (ipKeyGenerator anon fallback)
- **Config de Drive**: `drive enabled` derivado de `rcloneRemote`

## [0.7.0] - 2026-07-17

> **Nota:** No existe versión 0.6.0. El salto de 0.5.0 a 0.7.0 fue intencional.

### Added

- **Goal `check-imap`**: verificación de conectividad IMAP y diagnóstico del Bridge

### Changed

- **Rebrand a Proton Suite Agent v0.7.0**: el proyecto abarca Mail, Pass, Calendar y Drive
- **State labels y organización por carpetas**: `organize` ahora usa labels de estado

### Fixed

- **Labels del agente**: evitar categorías duplicadas en la organización

## [0.5.0] - 2026-07-04

### Added

- **Módulo de agente** (`src/agent/`) con goals (`discover`, `setup`, `organize`, `monitor`, `alert`)
- **Sistema de alertas** (`src/alerts/`) con reglas de contenido local y detección de amenazas
- **Tool MCP `proton_agent_plan`** para consultar plan sin aplicar cambios
- **CLI de agente** (`src/agent-cli.ts`)
- **Documentación del agente**: docs/alerting.md, docs/knowledge-base.md, playbooks/

### Changed

- **Rebrand a agente de correo**: paquete `@alexendros/protonmail-agent`
- **Licencia cambiada a AGPL-3.0**

## [0.4.0] - 2026-06-20

### Added

- **`PROTON_BRIDGE_SMTP_SECURITY`** env (starttls/implicit/plain)
- **Real E2E test suite** against GreenMail (IMAP/SMTP)
- **Generic MCP client docs** en README
- **`npm publish` in CI** con provenance

### Fixed

- **Version single-source**: derivado de package.json en runtime
- **Trash auto-detection** en proton_delete_email
- **ISO date validation** en proton_search_emails
- **Actionable IMAP connection errors** con remediation hint

## [0.2.0] - 2026-05-18

### BREAKING CHANGES (name only)

- Package renamed to `@alexendros/protonmail-mcp` (single-word)
- GitHub repository renamed to `Iniciativas-Alexendros/protonmail-mcp`
- MCP server identifier renamed to `protonmail-mcp`
- Binary in package.json renamed to `protonmail-mcp`

## [0.1.2] - 2026-05-02

### Fixed

- **mcpName** uses canonical GitHub username casing `Alexendros` (capital A)

## [0.1.1] - 2026-05-02

### Added

- `server.json` manifest para MCP Registry
- `mcpName` field en package.json
- `PUBLISH-MCP-REGISTRY.md` operator playbook

## [0.1.0] - 2026-05-01

### Added

- Initial public release on npm under canonical scope `@alexendros/proton-mail-mcp`.
- Full rename from `@alexendros/protonmail-mcp` → `@alexendros/proton-mail-mcp` (kebab-case alignment per Proton brand).
- 13 MCP tools across 4 capability areas: search/list/read/move/flag/delete emails, send mail with attachments, list folders, get attachments.
- Dual transport: stdio (for Claude Desktop / CLI) + streamable HTTP (for claude.ai Routines / SDK).
- Express middleware: rate limiting + CORS + Bearer auth on HTTP transport.
- `outputSchema` and `structuredContent` on all tools (MCP spec 2025-06-18).
- Read-only annotation hint on `proton_get_email`.
- Governance bundle: README badges, CONTRIBUTING.md, CODE_OF_CONDUCT.md, SECURITY.md, GitHub issue templates (bug-report.yml, feature-request.yml).
- Dockerfile + docker-compose.yml for self-hosted deployments.
- Smoke test script (`scripts/smoke.sh`).
- Vitest test setup with supertest for HTTP route coverage.

### Deprecated

- `@alexendros/protonmail-mcp` (old npm name) deprecated with `npm deprecate` pointing to the new package.

[Unreleased]: https://github.com/Iniciativas-Alexendros/agent-protonsuite/compare/v1.2.1...HEAD
[1.2.1]: https://github.com/Iniciativas-Alexendros/agent-protonsuite/releases/tag/v1.2.1
[1.2.0]: https://github.com/Iniciativas-Alexendros/agent-protonsuite/releases/tag/v1.2.0
[1.1.0]: https://github.com/Iniciativas-Alexendros/agent-protonsuite/releases/tag/v1.1.0
[1.0.1]: https://github.com/Iniciativas-Alexendros/agent-protonsuite/releases/tag/v1.0.1
[1.0.0]: https://github.com/Iniciativas-Alexendros/agent-protonsuite/releases/tag/v1.0.0
[0.7.0]: https://github.com/Iniciativas-Alexendros/agent-protonsuite/releases/tag/v0.7.0
[0.5.0]: https://github.com/Iniciativas-Alexendros/agent-protonsuite/releases/tag/v0.5.0
[0.4.0]: https://github.com/Iniciativas-Alexendros/agent-protonsuite/releases/tag/v0.4.0
[0.2.0]: https://github.com/Iniciativas-Alexendros/agent-protonsuite/releases/tag/v0.2.0
[0.1.2]: https://github.com/Iniciativas-Alexendros/agent-protonsuite/releases/tag/v0.1.2
[0.1.1]: https://github.com/Iniciativas-Alexendros/agent-protonsuite/releases/tag/v0.1.1
[0.1.0]: https://github.com/Iniciativas-Alexendros/agent-protonsuite/releases/tag/v0.1.0
