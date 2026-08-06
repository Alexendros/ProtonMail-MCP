import { existsSync } from 'node:fs'
import { extname, relative, dirname } from 'node:path'
import { hashFile, walkDir } from './drive-utils.js'

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

  async scanInventory(stagingDir: string): Promise<InventoryReport> {
    const files: InventoryReport['files'] = []
    let totalBytes = 0

    if (existsSync(stagingDir)) {
      await walkDir(
        stagingDir,
        (entry, full, size, mtime) => {
          totalBytes += size
          files.push({
            name: entry,
            path: relative(stagingDir, full),
            ext: extname(entry).toLowerCase(),
            size,
            modified: mtime,
          })
        },
        (full, err) => {
          this.log.error(`drive-audit: skip ${full}`, {
            error: (err as Error).message,
          })
        },
      )
    }

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
    if (existsSync(stagingDir)) {
      await walkDir(
        stagingDir,
        (entry, full, size) => {
          if (size > 0) {
            const hash = hashFile(full)
            let dup = hashMap.get(hash)
            if (!dup) {
              dup = { hash, size, files: [] }
              hashMap.set(hash, dup)
            }
            dup.files.push({ path: relative(stagingDir, full), name: entry })
          }
        },
        (full, err) => {
          this.log.error(`drive-audit: skip ${full}`, {
            error: (err as Error).message,
          })
        },
      )
    }

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
