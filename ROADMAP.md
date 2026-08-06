# Roadmap de Proton Suite Agent

Plan a alto nivel. No son compromisos firmes; las prioridades pueden cambiar según el contexto operativo. El detalle por versión publicada vive en `CHANGELOG.md`; las decisiones de fondo en `docs/adr/`.

## Estado actual

`v1.2.1` — Architecture improvement: documentación, observabilidad, contract tests y CalDAV seam.

## Completado

### v0.6.0 — Rebrand a Proton Suite

- [x] Rebrand completo: `@alexendros/protonsuite-agent`, binarios `protonsuite-*`, repo `agent-protonsuite`.
- [x] Integración Proton Pass: `src/pass.ts`, tools `proton_pass_list/get/generate/health`.
- [x] Schema de configuración multi-producto en `config.ts`.
- [x] Inicialización condicional de clientes por producto en `index.ts`.
- [x] Tool `proton_suite_status` unificada.
- [x] Playbooks cross-producto (`pass-audit.md`, `suite-daily-briefing.md`).
- [x] Stubs de Calendar y Drive con tools visibles pero no funcionales.
- [x] Actualización de CI, conectores y Docker para el nuevo nombre.

### v0.7.0 — Profesionalización

- [x] ESLint flat config (`eslint.config.mjs`) con reglas strict TypeScript, unicorn, security, import-x.
- [x] commitlint + Husky: conventional commits forzados en pre-commit con scopes del proyecto.
- [x] Knip: detección de dependencias, exports y archivos sin usar.
- [x] lint-staged: ESLint solo sobre archivos staged en pre-commit.
- [x] semantic-release: versionado automatizado desde conventional commits.
- [x] Renovate: auto-merge para devDependencies + lockfile maintenance semanal.
- [x] CI: paso de lint en ci.yml, paso de knip en quality.yml, semantic-release en release.yml.
- [x] Estandarización de scripts npm (`lint`, `lint:fix`, `knip`, `prepare`).

### v1.0.0 — Architecture improvement (docs, observabilidad, contract tests, CalDAV seam)

**Phase 1 — Documentación y decisiones:**

- [x] `AGENTS.md` (especificación agents.md para contexto de agentes IA).
- [x] ADRs: `docs/adr/0002` (transport dual stdio/http), `0003` (ports & adapters), `0004` (config validation + dry-run guardrail), `0005` (CalDAV stub — dependencia Proton).
- [x] Documentación de API generada: `scripts/generate-docs.mjs` → `docs/api/mcp-tools.md` (50 tools, validado por CI).
- [x] `ARCHITECTURE.md` actualizado con referencias a ADRs.

**Phase 2 — Observabilidad:**

- [x] Endpoint `/metrics` (Prometheus-style) detrás de bearer auth en `src/http.ts`.
- [x] Instrumentación de requests/sesiones MCP vía `src/utils/metrics.ts`.
- [x] Tests de métricas (`tests/utils/metrics.test.ts`, `tests/http-transport.test.ts`).

**Phase 3 — Contract tests + CalDAV seam:**

- [x] Suite de contract tests (`tests/contract/`): valida la superficie MCP real vía HTTP/SSE (`buildHttpApp` + supertest), no introspección estática.
- [x] Golden set de 50 tools (nombres, `title`, `description`, `inputSchema`, `readOnlyHint`/`openWorldHint`).
- [x] Snapshot determinista de esquemas JSON por tool (`tool-catalog.snap`).
- [x] CI gate: "Contract tests (MCP tool surface)" en `ci.yml`, script `test:contract`.
- [x] `ICalendarAdapter` port en `src/clients/interfaces.ts` (interfaz solamente — CalDAV bloqueado por Proton Bridge; ver ADR-005).

**Infraestructura (corte transversal):**

- [x] Capa de ports hexagonal: `IImapClient`, `ISmtpClient`, `IDriveClient`, `IPassClient`, `ICalendarAdapter` en `src/clients/interfaces.ts`.
- [x] Pre-commit local: `.husky/pre-commit` → `lint-staged` (eslint --fix src) + typecheck + test suite (934 tests, 98% cobertura).
- [x] Refactor en progreso: `src/server.ts` → `src/server/{bridge,mail,pass,drive,suite,ecosystem,agent}.ts` (extractores por dominio).

## Pendiente · prioridad alta

- [ ] **Calendar MVP:** cliente CalDAV real cuando Bridge lo exponga, tools `proton_calendar_list_events/create_event`. (Interfaz `ICalendarAdapter` lista en `src/clients/interfaces.ts`; ver ADR-005.)
- [ ] **Drive MVP:** integración OAuth, tools `proton_drive_list_files/upload/download/share`.
- [ ] **Pass CLI backend alternativo:** soporte para `gopass` como drop-in con `GOPASS_STORE_DIR`.
- [ ] **Agente multi-pass:** goal `pass-audit` con reporte de fortaleza y rotación programada.
- [ ] **Docker compose multi-producto:** servicio de `gopass` o `pass` en el compose para Pass.

## Pendiente · prioridad media

- [ ] Auto-labeler CI: etiquetar PRs automáticamente según los archivos modificados.
- [ ] Coverage badge en README (vitest coverage → shields.io).
- [ ] Webhook de alertas: integración con ntfy, Discord o Slack desde `AlertSystem`.
- [ ] Documentación de playbooks con ejemplos de prompts para Claude/OpenCode.

## Pendiente · backlog

- [ ] Monorepo: separar `@alexendros/protonsuite-core` + `agent` + `mcp-server` si el proyecto crece.
- [ ] TypeScript project references + Turborepo si se migra a monorepo.
- [ ] Plugin system para backends de Pass (además de pass/gopass: Bitwarden CLI, 1Password CLI).
- [ ] Dashboard web opcional para monitorización de alertas y estado de la suite.
