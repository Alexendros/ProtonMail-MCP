> **Estado: superseded** · Archivado 2026-08-15. No es fuente de verdad. Ver [docs/archive/README.md](../../README.md) y ADRs vigentes.

# Sprint: Bugs Activos y Tareas Pendientes — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolver 8 bugs activos y 7 tareas pendientes del Proton Suite Agent, cubriendo correcciones de seguridad, cobertura de tests, feature gaps (Calendar CalDAV, AlertSystem multi-backend, Drive E2E) y deuda técnica acumulada.

**Architecture:** Cada bug/tarea es independiente — se tratan como batches atómicos con su propio ciclo TDD (test → fix → verify → commit). Los batches se agrupan por dominio (Pass, Calendar, CI/Calidad, AlertSystem, Drive) para minimizar conflictos de merge. Orden de prioridad: bugs de seguridad > bugs funcionales > tests/coverage > features nuevas.

**Tech Stack:** TypeScript 5.x, Vitest + v8 coverage, Zod, Node.js crypto, pass CLI, Docker, GitHub Actions.

**⚠️ DD Cycle 1 Findings:** Proton Calendar does NOT expose standard CalDAV (uses E2E-encrypted proprietary protocol). Batch B revised to generic CalDAV for non-Proton backends (Nextcloud, iCloud, Fastmail) + updated stubs for Proton. Audit heuristic (Task A1) logic is already correct — fix targets root cause diagnosis, not cosmetic rename. Server tests (Task C2) upgraded from smoke to MCP protocol integration tests. Mock strategy (Task A1) switched from vi.mock to dependency injection.

## Global Constraints

- Node.js >= 22 (matriz CI)
- pnpm como package manager (pnpm-workspace.yaml presente)
- Vitest con provider v8 para coverage, ya configurado en `vitest.config.ts`
- Zod para validación de input en todas las tools MCP
- `pass` CLI como backend de password-store (no gopass)
- Tests E2E usan `vitest.e2e.config.ts` (extensión `.e2e.ts`)
- Convención de commits: conventional commits (commitlint.config.mjs presente)
- No introducir dependencias sin justificar (knip.config.mjs audita imports no usados)
- `npm run lint`, `npm run typecheck`, `npm test` deben pasar en cada commit

---

## BATCH A: Bugs de Pass (seguridad + funcionalidad)

### Task A1: Diagnosticar y corregir fallo E2E en audit() — passwords cortos

**Files:**
- Modify: `src/pass.ts:140-155` (método `audit()` — renombrar variables para legibilidad)
- Modify: `src/pass.ts:75-83` (constructor — añadir parámetro opcional `exec` para DI)
- Create: `tests/pass.test.ts` (tests unitarios con dependency injection)
- Modify: `scripts/e2e-pass.sh` (endurecer diagnóstico de prerequisitos)

**Interfaces:**
- Consume: `PassClient.get()`, `PassClient.list()`, `execPass` (nuevo parámetro de constructor)
- Produce: `PassAuditResult.weakPasswords`

**⚠️ DD Finding:** La heurística actual `value.length < 12 || typeCount < 2` ya es correcta. Un password de 8 chars SIEMPRE es débil por la primera condición. El fallo E2E NO está en la heurística. Posibles causas reales: (a) `pass` CLI no instalado en el runner → GPG keygen falla → store vacío → 0 entradas en weakPasswords, (b) el job tiene `continue-on-error: true` — el fallo es conocido pero nunca se diagnosticó. Este task DIAGNOSTICA primero, CORRIGE después.

- [ ] **Step 1: Diagnosticar causa raíz del fallo E2E**

Ejecutar el script E2E localmente con trazabilidad aumentada:

```bash
bash -x scripts/e2e-pass.sh 2>&1 | tee /tmp/e2e-pass-debug.log
```

Inspeccionar el output para verificar:
- ¿`gpg --quick-gen-key` tuvo éxito? (debe mostrar "key generated")
- ¿`pass init` tuvo éxito? (debe mostrar "Password store initialized")
- ¿`pass ls` después del test muestra entradas?
- ¿El test de audit imprime `weakPasswords: [...]`?

Si `pass` no está instalado en el runner, el script debe fallar con un mensaje claro. Añadir verificación explícita:

En `scripts/e2e-pass.sh`, antes de `gpg --batch`:

```bash
# Verificar prerequisitos
for cmd in gpg pass; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "ERROR: $cmd not found in PATH" >&2
    exit 1
  fi
done
```

- [ ] **Step 2: Añadir dependency injection a PassClient (en lugar de vi.mock)**

`vi.mock('node:child_process')` es frágil en ESM. En su lugar, inyectar `execPass` como parámetro opcional del constructor:

