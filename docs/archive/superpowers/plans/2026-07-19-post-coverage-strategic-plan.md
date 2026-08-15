> **Estado: superseded** · Archivado 2026-08-15. No es fuente de verdad. Ver [docs/archive/README.md](../../README.md) y ADRs vigentes.

# Plan Estratégico Post-Cobertura

> **For agentic workers:** Plan de análisis y priorización, no de implementación inmediata. Cada sección propone una fase independiente ejecutable en su propio worktree.

**Goal:** Definir qué mejorar ahora que la cobertura de tests supera el 94% — lint strict, tipos estrictos, documentación, seguridad, y arquitectura.

**Estado actual (2026-07-19):** Cobertura global 95.12% statements, 91.71% branches. CI completamente verde (typecheck, lint, tests, build, E2E). 27 workflows de CI/CD. 620+ tests.

---

## 1. Diagnóstico Rápido

### ✅ Ya funciona bien
- **TypeScript strict mode**: `tsconfig.json` con `strict: true` activo
- **Lint strict**: ESLint con `strictTypeChecked` + `stylisticTypeChecked` sobre `src/`
- **Security plugin**: `eslint-plugin-security` integrado
- **Quality gates**: CI ejecuta lint → typecheck → test → coverage → build → smoke
- **Supply chain**: SBOM + attest-build-provenance en CI
- **Workflows**: Renovate, semantic-release, knip, dependabot, CodeQL
- **Husky**: commit-msg (commitlint) + pre-commit (lint-staged)

### 🟡 Hay margen de mejora
- Varias reglas TS desactivadas en `src/` (`no-explicit-any: warn`, `no-unsafe-*: off`)
- Tests tienen ESLint muy relajado (muchos `off`)
- `src/agent/types.ts`, `src/server/index.ts`, `src/calendar.ts` son stubs/barrels
- Documentación: `docs/agent-quickstart.md`, `docs/human-quickstart.md` sin revisar
- `docs/security/` tiene `REPORTE_SEGURIDAD_FASE1.md` pero no FASE2
- `docs/coverage-report.md` está desactualizado (último reporte fue antes de server.ts Ronda 8)

---

## 2. Fases Propuestas

Cada fase es independiente y puede ejecutarse en su propio worktree.

---

### Fase A: Endurecer ESLint en src/ (bajo riesgo)

**Objetivo:** Reducir reglas desactivadas en `src/`, subir `warn` a `error` donde sea seguro.

**Archivo:** `eslint.config.mjs`

#### A1: `no-explicit-any` de `warn` a `error`

Actualmente `warn`. Afecta ~15-20 líneas en todo `src/`.

**Riesgo:** Bajo. Los `any` explícitos están en `server.ts` (register wrapper casting), `config.ts`, `http.ts`. La mayoría requiere `unknown` en vez de `any`, no lógica condicional.

**Verificación:** `npx eslint src/ --quiet` → 0 errores tras arreglar.

#### A2: `no-unnecessary-condition` de `warn` a `error`

Actualmente `warn`. Afecta principalmente a accesos opcionales (`?.`) en propiedades que TypeScript ya sabe que no son null.

**Riesgo:** Medio. Puede haber algún `?.` genuinamente necesario por type-narrowing que TS no deduce.

**Verificación:** `npx eslint src/ --quiet` → 0 errores.

#### A3: `no-non-null-assertion` de `warn` a `error`

Actualmente `warn`. Afecta a `!` postfijo. En `tests/` está desactivado.

**Riesgo:** Bajo. Reemplazar `!` con guardas o early returns mejora el código.

#### A4: Mirar `no-unsafe-*` (actualmente `off`)

Reglas desactivadas:
- `@typescript-eslint/no-unsafe-assignment: off`
- `@typescript-eslint/no-unsafe-member-access: off`
- `@typescript-eslint/no-unsafe-call: off`
- `@typescript-eslint/no-unsafe-return: off`

**Riesgo:** Alto en un solo PR. Son muchas líneas de cambios. Sugerencia: activar gradualmente, un módulo por PR.

**Alternativa:** Dejarlas en `off` pero marcar como deuda técnica en TASKS.md. No bloquear.

#### A5: `require-await` de `warn` a `error`

Actualmente `warn`. Funciones `async` que no usan `await`.

**Riesgo:** Bajo. Quitar `async` o añadir `await` según corresponda.

---

### Fase B: Endurecer ESLint en tests/ (riesgo medio)

**Objetivo:** Reducir la brecha entre config de `src/` y `tests/`.

Actualmente `tests/` tiene muchas reglas en `off`:
- `no-floating-promises: off`
- `no-misused-promises: off`
- `no-unsafe-assignment: off`
- `no-unsafe-argument: off`
- `no-unnecessary-type-assertion: off`
- `no-explicit-any: off`
- `no-unnecessary-condition: off`
- `no-unsafe-return: off`
- `no-unsafe-member-access: off`
- `no-unsafe-call: off`
- `no-non-null-assertion: off`
- `require-await: off`

**Enfoque:** No activar todo de golpe. Subir las más seguras primero:
1. `no-floating-promises` → `warn`
2. `no-misused-promises` → `warn`
3. `require-await` → `warn`
4. `no-unnecessary-condition` → `warn`

Dejar `no-unsafe-*` y `no-explicit-any` en `off` para tests.

**Verificación:** `npx eslint tests/ --quiet` → 0 errores.

---

### Fase C: TypeScript strict — `noUncheckedIndexedAccess` (riesgo medio)

**Objetivo:** Activar `noUncheckedIndexedAccess` en `tsconfig.json`.

