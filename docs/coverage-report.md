# Coverage Report

> **Histórico.** Snapshot del 2026-07-30. La fuente viva de cobertura es CI
> (`pnpm run coverage`, workflow `coverage-badge.yml`). Conteos actuales de
> tests: ver [README.md](../README.md) / [AGENTS.md](../AGENTS.md) (953+).

**Generado:** 2026-07-30 — vitest + @vitest/coverage-v8 (post commits `6851bd4` housekeeping + `1414805` README sync; cierra drift con `README.md` badge y `origin/gh-pages` `coverage-badge.json`).

> El gate al 95% (lines | branches | statements) instalado en `vitest.config.ts` **PASA** — todas las métricas globales cumplen con margen saludable (+0.76pp sobre branches).

## Resumen global

| Métrica | Valor | Gate | Estado | Δ vs reporte anterior |
|---------|-------|------|--------|----------------------|
| **Statements** | **98.05%** | ≥95% | ✅ | **+0.10pp** |
| **Branches** | **95.76%** | ≥95% | ✅ **PASA** | **+0.46pp** |
| **Functions** | **97.37%** | (ungated) | ✅ | — |
| **Lines** | **98.05%** | ≥95% | ✅ | **+0.10pp** |
| **Tests** | **899 / 43 files** | — | +23 desde último reporte | 0 files |

> Cierre de drift: el badge en `README.md` (98.05%), el de `origin/gh-pages` `coverage-badge.json` (98.05% post último `coverage-badge.yml` run), y esta medición local coinciden exactamente. La rama `fix/seguridad-fase-1` referenciaba `97.62%` localmente como medición efímera pero no quedó en tracked artifacts.

## Branch Hunt 1 — cierre de 3 gaps en PR #81 (commit `9e8b798`)

**Tesis.** Los 3 módulos P0 del plan Branch Hunt 2 (impacto más alto en global) se cerraron en esta ronda: fix de bug en `discovery.ts`, tests para `executor.ts` y `server/drive.ts`.

### Gaps cerrados

| # | Módulo | Branches pre | Branches post | Δ | Tests | Patrón |
|---|--------|-------------|--------------|---|-------|--------|
| 1 | `ecosystem/discovery.ts` | 86.84% | **88.23%** | **+1.39pp** | 17 | Bug fix: `trimmed.startsWith('  ')` → `line.startsWith('  ')`; dedup con `Set`; test actualizado post-fix |
| 2 | `agent/executor.ts` | 87.23% | **87.50%** | **+0.27pp** | 2 | Tests drive-list (exits 2) + suite-manage (checkAllBinaries) |
| 3 | `server/drive.ts` | 89.47% | **90.62%** | **+1.15pp** | 1 | Test `authenticated: false` + `obsoleteFiles` vacío en format_report |

**Global post-hunt: 95.30%** — gate pasa por primera vez desde que se instaló.

### Patrón replicable (5 pasos)

Aplicable a cualquier módulo futuro con branches <95%:

1. **Identificar el gap.** `pnpm run coverage` → `coverage/coverage-summary.json` → ordenar por `branches.pct` ascendente.
2. **Diferenciar reachable vs defensive.** Para cada rama no cubierta:
   - **Reachable** — real en producción (network errors, parse failures, callback paths): necesita cobertura.
   - **Defensive** — `?? ''`, `|| '(none)'`, fallbacks de nullish coalescing en template literals: imposible de ejecutar en runtime.
3. **Cerrar reachable con tests** según personalidad del módulo:
   - Función pura → tests de tabla (`input, expected`).
   - Async con subprocess → mock con EventEmitter.
   - Red / socket → `Promise.reject` o mock de clase.
4. **Cerrar defensive con SAFETY comment** si lint bloquea la simplificación:
   - `?? ''` documentado con SAFETY block explicando el invariante de spec.
   - ⚠️ **Nunca** con mocks que falseen coverage — dishonest, esconde invariantes de runtime.