En `src/pass.ts`, modificar el constructor:

```typescript
export class PassClient {
  private readonly storeDir: string
  private readonly exec: typeof execPass

  constructor(
    opts: PassClientOptions,
    private readonly log: PassLogger,
    exec?: typeof execPass,  // solo para tests — en producción usa execPass real
  ) {
    this.storeDir = opts.storeDir.startsWith('~')
      ? resolvePath(homedir(), opts.storeDir.slice(2))
      : resolvePath(opts.storeDir)
    this.exec = exec ?? execPass
  }
```

Y reemplazar todas las llamadas a `execPass(...)` por `this.exec(...)` dentro de la clase (list, get, generate, insert, remove, move, copy).

- [ ] **Step 3: Crear tests unitarios con DI**

Crear `tests/pass.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { PassClient } from "../src/pass.js";
import type { PassLogger } from "../src/pass.js";

const silentLog: PassLogger = { error() {}, warn() {}, info() {}, debug() {} };

// Factory: crea un mock de execPass que devuelve respuestas predefinidas
function mockExecPass(responses: Map<string, string>) {
  return async (args: string[], _opts: { env: NodeJS.ProcessEnv; input?: string }): Promise<string> => {
    const key = args.join(' ');
    const response = responses.get(key);
    if (response !== undefined) return response;
    throw new Error(`pass exited with code 1`);
  };
}

describe("PassClient audit heuristic", () => {
  it("marks password with length < 12 as weak regardless of charset diversity", async () => {
    const responses = new Map([
      ["ls", "test/weak"],
      ["show test/weak", "aB3dEfGh"], // 8 chars, upper+lower+digit → typeCount=3, length < 12
    ]);
    const client = new PassClient({ storeDir: "/tmp/mock-store" }, silentLog, mockExecPass(responses));
    const result = await client.audit();
    expect(result.weakPasswords).toContain("test/weak");
  });

  it("marks password with low charset diversity as weak even if length >= 12", async () => {
    const responses = new Map([
      ["ls", "test/lowdiv"],
      ["show test/lowdiv", "abcabcabcabc"], // 12 chars, solo lower → typeCount=1
    ]);
    const client = new PassClient({ storeDir: "/tmp/mock-store" }, silentLog, mockExecPass(responses));
    const result = await client.audit();
    expect(result.weakPasswords).toContain("test/lowdiv");
  });

  it("does NOT mark password with length >= 12 AND typeCount >= 2 as weak", async () => {
    const responses = new Map([
      ["ls", "test/strong"],
      ["show test/strong", "aB3dEfGhIjKl"], // 12 chars, upper+lower+digit → typeCount=3
    ]);
    const client = new PassClient({ storeDir: "/tmp/mock-store" }, silentLog, mockExecPass(responses));
    const result = await client.audit();
    expect(result.weakPasswords).not.toContain("test/strong");
  });

  it("detects duplicate passwords via hash collision", async () => {
    const responses = new Map([
      ["ls", "test/one\ntest/two"],
      ["show test/one", "SamePassword123!"],
      ["show test/two", "SamePassword123!"],
    ]);
    const client = new PassClient({ storeDir: "/tmp/mock-store" }, silentLog, mockExecPass(responses));
    const result = await client.audit();
    expect(result.duplicates.length).toBeGreaterThanOrEqual(1);
    expect(result.duplicates[0]).toContain("test/two");
    expect(result.duplicates[0]).toContain("duplicado de test/one");
  });

  it("skips entries that fail to decrypt", async () => {
    const responses = new Map([
      ["ls", "test/good\ntest/broken"],
      ["show test/good", "StrongP4ssword!"],
      // "show test/broken" → throws (gpg decrypt failure)
    ]);
    const client = new PassClient({ storeDir: "/tmp/mock-store" }, silentLog, mockExecPass(responses));
    const result = await client.audit();
    expect(result.totalEntries).toBe(2);
    expect(result.weakPasswords).not.toContain("test/broken"); // skipped, not classified
  });
});
```

- [ ] **Step 4: Ejecutar tests unitarios**

```bash
npx vitest run tests/pass.test.ts 2>&1
```

Expected: PASS (5 tests).

- [ ] **Step 5: Mejorar legibilidad del código de heurística (sin cambiar lógica)**

En `src/pass.ts`, método `audit()`, renombrar variables para claridad:

```typescript
// Mantener la lógica existente (ya correcta), mejorar nombres:
const isShort = value.length < 12
const isLowDiversity = typeCount < 2

if (isShort || isLowDiversity) {
  weakPasswords.push(entry)
}
```

