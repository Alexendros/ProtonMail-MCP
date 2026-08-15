> **Estado: superseded** · Archivado 2026-08-15. No es fuente de verdad. Ver [docs/archive/README.md](../../README.md) y ADRs vigentes.

# Proton Drive — Sincronización con rsync y Auditoría de Contenido

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrar Proton Drive en el agente usando rclone como backend de sincronización, con tools MCP de auditoría de contenido (inventario, formato, duplicados, organización) y agent goals.

**Architecture:** DriveSyncClient (src/drive.ts) wrapper sobre rclone — sincroniza con ProtonDrive a un staging dir local. DriveAuditor (src/drive-audit.ts) escanea el staging y genera reportes. Tools MCP condicionales en server.ts. Agent goals en executor.ts.

**Tech Stack:** TypeScript 5.7, rclone (dependencia externa), Node ≥22, Zod para schemas, Vitest para tests.

## Global Constraints

- Sin dependencias npm nuevas — solo rclone como binario externo.
- Logging siempre a stderr (nunca stdout).
- Todas las tools de lectura aceptan `response_format: "markdown" | "json"`.
- Las tools write (organize) usan dry-run por defecto.
- Tools Drive se registran condicionalmente cuando `DRIVE_RCLONE_REMOTE` está configurado.
- Secretos de Proton Drive viven solo en `rclone config`, nunca en el agente.
- Zod para validación de env y schemas de output.

---

### Task 1: Config schema + DriveClient base

**Files:**

- Modify: `src/config.ts`
- Modify: `src/drive.ts`
- Modify: `.env.example`
- Create: `tests/drive.test.ts`

**Interfaces:**

- Consumes: existing `ConfigSchema` pattern, existing `DriveClient` class
- Produces: `DriveConfig` (rcloneRemote, stagingDir, syncMode, rcloneBin, obsoleteExts), updated `DriveClient` constructor

- [ ] **Step 1: Add DriveConfig types to config.ts**

Add after the `products.drive` block (line ~58):

```typescript
export const DriveConfigSchema = z.object({
  rcloneRemote: z.string().optional(),
  stagingDir: z.string().default('~/.protonmail/drive/'),
  syncMode: z.enum(['pull', 'watch']).default('pull'),
  rcloneBin: z.string().default('rclone'),
  obsoleteExtensions: z
    .array(z.string())
    .default(['.doc', '.ppt', '.xls', '.bmp']),
})
```

Replace the `products.drive` block in ConfigSchema (~line 57-59) with the full schema:

```typescript
drive: DriveConfigSchema,
```

And remove the existing `products.drive: z.object({ enabled: z.boolean().default(false) })` block.

Export the inferred type:

```typescript
export type DriveConfig = z.infer<typeof DriveConfigSchema>
```

- [ ] **Step 2: Extend parseProductsConfig for Drive**

Replace the drive block inside `parseProductsConfig` (~line 168-170):

```typescript
drive: {
  enabled: readBool(env.PROTON_DRIVE_ENABLED, false),
  rcloneRemote: env.DRIVE_RCLONE_REMOTE || undefined,
  stagingDir: env.DRIVE_STAGING_DIR ?? "~/.protonmail/drive/",
  syncMode: (env.DRIVE_SYNC_MODE ?? "pull") as "pull" | "watch",
  rcloneBin: env.DRIVE_RCLONE_BIN ?? "rclone",
  obsoleteExtensions: readCsv(env.DRIVE_OBSOLETE_EXTENSIONS).length > 0
    ? readCsv(env.DRIVE_OBSOLETE_EXTENSIONS)
    : [".doc", ".ppt", ".xls", ".bmp"],
},
```

- [ ] **Step 3: Update DriveClient constructor in src/drive.ts**

Replace entire `src/drive.ts` with the new base:

```typescript
import { execSync, execFile } from 'node:child_process'
import { readdirSync, statSync, mkdirSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

export interface DriveFile {
  id: string
  name: string
  mimeType: string
  size: number
  modifiedTime: string
  parentId?: string
  path: string
}

export interface DriveConfig {
  rcloneRemote?: string
  stagingDir: string
  syncMode: 'pull' | 'watch'
  rcloneBin: string
  obsoleteExtensions: string[]
}

export class DriveClient {
  constructor(
    public opts: DriveConfig,
    private log: {
      debug: (m: string, d?: unknown) => void
      info: (m: string, d?: unknown) => void
      error: (m: string, d?: unknown) => void
    },
  ) {}

  get stagingDir(): string {
    return resolve(this.opts.stagingDir.replace(/^~/, process.env.HOME ?? ''))
  }

  get rcloneBin(): string {
    return this.opts.rcloneBin
  }

  get remotePrefix(): string {
    return `${this.opts.rcloneRemote ?? ''}`
  }

  async execRclone(
    args: string[],
  ): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolvePromise, reject) => {
      const child = execFile(
        this.rcloneBin,
        args,
        { maxBuffer: 50 * 1024 * 1024 },
        (err, stdout, stderr) => {
          if (err) {
            reject(new Error(`rclone error: ${err.message}\nstderr: ${stderr}`))
            return
          }
          resolvePromise({ stdout, stderr })
        },
      )
    })
  }

  checkDeps(): { ok: boolean; error?: string } {
    try {
      const out = execSync(`${this.rcloneBin} --version`, {
        encoding: 'utf-8',
        timeout: 5000,
      })
      if (!this.opts.rcloneRemote)
        return { ok: false, error: 'DRIVE_RCLONE_REMOTE not set' }
      return { ok: true }
    } catch (err) {
      return { ok: false, error: `rclone not found: ${(err as Error).message}` }
    }
  }
}
```