**Archivo:** `tsconfig.json`

```json
{
  "compilerOptions": {
    "noUncheckedIndexedAccess": true
  }
}
```

**Impacto:** Cada acceso a `array[i]` o `obj[key]` pasa a requerir verificación de undefined. Es la regla strict más impactante después de `strict: true`.

**Verificación:** `npx tsc --noEmit` → 0 errores (esperable: muchos, pero todos mecánicos).

---

### Fase D: Documentación (bajo riesgo, alto impacto)

**Objetivo:** Sincronizar docs con el estado real del proyecto.

#### D1: Actualizar `docs/coverage-report.md`

Ejecutar `npx vitest run --coverage`, parsear output, generar tabla markdown.

**Verificación:** `diff docs/coverage-report.md` muestra datos actualizados.

#### D2: Revisar `docs/agent-quickstart.md`

Verificar que comandos, paths, y flags coinciden con la implementación actual.

#### D3: Revisar `docs/human-quickstart.md`

Ídem para la guía humana.

#### D4: `docs/security/REPORTE_SEGURIDAD_FASE2.md`

Existe FASE1. Crear FASE2 cubriendo:
- npm cache en workflows CI
- Multi-stage Dockerfile verificado
- `.npmrc` ausente o en `.gitignore`
- `.env.test.example` sin secretos reales

#### D5: Revisar `TASKS.md`

Asegurar que refleja el estado post-cobertura. Eliminar tareas completadas.

---

### Fase E: Seguridad (riesgo variable)

**Objetivo:** Cerrar hallazgos de FASE1, ejecutar FASE2.

#### E1: npm cache en workflows CI

Verificar `.github/workflows/*.yml` — actualmente no hay cache de npm/pnpm configurado. Evaluar si añadir `pnpm/store` cache mejora tiempos.

#### E2: Multi-stage Dockerfile

Verificar `Dockerfile` y `Dockerfile.bridge` usan multi-stage build.

#### E3: `.npmrc`

Confirmar que no existe, o que está en `.gitignore`.

#### E4: `.env.test.example`

Revisar que no contiene secretos reales (tokens, contraseñas, API keys).

#### E5: `docs/security/REPORTE_SEGURIDAD_FASE2.md`

Documentar hallazgos de E1-E4.

---

### Fase F: Arquitectura — stubs y dead code (riesgo medio)

**Objetivo:** Evaluar si maintainer stubs sin implementar.

#### F1: `src/calendar.ts` (0% coverage)

Es un stub. Decidir: implementar CalDAV real o eliminar.

#### F2: `src/agent-cli.ts` (0% coverage)

CLI stub. Decidir: implementar CLI con comandos o eliminar.

#### F3: `src/server/index.ts` (0% coverage)

Barrel export. Decidir si mantener o re-exportar desde otro lado.

#### F4: `src/agent/types.ts` (0% coverage)

Tipos. Verificar si se usan o son muertos.

#### F5: `calendar-types.ts` (0% coverage)

Tipos CalDAV. Idem.

---

### Fase G: Cobertura de branches (opcional, rendimiento decreciente)

**Objetivo:** Cerrar los últimos gaps de branches en módulos >90%.

| Módulo | Stmts | Branches | Gap |
|--------|-------|----------|-----|
| `smtp.ts` | 98.55% | **79.1%** | líneas 109-111 |
| `agent/setup.ts` | 100% | **90%** | líneas 30, 74 |
| `server/drive.ts` | 99.49% | **85.22%** | líneas 97, 104, 282 |
| `server/suite.ts` | 98.38% | **92.3%** | líneas 72-73 |
| `server.ts` | 100% | **95.12%** | líneas 210-211 |
| `imap.ts` | 93.6% | **91.42%** | ~30,231,242-245 |
| `server/mail.ts` | 100% | **95.94%** | líneas 74, 679-680 |

**Rendimiento:** Cada punto de branches cuesta más que en rondas anteriores. Priorizar solo `smtp.ts` (79.1%) y `server/drive.ts` (85.22%).

---

## 3. Priorización Recomendada

| Prioridad | Fase | Impacto | Riesgo | Tiempo estimado |
|-----------|------|---------|--------|----------------|
| **P0** | D1: coverage-report.md | Alto (información actualizada) | Bajo | 10 min |
| **P0** | E4: .env.test.example review | Alto (seguridad) | Bajo | 5 min |
| **P1** | A1: no-explicit-any → error | Medio (calidad código) | Bajo | 30 min |
| **P1** | A5: require-await → error | Medio (claridad) | Bajo | 15 min |
| **P2** | C: noUncheckedIndexedAccess | Alto (type safety) | Medio | 1-2h |
| **P2** | D3-D4: quickstarts + FASE2 | Medio (docs frescas) | Bajo | 1h |
| **P3** | A4: no-unsafe-* gradual | Alto (type safety) | Alto | 2-4h |
| **P3** | B: tests/ lint hardening | Medio | Medio | 1-2h |
| **P4** | F: stubs evaluation | Bajo (depende de roadmap) | Bajo | 30 min análisis |
| **P4** | G: cobertura smtp.ts | Bajo (95% → 97%) | Bajo | 30 min |

---

## 4. Plan de Ejecución Sugerido

**Worktree 1 (fases P0):** Actualizar docs + revisar .env
**Worktree 2 (fases P1):** Endurecer ESLint en src/
**Worktree 3 (fase P2):** TypeScript strict — noUncheckedIndexedAccess
**Worktree 4 (fase P2):** Docs + seguridad FASE2
**Worktree 5 (fase G opcional):** Cobertura smtp.ts + server/drive.ts
