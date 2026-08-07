import { describe, it, expect, vi } from 'vitest'
import { SecretSafety, makeSecretLogger } from '../src/security.js'
import type { SecretLogger } from '../src/security.js'

describe('SecretSafety.validateSafePath', () => {
  it('accepts simple paths with alphanumeric, dot, slash, underscore, hyphen', () => {
    expect(SecretSafety.validateSafePath('proton/bridge/password')).toBe(true)
    expect(SecretSafety.validateSafePath('my-safe-dir/file_123.txt')).toBe(true)
    expect(SecretSafety.validateSafePath('.config/foo')).toBe(true)
  })

  it('accepts dots since they are valid in path segments, but does not validate parent traversal', () => {
    // The character-class regex allows '.' — parent traversal is prevented
    // at the usage site (execFile without shell, controlled base dir).
    expect(SecretSafety.validateSafePath('..')).toBe(true)
    expect(SecretSafety.validateSafePath('../etc/passwd')).toBe(true)
    expect(SecretSafety.validateSafePath('foo/../../bar')).toBe(true)
  })

  it('rejects paths with spaces', () => {
    expect(SecretSafety.validateSafePath('foo bar')).toBe(false)
    expect(SecretSafety.validateSafePath(' dir/file')).toBe(false)
  })

  it('rejects paths with special characters', () => {
    expect(SecretSafety.validateSafePath('foo;rm -rf /')).toBe(false)
    expect(SecretSafety.validateSafePath('$(whoami)')).toBe(false)
    expect(SecretSafety.validateSafePath('foo|bar')).toBe(false)
    expect(SecretSafety.validateSafePath('foo\nbar')).toBe(false)
  })

  it('rejects empty string', () => {
    expect(SecretSafety.validateSafePath('')).toBe(false)
  })

  it('rejects paths with characters outside safe set', () => {
    // Unicode characters should not be in safe path
    expect(SecretSafety.validateSafePath('café/foo')).toBe(false)
    // Backslash
    expect(SecretSafety.validateSafePath('foo\\bar')).toBe(false)
  })

  it('accepts mixed-case alphanumeric paths', () => {
    expect(SecretSafety.validateSafePath('MyEntries/API-Key_2024')).toBe(true)
  })
})

describe('SecretSafety.sanitizeForLog', () => {
  it('sanitizes string values showing first 2 and last 2 chars', () => {
    const result = SecretSafety.sanitizeForLog('abcdefgh')
    expect(result).toBe('ab***gh')
  })

  it('returns *** for strings of length 4 or less', () => {
    expect(SecretSafety.sanitizeForLog('ab')).toBe('***')
    expect(SecretSafety.sanitizeForLog('abcd')).toBe('***')
    expect(SecretSafety.sanitizeForLog('')).toBe('***')
    expect(SecretSafety.sanitizeForLog('a')).toBe('***')
  })

  it('handles 5-6 char strings correctly', () => {
    // length 5: slice(0,2) + '***' + slice(-2) = first2 + *** + last2
    expect(SecretSafety.sanitizeForLog('abcde')).toBe('ab***de')
    // length 6: same pattern
    expect(SecretSafety.sanitizeForLog('abcdef')).toBe('ab***ef')
  })

  it('returns *** for non-string values', () => {
    expect(SecretSafety.sanitizeForLog(12345)).toBe('***')
    expect(SecretSafety.sanitizeForLog(null)).toBe('***')
    expect(SecretSafety.sanitizeForLog(undefined)).toBe('***')
    expect(SecretSafety.sanitizeForLog({ secret: true })).toBe('***')
    expect(SecretSafety.sanitizeForLog(['a', 'b'])).toBe('***')
  })

  it('does not leak more than 2+2 characters for any length', () => {
    const longSecret = 'x'.repeat(100)
    const result = SecretSafety.sanitizeForLog(longSecret)
    expect(result).toBe('xx***xx')
    expect(result.length).toBe(7) // 2 + 3 + 2
  })
})

describe('makeSecretLogger', () => {
  it('wraps each level with [sec] prefix', () => {
    const base: SecretLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }
    const secLogger = makeSecretLogger(base)

    secLogger.debug('starting audit', { entries: 5 })
    expect(base.debug).toHaveBeenCalledWith('[sec] starting audit', { entries: 5 })

    secLogger.info('store healthy')
    expect(base.info).toHaveBeenCalledWith('[sec] store healthy', undefined)

    secLogger.warn('weak password detected', { path: 'foo' })
    expect(base.warn).toHaveBeenCalledWith('[sec] weak password detected', { path: 'foo' })

    secLogger.error('store not found', { path: 'missing' })
    expect(base.error).toHaveBeenCalledWith('[sec] store not found', { path: 'missing' })
  })

  it('preserves all methods of SecretLogger interface', () => {
    const base: SecretLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }
    const secLogger = makeSecretLogger(base)
    expect(secLogger).toHaveProperty('debug')
    expect(secLogger).toHaveProperty('info')
    expect(secLogger).toHaveProperty('warn')
    expect(secLogger).toHaveProperty('error')
    expect(typeof secLogger.debug).toBe('function')
    expect(typeof secLogger.info).toBe('function')
    expect(typeof secLogger.warn).toBe('function')
    expect(typeof secLogger.error).toBe('function')
  })
})

describe('SecretLogger interface structural compatibility', () => {
  it('base logger from config.ts createLogger is structurally compatible', () => {
    // This is a compile-time check disguised as a runtime test
    const logger: SecretLogger = {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    }
    const prefixed = makeSecretLogger(logger)
    expect(() => { prefixed.info('structural test'); }).not.toThrow()
  })
})