- [ ] **Step 4: Write failing tests for DriveClient**

Create `tests/drive.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { DriveClient } from '../src/drive.js'

describe('DriveClient', () => {
  it('should resolve staging dir', () => {
    const dc = new DriveClient(
      {
        rcloneRemote: 'proton-drive:',
        stagingDir: '/tmp/test-drive',
        syncMode: 'pull',
        rcloneBin: 'rclone',
        obsoleteExtensions: [],
      },
      { debug: () => {}, info: () => {}, error: () => {} },
    )
    expect(dc.stagingDir).toBe('/tmp/test-drive')
  })

  it('should expand ~ in staging dir', () => {
    const dc = new DriveClient(
      {
        rcloneRemote: 'proton-drive:',
        stagingDir: '~/test-drive',
        syncMode: 'pull',
        rcloneBin: 'rclone',
        obsoleteExtensions: [],
      },
      { debug: () => {}, info: () => {}, error: () => {} },
    )
    expect(dc.stagingDir).toBe(`${process.env.HOME}/test-drive`)
  })

  it('should build remote prefix', () => {
    const dc = new DriveClient(
      {
        rcloneRemote: 'proton-drive:',
        stagingDir: '/tmp/d',
        syncMode: 'pull',
        rcloneBin: 'rclone',
        obsoleteExtensions: [],
      },
      { debug: () => {}, info: () => {}, error: () => {} },
    )
    expect(dc.remotePrefix).toBe('proton-drive:')
  })

  it('should return error when rclone not found', () => {
    const dc = new DriveClient(
      {
        rcloneRemote: 'proton-drive:',
        stagingDir: '/tmp/d',
        syncMode: 'pull',
        rcloneBin: '/nonexistent/rclone',
        obsoleteExtensions: [],
      },
      { debug: () => {}, info: () => {}, error: () => {} },
    )
    const result = dc.checkDeps()
    expect(result.ok).toBe(false)
    expect(result.error).toContain('not found')
  })
})
```

- [ ] **Step 5: Run tests to verify they fail**

Run: `npx vitest run tests/drive.test.ts --reporter=verbose`
Expected: 4 tests pass (implementation already written)

- [ ] **Step 6: Update .env.example**

Add below the Proton Drive section (~lines 49-53):

```env
# =============================================================================
# Proton Drive (via rclone — habilitar con DRIVE_RCLONE_REMOTE)
# =============================================================================
# Remote name configurado en rclone (ej. `proton-drive:`). Al definir esto
# se activan las tools MCP y agent goals de Drive.
# DRIVE_RCLONE_REMOTE=proton-drive:
# Directorio local de staging (rclone sincroniza aquí).
# DRIVE_STAGING_DIR=~/.protonmail/drive/
# Modo de sincronización: pull (sync explícito) | watch (FUSE mount).
# DRIVE_SYNC_MODE=pull
# Path al binario de rclone.
# DRIVE_RCLONE_BIN=rclone
# Extensiones consideradas obsoletas (separadas por coma).
# DRIVE_OBSOLETE_EXTENSIONS=.doc,.ppt,.xls,.bmp
```

Remove the old stub lines `PROTON_DRIVE_ENABLED` and `PROTON_DRIVE_REFRESH_TOKEN`.

- [ ] **Step 7: Commit**

```bash
git add src/config.ts src/drive.ts .env.example tests/drive.test.ts
git commit -m "feat(drive): config schema and DriveClient base with rclone wrapper"
```

---

### Task 2: DriveSyncClient — rclone sync methods

**Files:**

- Modify: `src/drive.ts`
- Modify: `tests/drive.test.ts`

**Interfaces:**

- Consumes: `DriveClient.checkDeps()`
- Produces: `syncPull()`, `syncPush()`, `status()`, `mount()`, `unmount()`

- [ ] **Step 1: Add sync methods to DriveClient**

Append to `src/drive.ts` inside the `DriveClient` class:

```typescript
async syncPull(): Promise<{ ok: boolean; files: number; bytes: number; error?: string }> {
  if (!this.opts.rcloneRemote) return { ok: false, files: 0, bytes: 0, error: "DRIVE_RCLONE_REMOTE not set" };
  const staging = this.stagingDir;
  if (!existsSync(staging)) mkdirSync(staging, { recursive: true });
  try {
    const { stdout } = await this.execRclone([
      "sync", `${this.remotePrefix}/`, staging,
      "--progress", "--stats-one-line",
    ]);
    const files = (stdout.match(/Transferred:\s+(\d+)/)?.[1] ?? "0");
    return { ok: true, files: parseInt(files, 10), bytes: 0 };
  } catch (err) {
    const msg = (err as Error).message;
    return { ok: false, files: 0, bytes: 0, error: msg };
  }
}

async syncPush(): Promise<{ ok: boolean; files: number; bytes: number; error?: string }> {
  if (!this.opts.rcloneRemote) return { ok: false, files: 0, bytes: 0, error: "DRIVE_RCLONE_REMOTE not set" };
  const staging = this.stagingDir;
  try {
    const { stdout } = await this.execRclone([
      "sync", staging, `${this.remotePrefix}/`,
      "--progress", "--stats-one-line",
    ]);
    const files = (stdout.match(/Transferred:\s+(\d+)/)?.[1] ?? "0");
    return { ok: true, files: parseInt(files, 10), bytes: 0 };
  } catch (err) {
    const msg = (err as Error).message;
    return { ok: false, files: 0, bytes: 0, error: msg };
  }
}

async status(): Promise<{
  ok: boolean;
  configured: boolean;
  remoteReachable?: boolean;
  lastSync?: string;
  stagingExists: boolean;
  stagingFiles?: number;
  stagingBytes?: number;
  syncMode: string;
  error?: string;
}> {
  const staging = this.stagingDir;
  const stagingExists = existsSync(staging);
  let stagingFiles: number | undefined;
  let stagingBytes: number | undefined;
  if (stagingExists) {
    stagingFiles = 0;
    stagingBytes = 0;
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = resolve(dir, entry);
        try {
          const s = statSync(full);
          if (s.isDirectory()) walk(full);
          else { stagingFiles!++; stagingBytes! += s.size; }
        } catch { /* skip */ }
      }
    };
    walk(staging);
  }
  let remoteReachable: boolean | undefined;
  if (this.opts.rcloneRemote) {
    try {
      await this.execRclone(["lsf", `${this.remotePrefix}/`, "--max-depth", "0"]);
      remoteReachable = true;
    } catch { remoteReachable = false; }
  }
  return {
    ok: !!this.opts.rcloneRemote && stagingExists,
    configured: !!this.opts.rcloneRemote,
    remoteReachable,
    stagingExists,
    stagingFiles,
    stagingBytes,
    syncMode: this.opts.syncMode,
  };
}

async mount(mountPoint?: string): Promise<{ ok: boolean; error?: string }> {
  const target = mountPoint ?? resolve("/tmp/proton-drive-mount");
  try {
    await this.execRclone([
      "mount", `${this.remotePrefix}/`, target,
      "--daemon", "--vfs-cache-mode", "full",
    ]);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

async unmount(mountPoint?: string): Promise<{ ok: boolean; error?: string }> {
  const target = mountPoint ?? resolve("/tmp/proton-drive-mount");
  try {
    await this.execRclone(["unmount", target]);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
```

- [ ] **Step 2: Write failing test for sync methods**

Append to `tests/drive.test.ts`:

```typescript
describe('DriveClient sync', () => {
  it('should return error on syncPull when no remote configured', async () => {
    const dc = new DriveClient(
      {
        stagingDir: '/tmp/test-drive',
        syncMode: 'pull',
        rcloneBin: 'rclone',
        obsoleteExtensions: [],
      },
      { debug: () => {}, info: () => {}, error: () => {} },
    )
    const result = await dc.syncPull()
    expect(result.ok).toBe(false)
    expect(result.error).toContain('not set')
  })

  it('should return error on syncPush when no remote configured', async () => {
    const dc = new DriveClient(
      {
        stagingDir: '/tmp/test-drive',
        syncMode: 'pull',
        rcloneBin: 'rclone',
        obsoleteExtensions: [],
      },
      { debug: () => {}, info: () => {}, error: () => {} },
    )
    const result = await dc.syncPush()
    expect(result.ok).toBe(false)
    expect(result.error).toContain('not set')
  })

  it('should report status without remote', async () => {
    const dc = new DriveClient(
      {
        stagingDir: '/tmp/test-drive',
        syncMode: 'pull',
        rcloneBin: 'rclone',
        obsoleteExtensions: [],
      },
      { debug: () => {}, info: () => {}, error: () => {} },
    )
    const result = await dc.status()
    expect(result.configured).toBe(false)
    expect(result.ok).toBe(false)
  })
})
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run tests/drive.test.ts --reporter=verbose`
Expected: 7 tests pass

- [ ] **Step 4: Commit**

```bash
git add src/drive.ts tests/drive.test.ts
git commit -m "feat(drive): DriveSyncClient sync pull/push/status/mount"
```

---

### Task 3: DriveAuditor — scan, duplicates, format report

**Files:**

- Create: `src/drive-audit.ts`
- Create: `tests/drive-audit.test.ts`

**Interfaces:**

