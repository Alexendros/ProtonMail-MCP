/**
 * Tests unitarios para src/server/utils.ts (37.5% cobertura).
 *
 * Funciones exportadas:
 *  - resolveTrashPath()  — busca mailbox \\Trash, requiere ImapClient mockeado
 *  - renderEmailList()   — tabla markdown de correos (pura)
 *  - renderFullEmail()   — email completo en markdown (pura)
 *  - buildSearchCriteria() — SearchObject para imapflow (pura)
 */
import { describe, it, expect, vi } from 'vitest'
import {
  resolveTrashPath,
  renderEmailList,
  renderFullEmail,
  buildSearchCriteria,
} from '../../src/server/utils.js'

// ---------------------------------------------------------------------------
// resolveTrashPath
// ---------------------------------------------------------------------------

describe('resolveTrashPath', () => {
  it('devuelve override cuando se proporciona', async () => {
    const result = await resolveTrashPath({} as never, '[Gmail]/Papelera')
    expect(result).toBe('[Gmail]/Papelera')
  })

  it('encuentra \\Trash por specialUse', async () => {
    // Nota: '\\Trash' en JS es el string '\Trash' — 1 backlash + Trash.
    // Este es el mismo valor que imapflow devuelve y que src/server/utils.ts
    // compara con === '\\Trash'.
    const TRASH = '\\Trash'
    const imap = {
      listMailboxes: vi.fn().mockResolvedValue([
        { path: 'INBOX', specialUse: '\\Inbox' },
        { path: '[Gmail]/Trash', specialUse: TRASH },
        { path: '[Gmail]/Spam', specialUse: '\\Spam' },
      ]),
    }
    const result = await resolveTrashPath(imap as never)
    expect(result).toBe('[Gmail]/Trash')
  })

  it('fallback a "Trash" cuando no hay specialUse', async () => {
    const imap = {
      listMailboxes: vi.fn().mockResolvedValue([
        { path: 'INBOX', specialUse: '\\\\Inbox' },
        { path: 'Custom', specialUse: undefined },
      ]),
    }
    const result = await resolveTrashPath(imap as never)
    expect(result).toBe('Trash')
  })

  it('fallback a "Trash" cuando listMailboxes devuelve vacío', async () => {
    const imap = {
      listMailboxes: vi.fn().mockResolvedValue([]),
    }
    const result = await resolveTrashPath(imap as never)
    expect(result).toBe('Trash')
  })

  it('override vacío (string vacío) se trata como falsy y busca specialUse', async () => {
    const imap = {
      listMailboxes: vi.fn().mockResolvedValue([
        { path: 'INBOX', specialUse: '\\Inbox' },
        { path: '[Gmail]/Trash', specialUse: '\\Trash' },
      ]),
    }
    const result = await resolveTrashPath(imap as never, '')
    // '' es falsy → no se usa como override
    expect(result).toBe('[Gmail]/Trash')
  })
})

// ---------------------------------------------------------------------------
// renderEmailList
// ---------------------------------------------------------------------------

