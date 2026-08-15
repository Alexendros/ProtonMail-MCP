> **Estado: superseded** · Archivado 2026-08-15. No es fuente de verdad. Ver [docs/archive/README.md](../../README.md) y ADRs vigentes.

# Coverage Hunt — Top 5 Tests por Impacto Global

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Subir la cobertura global de **75.36% → ~83%** cubriendo los 5 módulos con peor cobertura y mayor impacto potencial.

**Architecture:** Los 5 targets son módulos con <10% cobertura (ecosystem/) o <8% (alerts/ntfy, webhook). Todos usan I/O (`execFileSync`, `fetch`, `existsSync`, `whichSync`) que debe mockearse. Los tests siguen el patrón `vi.mock` + `vi.hoisted` establecido en `tests/setup.test.ts` y `tests/diagnostics.test.ts`.

**Tech Stack:** TypeScript, Vitest, `vi.mock('node:child_process')`, `vi.mock('node:fs')`, `vi.mock('node:fetch')`, `vi.hoisted()` para shared state.

## Situación Actual

| Módulo | Cobertura | Líneas | Impacto estimado |
|--------|-----------|--------|-----------------|
| ecodiscovery.ts | **7.33%** | 134 | ~+2.8% global |
| eco/installer.ts | **7.69%** | 91 | ~+1.9% global |
| eco/updater.ts | **5.35%** | 73 | ~+1.6% global |
| eco/binaries.ts | **50.64%** | 108 | ~+1.2% global |
| alerts/ntfy.ts | **3.70%** | 32 | ~+0.7% global |
| alerts/webhook.ts | **7.69%** | 16 | ~+0.3% global |
| **Total ecosystem/** | **17.5%** | 406 | **~+7.5%** |
| **Total alerts/** | **66.47%** | — | **~+1.0%** |

> **Nota sobre el estado de los módulos mencionados originalmente:** `agent/setup.ts` (3.94%) y `server/suite.ts` (16.93%) ya están al 100% y 98.38% respectivamente tras la ronda anterior de tests.

## Global Constraints

- Usar `vi.mock` para mockear módulos del sistema (`node:child_process`, `node:fs`, etc.)
- Usar `vi.hoisted()` para shared state entre factories de mock (patrón establecido en tests previos)
- Los mocks de constructores (clases) deben definirse como clases dentro de `vi.hoisted()`
- `beforeEach` debe llamar `vi.clearAllMocks()`
- No modificar el código fuente — solo añadir archivos de test
- Seguir el patrón `tests/<module>.test.ts` ya establecido

---

### Task 1: `ecosystem/discovery.ts` (7.33%, 134 líneas)

**Files:**
- Create: `tests/ecosystem/discovery.test.ts`
- Source: `src/ecosystem/discovery.ts`, `src/ecosystem/binaries.ts`, `src/which.ts`

**Interfaces:**
- Consumes: `resolveBinPath(bin: BinaryInfo): string | undefined`, `checkBinary(bin: BinaryInfo): BinaryVersion`, `checkAllBinaries(): BinaryVersion[]`, `discoverSubcommands(bin: BinaryInfo): DiscoveryResult`, `parseHelpOutput(help: string, product: string): Subcommand[]`
- Produces: ~40 tests cubriendo todas las funciones exportadas y sus ramas

**Mocks necesarios:**
- `vi.mock('node:child_process')` → `execFileSync` controlado
- `vi.mock('node:fs')` → `existsSync` controlado  
- `vi.mock('../../src/which.js')` → `whichSync` que puede lanzar o devolver path
- `vi.mock('../../src/ecosystem/binaries.js')` → `REGISTRY` con datos mock

**Árbol de tests (~40):**

```
resolveBinPath
├── devuelve envPath cuando envVar existe y existsSync es true
├── devuelve undefined cuando envVar no está definida
├── devuelve whichSync(bin.defaultBin) cuando no hay envVar
├── devuelve undefined cuando whichSync lanza
├── var env existe pero archivo no existe → fallback a whichSync
└── envVar existe, archivo existe → devuelve envPath (no llama whichSync)

checkBinary
├── resuelve path → no instalado → version/authenticated undefined
├── resuelve path → instalado → version parse OK, sin healthCmd
├── resuelve path → instalado → execFileSync versionCmd lanza → version undefined
├── resuelve path → instalado → healthCmd ok → authenticated=true
├── resuelve path → instalado → healthCmd lanza → authenticated=false
├── no resuelve path → { installed: false, error, inPath: false }

checkAllBinaries
├── REGISTRY con 3 items → devuelve 3 BinaryVersion
└── REGISTRY vacío → devuelve []

discoverSubcommands
├── checkBinary devuelve no instalado → { version, subcommands:[], rawHelp:'' }
├── instalado → execFileSync --help ok → parsea subcommands
├── instalado → execFileSync --help ok → output sin comandos → [](segundo pass)
├── instalado → execFileSync --help lanza → { version, subcommands:[], rawHelp:'' }
└── instalado → help con "Commands:" header → segundo pass extrae comandos

parseHelpOutput
├── líneas con indent 2 → extrae name y description
├── primer pass no encuentra → segundo pass busca "Commands:"
├── "Commands:" header seguido de whitespace → corta
└── sin comandos → []
```

---

### Task 2: `ecosystem/installer.ts` (7.69%, 91 líneas)

**Files:**
- Create: `tests/ecosystem/installer.test.ts`
- Source: `src/ecosystem/installer.ts`, `src/ecosystem/binaries.ts`, `src/which.ts`

**Interfaces:**
- Consumes: `installOnUbuntu(bin: BinaryInfo): InstallResult`, `buildInstallPlan(bin: BinaryInfo): InstallResult`, `platformPackage(bin: BinaryInfo): string | null`, `runApt(args: string[]): InstallResult` (privada)
- Produces: ~20 tests cubriendo todos los productos + errores

**Mocks:**
- `vi.mock('node:child_process')` → `execFileSync` controlado
- `vi.mock('../../src/ecosystem/binaries.js')` → `installationGuide` con pasos mock
- `vi.mock('../../src/which.js')` → `Platform` y `Codename` mockeados

**Árbol de tests (~20):**

```
installOnUbuntu
├── product='pass' → llama runApt(['install', 'pass', 'gpg', 'tree'])
│   ├── apt success → { ok: true, message: 'Installed via apt...' }
│   └── apt fail → { ok: false, message: error string }
├── product='gpg' → llama runApt(['install', 'gnupg2'])
│   └── (mismos subcasos)
├── product='drive' → { ok: false, steps con wget+chmod }
└── product='bridge' (fallback) → { ok: false, steps con .deb + docker }

buildInstallPlan
├── bin product conocido → { product, ok: false, steps: guide.steps }
└── guide con steps vacío

platformPackage
├── Platform='arch' → bridge→protonmail-bridge-core, pass→pass, gpg→gnupg
├── Platform='debian' → pass→pass, gpg→gnupg2
├── Platform='macos' → pass→pass, gpg→gnupg
├── product no mapeado → null
└── Platform no mapeado → null
```

---

### Task 3: `ecosystem/updater.ts` (5.35%, 73 líneas)

**Files:**
- Create: `tests/ecosystem/updater.test.ts`
- Source: `src/ecosystem/updater.ts`, `src/ecosystem/discovery.ts`, `src/ecosystem/binaries.ts`

**Interfaces:**
- Consumes: `checkUpdateFor(bin: BinaryInfo): UpdateCheckResult`, `fetchLatestVersion(bin: BinaryInfo): string | undefined` (privada), `getPackageManager(): string` (privada)
- Produces: ~15 tests

**Mocks:**
- `vi.mock('node:child_process')` → `execFileSync` para version check + apt policy
- `vi.mock('../../src/ecosystem/discovery.js')` → `checkBinary` controlado
- `vi.mock('../../src/ecosystem/binaries.js')` → `REGISTRY` + BinaryInfo

**Árbol de tests (~15):**

```
checkUpdateFor
├── checkBinary devuelve no instalado → { updatable: false, error: 'not installed' }
├── checkBinary devuelve instalado sin version → { updatable: false, error }
├── checkBinary ok → fetchLatestVersion devuelve undefined → { updatable: false }
├── checkBinary ok → fetchLatestVersion = misma versión → { updatable: false }
├── checkBinary ok → fetchLatestVersion = distinta → { updatable: true }
└── checkBinary ok → fetchLatestVersion lanza → { updatable: false }

fetchLatestVersion (se prueba a través de checkUpdateFor)
├── product='drive' → undefined
├── product='gpg' → undefined
├── product='bridge' → undefined
├── product='pass' + apt policy ok → versión del candidato
├── product='pass' + apt policy ok → sin match de regex → undefined
└── product='pass' + apt policy lanza → undefined

getPackageManager
├── 'apt' disponible → 'apt'
├── 'apt' no disponible, 'pacman' disponible → 'pacman'
├── apt ni pacman disponibles → 'brew'
└── (ejecutar execFileSync secuencialmente con mockResolvedValueOnce)
```

---

### Task 4: `alerts/ntfy.ts` (3.70%, 32 líneas)

**Files:**
- Create: `tests/alerts/ntfy.test.ts`
- Source: `src/alerts/ntfy.ts`, `src/alerts/types.ts`

**Interfaces:**
- Consumes: `new NtfyAlertSink(url, topic, token?)`, `sink.emit(event: AlertEvent): Promise<void>`
- Produces: ~8 tests

**Mocks:**
- `vi.mock('node:fetch', ...)` o mock global `fetch` (Vitest lo expone como global)

**Árbol de tests (~8):**

```
NtfyAlertSink.emit
├── sin token → POST a url/topic con body plain/text, sin Authorization
│   ├── res.ok=true → resuelve sin error
│   └── res.ok=false → lanza Error con status
├── con token → POST con Authorization: Bearer <token>
├── con context → body incluye "Context: {...}"
├── sin context → body sin línea "Context:"
└── severidad uppercase en título ([CRITICAL], [WARNING], etc.)
```

---

### Task 5: `alerts/webhook.ts` (7.69%, 16 líneas)

**Files:**
- Create: `tests/alerts/webhook.test.ts`
- Source: `src/alerts/webhook.ts`, `src/alerts/types.ts`

**Interfaces:**
- Consumes: `new WebhookAlertSink(url)`, `sink.emit(event: AlertEvent): Promise<void>`
- Produces: ~4 tests

**Mocks:**
- `vi.mock('node:fetch', ...)` o mock global `fetch`

**Árbol de tests (~4):**

```
WebhookAlertSink.emit
├── POST a url con Content-Type application/json y body JSON.stringify(event)
│   ├── res.ok=true → resuelve sin error
│   └── res.ok=false → lanza Error con status
└── múltiples events emitidos secuencialmente (verificar body cada uno)
```

---

## Impacto Estimado

| Task | Módulo | Coverage actual | Coverage objetivo | Impacto global |
|------|--------|----------------|-------------------|---------------|
| 1 | `ecosystem/discovery.ts` | 7.33% | ~95% | +2.8pp |
| 2 | `ecosystem/installer.ts` | 7.69% | ~95% | +1.9pp |
| 3 | `ecosystem/updater.ts` | 5.35% | ~95% | +1.6pp |
| 4 | `alerts/ntfy.ts` | 3.70% | 100% | +0.7pp |
| 5 | `alerts/webhook.ts` | 7.69% | 100% | +0.3pp |
| **Total** | | **75.36%** | **~83%** | **+7.3pp** |

## Verificación

Después de cada tarea:
- `pnpm run typecheck` — debe pasar sin errores
- `pnpm run test -- tests/<path>/<file>.test.ts --reporter=verbose` — pasa/falla por test
- `pnpm run coverage 2>&1 | grep -E "^(ecosystem|alerts|All files)"` — verificar mejora

Al finalizar las 5 tareas:
- `pnpm run coverage` — cobertura global debe estar cerca de 83%
- `pnpm run test` — todos los tests pasan