- Consumes: `DriveClient.stagingDir`, `DriveConfig.obsoleteExtensions`
- Produces: `AuditReport`, `DuplicatesReport`, `FormatReport`, `OrganizePlan`

- [ ] **Step 1: Write failing tests for DriveAuditor**

Create `tests/drive-audit.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { DriveAuditor } from '../src/drive-audit.js'

const TMP = '/tmp/test-drive-audit'

describe('DriveAuditor', () => {
  beforeEach(() => {
    mkdirSync(TMP, { recursive: true })
    mkdirSync(resolve(TMP, 'docs'), { recursive: true })
    mkdirSync(resolve(TMP, 'images'), { recursive: true })
    writeFileSync(resolve(TMP, 'readme.md'), '# Hello')
    writeFileSync(resolve(TMP, 'docs', 'report.doc'), 'old format')
    writeFileSync(resolve(TMP, 'docs', 'notes.txt'), 'some notes')
    writeFileSync(resolve(TMP, 'images', 'photo.jpg'), Buffer.alloc(1024))
    writeFileSync(resolve(TMP, 'duplicate.txt'), 'same content')
    writeFileSync(resolve(TMP, 'docs', 'duplicate.txt'), 'same content')
  })

  afterEach(() => {
    rmSync(TMP, { recursive: true, force: true })
  })

  const auditor = new DriveAuditor(['.doc', '.ppt', '.xls', '.bmp'], {
    debug: () => {},
    info: () => {},
    error: () => {},
  })

  it('should scan inventory', async () => {
    const inv = await auditor.scanInventory(TMP)
    expect(inv.totalFiles).toBe(5)
    expect(inv.totalBytes).toBeGreaterThan(0)
    expect(inv.byExt['.md']).toBe(1)
    expect(inv.byExt['.doc']).toBe(1)
    expect(inv.byExt['.txt']).toBe(2)
    expect(inv.byExt['.jpg']).toBe(1)
  })

  it('should detect duplicates by content', async () => {
    const dups = await auditor.findDuplicates(TMP)
    expect(dups.length).toBeGreaterThanOrEqual(1)
    const dup = dups.find(
      (d) => d.hash === auditor.hashFile(resolve(TMP, 'duplicate.txt')),
    )
    expect(dup).toBeDefined()
    expect(dup!.files.length).toBe(2)
  })

  it('should report obsolete formats', async () => {
    const fmt = await auditor.formatReport(TMP)
    expect(fmt.obsoleteFiles.length).toBe(1)
    expect(fmt.obsoleteFiles[0].name).toBe('report.doc')
    expect(fmt.obsoleteExtensions).toEqual(['.doc', '.ppt', '.xls', '.bmp'])
  })

  it('should build organize plan', async () => {
    const plan = await auditor.buildOrganizePlan(TMP)
    expect(plan.suggestions.length).toBeGreaterThanOrEqual(1)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/drive-audit.test.ts --reporter=verbose`
Expected: 4 tests fail (module not found)

- [ ] **Step 3: Write minimal DriveAuditor**

Create `src/drive-audit.ts`:

```typescript
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { resolve, extname, relative, basename, dirname } from 'node:path'
import { createHash } from 'node:crypto'

export interface InventoryReport {
  totalFiles: number
  totalBytes: number
  byExt: Record<string, number>
  byDir: Record<string, number>
  files: {
    name: string
    path: string
    ext: string
    size: number
    modified: Date
  }[]
}

export interface DuplicateEntry {
  hash: string
  size: number
  files: { path: string; name: string }[]
}

export interface FormatReport {
  totalExtensions: number
  extensions: string[]
  obsoleteExtensions: string[]
  obsoleteFiles: { name: string; path: string; ext: string; size: number }[]
  noExtension: number
}

export interface OrganizeSuggestion {
  action: 'move' | 'rename'
  from: string
  to: string
  reason: string
}

export interface OrganizePlan {
  suggestions: OrganizeSuggestion[]
}

export class DriveAuditor {
  constructor(
    private obsoleteExtensions: string[],
    private log: {
      debug: (m: string, d?: unknown) => void
      info: (m: string, d?: unknown) => void
      error: (m: string, d?: unknown) => void
    },
  ) {}

  hashFile(filePath: string): string {
    const content = readFileSync(filePath)
    return createHash('sha256').update(content).digest('hex')
  }

  async scanInventory(stagingDir: string): Promise<InventoryReport> {
    const files: InventoryReport['files'] = []
    let totalBytes = 0

    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = resolve(dir, entry)
        try {
          const s = statSync(full)
          if (s.isDirectory()) walk(full)
          else {
            totalBytes += s.size
            files.push({
              name: entry,
              path: relative(stagingDir, full),
              ext: extname(entry).toLowerCase(),
              size: s.size,
              modified: s.mtime,
            })
          }
        } catch {
          /* skip */
        }
      }
    }
    if (existsSync(stagingDir)) walk(stagingDir)

    const byExt: Record<string, number> = {}
    const byDir: Record<string, number> = {}
    for (const f of files) {
      byExt[f.ext] = (byExt[f.ext] ?? 0) + 1
      const dir = dirname(f.path)
      byDir[dir === '.' ? '/' : dir] = (byDir[dir === '.' ? '/' : dir] ?? 0) + 1
    }

    return { totalFiles: files.length, totalBytes, byExt, byDir, files }
  }

  async findDuplicates(stagingDir: string): Promise<DuplicateEntry[]> {
    const hashMap = new Map<string, DuplicateEntry>()
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = resolve(dir, entry)
        try {
          const s = statSync(full)
          if (s.isDirectory()) walk(full)
          else if (s.size > 0) {
            const hash = this.hashFile(full)
            if (!hashMap.has(hash)) {
              hashMap.set(hash, { hash, size: s.size, files: [] })
            }
            hashMap.get(hash)!.files.push({ path: full, name: entry })
          }
        } catch {
          /* skip */
        }
      }
    }
    if (existsSync(stagingDir)) walk(stagingDir)

    return Array.from(hashMap.values()).filter((e) => e.files.length > 1)
  }

  async formatReport(stagingDir: string): Promise<FormatReport> {
    const inv = await this.scanInventory(stagingDir)
    const obsoleteFiles = inv.files.filter((f) =>
      this.obsoleteExtensions.includes(f.ext),
    )
    const extensions = [...new Set(inv.files.map((f) => f.ext))]
      .filter(Boolean)
      .sort()
    const noExtension = inv.files.filter((f) => !f.ext).length

    return {
      totalExtensions: extensions.length,
      extensions,
      obsoleteExtensions: [...this.obsoleteExtensions],
      obsoleteFiles: obsoleteFiles.map((f) => ({
        name: f.name,
        path: f.path,
        ext: f.ext,
        size: f.size,
      })),
      noExtension,
    }
  }

  async buildOrganizePlan(stagingDir: string): Promise<OrganizePlan> {
    const inv = await this.scanInventory(stagingDir)
    const suggestions: OrganizeSuggestion[] = []

    const byExt = inv.byExt
    const extDirs: Record<string, string> = {
      '.md': 'docs',
      '.txt': 'docs',
      '.doc': 'docs/old',
      '.pdf': 'docs',
      '.jpg': 'images',
      '.jpeg': 'images',
      '.png': 'images',
      '.gif': 'images',
      '.svg': 'images',
      '.mp4': 'media',
      '.mov': 'media',
      '.avi': 'media',
      '.mp3': 'audio',
      '.wav': 'audio',
      '.flac': 'audio',
      '.zip': 'archives',
      '.tar': 'archives',
      '.gz': 'archives',
      '.csv': 'data',
      '.json': 'data',
      '.xml': 'data',
    }

    for (const f of inv.files) {
      const targetDir = extDirs[f.ext]
      if (targetDir && dirname(f.path) !== targetDir) {
        suggestions.push({
          action: 'move',
          from: f.path,
          to: `${targetDir}/${f.name}`,
          reason: `Move ${f.ext} file to ${targetDir}/`,
        })
      }
    }

    return { suggestions }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/drive-audit.test.ts --reporter=verbose`