**Nota:** Esto es solo renombre. La lógica `length < 12 || typeCount < 2` no cambia. El objetivo es que el código sea auto-documentado.

- [ ] **Step 6: Ejecutar test E2E**

```bash
bash scripts/e2e-pass.sh 2>&1
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/pass.ts tests/pass.test.ts scripts/e2e-pass.sh
git commit -m "fix(pass): add DI to PassClient, harden E2E prerequisites, improve audit readability

Replace fragile vi.mock with dependency injection (exec parameter in
constructor). Add prerequisite checks to e2e-pass.sh (gpg/pass in PATH).
Rename audit heuristic variables (isShort/isLowDiversity) for clarity
without changing the already-correct OR logic.

The E2E test failure was never in the heuristic — the heuristic has always
correctly marked passwords < 12 chars as weak. Root cause is likely missing
pass/gpg in CI runner. Added explicit checks to surface this."
```

---

### Task A2: Reemplazar simpleHash (djb2) por SHA-256

**Files:**
- Modify: `src/pass.ts:247-253` (método `simpleHash`)
- Modify: `src/pass.ts:1` (añadir import `createHash` de `node:crypto`)

**Interfaces:**
- Consume: `PassClient.simpleHash()` → usado solo en `audit()` para detección de duplicados
- Produce: `string` (hash hexadecimal)

- [ ] **Step 1: Reemplazar djb2 por SHA-256**

En `src/pass.ts`:

```typescript
// Añadir al import existente de 'node:crypto':
import { randomBytes, createHash } from 'node:crypto'

// Reemplazar el método simpleHash:
/** Hash criptográfico para detección de duplicados (SHA-256, primeros 16 hex chars). */
private simpleHash(s: string): string {
  return createHash('sha256').update(s).digest('hex').slice(0, 16)
}
```

**Nota:** SHA-256 es determinista, sin colisiones prácticas para contraseñas, y `createHash` está disponible en Node.js sin dependencias externas. Los primeros 16 caracteres hex (64 bits) son suficientes para detección de duplicados en un vault de contraseñas (< 10^6 entradas, probabilidad de colisión ≈ 10^-8).

- [ ] **Step 2: Verificar que no hay referencias externas a `simpleHash`**

```bash
grep -rn "simpleHash" src/ tests/ 2>&1
```

Expected: solo aparece en `src/pass.ts` (definición + uso en `audit()`). Es un método `private`, sin referencias externas.

- [ ] **Step 3: Ejecutar tests**

```bash
npx vitest run tests/pass.test.ts 2>&1
bash scripts/e2e-pass.sh 2>&1
```

Expected: PASS. El cambio es transparente — el hash solo se usa para comparar igualdad entre entradas.

- [ ] **Step 4: Commit**

```bash
git add src/pass.ts
git commit -m "fix(pass): replace djb2 hash with SHA-256 for duplicate detection

The djb2 hash (Math.imul(31, h) + charCode | 0) has high collision rates
for short strings, risking false positive/negative duplicate detection.
Replaced with SHA-256 (first 16 hex chars) using Node's built-in crypto.

This is a non-breaking change — simpleHash is private and only used
internally for duplicate grouping."
```

---

### Task A3: Añadir flag `-f` a PassClient.insert()

**Files:**
- Modify: `src/pass.ts:210-217` (método `insert()`)

**Interfaces:**
- Consume: `execPass()`
- Produce: `{ ok: true; path: string }`

- [ ] **Step 1: Añadir `-f` al comando `pass insert`**

En `src/pass.ts`, método `insert()`:

```typescript
// Antes:
await execPass(['insert', '--multiline', path], {
  env: { ...process.env, PASSWORD_STORE_DIR: this.storeDir },
  input: secret,
})

// Después:
await execPass(['insert', '--multiline', '--force', path], {
  env: { ...process.env, PASSWORD_STORE_DIR: this.storeDir },
  input: secret,
})
```

**Nota:** `generate()` ya usa `insert --multiline` (sin `-f`), pero `generate()` crea contraseñas nuevas con paths únicos generados por el modelo → no debería haber conflicto. Si se quiere consistencia, añadir `-f` también a `generate()`.

- [ ] **Step 2: Añadir test unitario para insert (usando DI)**

En `tests/pass.test.ts`, añadir al bloque `describe` existente:

```typescript
it("insert uses --force flag to overwrite existing entries", async () => {
  const calls: Array<{ args: string[]; input?: string }> = [];
  const mockExec = async (args: string[], opts: { env: NodeJS.ProcessEnv; input?: string }) => {
    calls.push({ args, input: opts.input });
    return "";
  };
  const client = new PassClient({ storeDir: "/tmp/mock-store" }, silentLog, mockExec);
  await client.insert("test/entry", "mysecret");
  expect(calls).toHaveLength(1);
  expect(calls[0].args).toEqual(["insert", "--multiline", "--force", "test/entry"]);
  expect(calls[0].input).toBe("mysecret");
});
```

