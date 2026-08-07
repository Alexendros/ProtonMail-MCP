const SAFE_PATH_RE = /^[a-zA-Z0-9._/-]+$/

export const SecretSafety = {
  validateSafePath(path: string): boolean {
    return SAFE_PATH_RE.test(path)
  },

  sanitizeForLog(value: unknown): string {
    if (typeof value === 'string') {
      if (value.length <= 4) return '***'
      return value.slice(0, 2) + '***' + value.slice(-2)
    }
    return '***'
  },
}

export interface SecretLogger {
  debug: (m: string, d?: unknown) => void
  info: (m: string, d?: unknown) => void
  warn: (m: string, d?: unknown) => void
  error: (m: string, d?: unknown) => void
}

export function makeSecretLogger(base: SecretLogger): SecretLogger {
  return {
    debug: (m, d) => {
      base.debug(`[sec] ${m}`, d)
    },
    info: (m, d) => {
      base.info(`[sec] ${m}`, d)
    },
    warn: (m, d) => {
      base.warn(`[sec] ${m}`, d)
    },
    error: (m, d) => {
      base.error(`[sec] ${m}`, d)
    },
  }
}
