/**
 * Tests unitarios para src/server/mail.ts.
 *
 * registerMailTools registra 13 MCP tools en 5 grupos:
 *  - Folder tools (3): proton_list_folders, proton_create_folder, proton_mailbox_status
 *  - List/Search (2): proton_list_emails, proton_search_emails
 *  - Read (2): proton_get_email, proton_get_attachment
 *  - Send (3): proton_send_email, proton_reply_email, proton_forward_email
 *  - Modify (3): proton_flag_email, proton_move_email, proton_delete_email
 *
 * Estrategia de mocks:
 *  ┌─────────────────────────────────────────────┐
 *  │  ImapClient → objeto plano pasado por deps   │
 *  │  SmtpClient → objeto plano pasado por deps   │
 *  │  smtp.js → vi.mock para buildReplyOptions/   │
 *  │            buildForwardOptions               │
 *  │  registerTool → captureHandler               │
 *  └─────────────────────────────────────────────┘
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ImapClient } from '../../src/imap.js'
import { registerMailTools } from '../../src/server/mail.js'
import type { SendOptions, SendResult } from '../../src/smtp.js'

// ---------------------------------------------------------------------------
// vi.hoisted — smtp.js helpers (buildReplyOptions, buildForwardOptions)
// ---------------------------------------------------------------------------

const hoisted = vi.hoisted(() => {
  const mockBuildReplyOptions = vi.fn<
    (...args: Array<unknown>) => Promise<SendOptions | null>
  >()
  const mockBuildForwardOptions = vi.fn<
    (...args: Array<unknown>) => Promise<SendOptions | null>
  >()
  return { mockBuildReplyOptions, mockBuildForwardOptions }
})

vi.mock('../../src/smtp.js', () => ({
  buildReplyOptions: hoisted.mockBuildReplyOptions,
  buildForwardOptions: hoisted.mockBuildForwardOptions,
}))

// ---------------------------------------------------------------------------
// Logger silencioso
// ---------------------------------------------------------------------------

const silentLog = {
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
}

// ---------------------------------------------------------------------------
// Helper: captureHandler (captura tool handler de registerTool)
// ---------------------------------------------------------------------------

type ToolHandler = (args: Record<string, unknown>) => Promise<{
    content: { type: string; text: string }[]
    isError?: boolean
    structuredContent?: Record<string, unknown>
  }>

function captureHandler() {
  const handlers = new Map<string, ToolHandler>()
  const server = {
    registerTool: vi.fn(
      (
        name: string,
        _schema: unknown,
        handler: ToolHandler,
      ) => {
        handlers.set(name, handler)
      },
    ),
  } as unknown as McpServer
  return {
    server,
    invoke: async (toolName: string, args: Record<string, unknown> = {}) => {
      const handler = handlers.get(toolName)
      if (!handler) throw new Error(`Tool "${toolName}" not registered`)
      return handler(args)
    },
  }
}

// ---------------------------------------------------------------------------
// Helpers: mock builders
// ---------------------------------------------------------------------------

function makeImap(overrides?: Partial<ImapClient>): ImapClient & {
  listMailboxes: ReturnType<typeof vi.fn>
  createMailbox: ReturnType<typeof vi.fn>
  mailboxStatus: ReturnType<typeof vi.fn>
  listEmails: ReturnType<typeof vi.fn>
  searchEmails: ReturnType<typeof vi.fn>
  getEmail: ReturnType<typeof vi.fn>
  getAttachment: ReturnType<typeof vi.fn>
  setFlags: ReturnType<typeof vi.fn>
  moveEmail: ReturnType<typeof vi.fn>
  deleteEmail: ReturnType<typeof vi.fn>
} {
  return {
    listMailboxes: vi.fn().mockResolvedValue([
      { path: 'INBOX', name: 'INBOX', delimiter: '/', flags: [], specialUse: '\\Inbox', subscribed: true, listed: true },
      { path: 'Sent', name: 'Sent', delimiter: '/', flags: [], specialUse: '\\Sent', subscribed: true, listed: true },
      { path: 'Trash', name: 'Trash', delimiter: '/', flags: [], specialUse: '\\Trash', subscribed: true, listed: true },
    ]),
    createMailbox: vi.fn().mockResolvedValue({ path: 'Projects/New', created: true }),
    mailboxStatus: vi.fn().mockResolvedValue({ messages: 42, unseen: 3, recent: 0, uidNext: 100 }),
    listEmails: vi.fn().mockResolvedValue({
      items: [
        { uid: 100, seq: 3, from: 'alice@example.com', to: ['bob@test.com'], subject: 'Hola', date: '2026-07-01T10:00:00Z', flags: ['\\Seen'], size: 1234 },
        { uid: 99, seq: 2, from: 'carol@test.com', to: ['bob@test.com'], subject: 'Re: proyecto', date: '2026-06-30T09:00:00Z', flags: ['\\Seen', '\\Flagged'], size: 567 },
        { uid: 98, seq: 1, from: 'dave@work.com', to: ['bob@test.com'], subject: 'Informe', date: '2026-06-29T14:30:00Z', flags: [], size: 8901 },
      ],
      total: 10,
    }),
    searchEmails: vi.fn().mockResolvedValue({
      items: [
        { uid: 100, seq: 3, from: 'alice@example.com', to: ['bob@test.com'], subject: 'Hola', date: '2026-07-01T10:00:00Z', flags: ['\\Seen'], size: 1234 },
      ],
      matched: 1,
    }),
    getEmail: vi.fn().mockResolvedValue({
      uid: 100,
      seq: 3,
      messageId: '<msg-100@proton>',
      from: 'alice@example.com',
      to: ['bob@test.com'],
      subject: 'Hola',
      date: '2026-07-01T10:00:00Z',
      flags: ['\\Seen'],
      size: 1234,
      cc: [],
      bcc: [],
      replyTo: [],
      textBody: 'Cuerpo del mensaje',
      htmlBody: '<p>Cuerpo del mensaje</p>',
      attachments: [
        { filename: 'doc.pdf', contentType: 'application/pdf', size: 102400, contentId: undefined, checksum: 'abc123' },
      ],
      headers: { 'message-id': '<msg-100@proton>', references: '' },
    }),
    getAttachment: vi.fn().mockResolvedValue({
      filename: 'doc.pdf',
      contentType: 'application/pdf',
      base64: Buffer.from('fake pdf content').toString('base64'),
    }),
    setFlags: vi.fn().mockResolvedValue(true),
    moveEmail: vi.fn().mockResolvedValue(true),
    deleteEmail: vi.fn().mockResolvedValue(true),
    ...overrides,
  } as unknown as ImapClient & {
    listMailboxes: ReturnType<typeof vi.fn>
    createMailbox: ReturnType<typeof vi.fn>
    mailboxStatus: ReturnType<typeof vi.fn>
    listEmails: ReturnType<typeof vi.fn>
    searchEmails: ReturnType<typeof vi.fn>
    getEmail: ReturnType<typeof vi.fn>
    getAttachment: ReturnType<typeof vi.fn>
    setFlags: ReturnType<typeof vi.fn>
    moveEmail: ReturnType<typeof vi.fn>
    deleteEmail: ReturnType<typeof vi.fn>
  }
}

function makeSmtp(): { send: ReturnType<typeof vi.fn> } & SmtpClient {
  return {
    send: vi.fn().mockResolvedValue({
      messageId: '<send-ok@proton>',
      accepted: ['bob@test.com'],
      rejected: [],
      response: '250 OK',
    } as SendResult),
  } as unknown as { send: ReturnType<typeof vi.fn> } & SmtpClient
}

// ---------------------------------------------------------------------------
// Reseteo entre tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
})

// ===========================================================================
// registerMailTools
// ===========================================================================

describe('registerMailTools', () => {
  // -------------------------------------------------------------------------
  // Folder tools
  // -------------------------------------------------------------------------

  describe('folder tools', () => {
    it('proton_list_folders: devuelve tabla markdown por defecto', async () => {
      const { server, invoke } = captureHandler()
      registerMailTools(server, {
        cfg: null as never,
        log: silentLog,
        imap: makeImap(),
        smtp: makeSmtp(),
      })

      const result = await invoke('proton_list_folders', {})
      const text = result.content[0].text

      expect(text).toContain('| Path | Name | Special-use | Flags |')
      expect(text).toContain('| `INBOX` | INBOX | \\Inbox | — |')
      expect(text).toContain('| `Sent` | Sent | \\Sent | — |')
      expect(text).toContain('| `Trash` | Trash | \\Trash | — |')
    })

    it('proton_list_folders: muestra flags cuando la lista no está vacía', async () => {
      const imap = makeImap({
        listMailboxes: vi.fn().mockResolvedValue([
          { path: 'INBOX', name: 'INBOX', delimiter: '/', flags: ['\\Seen'], specialUse: '\\Inbox', subscribed: true, listed: true },
          { path: 'Flagged', name: 'Flagged', delimiter: '/', flags: ['\\Flagged'], specialUse: undefined, subscribed: true, listed: true },
        ]),
      })
      const { server, invoke } = captureHandler()
      registerMailTools(server, {
        cfg: null as never,
        log: silentLog,
        imap,
        smtp: makeSmtp(),
      })

      const result = await invoke('proton_list_folders', {})
      const text = result.content[0].text
      expect(text).toContain('\\Seen')
      expect(text).toContain('\\Flagged')
      expect(text).toContain('\\Seen |')
      expect(text).toContain('\\Flagged |')
    })

    it('proton_list_folders: devuelve JSON con response_format=json', async () => {
      const { server, invoke } = captureHandler()
      registerMailTools(server, {
        cfg: null as never,
        log: silentLog,
        imap: makeImap(),
        smtp: makeSmtp(),
      })

      const result = await invoke('proton_list_folders', { response_format: 'json' })
      const parsed = JSON.parse(result.content[0].text)

      expect(Array.isArray(parsed)).toBe(true)
      expect(parsed).toHaveLength(3)
      expect(parsed[0].path).toBe('INBOX')
    })

    it('proton_list_folders: incluye structuredContent', async () => {
      const { server, invoke } = captureHandler()
      registerMailTools(server, {
        cfg: null as never,
        log: silentLog,
        imap: makeImap(),
        smtp: makeSmtp(),
      })

      const result = await invoke('proton_list_folders', {})
      expect(result.structuredContent).toBeDefined()
      expect((result.structuredContent as { folders: unknown[] }).folders).toHaveLength(3)
    })

    it('proton_create_folder: crea carpeta y devuelve resultado', async () => {
      const imap = makeImap()
      const { server, invoke } = captureHandler()
      registerMailTools(server, {
        cfg: null as never,
        log: silentLog,
        imap,
        smtp: makeSmtp(),
      })

      const result = await invoke('proton_create_folder', { path: 'Projects/New' })
      expect(result.content[0].text).toContain('Created Projects/New')
      expect(result.content[0].text).toContain('new=true')
      expect(imap.createMailbox).toHaveBeenCalledWith('Projects/New')
    })

    it('proton_mailbox_status: devuelve counts en markdown', async () => {
      const imap = makeImap()
      const { server, invoke } = captureHandler()
      registerMailTools(server, {
        cfg: null as never,
        log: silentLog,
        imap,
        smtp: makeSmtp(),
      })

      const result = await invoke('proton_mailbox_status', { mailbox: 'INBOX' })
      expect(result.content[0].text).toContain('INBOX')
      expect(result.content[0].text).toContain('total: 42')
      expect(result.content[0].text).toContain('unseen: 3')
      expect(result.content[0].text).toContain('recent: 0')
      expect(result.content[0].text).toContain('uidNext: 100')
      expect(imap.mailboxStatus).toHaveBeenCalledWith('INBOX')
    })

    it('proton_mailbox_status: no incluye uidNext si es undefined', async () => {
      const imap = makeImap({ mailboxStatus: vi.fn().mockResolvedValue({ messages: 5, unseen: 0, recent: 0 }) })
      const { server, invoke } = captureHandler()
      registerMailTools(server, {
        cfg: null as never,
        log: silentLog,
        imap,
        smtp: makeSmtp(),
      })

      const result = await invoke('proton_mailbox_status', { mailbox: 'INBOX' })
      expect(result.content[0].text).not.toContain('uidNext')
      const json = result.structuredContent!
      expect(json.uidNext).toBeUndefined()
    })
  })

  // -------------------------------------------------------------------------
  // List / Search tools
  // -------------------------------------------------------------------------

  describe('list/search tools', () => {
    it('proton_list_emails: devuelve tabla markdown por defecto', async () => {
      const imap = makeImap()
      const { server, invoke } = captureHandler()
      registerMailTools(server, {
        cfg: null as never,
        log: silentLog,
        imap,
        smtp: makeSmtp(),
      })

      const result = await invoke('proton_list_emails', { mailbox: 'INBOX', limit: 25, offset: 0 })
      expect(result.content[0].text).toContain('showing 3 of 10 (offset 0)')
      expect(result.content[0].text).toContain('| UID |')
      expect(result.content[0].text).toContain('alice@example.com')
      expect(imap.listEmails).toHaveBeenCalledWith('INBOX', 25, 0)
    })

    it('proton_list_emails: devuelve JSON con response_format=json', async () => {
      const imap = makeImap()
      const { server, invoke } = captureHandler()
      registerMailTools(server, {
        cfg: null as never,
        log: silentLog,
        imap,
        smtp: makeSmtp(),
      })

      const result = await invoke('proton_list_emails', {
        mailbox: 'INBOX', limit: 25, offset: 0, response_format: 'json',
      })
      const parsed = JSON.parse(result.content[0].text)
      expect(parsed.mailbox).toBe('INBOX')
      expect(parsed.total).toBe(10)
      expect(parsed.count).toBe(3)
      expect(parsed.has_more).toBe(true)
      expect(parsed.next_offset).toBe(3)
    })

    it('proton_list_emails: incluye structuredContent', async () => {
      const { server, invoke } = captureHandler()
      registerMailTools(server, {
        cfg: null as never,
        log: silentLog,
        imap: makeImap(),
        smtp: makeSmtp(),
      })

      const result = await invoke('proton_list_emails', { mailbox: 'INBOX', limit: 25, offset: 0 })
      expect(result.structuredContent).toBeDefined()
      const sc = result.structuredContent as { mailbox: string; total: number; items: unknown[] }
      expect(sc.mailbox).toBe('INBOX')
      expect(sc.total).toBe(10)
    })

    it('proton_search_emails: devuelve tabla markdown con matched count', async () => {
      const imap = makeImap()
      const { server, invoke } = captureHandler()
      registerMailTools(server, {
        cfg: null as never,
        log: silentLog,
        imap,
        smtp: makeSmtp(),
      })

      const result = await invoke('proton_search_emails', {
        mailbox: 'INBOX', query: 'hola', fields: ['text'],
        unseen_only: false, limit: 25, response_format: 'markdown',
      })
      expect(result.content[0].text).toContain('Matched 1 message(s), showing 1')
      expect(result.content[0].text).toContain('alice@example.com')
      // searchEmails llamado con SearchObject construido por buildSearchCriteria
      expect(imap.searchEmails).toHaveBeenCalledWith(
        'INBOX', expect.objectContaining({}), 25,
      )
    })

    it('proton_search_emails: devuelve JSON con response_format=json', async () => {
      const imap = makeImap()
      const { server, invoke } = captureHandler()
      registerMailTools(server, {
        cfg: null as never,
        log: silentLog,
        imap,
        smtp: makeSmtp(),
      })

      const result = await invoke('proton_search_emails', {
        mailbox: 'INBOX', query: 'hola', fields: ['text'],
        unseen_only: false, limit: 25, response_format: 'json',
      })
      const parsed = JSON.parse(result.content[0].text)
      expect(parsed.matched).toBe(1)
      expect(parsed.count).toBe(1)
      expect(parsed.has_more).toBe(false)
    })

    it('proton_search_emails: sin query filtra por unseen_only', async () => {
      const imap = makeImap()
      const { server, invoke } = captureHandler()
      registerMailTools(server, {
        cfg: null as never,
        log: silentLog,
        imap,
        smtp: makeSmtp(),
      })

      await invoke('proton_search_emails', {
        mailbox: 'INBOX', fields: ['text'],
        unseen_only: true, limit: 10, response_format: 'markdown',
      })
      expect(imap.searchEmails).toHaveBeenCalledWith(
        'INBOX', expect.objectContaining({ seen: false }), 10,
      )
    })
  })

  // -------------------------------------------------------------------------
  // Read tools
  // -------------------------------------------------------------------------

  describe('read tools', () => {
    it('proton_get_email: devuelve markdown por defecto', async () => {
      const imap = makeImap()
      const { server, invoke } = captureHandler()
      registerMailTools(server, {
        cfg: null as never,
        log: silentLog,
        imap,
        smtp: makeSmtp(),
      })

      const result = await invoke('proton_get_email', { mailbox: 'INBOX', uid: 100 })
      expect(result.content[0].text).toContain('**Subject:** Hola')
      expect(result.content[0].text).toContain('**From:** alice@example.com')
      expect(result.content[0].text).toContain('Cuerpo del mensaje')
      expect(imap.getEmail).toHaveBeenCalledWith('INBOX', 100)
    })

    it('proton_get_email: devuelve JSON con response_format=json', async () => {
      const imap = makeImap()
      const { server, invoke } = captureHandler()
      registerMailTools(server, {
        cfg: null as never,
        log: silentLog,
        imap,
        smtp: makeSmtp(),
      })

      const result = await invoke('proton_get_email', {
        mailbox: 'INBOX', uid: 100, response_format: 'json',
      })
      const parsed = JSON.parse(result.content[0].text)
      expect(parsed.subject).toBe('Hola')
      expect(parsed.uid).toBe(100)
    })

    it('proton_get_email: incluye htmlBody cuando include_html=true', async () => {
      const imap = makeImap()
      const { server, invoke } = captureHandler()
      registerMailTools(server, {
        cfg: null as never,
        log: silentLog,
        imap,
        smtp: makeSmtp(),
      })

      const result = await invoke('proton_get_email', {
        mailbox: 'INBOX', uid: 100, include_html: true,
      })
      expect(result.content[0].text).toContain('HTML body present')
      expect(result.content[0].text).toContain('include_html=true')
    })

    it('proton_get_email: omite htmlBody por defecto (include_html=false)', async () => {
      const imap = makeImap()
      const { server, invoke } = captureHandler()
      registerMailTools(server, {
        cfg: null as never,
        log: silentLog,
        imap,
        smtp: makeSmtp(),
      })

      const result = await invoke('proton_get_email', { mailbox: 'INBOX', uid: 100 })
      expect(result.content[0].text).not.toContain('HTML body')
    })

    it('proton_get_email: devuelve isError=true cuando getEmail devuelve null', async () => {
      const imap = makeImap({ getEmail: vi.fn().mockResolvedValue(null) })
      const { server, invoke } = captureHandler()
      registerMailTools(server, {
        cfg: null as never,
        log: silentLog,
        imap,
        smtp: makeSmtp(),
      })

      const result = await invoke('proton_get_email', { mailbox: 'INBOX', uid: 999 })
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('No message with UID 999')
    })

    it('proton_get_attachment: devuelve JSON con base64, metadata', async () => {
      const imap = makeImap()
      const { server, invoke } = captureHandler()
      registerMailTools(server, {
        cfg: null as never,
        log: silentLog,
        imap,
        smtp: makeSmtp(),
      })

      const result = await invoke('proton_get_attachment', { mailbox: 'INBOX', uid: 100, index: 0 })
      const parsed = JSON.parse(result.content[0].text)
      expect(parsed.filename).toBe('doc.pdf')
      expect(parsed.contentType).toBe('application/pdf')
      expect(parsed.size_bytes).toBeGreaterThan(0)
      expect(parsed.returned_bytes).toBe(parsed.size_bytes)
      expect(parsed.truncated).toBe(false)
      expect(parsed.base64).toBeTruthy()
      expect(imap.getAttachment).toHaveBeenCalledWith('INBOX', 100, 0)
    })

    it('proton_get_attachment: devuelve isError=true cuando no encuentra attachment', async () => {
      const imap = makeImap({ getAttachment: vi.fn().mockResolvedValue(null) })
      const { server, invoke } = captureHandler()
      registerMailTools(server, {
        cfg: null as never,
        log: silentLog,
        imap,
        smtp: makeSmtp(),
      })

      const result = await invoke('proton_get_attachment', { mailbox: 'INBOX', uid: 100, index: 9 })
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Attachment #9 not found')
    })

    it('proton_get_attachment: trunca attachment cuando excede max_bytes', async () => {
      const bigContent = 'x'.repeat(100)
      const imap = makeImap({
        getAttachment: vi.fn().mockResolvedValue({
          filename: 'big.pdf',
          contentType: 'application/pdf',
          base64: Buffer.from(bigContent).toString('base64'),
        }),
      })
      const { server, invoke } = captureHandler()
      registerMailTools(server, {
        cfg: null as never,
        log: silentLog,
        imap,
        smtp: makeSmtp(),
      })

      const result = await invoke('proton_get_attachment', {
        mailbox: 'INBOX', uid: 100, index: 0, max_bytes: 10,
      })
      const parsed = JSON.parse(result.content[0].text)
      expect(parsed.size_bytes).toBe(100)
      expect(parsed.returned_bytes).toBe(10)
      expect(parsed.truncated).toBe(true)
      expect(Buffer.from(parsed.base64, 'base64').byteLength).toBe(10)
    })
  })

  // -------------------------------------------------------------------------
  // Send tools
  // -------------------------------------------------------------------------

  describe('send tools', () => {
    it('proton_send_email: envía correo y devuelve messageId', async () => {
      const smtp = makeSmtp()
      const { server, invoke } = captureHandler()
      registerMailTools(server, {
        cfg: { products: { mail: { bridge: { from: 'me@proton.me' } } } } as never,
        log: silentLog,
        imap: makeImap(),
        smtp,
      })

      const result = await invoke('proton_send_email', {
        to: ['bob@test.com'],
        subject: 'Asunto',
        text: 'Cuerpo',
      })
      expect(result.content[0].text).toContain('messageId=<send-ok@proton>')
      expect(result.content[0].text).toContain('accepted=1')
      expect(smtp.send).toHaveBeenCalledWith(
        expect.objectContaining({ to: ['bob@test.com'], subject: 'Asunto', text: 'Cuerpo' }),
      )
    })

    it('proton_send_email: devuelve isError si falta text y html', async () => {
      const smtp = makeSmtp()
      const { server, invoke } = captureHandler()
      registerMailTools(server, {
        cfg: null as never,
        log: silentLog,
        imap: makeImap(),
        smtp,
      })

      const result = await invoke('proton_send_email', {
        to: ['bob@test.com'],
        subject: 'Asunto',
      })
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('text')
      expect(smtp.send).not.toHaveBeenCalled()
    })

    it('proton_send_email: envía con attachments mapeados', async () => {
      const smtp = makeSmtp()
      const { server, invoke } = captureHandler()
      registerMailTools(server, {
        cfg: { products: { mail: { bridge: { from: 'me@proton.me' } } } } as never,
        log: silentLog,
        imap: makeImap(),
        smtp,
      })

      await invoke('proton_send_email', {
        to: ['bob@test.com'],
        subject: 'Con adjunto',
        text: 'Mira el archivo',
        attachments: [
          { filename: 'report.pdf', content_base64: Buffer.from('pdf').toString('base64'), content_type: 'application/pdf' },
        ],
      })
      expect(smtp.send).toHaveBeenCalledWith(
        expect.objectContaining({
          attachments: expect.arrayContaining([
            expect.objectContaining({ filename: 'report.pdf', contentType: 'application/pdf' }),
          ]),
        }),
      )
    })

    it('proton_send_email: attachment sin content_type omite campo', async () => {
      const smtp = makeSmtp()
      const { server, invoke } = captureHandler()
      registerMailTools(server, {
        cfg: { products: { mail: { bridge: { from: 'me@proton.me' } } } } as never,
        log: silentLog,
        imap: makeImap(),
        smtp,
      })

      await invoke('proton_send_email', {
        to: ['bob@test.com'],
        subject: 'Sin tipo',
        text: 'Adjunto sin content_type',
        attachments: [
          { filename: 'data.bin', content_base64: Buffer.from('binary').toString('base64') },
        ],
      })
      const callArgs = smtp.send.mock.calls[0][0]
      const attachment = callArgs.attachments[0]
      expect(attachment.filename).toBe('data.bin')
      expect(attachment).not.toHaveProperty('contentType')
    })

    it('proton_reply_email: responde con threading', async () => {
      hoisted.mockBuildReplyOptions.mockResolvedValue({
        to: ['alice@example.com'],
        subject: 'Re: Hola',
        text: 'Gracias por tu mensaje.',
        inReplyTo: '<msg-100@proton>',
        references: ['<msg-100@proton>'],
      } as SendOptions)
      const smtp = makeSmtp()
      const imap = makeImap()
      const { server, invoke } = captureHandler()
      registerMailTools(server, {
        cfg: { products: { mail: { bridge: { from: 'me@proton.me' } } } } as never,
        log: silentLog,
        imap,
        smtp,
      })

      const result = await invoke('proton_reply_email', {
        mailbox: 'INBOX', uid: 100, text: 'Gracias por tu mensaje.', reply_all: false, include_quote: true,
      })
      expect(result.content[0].text).toContain('Reply sent to alice@example.com')
      expect(hoisted.mockBuildReplyOptions).toHaveBeenCalledWith({
        imap, mailbox: 'INBOX', uid: 100, body: { text: 'Gracias por tu mensaje.', html: undefined },
        includeQuote: true, replyAll: false, ownAddress: 'me@proton.me',
      })
      expect(smtp.send).toHaveBeenCalled()
    })

    it('proton_reply_email: isError cuando falta text y html', async () => {
      const { server, invoke } = captureHandler()
      registerMailTools(server, {
        cfg: null as never,
        log: silentLog,
        imap: makeImap(),
        smtp: makeSmtp(),
      })

      const result = await invoke('proton_reply_email', {
        mailbox: 'INBOX', uid: 100, reply_all: false, include_quote: true,
      })
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('text')
    })

    it('proton_reply_email: isError cuando buildReplyOptions devuelve null', async () => {
      hoisted.mockBuildReplyOptions.mockResolvedValue(null)
      const { server, invoke } = captureHandler()
      registerMailTools(server, {
        cfg: { products: { mail: { bridge: { from: 'me@proton.me' } } } } as never,
        log: silentLog,
        imap: makeImap(),
        smtp: makeSmtp(),
      })

      const result = await invoke('proton_reply_email', {
        mailbox: 'INBOX', uid: 999, text: 'hola', reply_all: false, include_quote: true,
      })
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('UID 999 not found')
    })

    it('proton_reply_email: isError cuando buildReplyOptions devuelve to vacío', async () => {
      hoisted.mockBuildReplyOptions.mockResolvedValue({
        to: [],
        subject: 'Re: Hola',
        text: 'hola',
      } as unknown as SendOptions)
      const { server, invoke } = captureHandler()
      registerMailTools(server, {
        cfg: { products: { mail: { bridge: { from: 'me@proton.me' } } } } as never,
        log: silentLog,
        imap: makeImap(),
        smtp: makeSmtp(),
      })

      const result = await invoke('proton_reply_email', {
        mailbox: 'INBOX', uid: 100, text: 'hola', reply_all: false, include_quote: true,
      })
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('no reply-to address')
    })

    it('proton_forward_email: reenvía con attachments originales', async () => {
      hoisted.mockBuildForwardOptions.mockResolvedValue({
        to: ['external@test.com'],
        subject: 'Fwd: Hola',
        text: 'Reenviando info.',
        inReplyTo: '<msg-100@proton>',
        references: ['<msg-100@proton>'],
        attachments: [
          { filename: 'doc.pdf', contentBase64: 'ZmFrZQ==', contentType: 'application/pdf' },
        ],
      } as SendOptions)
      const smtp = makeSmtp()
      const imap = makeImap()
      const { server, invoke } = captureHandler()
      registerMailTools(server, {
        cfg: null as never,
        log: silentLog,
        imap,
        smtp,
      })

      const result = await invoke('proton_forward_email', {
        mailbox: 'INBOX', uid: 100, to: ['external@test.com'], text: 'Reenviando info.',
        include_attachments: true,
      })
      expect(result.content[0].text).toContain('Forwarded to external@test.com')
      expect(hoisted.mockBuildForwardOptions).toHaveBeenCalledWith(
        imap, 'INBOX', 100, ['external@test.com'],
        { text: 'Reenviando info.', html: undefined }, true,
      )
      expect(smtp.send).toHaveBeenCalled()
    })

    it('proton_forward_email: isError cuando buildForwardOptions devuelve null', async () => {
      hoisted.mockBuildForwardOptions.mockResolvedValue(null)
      const { server, invoke } = captureHandler()
      registerMailTools(server, {
        cfg: null as never,
        log: silentLog,
        imap: makeImap(),
        smtp: makeSmtp(),
      })

      const result = await invoke('proton_forward_email', {
        mailbox: 'INBOX', uid: 999, to: ['x@test.com'], text: 'hola', include_attachments: true,
      })
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('UID 999 not found')
    })
  })

  // -------------------------------------------------------------------------
  // Modify tools
  // -------------------------------------------------------------------------

  describe('modify tools', () => {
    it('proton_flag_email: marca como leído (read)', async () => {
      const imap = makeImap()
      const { server, invoke } = captureHandler()
      registerMailTools(server, {
        cfg: null as never,
        log: silentLog,
        imap,
        smtp: makeSmtp(),
      })

      const result = await invoke('proton_flag_email', { mailbox: 'INBOX', uid: 100, action: 'read' })
      expect(result.content[0].text).toContain('Flags updated on UID 100')
      expect(imap.setFlags).toHaveBeenCalledWith('INBOX', 100, ['\\Seen'], [])
    })

    it('proton_flag_email: marca como no leído (unread)', async () => {
      const imap = makeImap()
      const { server, invoke } = captureHandler()
      registerMailTools(server, {
        cfg: null as never,
        log: silentLog,
        imap,
        smtp: makeSmtp(),
      })

      await invoke('proton_flag_email', { mailbox: 'INBOX', uid: 100, action: 'unread' })
      expect(imap.setFlags).toHaveBeenCalledWith('INBOX', 100, [], ['\\Seen'])
    })

    it('proton_flag_email: marca como destacado (starred)', async () => {
      const imap = makeImap()
      const { server, invoke } = captureHandler()
      registerMailTools(server, {
        cfg: null as never,
        log: silentLog,
        imap,
        smtp: makeSmtp(),
      })

      await invoke('proton_flag_email', { mailbox: 'INBOX', uid: 100, action: 'starred' })
      expect(imap.setFlags).toHaveBeenCalledWith('INBOX', 100, ['\\Flagged'], [])
    })

    it('proton_flag_email: quita destacado (unstarred)', async () => {
      const imap = makeImap()
      const { server, invoke } = captureHandler()
      registerMailTools(server, {
        cfg: null as never,
        log: silentLog,
        imap,
        smtp: makeSmtp(),
      })

      await invoke('proton_flag_email', { mailbox: 'INBOX', uid: 100, action: 'unstarred' })
      expect(imap.setFlags).toHaveBeenCalledWith('INBOX', 100, [], ['\\Flagged'])
    })

    it('proton_flag_email: flags personalizados (custom)', async () => {
      const imap = makeImap()
      const { server, invoke } = captureHandler()
      registerMailTools(server, {
        cfg: null as never,
        log: silentLog,
        imap,
        smtp: makeSmtp(),
      })

      await invoke('proton_flag_email', {
        mailbox: 'INBOX', uid: 100, action: 'custom',
        add_flags: ['$Important'], remove_flags: ['$Junk'],
      })
      expect(imap.setFlags).toHaveBeenCalledWith('INBOX', 100, ['$Important'], ['$Junk'])
    })

    it('proton_flag_email: devuelve failure cuando setFlags falla', async () => {
      const imap = makeImap({ setFlags: vi.fn().mockResolvedValue(false) })
      const { server, invoke } = captureHandler()
      registerMailTools(server, {
        cfg: null as never,
        log: silentLog,
        imap,
        smtp: makeSmtp(),
      })

      const result = await invoke('proton_flag_email', { mailbox: 'INBOX', uid: 100, action: 'read' })
      expect(result.content[0].text).toContain('Failed to update flags')
    })

    it('proton_move_email: mueve correo entre mailboxes', async () => {
      const imap = makeImap()
      const { server, invoke } = captureHandler()
      registerMailTools(server, {
        cfg: null as never,
        log: silentLog,
        imap,
        smtp: makeSmtp(),
      })

      const result = await invoke('proton_move_email', {
        from_mailbox: 'INBOX', uid: 100, to_mailbox: 'Projects/Archived',
      })
      expect(result.content[0].text).toContain('Moved UID 100 → Projects/Archived')
      expect(imap.moveEmail).toHaveBeenCalledWith('INBOX', 100, 'Projects/Archived')
    })

    it('proton_move_email: devuelve failure cuando move falla', async () => {
      const imap = makeImap({ moveEmail: vi.fn().mockResolvedValue(false) })
      const { server, invoke } = captureHandler()
      registerMailTools(server, {
        cfg: null as never,
        log: silentLog,
        imap,
        smtp: makeSmtp(),
      })

      const result = await invoke('proton_move_email', {
        from_mailbox: 'INBOX', uid: 100, to_mailbox: 'Trash',
      })
      expect(result.content[0].text).toContain('Move failed.')
    })

    it('proton_delete_email: trash mode mueve a Trash (usa resolveTrashPath)', async () => {
      const imap = makeImap()
      const { server, invoke } = captureHandler()
      registerMailTools(server, {
        cfg: null as never,
        log: silentLog,
        imap,
        smtp: makeSmtp(),
      })

      const result = await invoke('proton_delete_email', { mailbox: 'INBOX', uid: 100, mode: 'trash' })
      expect(result.content[0].text).toContain('Moved UID 100 to Trash')
      expect(imap.moveEmail).toHaveBeenCalledWith('INBOX', 100, 'Trash')
      expect(imap.deleteEmail).not.toHaveBeenCalled()
    })

    it('proton_delete_email: trash mode acepta trash_path override', async () => {
      const imap = makeImap()
      const { server, invoke } = captureHandler()
      registerMailTools(server, {
        cfg: null as never,
        log: silentLog,
        imap,
        smtp: makeSmtp(),
      })

      await invoke('proton_delete_email', {
        mailbox: 'INBOX', uid: 100, mode: 'trash', trash_path: '[Gmail]/Papelera',
      })
      expect(imap.moveEmail).toHaveBeenCalledWith('INBOX', 100, '[Gmail]/Papelera')
    })

    it('proton_delete_email: modo permanente usa deleteEmail', async () => {
      const imap = makeImap()
      const { server, invoke } = captureHandler()
      registerMailTools(server, {
        cfg: null as never,
        log: silentLog,
        imap,
        smtp: makeSmtp(),
      })

      const result = await invoke('proton_delete_email', { mailbox: 'INBOX', uid: 100, mode: 'permanent' })
      expect(result.content[0].text).toContain('Permanently deleted UID 100')
      expect(imap.deleteEmail).toHaveBeenCalledWith('INBOX', 100)
      expect(imap.moveEmail).not.toHaveBeenCalled()
    })

    it('proton_delete_email: trash mode devuelve error cuando move falla', async () => {
      const imap = makeImap({ moveEmail: vi.fn().mockResolvedValue(false) })
      const { server, invoke } = captureHandler()
      registerMailTools(server, {
        cfg: null as never,
        log: silentLog,
        imap,
        smtp: makeSmtp(),
      })

      const result = await invoke('proton_delete_email', { mailbox: 'INBOX', uid: 100, mode: 'trash' })
      expect(result.content[0].text).toContain('Delete-to-trash failed.')
    })

    it('proton_delete_email: permanent mode devuelve error cuando delete falla', async () => {
      const imap = makeImap({ deleteEmail: vi.fn().mockResolvedValue(false) })
      const { server, invoke } = captureHandler()
      registerMailTools(server, {
        cfg: null as never,
        log: silentLog,
        imap,
        smtp: makeSmtp(),
      })

      const result = await invoke('proton_delete_email', { mailbox: 'INBOX', uid: 100, mode: 'permanent' })
      expect(result.content[0].text).toContain('Delete failed.')
    })
  })
})

// ===========================================================================
// branch gap coverage — lift branches en src/server/mail.ts líneas 488-493, 553-554, 615, 689-690
// ===========================================================================

describe('branch gap coverage — spread ternarios y ?? [] fallback', () => {
  it('proton_send_email con cc/bcc/html/reply_to todos definidos (líneas 488-493 true branches)', async () => {
    const smtp = makeSmtp()
    const { server, invoke } = captureHandler()
    registerMailTools(server, {
      cfg: { products: { mail: { bridge: { from: 'me@proton.me' } } } } as never,
      log: silentLog,
      imap: makeImap(),
      smtp,
    })

    // Pasar todos los campos opcionales explícitamente → hits TRUE branch de cada spread ternario
    await invoke('proton_send_email', {
      to: ['bob@test.com'],
      cc: ['carol@test.com'],
      bcc: ['dan@test.com'],
      subject: 'Con todo',
      text: 'Cuerpo texto',
      html: '<p>Cuerpo HTML</p>',
      reply_to: 'me@proton.me',
    })

    // smtp.send recibe los campos extendidos desde las spreads
    expect(smtp.send).toHaveBeenCalledWith(
      expect.objectContaining({
        cc: ['carol@test.com'],
        bcc: ['dan@test.com'],
        text: 'Cuerpo texto',
        html: '<p>Cuerpo HTML</p>',
        replyTo: 'me@proton.me',
      }),
    )
  })

  it('proton_flag_email con action=custom y add_flags/remove_flags explícitos (líneas 689-690 true branches)', async () => {
    const imap = makeImap()
    const { server, invoke } = captureHandler()
    registerMailTools(server, {
      cfg: null as never,
      log: silentLog,
      imap,
      smtp: makeSmtp(),
    })

    await invoke('proton_flag_email', {
      mailbox: 'INBOX',
      uid: 100,
      action: 'custom',
      add_flags: ['\\MyTag', '\\Important'],
      remove_flags: ['\\OldFlag'],
    })

    // Los ?? [] no deben aplicarse (los arrays llegan definidos) → setFlags recibe los valores exactos
    expect(imap.setFlags).toHaveBeenCalledWith('INBOX', 100, ['\\MyTag', '\\Important'], ['\\OldFlag'])
  })

  it('proton_reply_email con html explícito (líneas 553-554 — true html branch)', async () => {
    hoisted.mockBuildReplyOptions.mockResolvedValue({
      to: ['alice@example.com'],
      subject: 'Re: Hola',
      html: '<p>Reply en HTML</p>',
      inReplyTo: '<msg-100@proton>',
      references: ['<msg-100@proton>'],
    } as SendOptions)
    const smtp = makeSmtp()
    const imap = makeImap()
    const { server, invoke } = captureHandler()
    registerMailTools(server, {
      cfg: { products: { mail: { bridge: { from: 'me@proton.me' } } } } as never,
      log: silentLog,
      imap,
      smtp,
    })

    await invoke('proton_reply_email', {
      mailbox: 'INBOX',
      uid: 100,
      html: '<p>Reply en HTML</p>',
      reply_all: false,
      include_quote: true,
    })

    // buildReplyOptions recibe el html (spread ternario línea 554 true branch)
    expect(hoisted.mockBuildReplyOptions).toHaveBeenCalledWith({
      imap,
      mailbox: 'INBOX',
      uid: 100,
      body: { text: undefined, html: '<p>Reply en HTML</p>' },
      includeQuote: true,
      replyAll: false,
      ownAddress: 'me@proton.me',
    })
    expect(smtp.send).toHaveBeenCalled()
  })

  it('proton_forward_email con html explícito (línea 615 — true html branch)', async () => {
    hoisted.mockBuildForwardOptions.mockResolvedValue({
      to: ['external@test.com'],
      subject: 'Fwd: Hola',
      html: '<p>Forward HTML</p>',
      inReplyTo: '<msg-100@proton>',
      references: ['<msg-100@proton>'],
    } as SendOptions)
    const smtp = makeSmtp()
    const imap = makeImap()
    const { server, invoke } = captureHandler()
    registerMailTools(server, {
      cfg: null as never,
      log: silentLog,
      imap,
      smtp,
    })

    await invoke('proton_forward_email', {
      mailbox: 'INBOX',
      uid: 100,
      to: ['external@test.com'],
      html: '<p>Forward HTML</p>',
      include_attachments: false,
    })

    expect(hoisted.mockBuildForwardOptions).toHaveBeenCalledWith(
      imap,
      'INBOX',
      100,
      ['external@test.com'],
      { text: undefined, html: '<p>Forward HTML</p>' }, // text undefined, html defined
      false,
    )
    expect(smtp.send).toHaveBeenCalled()
  })
})