5. **Medir impacto.** 1 rama cerrada en un módulo con 30-100 ramas totales = ~1-3pp de ganancia en ese módulo, ~0.07-0.14pp en global.

## Branch Hunt 2 — plan para 12 módulos <95% (próxima iteración)

Gate pasa (95.30%), pero sin margen real (+0.30pp). 12 módulos tienen branches <95%. Cerrarlos todos daría **+1.59pp** → **96.89%** en global.

### Priorizados por impacto global

| # | Módulo | Branches | Unc | Ganancia | Esfuerzo | Tests necesarios |
|---|--------|----------|-----|----------|----------|------------------|
| 1 | `server/drive.ts` | 90.62% | 9 | **+0.65pp** | medio | 3: ext falsy en audit, error en status, path definido + size undefined en list_files, ?? fallbacks en move/copy/create_folder |
| 2 | `imap.ts` | 93.33% | 7 | **+0.51pp** | bajo | 1: error genérico en describeConnError (else fallback). Resto son SAFETY (cortocircuitos de `\|\|` inalcanzables) |
| 3 | `agent/executor.ts` | 87.50% | 6 | **+0.43pp** | alto | 3: discover goal, setup goal (éxito/fallo), pass-audit (exits 2). Requiere mocking de setup/organizer |
| 4 | `smtp.ts` | 93.58% | 5 | **+0.36pp** | medio | 2: buildForwardBody fallbacks, content-type negotiation |
| 5 | `ecosystem/discovery.ts` | 88.23% | 4 | **+0.29pp** | medio | 2: parseHelpOutput segunda pasada, healthCmd fail |
| 6 | `agent/organizer.ts` | 94.59% | 4 | **+0.29pp** | medio | 2: dry-run false con alerts, buildOrganizationPlan con config inválida |
| 7-12 | restantes (setup, updater, bridge, suite, installer, server/ecosystem) | 90-94.59% | 1-2 c/u | +0.14pp c/u | bajo | 1 test o SAFETY comment cada uno |

> **Total: ~7 tests + ~5 SAFETY comments → +1.59pp → 96.89% global, +4.89pp de margen sobre gate.**

## Todos los módulos ordenados por branches (ascendente)

