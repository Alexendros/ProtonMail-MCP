/**
 * Tests para src/agent/organizer.ts (68.82% → objetivo ~95%).
 *
 * buildOrganizationPlan:
 *  1. Resuelve bridge config → crea ImapClient
 *  2. Lista mailboxes + emails desde INBOX
 *  3. Clasifica cada email con classifyEmail + detectThreats
 *  4. Agrupa por categoría → propone carpetas + etiquetas + alertas
 *
 * Mock: ImapClient class via vi.mock, alerts functions, resolveBridgeConfig.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { GoalContext, OrganizationPlan } from '../../src/agent/goals.js'
import type { AlertSystem } from '../../src/alerts/index.js'
import type { EmailSummary, EmailFull } from '../../src/imap.js'

// ---------------------------------------------------------------------------
// Mock state
// ---------------------------------------------------------------------------

const hoisted = vi.hoisted(() => {
  // ImapClient mock methods
  const mockListMailboxes = vi.fn()
  const mockListEmails = vi.fn()
  const mockGetEmail = vi.fn()
  const mockClose = vi.fn()
  const mockCreateMailbox = vi.fn()
  const mockCopyEmail = vi.fn()
  const mockMoveEmail = vi.fn()

  class MockImapClient {
    listMailboxes = mockListMailboxes
    listEmails = mockListEmails
    getEmail = mockGetEmail
    close = mockClose
    createMailbox = mockCreateMailbox
    copyEmail = mockCopyEmail
    moveEmail = mockMoveEmail
  }

  const mockResolveBridgeConfig = vi.fn()
  const mockClassifyEmail = vi.fn()
  const mockDetectThreats = vi.fn()
  const mockInferStateLabels = vi.fn()

  const mockAlertsEmit = vi.fn()
  const mockAlertsInfo = vi.fn()
  const mockAlertSystem = {
    emit: mockAlertsEmit,
    info: mockAlertsInfo,
    warning: vi.fn(),
    alert: vi.fn(),
    critical: vi.fn(),
  } as unknown as AlertSystem

  const silentLog = { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }

  return {
    MockImapClient, mockListMailboxes, mockListEmails, mockGetEmail, mockClose, mockCreateMailbox, mockCopyEmail, mockMoveEmail,
    mockResolveBridgeConfig, mockClassifyEmail, mockDetectThreats, mockInferStateLabels,
    mockAlertsEmit, mockAlertsInfo, mockAlertSystem, silentLog,
  }
})

vi.mock('../../src/config.js', () => ({
  resolveBridgeConfig: hoisted.mockResolveBridgeConfig,
}))

vi.mock('../../src/imap.js', () => ({
  ImapClient: hoisted.MockImapClient,
}))

vi.mock('../../src/alerts/index.js', () => ({
  classifyEmail: hoisted.mockClassifyEmail,
  detectThreats: hoisted.mockDetectThreats,
  inferStateLabels: hoisted.mockInferStateLabels,
}))

// ---------------------------------------------------------------------------
// Module under test
// ---------------------------------------------------------------------------

import { buildOrganizationPlan, applyOrganizationPlan } from '../../src/agent/organizer.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const defaultCfg = {
  mail: { bridge: { host: '127.0.0.1', imapPort: 1143, user: 'test', passwordResolver: vi.fn(), tlsInsecure: true } },
  agent: { dryRun: true, maxInspectEmails: 50, minConfidence: 0.3 },
} as never

const defaultCtx: GoalContext = {
  goal: 'organize',
  dryRun: true,
  maxInspectEmails: 50,
  minConfidence: 0.3,
}

function makeSummary(uid: number, overrides?: Partial<EmailSummary>): EmailSummary {
  return { uid, seq: uid, messageId: `msg-${uid}`, from: 'sender@test.com', to: ['me@test.com'], subject: `Subject ${uid}`, date: '2026-07-18T10:00:00Z', flags: [], size: 1000, ...overrides }
}

function makeFullEmail(uid: number, overrides?: Partial<EmailFull>): EmailFull {
  return {
    uid, seq: uid, messageId: `msg-${uid}`, from: 'sender@test.com', to: ['me@test.com'], subject: `Subject ${uid}`, date: '2026-07-18T10:00:00Z', flags: [], size: 1000,
    cc: [], bcc: [], replyTo: [], textBody: 'Body text', htmlBody: undefined, attachments: [], headers: {},
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
  hoisted.mockResolveBridgeConfig.mockResolvedValue({ host: '127.0.0.1', imapPort: 1143, user: 'test', passwordResolver: vi.fn(), tlsInsecure: true })
  hoisted.mockClose.mockResolvedValue(undefined)
})

// ===========================================================================
// buildOrganizationPlan
// ===========================================================================

describe('buildOrganizationPlan', () => {
  it('devuelve plan vacío cuando inbox está vacío', async () => {
    hoisted.mockListMailboxes.mockResolvedValue([{ path: 'INBOX' }])
    hoisted.mockListEmails.mockResolvedValue({ items: [], total: 0 })

    const plan = await buildOrganizationPlan(defaultCfg, defaultCtx, hoisted.silentLog, hoisted.mockAlertSystem)

    expect(plan.newFolders).toEqual([])
    expect(plan.folderProposals).toEqual([])
    expect(plan.alerts).toEqual([])
  })

  it('clasifica emails en múltiples categorías', async () => {
    hoisted.mockListMailboxes.mockResolvedValue([{ path: 'INBOX' }])
    hoisted.mockListEmails.mockResolvedValue({
      items: [makeSummary(1), makeSummary(2), makeSummary(3)],
      total: 3,
    })
    hoisted.mockGetEmail
      .mockResolvedValueOnce(makeFullEmail(1, { from: 'legal@corp.com', subject: 'Contrato urgente', textBody: 'contrato documentos notificación requerimiento' }))
      .mockResolvedValueOnce(makeFullEmail(2, { from: 'admin@corp.com', subject: 'Factura pagos', textBody: 'factura invoice pago payment banco' }))
      .mockResolvedValueOnce(makeFullEmail(3, { from: 'tech@dev.com', subject: 'Login alert', textBody: 'nuevo dispositivo inicio de sesión login' }))
    hoisted.mockClassifyEmail
      .mockReturnValueOnce({ category: 'comunicaciones', confidence: 0.85, severity: 'alert', reason: 'Coincidencias: contrato, requerimiento', suggestedFolder: 'Folders/Comunicaciones', suggestedLabels: [] })
      .mockReturnValueOnce({ category: 'pagos', confidence: 0.8, severity: 'info', reason: 'Coincidencias: factura, pago', suggestedFolder: 'Folders/Pagos', suggestedLabels: [] })
      .mockReturnValueOnce({ category: 'logins', confidence: 0.9, severity: 'info', reason: 'Coincidencias: login, dispositivo', suggestedFolder: 'Folders/Logins', suggestedLabels: [] })
    hoisted.mockDetectThreats.mockReturnValue([])
    hoisted.mockInferStateLabels
      .mockReturnValueOnce({ labels: ['Labels/Importante'], reason: 'comunicación importante' })
      .mockReturnValueOnce({ labels: ['Labels/Por resolver'], reason: 'requiere acción' })
      .mockReturnValueOnce({ labels: [], reason: 'sin etiqueta' })

    const plan = await buildOrganizationPlan(defaultCfg, defaultCtx, hoisted.silentLog, hoisted.mockAlertSystem)

    expect(plan.newFolders).toEqual(['Folders/Comunicaciones', 'Folders/Pagos', 'Folders/Logins'])
    expect(plan.folderProposals).toHaveLength(3)
    expect(plan.folderProposals[0].emails).toEqual([1])
    expect(plan.folderProposals[1].emails).toEqual([2])
    expect(plan.folderProposals[2].emails).toEqual([3])
    // Etiquetas inferidas
    expect(plan.labelProposals.length).toBeGreaterThanOrEqual(2)
  })

  it('filtra emails con confianza baja (minConfidence=0.3)', async () => {
    hoisted.mockListMailboxes.mockResolvedValue([{ path: 'INBOX' }])
    hoisted.mockListEmails.mockResolvedValue({
      items: [makeSummary(1), makeSummary(2)],
      total: 2,
    })
    hoisted.mockGetEmail
      .mockResolvedValueOnce(makeFullEmail(1))
      .mockResolvedValueOnce(makeFullEmail(2))
    // Email 1: confianza alta > 0.3
    hoisted.mockClassifyEmail
      .mockReturnValueOnce({ category: 'pagos', confidence: 0.8, severity: 'info', reason: 'Coincidencias: factura', suggestedFolder: 'Folders/Pagos', suggestedLabels: [] })
      // Email 2: confianza baja < 0.3 → filtrado
      .mockReturnValueOnce({ category: 'uncategorized', confidence: 0.1, severity: 'info', reason: 'No encaja', suggestedFolder: 'Archive', suggestedLabels: [] })
    hoisted.mockDetectThreats.mockReturnValue([])
    hoisted.mockInferStateLabels.mockReturnValue({ labels: [], reason: 'sin etiqueta' })

    const plan = await buildOrganizationPlan(defaultCfg, defaultCtx, hoisted.silentLog, hoisted.mockAlertSystem)

    expect(plan.folderProposals).toHaveLength(1)
    expect(plan.folderProposals[0].emails).toEqual([1])
  })

  it('detecta amenazas y emite alertas', async () => {
    hoisted.mockListMailboxes.mockResolvedValue([{ path: 'INBOX' }])
    hoisted.mockListEmails.mockResolvedValue({
      items: [makeSummary(1)],
      total: 1,
    })
    hoisted.mockGetEmail.mockResolvedValueOnce(makeFullEmail(1, { from: 'phish@xyz.ru', subject: 'Verify account', htmlBody: '<a href="http://proton.xyz">Click</a>' }))
    hoisted.mockClassifyEmail.mockReturnValue({ category: 'logins', confidence: 0.5, severity: 'info', reason: 'login detectado', suggestedFolder: 'Folders/Logins', suggestedLabels: [] })
    hoisted.mockDetectThreats.mockReturnValue([
      { threat: 'phishing_link', severity: 'critical', confidence: 0.8, indicators: ['http://proton.xyz'] },
    ])
    hoisted.mockInferStateLabels.mockReturnValue({ labels: [], reason: 'sin etiqueta' })

    const plan = await buildOrganizationPlan(defaultCfg, defaultCtx, hoisted.silentLog, hoisted.mockAlertSystem)

    // Alerta emitida
    expect(hoisted.mockAlertsEmit).toHaveBeenCalledWith('critical', 'threat', expect.stringContaining('phishing_link'), 'agent/organizer', expect.any(Object))
    expect(plan.alerts).toHaveLength(1)
    expect(plan.alerts[0].severity).toBe('critical')
  })

  it('filtra amenazas con confianza por debajo de minConfidence', async () => {
    hoisted.mockListMailboxes.mockResolvedValue([{ path: 'INBOX' }])
    hoisted.mockListEmails.mockResolvedValue({
      items: [makeSummary(1)],
      total: 1,
    })
    hoisted.mockGetEmail.mockResolvedValueOnce(makeFullEmail(1))
    hoisted.mockClassifyEmail.mockReturnValue({ category: 'comercial', confidence: 0.7, severity: 'info', reason: 'newsletter', suggestedFolder: 'Folders/Comercial', suggestedLabels: [] })
    hoisted.mockDetectThreats.mockReturnValue([
      { threat: 'phishing_link', severity: 'critical', confidence: 0.2, indicators: [] }, // < 0.3
    ])
    hoisted.mockInferStateLabels.mockReturnValue({ labels: [], reason: 'sin etiqueta' })

    const plan = await buildOrganizationPlan(defaultCfg, defaultCtx, hoisted.silentLog, hoisted.mockAlertSystem)

    expect(plan.alerts).toHaveLength(0)
    expect(hoisted.mockAlertsEmit).not.toHaveBeenCalled()
  })

  it('ignora emails sin uid', async () => {
    hoisted.mockListMailboxes.mockResolvedValue([{ path: 'INBOX' }])
    hoisted.mockListEmails.mockResolvedValue({
      items: [{ seq: 1 }, { uid: 2 }], // first has no uid
      total: 2,
    })
    hoisted.mockGetEmail.mockResolvedValueOnce(makeFullEmail(2))

    await buildOrganizationPlan(defaultCfg, defaultCtx, hoisted.silentLog, hoisted.mockAlertSystem)

    // Only uid=2 processed
    expect(hoisted.mockGetEmail).toHaveBeenCalledTimes(1)
    expect(hoisted.mockGetEmail).toHaveBeenCalledWith('INBOX', 2)
  })

  it('maneja errores de getEmail sin romper el plan', async () => {
    hoisted.mockListMailboxes.mockResolvedValue([{ path: 'INBOX' }])
    hoisted.mockListEmails.mockResolvedValue({
      items: [makeSummary(1)],
      total: 1,
    })
    hoisted.mockGetEmail.mockRejectedValueOnce(new Error('IMAP fetch failed'))

    const plan = await buildOrganizationPlan(defaultCfg, defaultCtx, hoisted.silentLog, hoisted.mockAlertSystem)

    expect(plan.newFolders).toEqual([])
    expect(plan.folderProposals).toEqual([])
    // close debe haberse llamado en finally
    expect(hoisted.mockClose).toHaveBeenCalled()
  })

  it('salta emails cuyo getEmail devuelve null', async () => {
    hoisted.mockListMailboxes.mockResolvedValue([{ path: 'INBOX' }])
    hoisted.mockListEmails.mockResolvedValue({
      items: [makeSummary(1), makeSummary(2)],
      total: 2,
    })
    hoisted.mockGetEmail
      .mockResolvedValueOnce(null)  // getEmail returns null → skip
      .mockResolvedValueOnce(makeFullEmail(2))
    hoisted.mockClassifyEmail.mockReturnValue({ category: 'comercial', confidence: 0.8, severity: 'info', reason: 'newsletter', suggestedFolder: 'Archive', suggestedLabels: [] })
    hoisted.mockDetectThreats.mockReturnValue([])
    hoisted.mockInferStateLabels.mockReturnValue({ labels: [], reason: 'sin etiqueta' })

    const plan = await buildOrganizationPlan(defaultCfg, defaultCtx, hoisted.silentLog, hoisted.mockAlertSystem)

    // Only uid=2 should be classified (uid=1 was skipped because getEmail returned null)
    expect(plan.folderProposals).toHaveLength(1)
    expect(plan.folderProposals[0].emails).toEqual([2])
  })

  it('cierra ImapClient en finally incluso cuando listMailboxes lanza', async () => {
    hoisted.mockListMailboxes.mockRejectedValue(new Error('list failed'))

    // El error se propaga desde el try → finally → close() → throw
    await expect(buildOrganizationPlan(defaultCfg, defaultCtx, hoisted.silentLog, hoisted.mockAlertSystem))
      .rejects.toThrow('list failed')
    expect(hoisted.mockClose).toHaveBeenCalledTimes(1)
  })

  it('usa las carpetas existentes para no duplicar newFolders', async () => {
    hoisted.mockListMailboxes.mockResolvedValue([{ path: 'Folders/Pagos' }, { path: 'Folders/Logins' }])
    hoisted.mockListEmails.mockResolvedValue({
      items: [makeSummary(1), makeSummary(2)],
      total: 2,
    })
    hoisted.mockGetEmail
      .mockResolvedValueOnce(makeFullEmail(1))
      .mockResolvedValueOnce(makeFullEmail(2))
    hoisted.mockClassifyEmail
      .mockReturnValueOnce({ category: 'pagos', confidence: 0.8, severity: 'info', reason: 'factura', suggestedFolder: 'Folders/Pagos', suggestedLabels: [] })
      .mockReturnValueOnce({ category: 'comunicaciones', confidence: 0.9, severity: 'alert', reason: 'contrato', suggestedFolder: 'Folders/Comunicaciones', suggestedLabels: [] })
    hoisted.mockDetectThreats.mockReturnValue([])
    hoisted.mockInferStateLabels.mockReturnValue({ labels: [], reason: 'sin etiqueta' })

    const plan = await buildOrganizationPlan(defaultCfg, defaultCtx, hoisted.silentLog, hoisted.mockAlertSystem)

    // Pagos ya existe → no se añade a newFolders
    // Comunicaciones no existe → se añade
    expect(plan.newFolders).toEqual(['Folders/Comunicaciones'])
  })

  it('clasifica spam con suggestedFolder Spam y categoría spam', async () => {
    hoisted.mockListMailboxes.mockResolvedValue([{ path: 'INBOX' }])
    hoisted.mockListEmails.mockResolvedValue({
      items: [makeSummary(1)],
      total: 1,
    })
    hoisted.mockGetEmail.mockResolvedValueOnce(makeFullEmail(1, { from: 'spammer@xyz.tk', subject: 'Gana dinero ya!', textBody: 'oferta promoción descuento opportunity' }))
    hoisted.mockClassifyEmail.mockReturnValue({ category: 'spam', confidence: 0.95, severity: 'info', reason: 'Múltiples patrones de spam', suggestedFolder: 'Spam', suggestedLabels: [] })
    hoisted.mockDetectThreats.mockReturnValue([])
    hoisted.mockInferStateLabels.mockReturnValue({ labels: [], reason: 'sin etiqueta' })

    const plan = await buildOrganizationPlan(defaultCfg, defaultCtx, hoisted.silentLog, hoisted.mockAlertSystem)

    expect(plan.folderProposals).toHaveLength(1)
    expect(plan.folderProposals[0].path).toBe('Spam')
    expect(plan.newFolders).toContain('Spam')
  })

  it('pasa from/subject/textBody/htmlBody a classifyEmail y detectThreats', async () => {
    hoisted.mockListMailboxes.mockResolvedValue([{ path: 'INBOX' }])
    hoisted.mockListEmails.mockResolvedValue({
      items: [makeSummary(10)],
      total: 1,
    })
    hoisted.mockGetEmail.mockResolvedValueOnce(makeFullEmail(10, { from: 'test@example.com', subject: 'Test subject', textBody: 'This is the body', htmlBody: '<p>HTML body</p>' }))
    hoisted.mockClassifyEmail.mockReturnValue({ category: 'comercial', confidence: 0.7, severity: 'info', reason: 'test', suggestedFolder: 'Folders/Comercial', suggestedLabels: [] })
    hoisted.mockDetectThreats.mockReturnValue([])
    hoisted.mockInferStateLabels.mockReturnValue({ labels: [], reason: 'sin etiqueta' })

    await buildOrganizationPlan(defaultCfg, defaultCtx, hoisted.silentLog, hoisted.mockAlertSystem)

    expect(hoisted.mockClassifyEmail).toHaveBeenCalledWith({
      from: 'test@example.com',
      subject: 'Test subject',
      text: 'This is the body',
      html: '<p>HTML body</p>',
    })
    expect(hoisted.mockDetectThreats).toHaveBeenCalledWith({
      from: 'test@example.com',
      subject: 'Test subject',
      text: 'This is the body',
      html: '<p>HTML body</p>',
    })
  })
})

// ===========================================================================
// applyOrganizationPlan
// ===========================================================================

describe('applyOrganizationPlan', () => {
  const samplePlan: OrganizationPlan = {
    newFolders: ['Folders/Nuevo', 'Labels/Urgente'],
    folderProposals: [
      { path: 'Folders/Pagos', reason: 'facturas', emails: [1, 2], suggestedLabels: ['Labels/Pendiente'] },
    ],
    labelProposals: [
      { name: 'Labels/Importante', reason: 'prioridad', emails: [1] },
    ],
    alerts: [],
  }

  beforeEach(() => {
    hoisted.mockCreateMailbox.mockResolvedValue({ path: '', created: true })
    hoisted.mockCopyEmail.mockResolvedValue(true)
    hoisted.mockMoveEmail.mockResolvedValue(true)
    hoisted.mockListEmails.mockResolvedValue({ items: [makeSummary(1), makeSummary(2)], total: 2 })
  })

  it('crea carpetas nuevas', async () => {
    await applyOrganizationPlan(defaultCfg, samplePlan, hoisted.silentLog)

    expect(hoisted.mockCreateMailbox).toHaveBeenCalledWith('Folders/Nuevo')
    expect(hoisted.mockCreateMailbox).toHaveBeenCalledWith('Labels/Urgente')
    expect(hoisted.mockCreateMailbox).toHaveBeenCalledWith('Labels/Importante')
  })

  it('mueve emails a las carpetas propuestas', async () => {
    await applyOrganizationPlan(defaultCfg, samplePlan, hoisted.silentLog)

    expect(hoisted.mockMoveEmail).toHaveBeenCalledWith('INBOX', 1, 'Folders/Pagos')
    expect(hoisted.mockMoveEmail).toHaveBeenCalledWith('INBOX', 2, 'Folders/Pagos')
  })

  it('copia emails a las etiquetas desde INBOX', async () => {
    await applyOrganizationPlan(defaultCfg, samplePlan, hoisted.silentLog)

    expect(hoisted.mockCopyEmail).toHaveBeenCalledWith('INBOX', 1, 'Labels/Importante')
  })

  it('ignora createMailbox cuando lanza "already subscribed"', async () => {
    hoisted.mockCreateMailbox.mockRejectedValue(new Error('already subscribed'))

    await applyOrganizationPlan(defaultCfg, samplePlan, hoisted.silentLog)
    // No debe lanzar — el catch captura "already subscribed"
  })

  it('continúa aunque moveEmail falle individualmente', async () => {
    hoisted.mockMoveEmail.mockResolvedValueOnce(true).mockResolvedValueOnce(false)

    await expect(applyOrganizationPlan(defaultCfg, samplePlan, hoisted.silentLog)).resolves.toBeUndefined()
  })

  it('aplica suggestedLabels en las carpetas destino', async () => {
    const plan: OrganizationPlan = {
      newFolders: [],
      folderProposals: [
        { path: 'Folders/Pagos', reason: 'facturas', emails: [1], suggestedLabels: ['Labels/Pendiente'] },
      ],
      labelProposals: [],
      alerts: [],
    }
    hoisted.mockCreateMailbox.mockResolvedValue({ path: 'Folders/Pagos', created: false })
    hoisted.mockListEmails.mockResolvedValue({ items: [makeSummary(1)], total: 1 })

    await applyOrganizationPlan(defaultCfg, plan, hoisted.silentLog)

    // suggestedLabels path: list moved items, then copy to label
    expect(hoisted.mockListEmails).toHaveBeenCalledWith('Folders/Pagos', 1, 0)
    expect(hoisted.mockCopyEmail).toHaveBeenCalledWith('Folders/Pagos', 1, 'Labels/Pendiente')
  })

  it('cierra ImapClient en finally', async () => {
    await applyOrganizationPlan(defaultCfg, samplePlan, hoisted.silentLog)

    expect(hoisted.mockClose).toHaveBeenCalledTimes(1)
  })
})

// ===========================================================================
// branch gap coverage — lift branches en src/agent/organizer.ts líneas 96, 106-107, 157
// ===========================================================================

describe('buildOrganizationPlan — branch gap coverage', () => {
  it('deduplica labelProposals cuando 2+ emails infieren la misma etiqueta (línea 96)', async () => {
    hoisted.mockListMailboxes.mockResolvedValue([{ path: 'INBOX' }])
    hoisted.mockListEmails.mockResolvedValue({
      items: [makeSummary(1), makeSummary(2), makeSummary(3)],
      total: 3,
    })
    hoisted.mockGetEmail
      .mockResolvedValueOnce(makeFullEmail(1))
      .mockResolvedValueOnce(makeFullEmail(2))
      .mockResolvedValueOnce(makeFullEmail(3))
    hoisted.mockClassifyEmail.mockReturnValue({ category: 'comercial', confidence: 0.8, severity: 'info', reason: 'newsletter', suggestedFolder: 'Folders/Comercial', suggestedLabels: [] })
    hoisted.mockDetectThreats.mockReturnValue([])
    // Emails 1, 2, 3 infieren la MISMA label → existing.emails.push se llama 2 veces
    hoisted.mockInferStateLabels.mockReturnValue({ labels: ['Labels/Por revisar'], reason: 'requiere acción' })

    const plan = await buildOrganizationPlan(defaultCfg, defaultCtx, hoisted.silentLog, hoisted.mockAlertSystem)

    // 1 sola labelProposal con todos los uids
    expect(plan.labelProposals).toHaveLength(1)
    expect(plan.labelProposals[0].name).toBe('Labels/Por revisar')
    expect(plan.labelProposals[0].emails).toEqual([1, 2, 3])
  })

  it('maneja errores de inferStateLabels sin romper el plan (líneas 106-107)', async () => {
    hoisted.mockListMailboxes.mockResolvedValue([{ path: 'INBOX' }])
    hoisted.mockListEmails.mockResolvedValue({
      items: [makeSummary(1)],
      total: 1,
    })
    hoisted.mockGetEmail.mockResolvedValueOnce(makeFullEmail(1))
    hoisted.mockClassifyEmail.mockReturnValue({ category: 'comercial', confidence: 0.8, severity: 'info', reason: 'newsletter', suggestedFolder: 'Folders/Comercial', suggestedLabels: [] })
    hoisted.mockDetectThreats.mockReturnValue([])
    // inferStateLabels throws → entra en el catch block
    hoisted.mockInferStateLabels.mockImplementation(() => {
      throw new Error('state inference failed')
    })

    const plan = await buildOrganizationPlan(defaultCfg, defaultCtx, hoisted.silentLog, hoisted.mockAlertSystem)

    // Plan sigue adelante con la propuesta de carpeta, pero sin labelProposals por el fallo
    expect(plan.folderProposals).toHaveLength(1)
    expect(plan.labelProposals).toEqual([])
    // Error loggeado
    expect(hoisted.silentLog.error).toHaveBeenCalledWith(
      'Error inferring state labels',
      expect.objectContaining({ uid: 1, error: expect.stringContaining('state inference failed') }),
    )
  })

  it('clasifica email sin from/subject/textBody/htmlBody — spread ternarios al false branch', async () => {
    hoisted.mockListMailboxes.mockResolvedValue([{ path: 'INBOX' }])
    hoisted.mockListEmails.mockResolvedValue({
      items: [makeSummary(1)],
      total: 1,
    })
    // Email con todos los campos opcionales undefined
    hoisted.mockGetEmail.mockResolvedValueOnce(makeFullEmail(1, { from: undefined, subject: undefined, textBody: undefined, htmlBody: undefined }))
    hoisted.mockClassifyEmail.mockReturnValue({ category: 'uncategorized', confidence: 0.5, severity: 'info', reason: 'empty', suggestedFolder: 'Archive', suggestedLabels: [] })
    hoisted.mockDetectThreats.mockReturnValue([])
    hoisted.mockInferStateLabels.mockReturnValue({ labels: [], reason: 'sin etiqueta' })

    await buildOrganizationPlan(defaultCfg, defaultCtx, hoisted.silentLog, hoisted.mockAlertSystem)

    // Spread ternarios caen al branch false → classifyEmail/detectThreats reciben {}
    expect(hoisted.mockClassifyEmail).toHaveBeenCalledWith({})
    expect(hoisted.mockDetectThreats).toHaveBeenCalledWith({})
  })
})

describe('applyOrganizationPlan — branch gap coverage', () => {
  it('re-lanza error de createMailbox que no es "already subscribed" (línea 157)', async () => {
    const plan: OrganizationPlan = {
      newFolders: ['Folders/NewFolder'],
      folderProposals: [],
      labelProposals: [],
      alerts: [],
    }
    // Throw sin "already subscribed" → entra al throw err
    hoisted.mockCreateMailbox.mockRejectedValueOnce(new Error('Permission denied: cannot create folder'))

    await expect(applyOrganizationPlan(defaultCfg, plan, hoisted.silentLog)).rejects.toThrow('Permission denied')
    expect(hoisted.mockCreateMailbox).toHaveBeenCalledTimes(1)
  })
})