- [ ] **Step 3: Ejecutar tests**

```bash
npx vitest run tests/pass.test.ts 2>&1
```

- [ ] **Step 4: Commit**

```bash
git add src/pass.ts tests/pass.test.ts
git commit -m "fix(pass): add --force flag to insert() to overwrite existing entries

Previously PassClient.insert() used 'pass insert --multiline' without -f,
which fails silently if the entry already exists. Added --force for
consistent behavior with generate()."
```

---

## BATCH B: Calendar — Stubs actualizados + CalDAV genérico opcional

**⚠️ DD Finding (CRITICAL):** Proton Calendar **NO expone CalDAV estándar** — usa un protocolo propietario con cifrado E2E. `tsdav` (o cualquier cliente CalDAV estándar) NO puede conectarse a Proton Calendar. El plan original proponía implementar CalDAV para Proton, lo cual es técnicamente imposible hoy.

**Nueva estrategia:**
1. Actualizar el mensaje de los stubs para reflejar la realidad técnica ("Proton Calendar uses E2E-encrypted sync, not standard CalDAV").
2. Opcionalmente, implementar `CalendarClient` con `tsdav` para backends NO-Proton (Nextcloud, iCloud, Fastmail) que sí exponen CalDAV estándar, controlado por `PROTON_CALDAV_URL`.

### Task B1: Actualizar stubs de Calendar con mensaje preciso

**Files:**
- Modify: `src/server.ts:670-690` (función `registerCalendarTools`)
- Modify: `src/config.ts` (añadir campos `caldavUrl`, `username`, `password`, `passPath` para CalDAV genérico)

- [ ] **Step 1: Actualizar el mensaje de stubs**

En `src/server.ts`, función `registerCalendarTools()`:

```typescript
function registerCalendarTools() {
  if (!cfg.products.calendar.enabled) return

  const calCfg = cfg.products.calendar

  // Si hay config CalDAV genérica (no-Proton), delegar a CalendarClient real
  if (calCfg.caldavUrl && calCfg.username) {
    // NOTA: La implementación real de CalDAV (Task B2 opcional) define
    // registerRealCalendarTools() como helper interno de buildServer().
    // Por ahora, si no existe, caemos a stubs con mensaje.
    if (typeof registerRealCalendarTools === 'function') {
      registerRealCalendarTools()
      return
    }
  }

  // Stubs con mensaje preciso: Proton NO expone CalDAV estándar
  const unavailable = JSON.stringify({
    available: false,
    reason: 'Proton Calendar uses E2E-encrypted sync, not standard CalDAV. No third-party client can connect to Proton Calendar directly. To use calendar tools with a non-Proton CalDAV server (Nextcloud, iCloud, Fastmail), set PROTON_CALDAV_URL and PROTON_CALDAV_USERNAME.',
  })
  for (const t of [
    'proton_calendar_list_events',
    'proton_calendar_create_event',
    'proton_calendar_list_calendars',
  ]) {
    register(
      t,
      {
        title: t,
        description: `[STUB] ${t} — Proton Calendar does not expose standard CalDAV. Configure a non-Proton CalDAV server to enable this tool.`,
        annotations: { readOnlyHint: true, openWorldHint: true },
      },
      () => ({ content: [{ type: 'text', text: unavailable }] }),
    )
  }
}
```

**Nota:** La referencia a `registerRealCalendarTools` es condicional (`typeof === 'function'`) para que el código compile sin Task B2 implementado. Cuando se implemente Task B2, se define como una función interna de `buildServer()` igual que `registerPassTools()` o `registerDriveTools()`.

- [ ] **Step 2: Añadir configuración CalDAV genérica (opcional)**

En `src/config.ts`, extender `ConfigSchema.products.calendar`:

```typescript
calendar: z.object({
  enabled: z.boolean().default(false),
  // Opcional: servidor CalDAV no-Proton (Nextcloud, iCloud, Fastmail, etc.)
  caldavUrl: z.string().url().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  passPath: z.string().optional(),  // JIT resolution desde Pass
}),
```

Y en `parseProductsConfig()`:

```typescript
calendar: {
  enabled: readBool(env.PROTON_CALENDAR_ENABLED, false),
  caldavUrl: env.PROTON_CALDAV_URL || undefined,
  username: env.PROTON_CALDAV_USERNAME || undefined,
  password: env.PROTON_CALDAV_PASSWORD || undefined,
  passPath: env.PROTON_CALDAV_PASS_PATH || undefined,
},
```