Expected: 4 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/drive-audit.ts tests/drive-audit.test.ts
git commit -m "feat(drive): DriveAuditor — inventory, duplicates, format report, organize plan"
```

---

### Task 4: MCP Tools registration

**Files:**

- Modify: `src/server.ts`
- Modify: `tests/server-tools.test.ts`

**Interfaces:**

- Consumes: `DriveClient`, `DriveAuditor`
- Produces: 5 MCP tools: `proton_drive_audit`, `proton_drive_status`, `proton_drive_organize`, `proton_drive_format_report`, `proton_drive_sync`

- [ ] **Step 1: Replace registerDriveTools in server.ts**

Replace the stub `registerDriveTools` function (~lines 1072-1081):

```typescript
function registerDriveTools() {
  if (!cfg.products.drive.rcloneRemote) return
  const driveCfg = cfg.products.drive as import('./drive.js').DriveConfig
  const driveClient = new DriveClient(driveCfg, log)
  const auditor = new DriveAuditor(driveCfg.obsoleteExtensions, log)

  register(
    'proton_drive_audit',
    {
      title: 'Audit Proton Drive content',
      description:
        'Scans the staging directory and returns an inventory report: total files, by type/size/date, duplicates, and obsolete formats.',
      inputSchema: {
        response_format: z.enum(['markdown', 'json']).default('markdown'),
        staging_dir: z
          .string()
          .optional()
          .describe('Override staging directory path'),
      },
      outputSchema: {
        totalFiles: z.number(),
        totalBytes: z.number(),
        duplicates: z.array(
          z.object({
            hash: z.string(),
            size: z.number(),
            files: z.array(z.object({ path: z.string(), name: z.string() })),
          }),
        ),
        obsoleteFiles: z.array(
          z.object({
            name: z.string(),
            path: z.string(),
            ext: z.string(),
            size: z.number(),
          }),
        ),
      },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ response_format, staging_dir }) => {
      const staging = staging_dir
        ? resolve(staging_dir)
        : driveClient.stagingDir
      try {
        const inv = await auditor.scanInventory(staging)
        const dups = await auditor.findDuplicates(staging)
        const fmt = await auditor.formatReport(staging)
        const structured = {
          totalFiles: inv.totalFiles,
          totalBytes: inv.totalBytes,
          duplicates: dups,
          obsoleteFiles: fmt.obsoleteFiles,
        }
        if (response_format === 'json') {
          return {
            content: [
              { type: 'text', text: JSON.stringify(structured, null, 2) },
            ],
            structuredContent: structured,
          }
        }
        const lines = [
          `# Proton Drive Audit`,
          `**Total:** ${inv.totalFiles} files, ${(inv.totalBytes / 1024 / 1024).toFixed(1)} MB`,
          '',
          '## By extension',
          ...Object.entries(inv.byExt)
            .sort(([, a], [, b]) => b - a)
            .map(([ext, count]) => `- \`${ext || '(none)'}\`: ${count}`),
          dups.length > 0
            ? [
                '',
                '## Duplicates',
                ...dups.map(
                  (d) =>
                    `- ${d.hash.slice(0, 8)} (${d.files.length} copies): ${d.files.map((f) => f.name).join(', ')}`,
                ),
              ]
            : [],
          fmt.obsoleteFiles.length > 0
            ? [
                '',
                '## Obsolete formats',
                ...fmt.obsoleteFiles.map((f) => `- \`${f.path}\` (${f.ext})`),
              ]
            : [],
        ].flat()
        return {
          content: [{ type: 'text', text: lines.join('\n') }],
          structuredContent: structured,
        }
      } catch (err) {
        return { isError: true, content: [{ type: 'text', text: String(err) }] }
      }
    },
  )

  register(
    'proton_drive_status',
    {
      title: 'Proton Drive sync status',
      description:
        'Returns the current sync status of the Drive staging directory and rclone remote.',
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async () => {
      try {
        const st = await driveClient.status()
        return {
          content: [{ type: 'text', text: JSON.stringify(st, null, 2) }],
        }
      } catch (err) {
        return { isError: true, content: [{ type: 'text', text: String(err) }] }
      }
    },
  )

  register(
    'proton_drive_organize',
    {
      title: 'Organize files in Proton Drive',
      description:
        'Analyzes the staging directory and moves files into a structured folder layout (by type). Dry-run by default.',
      inputSchema: {
        dry_run: z
          .boolean()
          .default(true)
          .describe('If true, only shows the plan without moving files.'),
        staging_dir: z.string().optional(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ dry_run, staging_dir }) => {
      const staging = staging_dir
        ? resolve(staging_dir)
        : driveClient.stagingDir
      try {
        const plan = await auditor.buildOrganizePlan(staging)
        if (dry_run) {
          const lines = [
            '# Organize plan (dry-run)',
            '',
            '## Suggested moves:',
            ...plan.suggestions.map(
              (s) => `- \`${s.from}\` → \`${s.to}\` (${s.reason})`,
            ),
          ]
          return {
            content: [{ type: 'text', text: lines.join('\n') }],
            structuredContent: { dryRun: true, suggestions: plan.suggestions },
          }
        }
        let moved = 0
        for (const s of plan.suggestions) {
          if (s.action === 'move') {
            const src = resolve(staging, s.from)
            const dst = resolve(staging, s.to)
            const dstDir = dirname(dst)
            if (!existsSync(dstDir)) mkdirSync(dstDir, { recursive: true })
            renameSync(src, dst)
            moved++
          }
        }
        return {
          content: [
            {
              type: 'text',
              text: `Moved ${moved} files. Run sync to push changes to ProtonDrive.`,
            },
          ],
        }
      } catch (err) {
        return { isError: true, content: [{ type: 'text', text: String(err) }] }
      }
    },
  )

  register(
    'proton_drive_format_report',
    {
      title: 'Proton Drive format report',
      description:
        'Detailed analysis of file formats in the staging directory.',
      inputSchema: {
        staging_dir: z.string().optional(),
      },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ staging_dir }) => {
      const staging = staging_dir
        ? resolve(staging_dir)
        : driveClient.stagingDir
      try {
        const fmt = await auditor.formatReport(staging)
        return {
          content: [{ type: 'text', text: JSON.stringify(fmt, null, 2) }],
        }
      } catch (err) {
        return { isError: true, content: [{ type: 'text', text: String(err) }] }
      }
    },
  )

  register(
    'proton_drive_sync',
    {
      title: 'Sync Proton Drive staging',
      description:
        'Triggers rclone sync (pull + push). Idempotent — safe to call repeatedly.',
      inputSchema: {
        direction: z
          .enum(['pull', 'push', 'both'])
          .default('pull')
          .describe('Sync direction'),
      },
      annotations: {
        readOnlyHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ direction }) => {
      try {
        if (direction === 'pull' || direction === 'both') {
          const r = await driveClient.syncPull()
          if (!r.ok)
            return {
              isError: true,
              content: [{ type: 'text', text: `Pull failed: ${r.error}` }],
            }
        }
        if (direction === 'push' || direction === 'both') {
          const r = await driveClient.syncPush()
          if (!r.ok)
            return {
              isError: true,
              content: [{ type: 'text', text: `Push failed: ${r.error}` }],
            }
        }
        return {
          content: [{ type: 'text', text: `Sync ${direction} completed.` }],
        }
      } catch (err) {
        return { isError: true, content: [{ type: 'text', text: String(err) }] }
      }
    },
  )
}
```

Also add the necessary imports at the top of server.ts (add after existing imports, around line 24-31):

```typescript
import { DriveClient } from './drive.js'
import { DriveAuditor } from './drive-audit.js'
import { resolve, dirname } from 'node:path'
import { existsSync, mkdirSync, renameSync } from 'node:fs'
```

- [ ] **Step 2: Update buildServer signature to return driveClient**

The return type of `buildServer` (~line 115-118) currently returns `{ server, imap, smtp }`. Add drive to the return:

```typescript
export function buildServer(
  cfg: Config,
  log: Logger,
): { server: McpServer; imap: ImapClient; smtp: SmtpClient; drive?: DriveClient } {
```

And add before `return { server, imap, smtp }`:

```typescript
let driveClient: DriveClient | undefined
if (cfg.products.drive.rcloneRemote) {
  driveClient = new DriveClient(
    cfg.products.drive as import('./drive.js').DriveConfig,
    log,
  )
}
```

And update the return to include drive.

- [ ] **Step 3: Update instructions in server constructor** (line ~136)

Append Drive to the instructions string:

```
"Proton Suite agent with multiple products. Mail: via Proton Mail Bridge (IMAP/SMTP) — call proton_list_folders first, use UIDs. Pass: via pass-cli — never returns secret values, only confirms found/generated. Drive: via rclone — staging directory synced with ProtonDrive. Calendar stub. Before any write operation, review the plan in read-only mode."
```

- [ ] **Step 4: Update suite-status tool** (lines ~1127-1131)

Replace the drive status line:

```typescript
drive: cfg.products.drive.rcloneRemote
  ? (() => {
      try {
        const dc = new DriveClient(cfg.products.drive as import("./drive.js").DriveConfig, log);
        return { available: true, rcloneRemote: cfg.products.drive.rcloneRemote, syncMode: cfg.products.drive.syncMode };
      } catch (err) {
        return { available: false, error: String(err) };
      }
    })()
  : { available: false, reason: "DRIVE_RCLONE_REMOTE not set" },
```

- [ ] **Step 5: Write tests for drive tools**

Append to `tests/server-tools.test.ts`:

```typescript
import { DriveClient, type DriveConfig } from '../src/drive.js'

describe('drive tools', () => {
  it('should create DriveClient with config', () => {
    const cfg: DriveConfig = {
      rcloneRemote: 'proton-drive:',
      stagingDir: '/tmp/test-drive',
      syncMode: 'pull',
      rcloneBin: 'rclone',
      obsoleteExtensions: ['.doc'],
    }
    const dc = new DriveClient(cfg, {
      debug: () => {},
      info: () => {},
      error: () => {},
    })
    expect(dc.stagingDir).toBe('/tmp/test-drive')
    expect(dc.remotePrefix).toBe('proton-drive:')
  })

  it('should return status without errors', async () => {
    const cfg: DriveConfig = {
      stagingDir: '/tmp/test-status',
      syncMode: 'pull',
      rcloneBin: 'rclone',
      obsoleteExtensions: [],
    }
    const dc = new DriveClient(cfg, {
      debug: () => {},
      info: () => {},
      error: () => {},
    })
    const st = await dc.status()
    expect(st.configured).toBe(false)
    expect(st.ok).toBe(false)
  })
})
```

- [ ] **Step 6: Run existing tests to verify no regressions**

Run: `npx vitest run tests/server-tools.test.ts --reporter=verbose`
Expected: all existing + new tests pass

- [ ] **Step 7: Commit**

```bash
git add src/server.ts tests/server-tools.test.ts
git commit -m "feat(drive): real MCP tools — audit, status, organize, format-report, sync"
```

---

### Task 5: Agent Goals (drive-audit, drive-organize, drive-sync)

**Files:**

- Modify: `src/agent/types.ts`
- Modify: `src/agent/goals.ts`
- Modify: `src/agent/executor.ts`
- Modify: `src/agent-cli.ts`
- Modify: `package.json`

**Interfaces:**

- Consumes: `DriveClient`, `DriveAuditor`
- Produces: goals `drive-audit`, `drive-organize`, `drive-sync`

- [ ] **Step 1: Add drive goals to AgentGoal type** (`src/agent/types.ts`)

Add `| "drive-audit" | "drive-organize" | "drive-sync"` to the union type in `types.ts`.

- [ ] **Step 2: Add goals to ALLOWED_GOALS + describeGoal** (`src/agent/goals.ts`)

Add to `ALLOWED_GOALS`:

```typescript
const ALLOWED_GOALS: AgentGoal[] = [
  'discover',
  'setup',
  'check-imap',
  'organize',
  'monitor',
  'alert',
  'pass-audit',
  'suite-status',
  'drive-audit',
  'drive-organize',
  'drive-sync',
]
```

Add to `describeGoal` map:

```typescript
"drive-audit": "Escanea el staging de ProtonDrive: inventario, duplicados, formatos obsoletos. Read-only.",
"drive-organize": "Analiza y reorganiza archivos en el staging por tipo. Dry-run por defecto.",
"drive-sync": "Sincroniza el staging con ProtonDrive (pull + push opcional).",
```

- [ ] **Step 3: Add cases to executor.ts** (`src/agent/executor.ts`)

Add after the `pass-audit` case (~line 84):

```typescript
case "drive-audit":
case "drive-organize":
case "drive-sync": {
  if (!cfg.products.drive.rcloneRemote) {
    log.error("Drive is not configured. Set DRIVE_RCLONE_REMOTE.");
    process.exit(2);
  }
  const { DriveClient } = await import("../drive.js");
  const { DriveAuditor } = await import("../drive-audit.js");
  const driveCfg = cfg.products.drive as import("../drive.js").DriveConfig;
  const driveClient = new DriveClient(driveCfg, log);
  const auditor = new DriveAuditor(driveCfg.obsoleteExtensions, log);

  if (goal === "drive-audit") {
    const inv = await auditor.scanInventory(driveClient.stagingDir);
    const dups = await auditor.findDuplicates(driveClient.stagingDir);
    const fmt = await auditor.formatReport(driveClient.stagingDir);
    log.info("drive-audit report", {
      totalFiles: inv.totalFiles,
      totalBytes: inv.totalBytes,
      duplicates: dups.length,
      obsoleteFiles: fmt.obsoleteFiles.length,
    });
    alerts.audit("drive-audit", "agent/executor", {
      totalFiles: inv.totalFiles,
      duplicates: dups.length,
      obsoleteFiles: fmt.obsoleteFiles.length,
    });
  } else if (goal === "drive-organize") {
    const plan = await auditor.buildOrganizePlan(driveClient.stagingDir);
    if (ctx.dryRun) {
      log.info("drive-organize plan (dry-run)", {
        suggestions: plan.suggestions.length,
      });
      alerts.info("drive-organize", "Plan de organización Drive en dry-run", "agent/executor", {
        suggestions: plan.suggestions.length,
      });
    } else {
      let moved = 0;
      for (const s of plan.suggestions) {
        if (s.action === "move") {
          const src = resolve(driveClient.stagingDir, s.from);
          const dst = resolve(driveClient.stagingDir, s.to);
          mkdirSync(dirname(dst), { recursive: true });
          renameSync(src, dst);
          moved++;
        }
      }
      log.info("drive-organize applied", { moved });
      alerts.audit("drive-organize-applied", "agent/executor", { moved });
    }
  } else if (goal === "drive-sync") {
    const pullResult = await driveClient.syncPull();
    if (!pullResult.ok) {
      log.error("drive-sync pull failed", { error: pullResult.error });
      alerts.alert("drive-sync", "Sync pull falló", "agent/executor", { error: pullResult.error });
      process.exit(2);
    }
    log.info("drive-sync pull ok", { files: pullResult.files });
    // Push only if explicitly requested (not automatic in sync goal)
    alerts.audit("drive-sync", "agent/executor", { pullOk: true, files: pullResult.files });
  }
  break;
}
```

Also add the missing import for `resolve, dirname, mkdirSync, renameSync` at the top of executor.ts.

- [ ] **Step 4: Add npm scripts** (`package.json`)

Add after the `agent:suite-status` line:

```json
"agent:drive-audit": "node dist/agent-cli.js drive-audit",
"agent:drive-organize": "node dist/agent-cli.js drive-organize",
"agent:drive-sync": "node dist/agent-cli.js drive-sync",
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run tests/agent.test.ts --reporter=verbose`
Expected: all pass

- [ ] **Step 6: Commit**

```bash
git add src/agent/types.ts src/agent/goals.ts src/agent/executor.ts package.json
git commit -m "feat(drive): agent goals drive-audit, drive-organize, drive-sync"
```

---

### Task 6: Documentation

**Files:**

- Create: `docs/drive-audit.md`

- [ ] **Step 1: Write drive-audit docs**

Create `docs/drive-audit.md` with:

- Prerequisites (rclone installed, remote configured)
- Configuration (env vars)
- Usage: agent goals CLI
- Usage: MCP tools
- rclone setup instructions (`rclone config` + required scopes)
- Dry-run behavior

- [ ] **Step 2: Run typecheck**

Run: `npx vitest run && npm run typecheck`
Expected: all tests pass, no type errors

- [ ] **Step 3: Commit**

```bash
git add docs/drive-audit.md
git commit -m "docs(drive): drive-audit documentation with setup and usage"
```