describe('renderEmailList', () => {
  it('renderiza tabla markdown con cabecera y filas', () => {
    const items = [
      { uid: 10, from: 'alice@example.com', subject: 'Hola', date: '2026-06-15T10:00:00Z', flags: ['\\Seen'] },
      { uid: 20, from: 'bob@test.com', subject: 'Re: proyecto', date: '2026-06-14T09:00:00Z', flags: ['\\Seen', '\\Flagged'] },
    ]
    const result = renderEmailList(items, 'INBOX', 10, 0)
    expect(result).toContain('**INBOX** — showing 2 of 10 (offset 0)')
    expect(result).toContain('| UID | Date | From | Subject | Flags |')
    expect(result).toContain('| 10 | 2026-06-15 10:00 | alice@example.com | Hola | \\Seen |')
    expect(result).toContain('| 20 | 2026-06-14 09:00 | bob@test.com | Re: proyecto | \\Seen \\Flagged |')
  })

  it('devuelve mensaje de vacío cuando no hay items', () => {
    const result = renderEmailList([], 'INBOX', 0, 0)
    expect(result).toBe('No messages in INBOX (total: 0).')
  })

  it('trunca from a 32 caracteres y subject a 50', () => {
    const longFrom = 'very-long-email-address-that-exceeds-thirty-two-chars@x.com'
    const longSubject = 'A'.repeat(60)
    const items = [
      { uid: 1, from: longFrom, subject: longSubject, date: '2026-01-01T00:00:00Z', flags: [] },
    ]
    const result = renderEmailList(items, 'IN', 1, 0)
    expect(result).toContain('very-long-email-address-that-ex…')
    expect(result).toContain('A'.repeat(49) + '…')
  })

  it('maneja valores ausentes con fallbacks', () => {
    const items = [
      { uid: 5, from: undefined, subject: undefined, date: undefined, flags: [] },
    ]
    const result = renderEmailList(items, 'BOX', 1, 0)
    expect(result).toContain('| 5 | — | — | (no subject) | — |')
  })

  it('renderiza modo concise con bullets y truncado corto', () => {
    const longFrom = 'very-long-email-address-that-exceeds@example.com'
    const items = [
      {
        uid: 10,
        from: longFrom,
        subject: 'Hola mundo',
        date: '2026-06-15T10:00:00Z',
        flags: [],
      },
      {
        uid: 11,
        from: undefined,
        subject: undefined,
        date: undefined,
        flags: [],
      },
    ]
    const result = renderEmailList(items, 'INBOX', 10, 0, true)
    expect(result).toContain('**INBOX** — 2/10 (offset 0)')
    expect(result).toContain('- 10 2026-06-15')
    expect(result).toContain('| Hola mundo')
    expect(result).toContain('- 11 — — | (no subject)')
    expect(result).not.toContain('| UID | Date |')
  })
})

// ---------------------------------------------------------------------------
// renderFullEmail
// ---------------------------------------------------------------------------

describe('renderFullEmail', () => {
  const baseEmail = {
    uid: 42,
    from: 'alice@example.com',
    to: ['bob@example.com'],
    cc: [],
    subject: 'Meeting tomorrow',
    date: '2026-07-01T10:00:00Z',
    flags: ['\\Seen'],
    textBody: 'Hi Bob, let us meet at 3pm.',
    htmlBody: '<p>Hi Bob</p>',
    attachments: [],
  }

  it('renderiza todos los campos básicos', () => {
    const result = renderFullEmail(baseEmail)
    expect(result).toContain('**Subject:** Meeting tomorrow')
    expect(result).toContain('**From:** alice@example.com')
    expect(result).toContain('**To:** bob@example.com')
    expect(result).toContain('**Date:** 2026-07-01T10:00:00Z')
    expect(result).toContain('**UID:** 42')
    expect(result).toContain('Hi Bob, let us meet at 3pm.')
  })

  it('incluye CC cuando hay destinatarios en copia', () => {
    const email = { ...baseEmail, cc: ['carol@example.com', 'dave@test.com'] }
    const result = renderFullEmail(email)
    expect(result).toContain('**Cc:** carol@example.com, dave@test.com')
  })

  it('no incluye línea CC cuando está vacío', () => {
    const result = renderFullEmail(baseEmail)
    expect(result).not.toContain('**Cc:**')
  })

  it('incluye attachaments cuando hay adjuntos', () => {
    const email = {
      ...baseEmail,
      attachments: [
        { filename: 'doc.pdf', contentType: 'application/pdf', size: 102400 },
        { filename: undefined, contentType: 'image/png', size: 51200 },
      ],
    }
    const result = renderFullEmail(email)
    expect(result).toContain('**Attachments:**')
    expect(result).toContain('[0] doc.pdf — application/pdf — 100.0 KB')
    expect(result).toContain('[1] unnamed — image/png — 50.0 KB')
  })

  it('no incluye attachments si no hay', () => {
    const result = renderFullEmail(baseEmail)
    expect(result).not.toContain('**Attachments:**')
  })

  it('indica presencia de HTML body cuando existe', () => {
    const result = renderFullEmail(baseEmail)
    expect(result).toContain('HTML body present')
    expect(result).toContain('include_html=true')
  })

  it('no menciona HTML body cuando no existe', () => {
    const email = { ...baseEmail, htmlBody: undefined }
    const result = renderFullEmail(email)
    expect(result).not.toContain('HTML body')
  })

  it('usa fallbacks para campos ausentes', () => {
    const email = {
      uid: 0,
      from: undefined,
      to: [],
      cc: [],
      subject: undefined,
      date: undefined,
      flags: [],
      textBody: undefined,
      htmlBody: undefined,
      attachments: [],
    }
    const result = renderFullEmail(email)
    expect(result).toContain('(no subject)')
    expect(result).toContain('**From:** —')
    expect(result).toContain('**To:** —')
    expect(result).toContain('**Date:** —')
    expect(result).toContain('(no text body)')
  })

  it('flags vacío se muestra como —', () => {
    const email = { ...baseEmail, flags: [] }
    const result = renderFullEmail(email)
    expect(result).toContain('**Flags:** —')
  })
})

