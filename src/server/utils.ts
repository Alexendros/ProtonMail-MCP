import type { SearchObject } from 'imapflow'
import type { IImapClient } from '../clients/interfaces.js'

export async function resolveTrashPath(
  imap: IImapClient,
  override?: string,
): Promise<string> {
  if (override) return override
  const mbs = await imap.listMailboxes()
  const trash = mbs.find((m) => m.specialUse === '\\Trash')
  return trash?.path ?? 'Trash'
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s
  return s.slice(0, n - 1) + '…'
}

export function renderEmailList(
  items: {
    uid: number
    from: string | undefined
    subject: string | undefined
    date: string | undefined
    flags: string[]
  }[],
  mailbox: string,
  total: number,
  offset: number,
  concise = false,
): string {
  if (items.length === 0) return `No messages in ${mailbox} (total: ${total}).`
  if (concise) {
    const head = `**${mailbox}** — ${items.length}/${total} (offset ${offset})`
    const rows = items.map((m) => {
      const date = m.date ? m.date.slice(0, 10) : '—'
      const from = truncate(m.from ?? '—', 24)
      const subject = truncate(m.subject ?? '(no subject)', 40)
      return `- ${m.uid} ${date} ${from} | ${subject}`
    })
    return [head, ...rows].join('\n')
  }
  const head = `**${mailbox}** — showing ${items.length} of ${total} (offset ${offset})\n\n| UID | Date | From | Subject | Flags |\n|---|---|---|---|---|`
  const rows = items.map((m) => {
    const date = m.date ? m.date.slice(0, 16).replace('T', ' ') : '—'
    const from = truncate(m.from ?? '—', 32)
    const subject = truncate(m.subject ?? '(no subject)', 50)
    const flags = m.flags.join(' ') || '—'
    return `| ${m.uid} | ${date} | ${from} | ${subject} | ${flags} |`
  })
  return [head, ...rows].join('\n')
}

export function renderFullEmail(m: {
  uid: number
  from: string | undefined
  to: string[]
  cc: string[]
  subject: string | undefined
  date: string | undefined
  flags: string[]
  textBody: string | undefined
  htmlBody: string | undefined
  attachments: { filename: string | undefined; contentType: string; size: number }[]
}): string {
  const lines = [
    `**Subject:** ${m.subject ?? '(no subject)'}`,
    `**From:** ${m.from ?? '—'}`,
    `**To:** ${m.to.join(', ') || '—'}`,
    m.cc.length > 0 ? `**Cc:** ${m.cc.join(', ')}` : null,
    `**Date:** ${m.date ?? '—'}`,
    `**UID:** ${m.uid}   **Flags:** ${m.flags.join(' ') || '—'}`,
    '',
    '---',
    '',
    m.textBody ?? '(no text body)',
  ].filter((x) => x !== null)
  if (m.attachments.length > 0) {
    lines.push('', '**Attachments:**')
    m.attachments.forEach((a, i) => {
      lines.push(
        `- [${i}] ${a.filename ?? 'unnamed'} — ${a.contentType} — ${(a.size / 1024).toFixed(1)} KB`,
      )
    })
  }
  if (m.htmlBody) {
    lines.push(
      '',
      '---',
      'HTML body present (fetch with include_html=true and response_format=json to retrieve).',
    )
  }
  return lines.join('\n')
}

export function buildSearchCriteria(args: {
  query: string | undefined
  fields: ('text' | 'subject' | 'from' | 'to' | 'body')[]
  since: string | undefined
  before: string | undefined
  unseen_only: boolean
  from_address: string | undefined
  to_address: string | undefined
}): SearchObject {
  const criteria: SearchObject = {}
  if (args.unseen_only) criteria.seen = false
  if (args.since) criteria.since = new Date(args.since)
  if (args.before) criteria.before = new Date(args.before)
  if (args.from_address) criteria.from = args.from_address
  if (args.to_address) criteria.to = args.to_address
  if (args.query) {
    for (const f of args.fields) {
      if (f === 'text') criteria.body = args.query
      if (f === 'subject') criteria.subject = args.query
      if (f === 'from' && !criteria.from) criteria.from = args.query
      if (f === 'to' && !criteria.to) criteria.to = args.query
      if (f === 'body') criteria.body = args.query
    }
  }
  return criteria
}
