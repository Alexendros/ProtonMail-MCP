# Changelog

Changelog generado automáticamente por [semantic-release](https://github.com/semantic-release/semantic-release) a partir de los [Conventional Commits](https://www.conventionalcommits.org/).

El formato sigue [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) y [SemVer 2.0.0](https://semver.org/).

## Histórico pre-semantic-release
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

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

### Fixed

- SHA-256 hash for Pass duplicate detection, `--force` on insert/generate.
- `fs.readdir` for Pass `list()`, reject `..` paths, fix e2e path.

## [1.0.0] - 2026-07-12

### BREAKING

- **Rebrand a Proton Suite Agent v1.0.0**: el proyecto abarca Mail, Pass, Calendar y Drive. Package renombrado a `@alexendros/protonsuite-agent`, binarios `protonsuite-*`, repo `agent-protonsuite`. Commit BREAKING CHANGE desde v0.5.0 → bump semver major a v1.0.0.

### Added

- **Cobertura de tests 98.00%** (+36.3pp desde 61.7%): 889 tests en 43 archivos. Rondas 6-8: bridge-client 88%→95%, config.ts 90%→100%, imap.ts 93%→95%, diagnostics 93%→100%, drive-audit 94%→100%, drive 94%→100%, http.ts 100% stmts 97% branches, smtp.ts 100%.
- **Tests para agent/organizer.ts** (17 tests): buildOrganizationPlan con mock ImapClient multi-categoría (legal, admin, tech, spam, phishing), applyOrganizationPlan con creación de carpetas, movimiento y copia.
- **Tests para agent/executor.ts** (6 tests): mockear loadConfig, runSetup, buildOrganizationPlan. Probar cada goal con configs válidas e inválidas.
- **Tests para agent/setup.ts** (8 tests): mockear execFile, execSync, writeFile. Probar setup con binarios instalados/no instalados, fallos de descarga y permisos.
- **Tests para server/suite.ts** (14 tests): proton_suite_status con cada combinación de productos enabled/disabled.
- **Tests para server/mail.ts** (12 tests): mockear ImapClient completo (listEmails, searchEmails, getEmail, setFlags, moveEmail, deleteEmail, getAttachment).
- **Tests para server/ecosystem.ts** (13 tests): mockear execFile, fs.readdir. Probar discoverBinaries con combinaciones de binarios presentes/ausentes.
- **Tests para server/agent.ts** (5 tests): tool proton_agent_plan con response_format JSON/Markdown, dryRun, goal=alert.
- **Tests para server/utils.ts** (2 tests): helpers puros sin I/O.
- **Tests para server/pass.ts** (15 tests): mockear PassClient, probar proton_pass_list/get/generate/health con éxito y error.
- **Tests para server/drive.ts** (+11 tests): proton_drive_auth_status y proton_drive_auth_login tools MCP con mock DriveClient.
- **Tests para ecosystem/discovery.ts** (40 tests): mockear execFileSync, whichSync, existsSync. Probar resolveBinPath, checkBinary, checkAllBinaries, discoverSubcommands, parseHelpOutput.
- **Tests para ecosystem/installer.ts** (18 tests): mockear execFileSync. Probar installOnUbuntu (bridge/pass/drive/gpg), runApt, buildInstallPlan, platformPackage.
- **Tests para ecosystem/updater.ts** (22 tests): mockear checkBinary, execFileSync. Probar checkUpdateFor (6 estados), fetchLatestVersion (7 ramas), getPackageManager (3 fallbacks).
- **Tests para ecosystem/binaries.ts** (14 tests): datos puros — REGISTRY shape, getBinaryInfo, installationGuide.
- **Tests para which.ts** (13 tests): mockear accessSync, execFileSync. Probar whichSync, detectPlatform, detectDebianCodename.
- **Tests para drive.ts** (24 tests): callback-based mock para execFile. Probar DriveClient.listFiles/download/upload/share/status/move/copy/mkdir/remove.
- **Tests para pass.ts** (25 tests): event-emission pattern para execFile. Probar PassClient.list/get/insert/generate/delete/edit/health.
- **Tests para alerts/rules.ts** (20 tests): classifyEmail (5 categorías + uncategorized + HTML strip), detectThreats (phishing 2 patrones, credential, urgent), inferStateLabels (6 estados).
- **Tests para alerts/ntfy.ts** (7 tests): mockear fetch. Probar NtfyAlertSink.emit con/sin token, con/sin context, HTTP error.
- **Tests para alerts/webhook.ts** (4 tests): mockear fetch. Probar WebhookAlertSink.emit con éxito y HTTP error.
- **Tests para http.ts** (+14 tests sobre 8 existentes): CORS preflight (4), session lifecycle (4), auth edge cases (4), error handling (2).
- **Tests para diagnostics.ts** (2 tests): diagnoseMail mockeando ImapFlow con fallos en cada capa.
- **Tests para security.ts** (4 tests): validación de contraseñas, timing-safe comparison.
- **Tests para drive-audit.ts**: auditoría de Drive con mock de fs y DriveClient.
- **Tests para executor.ts** (6 tests): test unitarios del ejecutor de goals del agente.
- **Branch gaps cerrados** (3 módulos): organizer.ts 72%→94% (+22pp), mail.ts 87%→89% (+2pp), drive.ts 85%→94% (+9pp).
- **Branch Hunt 2** (3 módulos): server/drive.ts 94.89%, imap.ts 95.37%, organizer.ts 94.59% — 889 tests, gate 95.30% branches.
- **Drive OAuth tools MCP**: proton_drive_auth_status (verifica instalación + autenticación) y proton_drive_auth_login (instrucciones interactivas para login).
- **Split de src/config.ts** en sub-módulos por servicio: config/imap.ts, config/bridge.ts, config/smtp.ts, config/pass.ts, config/calendar.ts, config/drive.ts con barrel export en config/index.ts.
- **CLI de agente expandido**: src/agent-cli.ts con --help, subcomandos (setup, organize, pass-audit, drive-audit, suite-status), exit codes.
- **calendar-types.ts completado**: tipos CalDAV/iCalendar (RFC 5545) — VEvent, VCalendar, VTimezone, Alarm, Attachment, Attendee, Organizer.
- **REPORTE_SEGURIDAD_FASE1.md movido** a docs/security/ para no exponer en raíz pública.
- **Documentación de cobertura**: docs/coverage-report.md con reporte detallado de todos los módulos ordenados ascendente.
- **TASKS.md**: documento integral con estado del proyecto, 6 fases completadas, 8 tareas priorizadas y guía para retomar.
- **Coverage gate 95%**: vitest config con thresholds globales de líneas, branches y statements al 95% para prevenir regresiones.
- **Sistema de alertas multi-sink** (`src/alerts/ntfy.ts`). Arquitectura `AlertSink[]` con soporte para Ntfy. `audit()` solo escribe al file sink.
- **Tests unitarios de PassClient** (`tests/pass.test.ts`) con dependency injection.
- **Tests de registro de tools** (`tests/server/tools-registry.test.ts`).
- **Tests E2E de Drive** (`tests/e2e/drive.e2e.ts`).
- **Workflow `integration.yml`**: tests de integración para Bridge, Drive y Suite.
- **Documentación de Drive**: `docs/drive-audit.md`, `docs/superpowers/plans/2026-07-10-proton-drive-rsync-audit.md`.
- **Plan de sprint** (`docs/superpowers/plans/2026-07-17-sprint-bugfixes-pendientes.md`).

### Changed

- **ESLint endurecimiento completo en src/** (14 reglas off→error): no-explicit-any, no-unsafe-* (4), no-unsafe-argument, no-non-null-assertion, no-deprecated, no-unnecessary-condition, no-unnecessary-type-conversion, no-unnecessary-type-assertion, no-useless-escape, require-await, no-floating-promises, no-misused-promises, no-base-to-string. 0 violaciones.
- **ESLint endurecimiento en tests/** (11 reglas off→warn): require-await (error), no-floating-promises, no-misused-promises, no-unnecessary-condition, no-unsafe-* (4), no-unsafe-argument, no-deprecated, restrict-template-expressions, no-non-null-assertion, no-unnecessary-type-assertion, no-useless-escape. 0 violaciones.
- **ESLint reglas off→warn en src/**: restrict-template-expressions, restrict-plus-operands, prefer-nullish-coalescing. 0 violaciones.
- **TypeScript strict flags activados**: noUncheckedIndexedAccess, noPropertyAccessFromIndexSignature, verbatimModuleSyntax, noImplicitOverride, exactOptionalPropertyTypes.
- **Coverage badge migrado a gh-pages**: endpoint badge dinámico con shields.io, ya no commitea a main.
- **Dockerfile**: imagen base migrada de node:26-alpine a node:22-alpine LTS.
- **Dependabot endurecido**: labels por ecosistema (dependencies, npm/github-actions/docker), assignees (alexendros), timezone Europe/Madrid, versioning-strategy increase.
- **Migración completa de npm a pnpm**: todos los workflows CI (ci.yml, quality.yml, release.yml, integration.yml) actualizados de `npm ci` a `pnpm install --frozen-lockfile` con `pnpm/action-setup`.
- **Dockerfile actualizado**: multi-stage build con pnpm en builder stage (`RUN npm install -g pnpm`), COPY ajustados.
- **Hash de duplicados en PassClient**: de djb2 a SHA-256 (primeros 16 hex chars).
- **`list()` de PassClient** ahora lee el filesystem directamente (`fs.readdir` recursivo).
- **`validatePath()`** rechaza secuencias `..` para prevenir directory traversal.
- **`insert()` y `generate()` de PassClient** usan `--force`.
- **`suite-status`** reporta Drive como respaldado por CLI oficial, no como stub.
- **CI apunta a runner self-hosted** en minipc.
- **Dockerfile.bridge**: digest SHA256 actualizado.
- **pnpm-workspace.yaml**: añadido para estructura de workspace.
- **package.json**: scripts actualizados para pnpm, añadido `pnpm.onlyBuiltDependencies` (esbuild, unrs-resolver).
- **.gitignore**: package-lock.json añadido, coverage/ añadido.
- **server.json**: revisado y mantenido en raíz (template público sin secretos).
- **Configuración de organizer**: manejo de errores mejorado en buildOrganizationPlan (finally cleanup, error catching por email).

### Removed

- **package.json lockfile npm**: package-lock.json eliminado (548KB). El proyecto usa exclusivamente pnpm-lock.yaml (86KB).

### Fixed

- **CVE nodemailer 6→9** (8 CVEs) y **unicorn 59→65** (ReDoS).
- **Config de Drive**: `drive enabled` derivado de `rcloneRemote`.
- **Métricas de sync de Drive**: captura desde stderr, `ignore-existing` en push.
- **Labels del agente**: se aplican vía copy sin carpetas duplicadas.
- **E2E Pass**: `scripts/e2e-pass.sh` verifica prerequisitos (GPG, pass).
- **E2E GreenMail**: `scripts/e2e-greenmail.sh` usa `PATH=/usr/bin:$PATH` para `pass` estándar.
- **Referencias a plantillas**: actualizadas a `Iniciativas-Alexendros/plantillas`.
- **zizmor**: peaceiris/actions-gh-pages commit hash actualizado a v4.1.0 para fijar versión.
- **http.ts**: cerrado último gap de branches (ipKeyGenerator anon fallback) — 100% stmts, 97.22% branches.
- **Dependabot**: prevención de agrupación de major bumps.
- **Test de phishing_link en rules.test.ts**: regex esperaba `\.proton\.` pero URL de test no tenía subdominio. Corregido `proton.xyz` → `login.proton.xyz`.
- **Test de organizer**: error propagado por finally block corregido a expect rejection.
- **Test de drive**: mock isDirectory cambiado de `includes('/sub')` a `endsWith('/sub')` para evitar falsos positivos con archivos dentro del subdirectorio. HOME save/restore con origHome pattern.
- **Stubs de Calendar con mensaje preciso**: ahora indican "E2E-encrypted sync, not standard CalDAV".
- **Cobertura en CI** (`npm run coverage`) con badge en README.

## [0.7.0] - 2026-07-17

> **Nota:** No existe versión 0.6.0. El salto de 0.5.0 a 0.7.0 fue intencional para reflejar la expansión del scope de Mail a Suite completa.

### Added

- **Goal `check-imap`**: verificación de conectividad IMAP y diagnóstico del Bridge.

### Changed

- **Rebrand a Proton Suite Agent v0.7.0**: el proyecto abarca Mail, Pass, Calendar y Drive.
- **State labels y organización por carpetas**: `organize` ahora usa labels de estado y plan de solo carpetas.

### Fixed

- **Labels del agente**: evitar categorías duplicadas en la organización.
## [0.5.0] - 2026-07-04

### Changed

- **Rebrand a agente de correo.** El paquete pasa a llamarse `@alexendros/protonmail-agent`, el binario principal es `protonmail-agent` y el repositorio se renombra a `Iniciativas-Alexendros/agent-protonmail`. El MCP server sigue disponible como `protonmail-mcp`.
- **Licencia cambiada a AGPL-3.0.** De MIT a GNU Affero General Public License v3.0, con `NOTICE.md` explicando el cambio y la relación con Proton AG.
- **Seguridad ampliada para agentes IA.** `SECURITY.md` incluye ahora un baseline de agentes autónomos (acción no autorizada, hallucinación, goal injection, data retention, alert fatigue) y controles correspondientes.

### Added

- **Módulo de agente** (`src/agent/`) con goals (`discover`, `setup`, `organize`, `monitor`, `alert`), setup, organización y clasificación de correos.
- **Sistema de alertas** (`src/alerts/`) con reglas de contenido local, detección de amenazas (phishing, spam, fraude), salida a fichero estructurado y webhook.
- **Tool MCP `proton_agent_plan`** para consultar el plan de organización/alertas sin aplicar cambios.
- **CLI de agente** (`src/agent-cli.ts`) ejecutable como `npx protonmail-agent <goal>`.
- **Documentación del agente**: `docs/alerting.md`, `docs/knowledge-base.md`, `playbooks/onboarding.md`, `playbooks/organize-inbox.md`, `playbooks/fraud-detection.md`.
- **Tests de alertas** (`tests/alerts.test.ts`) para reglas de clasificación y detección de amenazas.
- **Configuración del agente** (`AGENT_DRY_RUN`, `AGENT_MAX_INSPECT_EMAILS`, `AGENT_MIN_CONFIDENCE`) y de alertas (`ALERT_WEBHOOK_URL`, `ALERT_MIN_SEVERITY`, `ALERT_LOG_DIR`, `ALERTS_ENABLED`) en `src/config.ts` y `.env.example`.

### Removed

- **Nombre anterior** `@alexendros/protonmail-mcp` queda como alias histórico; el paquete se publica a partir de ahora como `@alexendros/protonmail-agent`.

## [0.4.0] - 2026-06-20

### Fixed

- **Version single-source.** The server version was hardcoded in three places that had drifted (`package.json` 0.3.1, `src/server.ts` "0.3.0", `src/http.ts` `/healthz` "0.2.0"). It is now derived once from `package.json` at runtime via `src/version.ts`.
- **Trash auto-detection in `proton_delete_email`.** `mode=trash` now resolves the mailbox flagged `\Trash` instead of assuming the literal English "Trash", so it works on accounts whose trash is `Papelera`/`Corbeille`/etc. `trash_path` is now an optional override.
- **ISO date validation in `proton_search_emails`.** `since`/`before` are validated as parseable dates (Zod refine) — a malformed date returns a clear schema error instead of a cryptic IMAP failure.
- **Actionable IMAP connection errors.** Connection failures are now classified (Bridge not running / bad credentials / timeout) with a remediation hint, preserving the original error as `cause`.

### Added

- **`PROTON_BRIDGE_SMTP_SECURITY`** env (`starttls` default | `implicit` | `plain`). The default preserves Bridge's STARTTLS behavior; the other modes broaden SMTP compatibility (and enable the GreenMail E2E suite).
- **Real E2E test suite (`npm run test:e2e`)** against GreenMail (IMAP/SMTP) exercising the full send → read → flag → move → delete cycle through the real clients — no mocks. Runs in CI as a service container; `scripts/e2e-greenmail.sh` runs it locally.
- **Generic MCP client docs.** README now documents a standard `mcpServers` config block so non-Claude clients (OpenCode, custom SDK backends) can consume the server directly.
- **`npm publish` in CI.** The release workflow now publishes the npm package (with provenance) on tags, in addition to the GHCR image.

### Changed

- **Per-handler debug logging** (`{ tool, ms }`, no payloads) and consolidated address parsing into `src/addresses.ts` (deduplicated between `imap.ts` and `smtp.ts`).

## [0.2.0] · 2026-05-18

### Changed

- **BREAKING (name only).** Package renamed back to `@alexendros/protonmail-mcp` (single-word `protonmail`, matching Proton AG's own marketing convention). The intermediate name `@alexendros/proton-mail-mcp` (kebab-case form used since `0.1.0`) is now deprecated on npm.
- GitHub repository renamed from `Iniciativas-Alexendros/proton-mail-mcp` → `Iniciativas-Alexendros/protonmail-mcp`. GitHub provides automatic redirect for the old URL; existing clones continue to fetch from `origin`.
- Docker image renamed from `ghcr.io/alexendros/proton-mail-mcp` → `ghcr.io/iniciativas-alexendros/protonmail-mcp` (track GitHub repository casing, which lowercases for GHCR).
- MCP server identifier (`tools/list`) renamed from `proton-mail-mcp` → `protonmail-mcp`. Clients that hardcode the server name in routing logic must update.
- Binary in `package.json` renamed from `proton-mail-mcp` → `protonmail-mcp`. Users invoking the CLI by name must update.
- `mcpName` updated to `io.github.Alexendros/protonmail-mcp` (capital `A`, registry canonical).

### Added

- `Marcas comerciales` section in README — explicit disclaimer that this project is unaffiliated with Proton AG.

### Notes

- **Reason for rename U-turn.** The intermediate name `proton-mail-mcp` (kebab-case) introduced in `0.1.0` was chosen for "brand alignment" but read awkwardly (`proton-mail` reads as two separate words while Proton's product is `Proton Mail` — a brand, not a compound). The single-word `protonmail-mcp` matches Proton AG's own `protonmail.com` heritage domain and aligns with the upstream community Docker image `shenxn/protonmail-bridge`. After two months of operational use the kebab form was found to introduce friction in autocomplete and verbal communication.
- Old package `@alexendros/proton-mail-mcp@0.1.x` deprecated with pointer to the new name. Old deprecation on the original `@alexendros/protonmail-mcp@<pre-0.1.0>` cleared (`npm deprecate '@alexendros/protonmail-mcp' ''`).
- No functional changes; this is a metadata-only release.
- > **Nota histórica (2026-07-04):** en `v0.5.0` el proyecto se transformó en agente y se renombró a `@alexendros/protonmail-agent` / `agent-protonmail`. La afirmación de "último rename" queda reflejada como decisión válida para la serie `0.2.x`.

## [0.1.2] · 2026-05-02

### Fixed

- `mcpName` and `server.json` `name` now use canonical GitHub username casing `Alexendros` (capital A) instead of lowercase `alexendros`. The MCP Registry (`registry.modelcontextprotocol.io`) enforces case-sensitive match between authenticated GitHub login and the namespace prefix; publish to lowercase namespace was rejected with `403 Forbidden: You have permission to publish: io.github.Alexendros/*`.

### Notes

- Metadata-only fix; no functional changes vs `0.1.1`.
- `0.1.1` was published to npm with the lowercase mcpName but never made it into the MCP Registry due to the permission mismatch above. Treat `0.1.2` as the first registry-published version.
- Documentation in upstream MCP Registry quickstart shows lowercase example (`io.github.my-username/`), which is misleading: the actual constraint is exact case-match with `gh api user --jq .login`.

## [0.1.1] · 2026-05-02

### Added

- `server.json` manifest for publication to the [MCP Registry](https://registry.modelcontextprotocol.io/) (preview, API frozen at v0.1).
- `mcpName` field in `package.json` (`io.github.alexendros/proton-mail-mcp`) — required for npm-package ownership verification by the MCP Registry.
- `PUBLISH-MCP-REGISTRY.md` operator playbook for `mcp-publisher` CLI flow (init/login/publish).
- Documented 5 environment variables in `server.json` for discoverability: `PROTON_BRIDGE_HOST`, `PROTON_IMAP_PORT`, `PROTON_SMTP_PORT`, `PROTON_USERNAME` (required), `PROTON_PASSWORD` (required, secret).

### Notes

- This release is metadata-only; no functional changes vs `0.1.0`.
- HTTP transport (`/mcp` over Bearer token at the operator's domain) is intentionally **not** declared in `server.json` `remotes[]` because the registry policy requires remote endpoints to be publicly accessible without authentication. Operator decides when (and whether) to expose an unauthenticated public HTTP endpoint.
- Old npm name `@alexendros/protonmail-mcp` remains deprecated since `0.1.0` — do not republish.

## [0.1.0] · 2026-05-01

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
[0.4.0]: https://github.com/Iniciativas-Alexendros/protonmailbrige-mcptool/releases/tag/v0.4.0
[0.2.0]: https://github.com/Iniciativas-Alexendros/protonmailbrige-mcptool/releases/tag/v0.2.0
[0.1.2]: https://github.com/Iniciativas-Alexendros/protonmailbrige-mcptool/releases/tag/v0.1.2
[0.1.1]: https://github.com/Iniciativas-Alexendros/protonmailbrige-mcptool/releases/tag/v0.1.1
[0.1.0]: https://github.com/Iniciativas-Alexendros/protonmailbrige-mcptool/releases/tag/v0.1.0