// ---------------------------------------------------------------------------
// buildSearchCriteria
// ---------------------------------------------------------------------------

describe('buildSearchCriteria', () => {
  it('construye criterio vacío cuando no hay filtros', () => {
    const result = buildSearchCriteria({
      query: undefined,
      fields: ['text'],
      since: undefined,
      before: undefined,
      unseen_only: false,
      from_address: undefined,
      to_address: undefined,
    })
    expect(result).toEqual({})
  })

  it('añade seen=false cuando unseen_only es true', () => {
    const result = buildSearchCriteria({
      unseen_only: true,
      fields: ['text'],
    })
    expect(result).toEqual({ seen: false })
  })

  it('parsa since/before como Date', () => {
    const result = buildSearchCriteria({
      since: '2026-01-01',
      before: '2026-06-30',
      unseen_only: false,
      fields: ['text'],
    })
    expect(result.since).toBeInstanceOf(Date)
    expect(result.before).toBeInstanceOf(Date)
    expect((result.since as Date).toISOString()).toContain('2026-01-01')
    expect((result.before as Date).toISOString()).toContain('2026-06-30')
  })

  it('añade from y to cuando se proporcionan', () => {
    const result = buildSearchCriteria({
      from_address: 'alice@example.com',
      to_address: 'bob@example.com',
      unseen_only: false,
      fields: ['text'],
    })
    expect(result.from).toBe('alice@example.com')
    expect(result.to).toBe('bob@example.com')
  })

  it('mapea query a los campos solicitados (text, subject, from, to, body)', () => {
    const result = buildSearchCriteria({
      query: 'importante',
      fields: ['text', 'subject', 'from', 'to', 'body'],
      unseen_only: false,
    })
    expect(result.subject).toBe('importante')
    expect(result.body).toBe('importante')
    expect(result.from).toBe('importante')
    expect(result.to).toBe('importante')
  })

  it('mapea query solo a "body" cuando fields=["body"]', () => {
    const result = buildSearchCriteria({
      query: 'factura',
      fields: ['body'],
      unseen_only: false,
    })
    expect(result.body).toBe('factura')
    expect(result.subject).toBeUndefined()
    expect(result.from).toBeUndefined()
  })

  it('no sobreescribe from/to cuando query y from_address/to_address coexisten', () => {
    // from del query solo se escribe si criteria.from no existe aún
    const result = buildSearchCriteria({
      query: 'otro',
      fields: ['from', 'to'],
      from_address: 'original@example.com',
      to_address: 'dest@example.com',
      unseen_only: false,
    })
    // `from` ya fue asignado por from_address, query no sobreescribe
    expect(result.from).toBe('original@example.com')
    expect(result.to).toBe('dest@example.com')
  })

  it('asigna query a from y to solo si no hay from_address/to_address', () => {
    const result = buildSearchCriteria({
      query: 'buscado',
      fields: ['from', 'to'],
      from_address: undefined,
      to_address: undefined,
      unseen_only: false,
    })
    expect(result.from).toBe('buscado')
    expect(result.to).toBe('buscado')
  })

  it('no asigna query a from si no está en fields', () => {
    const result = buildSearchCriteria({
      query: 'test',
      fields: ['subject'],
      unseen_only: false,
    })
    expect(result.subject).toBe('test')
    expect(result.body).toBeUndefined()
    expect(result.from).toBeUndefined()
  })
})