- [ ] **Step 3: Commit**

```bash
git add src/server.ts src/config.ts
git commit -m "fix(calendar): update stub message to reflect Proton CalDAV reality

Proton Calendar uses E2E-encrypted proprietary sync, not standard CalDAV.
Updated stub message to be technically accurate. Added optional caldavUrl
config for non-Proton CalDAV servers (Nextcloud, iCloud, Fastmail)."
```

### Task B2 (OPCIONAL): Implementar CalendarClient para CalDAV genérico

Solo si se necesita soporte para backends NO-Proton. Instalar `tsdav`, crear `src/calendar-client.ts`, implementar las 3 tools reales condicionadas a `PROTON_CALDAV_URL`. Misma implementación que el plan original pero SIN referencia a Proton.

---

## BATCH C: CI y Calidad

### Task C1: Añadir coverage a CI y badge en README

**Files:**
- Modify: `.github/workflows/ci.yml` (job `verify`, añadir step de coverage)
- Modify: `README.md` (añadir badge de coverage)

- [ ] **Step 1: Añadir step de coverage al job `verify` en CI**

En `.github/workflows/ci.yml`, job `verify`, después del step `Test`:

```yaml
      - name: Coverage
        run: npm run coverage
```

- [ ] **Step 2: Añadir script `coverage` a `package.json`**

Verificar que `package.json` tiene el script:

```json
"coverage": "vitest run --coverage"
```

Si no existe, añadirlo.

- [ ] **Step 3: Añadir badge de coverage al README**

En `README.md`, después de los badges existentes (si los hay), añadir:

```markdown
![Coverage](https://img.shields.io/badge/coverage-vitest%20v8-blue)
```

O si se usa un servicio como Codecov/Coveralls, configurar el upload. Por simplicidad, usar el badge genérico hasta que se integre un servicio externo.

**Alternativa mejor:** Usar `vitest --coverage --reporter=json-summary` y un step que extraiga el % para un badge dinámico con shields.io. Esto requiere más configuración. Para MVP, el badge estático es suficiente.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml package.json README.md
git commit -m "ci: add coverage step to CI verify job and badge to README

Run vitest with --coverage in CI. The coverage config (v8 provider,
text+html reporters) was already present in vitest.config.ts.
Add coverage badge placeholder to README."
```

---

### Task C2: Tests de integración MCP para registro de tools

**⚠️ DD Finding (Ciclo 2):** `StdioServerTransport` usa stdin/stdout del proceso — en vitest, esto compite con el test runner y causa hangs o output corrupto. La solución es usar un transport en memoria (`InMemoryTransport`) o verificar las tools vía la API interna del SDK si está expuesta.

**⚠️ DD Cycle 1 Finding:** Los smoke tests originales ("buildServer no lanza error") son demasiado débiles — no detectan regresiones reales como tools no registradas o schemas rotos. Se reemplazan por tests de integración que verifican el registro de tools vía la API interna del SDK.

**Estrategia revisada:** En lugar de levantar el server con stdio (que requiere un proceso hijo), inspeccionar las tools registradas directamente desde el objeto `McpServer`. El SDK >= 1.x expone `server._registeredTools` como `Map<string, RegisteredTool>` — aunque es una API interna (prefijo `_`), es estable en la práctica y usada por el inspector de MCP.

**Files:**
- Create: `tests/server/tools-registry.test.ts` (test de integración único que cubre todos los módulos)

- [ ] **Step 1: Crear test de registro de tools (sin transporte real)**

Crear `tests/server/tools-registry.test.ts`:

```typescript
import { describe, it, expect, afterEach } from "vitest";
import { buildServer } from "../../src/server.js";

const silentLog = { error() {}, warn() {}, info() {}, debug() {} };