| # | Módulo | Stmts | Branch | Funcs | Lines |
|---|--------|-------|--------|-------|-------|
| 1 | `agent/executor.ts` | 93.77% | **87.50%** | 100% | 93.77% |
| 2 | `ecosystem/discovery.ts` | 83.76% | **88.23%** | 100% | 83.76% |
| 3 | `agent/setup.ts` | 100% | 90.00% | 100% | 100% |
| 4 | `ecosystem/updater.ts` | 96.42% | 90.47% | 100% | 96.42% |
| 5 | `server/drive.ts` | 100% | 90.62% | 100% | 100% |
| 6 | `config/bridge.ts` | 100% | 92.30% | 100% | 100% |
| 7 | `server/suite.ts` | 98.38% | 92.30% | 100% | 98.38% |
| 8 | `imap.ts` | 95.21% | 93.33% | 84.61% | 95.21% |
| 9 | `ecosystem/installer.ts` | 100% | 93.54% | 100% | 100% |
| 10 | `smtp.ts` | 100% | 93.58% | 100% | 100% |
| 11 | `agent/organizer.ts` | 100% | 94.59% | 100% | 100% |
| 12 | `server/ecosystem.ts` | 100% | 94.59% | 100% | 100% |
| 13 | `server/pass.ts` | 99.56% | 95.23% | 100% | 99.56% |
| 14 | `pass.ts` | 100% | 95.31% | 100% | 100% |
| 15 | `server.ts` | 100% | 95.34% | 80% | 100% |
| 16 | `config.ts` | 100% | 95.55% | 95.23% | 100% |
| 17 | `diagnostics.ts` | 100% | 96.00% | 100% | 100% |
| 18 | `bridge/bridge-client.ts` | 95.01% | 96.63% | 100% | 95.01% |
| 19 | `server/mail.ts` | 100% | 96.93% | 100% | 100% |
| 20 | `http.ts` | 100% | 97.22% | 100% | 100% |
| 21 | `alerts/rules.ts` | 100% | 97.29% | 100% | 100% |
| 22 | `addresses.ts` | 100% | 100% | 100% | 100% |
| 23-44 | resto (agent-cli, agent/goals, agent/index, alerts/*, auth, config/*, drive, drive-audit, ecosystem/binaries, security, server/*, version, which) | 100% | 100% | 100% | 100% |

**Leyenda:** rojo <90% | naranja 90-95% | verde ≥95% | verde oscuro 100%

## Por grupo

### `src/` raíz — 97.95% statements

| File | Stmts | Branch | Funcs | Lines |
|------|-------|--------|-------|-------|
| config.ts | 100% | 95.55% | 95.23% | 100% |
| http.ts | 100% | 97.22% | 100% | 100% |
| smtp.ts | 100% | 93.58% | 100% | 100% |
| server.ts | 100% | 95.34% | 80% | 100% |
| imap.ts | 95.21% | 93.33% | 84.61% | 95.21% |
| pass.ts | 100% | 95.31% | 100% | 100% |
| diagnostics.ts | 100% | 96.00% | 100% | 100% |
| drive.ts | 100% | 100% | 100% | 100% |
| drive-audit.ts | 100% | 100% | 100% | 100% |
| addresses.ts | 100% | 100% | 100% | 100% |
| auth.ts | 100% | 100% | 100% | 100% |
| security.ts | 100% | 100% | 100% | 100% |
| version.ts | 100% | 100% | 100% | 100% |
| which.ts | 100% | 100% | 100% | 100% |
| agent-cli.ts | 0% | 100% | 100% | 0% |

### `src/agent/` — 97.55% statements

| File | Stmts | Branch | Funcs | Lines |
|------|-------|--------|-------|-------|
| executor.ts | 93.77% | 87.50% | 100% | 93.77% |
| setup.ts | 100% | 90.00% | 100% | 100% |
| organizer.ts | 100% | 94.59% | 100% | 100% |
| goals.ts | 100% | 100% | 100% | 100% |
| index.ts | 100% | 100% | 100% | 100% |

### `src/alerts/` — 99.71% statements

| File | Stmts | Branch | Funcs | Lines |
|------|-------|--------|-------|-------|
| index.ts | 98.66% | 100% | 100% | 98.66% |
| rules.ts | 100% | 97.29% | 100% | 100% |
| file.ts | 100% | 100% | 100% | 100% |
| ntfy.ts | 100% | 100% | 100% | 100% |
| types.ts | 100% | 100% | 100% | 100% |
| webhook.ts | 100% | 100% | 100% | 100% |

### `src/bridge/` — 95.01% statements

| File | Stmts | Branch | Funcs | Lines |
|------|-------|--------|-------|-------|
| bridge-client.ts | 95.01% | 96.63% | 100% | 95.01% |

### `src/config/` — 100% statements

| File | Stmts | Branch | Funcs | Lines |
|------|-------|--------|-------|-------|
| bridge.ts | 100% | 92.30% | 100% | 100% |
| calendar.ts | 100% | 100% | 100% | 100% |
| drive.ts | 100% | 100% | 100% | 100% |
| pass.ts | 100% | 100% | 100% | 100% |

### `src/ecosystem/` — 97.18% statements

| File | Stmts | Branch | Funcs | Lines |
|------|-------|--------|-------|-------|
| discovery.ts | 83.76% | 88.23% | 100% | 83.76% |
| updater.ts | 96.42% | 90.47% | 100% | 96.42% |
| installer.ts | 100% | 93.54% | 100% | 100% |
| binaries.ts | 100% | 100% | 100% | 100% |

### `src/server/` — 99.79% statements

| File | Stmts | Branch | Funcs | Lines |
|------|-------|--------|-------|-------|
| drive.ts | 100% | 90.62% | 100% | 100% |
| suite.ts | 98.38% | 92.30% | 100% | 98.38% |
| ecosystem.ts | 100% | 94.59% | 100% | 100% |
| server.ts | 100% | 95.34% | 80% | 100% |
| pass.ts | 99.56% | 95.23% | 100% | 99.56% |
| mail.ts | 100% | 96.93% | 100% | 100% |
| agent.ts | 100% | 100% | 100% | 100% |
| calendar.ts | 100% | 100% | 100% | 100% |
| types.ts | 100% | 100% | 100% | 100% |
| utils.ts | 100% | 100% | 100% | 100% |

## Estado de la caza

| Hito | Branches global | Δ | Gate |
|------|-----------------|---|------|
| Jun 2026 (base) | — | — | ❌ |
| Jul 2026 (Ronda 1-8 histórica) | 92.23% | — | ❌ |
| Jul 2026 (Branch Hunt 1 pre) | 93.63% | +1.40pp | ❌ |
| **Jul 2026 (Branch Hunt 1 post, PR #81)** | **95.30%** | **+1.67pp** | **✅ PASA** |
| **Jul 2026 (Coverage sync, commits `6851bd4`+`1414805`)** | **95.76%** | **+0.46pp** | **✅ PASA +0.76pp margen** |
| Jul 2026 (Branch Hunt 2 target) | 96.89% | +1.59pp | ✅ +4.89pp margen |

## Progreso histórico

| Fecha | Statements | Branches | Tests | Files | Hitos |
|-------|-----------|----------|-------|-------|-------|
| **Jul 2026 (Coverage sync, 6 commits)** | **98.05%** | **95.76%** | **899** | **43** | **`6851bd4`+`1414805`: Batch B (Calendar stub Proton reality, `37a48be`), Batch D (bridge digest verify, `d5721d2`), deps prune semrel/{exec,git} (`3ad1d7b`), CHANGELOG retroactivo (`5b3dabe`), README badge sync (`1414805`), housekeeping (`6851bd4`); +23 tests; gate PASA +0.76pp margen sobre branches.** |
| **Jul 2026 (Branch Hunt 1)** | **97.95%** | **95.30%** | **876** | **43** | **PR #81: bug fix discovery (88.23%), tests executor (87.5%), tests drive (90.62%); +12 tests; gate PASA** |
| Jul 2026 (ESLint endurecimiento) | 98.00% | 92.23% | 819 | 42 | ESLint reglas off→warn, config.ts 90→100%, bridge-client 88→95% |
| Jul 2026 (post-http.ts gap) | 96.67% | 91.04% | 804 | 42 | http.ts 99→100%, smtp.ts 98→100%, coverage badge bugfix |
| Jul 2026 (Ronda 3b) | 93.72% | 89.50% | 745 | 42 | server/drive.ts 89→99% (+43 tests) |
| Jul 2026 (post-merge) | 90.65% | 86.46% | 619 | 38 | Repo renombrado, PRs #65, #66 |
| Jun 2026 (base) | 61.70% | — | 258 | 21 | Reporte inicial |

## Reproducir localmente

```bash
# Run sin gate para diagnóstico (coverage-summary.json limpio):
rm -f coverage/coverage-summary.json
npx vitest run --coverage

# Round-trip al reporte:
python3 -c "import json; d=json.load(open('coverage/coverage-summary.json'))['total']; \
  print(f'STATEMENTS={d[\"statements\"][\"pct\"]}% BRANCHES={d[\"branches\"][\"pct\"]}% \
  FUNCTIONS={d[\"functions\"][\"pct\"]}% LINES={d[\"lines\"][\"pct\"]}%')"

# Test count exacto:
npx vitest run --reporter=default 2>&1 | grep -E '^Tests|^Test Files'

# CI (gate activo, retornará non-zero si branches<95%):
npx vitest run --coverage
```