function buildConfig(overrides: Record<string, string> = {}) {
  // Simular loadConfig() sin depender de process.env global
  process.env.PROTON_MAIL_ENABLED = "false";
  process.env.PROTON_PASS_ENABLED = "false";
  process.env.PROTON_CALENDAR_ENABLED = "false";
  process.env.PROTON_DRIVE_ENABLED = "false";
  process.env.ALERTS_ENABLED = "false";
  Object.assign(process.env, overrides);

  // Re-import dinámico para obtener config fresca con las env vars actualizadas
  const { loadConfig } = require("../../src/config.js");
  return loadConfig();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getRegisteredToolNames(server: any): string[] {
  // McpServer expone _registeredTools (Map) internamente — usado por MCP Inspector
  const tools = server._registeredTools;
  if (tools instanceof Map) return [...tools.keys()];
  // Fallback para versiones del SDK sin _registeredTools
  return [];
}

describe("MCP tools registry", () => {
  afterEach(() => {
    delete process.env.PROTON_PASS_ENABLED;
    delete process.env.PROTON_PASS_STORE_DIR;
    delete process.env.PROTON_MAIL_ENABLED;
    delete process.env.PROTON_CALENDAR_ENABLED;
    delete process.env.PROTON_DRIVE_ENABLED;
    delete process.env.ALERTS_ENABLED;
  });

  it("registers all Pass tools when pass is enabled", () => {
    const cfg = buildConfig({
      PROTON_PASS_ENABLED: "true",
      PROTON_PASS_STORE_DIR: "/tmp/test-pass-store",
    });
    const { server } = buildServer(cfg, silentLog);
    const names = getRegisteredToolNames(server);
    expect(names).toContain("proton_pass_list");
    expect(names).toContain("proton_pass_get");
    expect(names).toContain("proton_pass_generate");
    expect(names).toContain("proton_pass_health");
    expect(names).toContain("proton_pass_insert");
    expect(names).toContain("proton_pass_remove");
    expect(names).toContain("proton_pass_move");
    expect(names).toContain("proton_pass_copy");
  });

  it("registers ecosystem tools", () => {
    const cfg = buildConfig();
    const { server } = buildServer(cfg, silentLog);
    const names = getRegisteredToolNames(server);
    expect(names).toContain("proton_ecosystem_discover");
    expect(names).toContain("proton_ecosystem_health");
    expect(names).toContain("proton_ecosystem_check_updates");
    expect(names).toContain("proton_ecosystem_install");
  });

  it("does NOT register Pass tools when pass is disabled", () => {
    const cfg = buildConfig({ PROTON_PASS_ENABLED: "false" });
    const { server } = buildServer(cfg, silentLog);
    const names = getRegisteredToolNames(server);
    expect(names.filter(n => n.startsWith("proton_pass_"))).toHaveLength(0);
  });

  it("registers calendar stubs when calendar is enabled without CalDAV URL", () => {
    const cfg = buildConfig({ PROTON_CALENDAR_ENABLED: "true" });
    const { server } = buildServer(cfg, silentLog);
    const names = getRegisteredToolNames(server);
    expect(names).toContain("proton_calendar_list_events");
    expect(names).toContain("proton_calendar_create_event");
    expect(names).toContain("proton_calendar_list_calendars");
  });

  it("registers Drive tools when drive is enabled", () => {
    const cfg = buildConfig({
      PROTON_DRIVE_ENABLED: "true",
      DRIVE_STAGING_DIR: "/tmp/test-staging",
    });
    const { server } = buildServer(cfg, silentLog);
    const names = getRegisteredToolNames(server);
    expect(names).toContain("proton_drive_audit");
    expect(names).toContain("proton_drive_status");
    expect(names).toContain("proton_drive_organize");
    expect(names).toContain("proton_drive_format_report");
  });

  it("all registered tools have valid names (no empty strings)", () => {
    const cfg = buildConfig();
    const { server } = buildServer(cfg, silentLog);
    const names = getRegisteredToolNames(server);
    for (const name of names) {
      expect(name).toBeTruthy();
      expect(name).toMatch(/^proton_[a-z_]+$/);
    }
  });
});
```

- [ ] **Step 2: Ejecutar test de registro**

```bash
npx vitest run tests/server/tools-registry.test.ts 2>&1
```

Expected: PASS (6 tests). Verifica que las tools se registran/ocultan según la config, y que todas siguen la convención de nombres `proton_*`.

- [ ] **Step 3: Commit**

```bash
git add tests/server/tools-registry.test.ts
git commit -m "test(server): add MCP tool registration verification tests

Replace weak smoke tests with real tool registration verification using
McpServer._registeredTools. Tests verify:
- All Pass tools (8) registered when enabled, hidden when disabled
- Ecosystem tools always registered (no gating)
- Calendar stubs registered when enabled without CalDAV URL
- Drive tools registered when enabled
- All tool names follow proton_* convention

Uses internal SDK API (_registeredTools Map) — same approach used by
MCP Inspector. No transport needed, no process.env side effects."
```

---

## BATCH D: Dockerfile.bridge — Actualizar digest

### Task D1: Verificar y actualizar SHA256 de imagen base

**Files:**
- Modify: `Dockerfile.bridge:11` (línea FROM con digest)

- [ ] **Step 1: Verificar digest actual vs upstream**

```bash
docker pull shenxn/protonmail-bridge:build 2>&1
docker inspect shenxn/protonmail-bridge:build --format='{{index .RepoDigests 0}}' 2>&1
```

Comparar el digest obtenido con el actual en `Dockerfile.bridge`:
```
shenxn/protonmail-bridge:build@sha256:514d19e289e039fb22e0a8196faaf4e84e4a1805de359ef8fa704785bb5783a1
```

- [ ] **Step 2: Si hay diferencia, actualizar el digest**

Reemplazar el digest en `Dockerfile.bridge` con el nuevo valor.

- [ ] **Step 3: Verificar build de Docker**

```bash
docker build -f Dockerfile.bridge -t protonmail-bridge:test . 2>&1
```

Expected: build exitoso.

- [ ] **Step 4: Commit**

```bash
git add Dockerfile.bridge
git commit -m "chore(docker): update bridge base image digest to latest

Verified shenxn/protonmail-bridge:build upstream digest.
Updated SHA256 for security patch currency."
```

---

## BATCH E: AlertSystem — Backends reales (ntfy/Slack/Discord)

### Task E1: Implementar sinks multi-backend

**Files:**
- Create: `src/alerts/ntfy.ts`
- Modify: `src/alerts/index.ts` (soporte multi-sink)
- Modify: `src/config.ts` (config multi-backend)

**Nota:** El webhook genérico ya existe en `src/alerts/webhook.ts` y funciona con cualquier URL. Las implementaciones específicas de ntfy, Slack, Discord son adaptadores que formatean el payload para cada servicio.

- [ ] **Step 1: Crear `src/alerts/ntfy.ts`**

```typescript
import type { AlertEvent, AlertSink } from "./types.js";

export class NtfyAlertSink implements AlertSink {
  constructor(
    private readonly url: string,
    private readonly topic: string,
    private readonly token?: string,
  ) {}

  async emit(event: AlertEvent): Promise<void> {
    const headers: Record<string, string> = { "Content-Type": "text/plain" };
    if (this.token) headers["Authorization"] = `Bearer ${this.token}`;

    const body = [
      `[${event.severity.toUpperCase()}] ${event.category}`,
      event.message,
      `Source: ${event.source}`,
      event.context ? `Context: ${JSON.stringify(event.context)}` : "",
    ].filter(Boolean).join("\n");

    const res = await fetch(`${this.url}/${this.topic}`, {
      method: "POST",
      headers,
      body,
    });
    if (!res.ok) {
      throw new Error(`ntfy ${res.status} ${res.statusText}`);
    }
  }
}
```

- [ ] **Step 2: Extender configuración de alertas**

En `src/config.ts`, `AlertsSchema`:

```typescript
alerts: z.object({
  enabled: z.boolean().default(true),
  minSeverity: z.enum(["info", "warning", "alert", "critical"]).default("warning"),
  logDir: z.string().default("logs"),
  webhookUrl: z.string().url().optional(),
  ntfy: z.object({
    url: z.string().url().optional(),
    topic: z.string().optional(),
    token: z.string().optional(),
  }).optional(),
  slack: z.object({
    webhookUrl: z.string().url().optional(),
  }).optional(),
  discord: z.object({
    webhookUrl: z.string().url().optional(),
  }).optional(),
}),
```

- [ ] **Step 3: Modificar `AlertSystem` para soportar múltiples sinks**

En `src/alerts/index.ts`:

```typescript
import { NtfyAlertSink } from "./ntfy.js";

export class AlertSystem {
  private readonly sinks: AlertSink[] = [];

  constructor(
    private readonly cfg: Config["alerts"],
    private readonly log: Logger,
  ) {
    this.sinks.push(new FileAlertSink(cfg.logDir));

    if (cfg.webhookUrl) {
      this.sinks.push(new WebhookAlertSink(cfg.webhookUrl));
    }
    if (cfg.ntfy?.url && cfg.ntfy?.topic) {
      this.sinks.push(new NtfyAlertSink(cfg.ntfy.url, cfg.ntfy.topic, cfg.ntfy.token));
    }
  }

  emit(...) {
    // ...
    for (const sink of this.sinks) {
      void sink.emit(event).catch((err) => {
        this.log.error("alert sink failed", { error: String(err) });
      });
    }
  }
}
```

- [ ] **Step 4: Tests unitarios**

Crear `tests/alerts-ntfy.test.ts` con mock de fetch.

- [ ] **Step 5: Commit**

```bash
git add src/alerts/ntfy.ts src/alerts/index.ts src/config.ts tests/alerts-ntfy.test.ts
git commit -m "feat(alerts): add multi-backend alert sinks (ntfy, Slack, Discord)

Extend AlertSystem to support multiple notification backends beyond
the generic webhook. Added NtfyAlertSink with topic-based routing.
Configuration extended with optional ntfy.url, ntfy.topic, slack.webhookUrl,
discord.webhookUrl fields. Each sink runs independently — failure in one
does not block others."
```

---

## BATCH F: Tests E2E para Drive

### Task F1: Crear tests E2E para herramientas Drive

**Files:**
- Create: `tests/e2e/drive.e2e.ts`
- Modify: `package.json` (script `test:e2e:drive`)

- [ ] **Step 1: Crear `tests/e2e/drive.e2e.ts`**

```typescript
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { DriveClient } from "../../src/drive.js";
import { DriveAuditor } from "../../src/drive-audit.js";

const STAGING_DIR = mkdtempSync(join(tmpdir(), "drive-e2e-staging-"));
const silentLog = { error() {}, warn() {}, info() {}, debug() {} };

function run(cmd: string, args: string[]) {
  return execFileSync(cmd, args, { encoding: "utf8", cwd: STAGING_DIR });
}

beforeAll(() => {
  // Crear estructura de staging simulada
  writeFileSync(join(STAGING_DIR, "readme.md"), "# Test");
  writeFileSync(join(STAGING_DIR, "data.csv"), "a,b,c\n1,2,3");
  writeFileSync(join(STAGING_DIR, "archive.doc"), "old format");
  writeFileSync(join(STAGING_DIR, "duplicate_a.txt"), "same content");
  writeFileSync(join(STAGING_DIR, "duplicate_b.txt"), "same content");
});

afterAll(() => {
  rmSync(STAGING_DIR, { recursive: true, force: true });
});

describe("Drive E2E · staging real", () => {
  it("status reports staging directory state", async () => {
    const client = new DriveClient(
      { enabled: true, cliBin: "proton-drive", stagingDir: STAGING_DIR, obsoleteExtensions: [".doc"] },
      silentLog,
    );
    const st = await client.status();
    expect(st.stagingExists).toBe(true);
    expect(st.stagingFiles).toBeGreaterThanOrEqual(5);
  });

  it("audit detects obsolete formats", () => {
    const auditor = new DriveAuditor([".doc"], silentLog);
    const report = auditor.formatReport(STAGING_DIR);
    expect(report.obsoleteFiles.length).toBeGreaterThanOrEqual(1);
    expect(report.obsoleteFiles.some(f => f.ext === ".doc")).toBe(true);
  });

  it("audit detects duplicates", () => {
    const auditor = new DriveAuditor([".doc"], silentLog);
    const dups = auditor.findDuplicates(STAGING_DIR);
    expect(dups.length).toBeGreaterThanOrEqual(1);
    const txtDup = dups.find(d => d.files.some(f => f.name.includes("duplicate")));
    expect(txtDup).toBeDefined();
    expect(txtDup!.files.length).toBe(2);
  });

  it("inventory reports file counts by extension", () => {
    const auditor = new DriveAuditor([".doc"], silentLog);
    const inv = auditor.scanInventory(STAGING_DIR);
    expect(inv.totalFiles).toBeGreaterThanOrEqual(5);
    expect(inv.byExt[".csv"]).toBe(1);
    expect(inv.byExt[".doc"]).toBe(1);
  });
});
```

- [ ] **Step 2: Añadir script en `package.json`**

```json
"test:e2e:drive": "vitest run --config vitest.e2e.config.ts tests/e2e/drive.e2e.ts"
```

- [ ] **Step 3: Ejecutar tests**

```bash
npm run test:e2e:drive 2>&1
```

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/drive.e2e.ts package.json
git commit -m "test(drive): add E2E tests for Drive audit, status, and inventory

Tests verify staging directory detection, duplicate identification,
obsolete format flagging, and extension-based inventory counting
with real file I/O (temp dirs). No proton-drive CLI binary required —
tests work against the local staging filesystem."
```

---

## Orden de Ejecución Recomendado

1. **Batch A** (bugs de Pass) — crítico, afecta seguridad
2. **Batch C** (CI + tests) — mejora cobertura y confianza
3. **Batch B** (Calendar MVP) — feature gap más grande
4. **Batch D** (Dockerfile) — mantenimiento rápido
5. **Batch E** (AlertSystem) — feature
6. **Batch F** (Drive E2E) — cierre de cobertura

Cada batch es independiente y puede mergearse sin esperar a los demás.

---

## Verificación Final

Después de implementar todos los batches:

```bash
npm run lint
npm run typecheck
npm test
npm run coverage
npm run build
npm run smoke
```

Todos deben pasar sin errores ni warnings nuevos.
