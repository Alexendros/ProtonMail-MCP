import { classifyEmail, detectThreats, inferStateLabels, type AlertSystem } from "../alerts/index.js";
import type { Logger } from "../alerts/index.js";
import type { Config } from "../config.js";
import { resolveBridgeConfig } from "../config.js";
import { ImapClient, type EmailSummary } from "../imap.js";
import type { OrganizationPlan, GoalContext } from "./goals.js";

/** Maps EmailFull fields to the { from?, subject?, text?, html? } shape expected by alert rules. */
function emailFeatures(full: { from?: string | undefined; subject?: string | undefined; textBody?: string | undefined; htmlBody?: string | undefined }) {
  const f: { from?: string; subject?: string; text?: string; html?: string } = {}
  if (full.from !== undefined) f.from = full.from
  if (full.subject !== undefined) f.subject = full.subject
  if (full.textBody !== undefined) f.text = full.textBody
  if (full.htmlBody !== undefined) f.html = full.htmlBody
  return f
}

interface ClassifiedEmail {
  uid: number;
  summary: EmailSummary;
  full: Awaited<ReturnType<ImapClient["getEmail"]>>;
  classification: ReturnType<typeof classifyEmail>;
  threats: ReturnType<typeof detectThreats>;
}

export async function buildOrganizationPlan(
  cfg: Config,
  ctx: GoalContext,
  log: Logger,
  alerts: AlertSystem,
): Promise<OrganizationPlan> {
  const bridgeCfg = await resolveBridgeConfig(cfg, log);
  const imap = new ImapClient(bridgeCfg, log);
  const plan: OrganizationPlan = {
    newFolders: [],
    folderProposals: [],
    labelProposals: [],
    alerts: [],
  };

  try {
    const existingFolders = new Set((await imap.listMailboxes()).map((f) => f.path));
    const { items: summaries } = await imap.listEmails("INBOX", ctx.maxInspectEmails, 0);
    const classified: ClassifiedEmail[] = [];

    for (const summary of summaries) {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- defensive: IMAP runtime may return undefined UIDs
      if (summary.uid == null) continue;
      try {
        const full = await imap.getEmail("INBOX", summary.uid);
        if (!full) continue;
        const features = emailFeatures(full)
        const classification = classifyEmail(features)
        const threats = detectThreats(features)
        classified.push({ uid: summary.uid, summary, full, classification, threats })
      } catch (err) {
        log.error("Error classifying email", { uid: summary.uid, error: String(err) });
      }
    }

    // Group by category and propose folders.
    const byCategory = new Map<string, ClassifiedEmail[]>();
    for (const c of classified) {
      if (c.classification.confidence < ctx.minConfidence) continue;
      const list = byCategory.get(c.classification.category) ?? [];
      list.push(c);
      byCategory.set(c.classification.category, list);
    }

    for (const [category, emails] of byCategory) {
      if (emails.length === 0) continue;
      const first = emails[0];
      if (!first) continue;
      const sample = first.classification;
      const folder = sample.suggestedFolder;
      if (!existingFolders.has(folder)) {
        plan.newFolders.push(folder);
      }
      plan.folderProposals.push({
        path: folder,
        reason: `${emails.length} correos clasificados como ${category} (${sample.reason})`,
        emails: emails.map((e) => e.uid),
        suggestedLabels: [],
      });

      for (const e of emails) {
        try {
          const state = inferStateLabels({
            ...emailFeatures(e.full ?? {}),
            category: e.classification.category,
          });
          for (const label of state.labels) {
            const existing = plan.labelProposals.find((l) => l.name === label);
            if (existing) {
              existing.emails.push(e.uid);
            } else {
              plan.labelProposals.push({
                name: label,
                reason: `Etiqueta de estado inferida: ${state.reason}`,
                emails: [e.uid],
              });
            }
          }
        } catch (err) {
          log.error("Error inferring state labels", { uid: e.uid, error: String(err) });
        }
      }
    }

    // Security alerts from threat detection.
    for (const c of classified) {
      for (const threat of c.threats) {
        if (threat.confidence < ctx.minConfidence) continue;
        const severity = threat.severity;
        const message = `Amenaza ${threat.threat} detectada en UID ${c.uid}: ${threat.indicators.slice(0, 3).join(", ")}`;
        alerts.emit(severity, "threat", message, "agent/organizer", {
          uid: c.uid,
          category: c.classification.category,
          threat: threat.threat,
          indicators: threat.indicators,
        });
        plan.alerts.push({
          severity,
          category: "threat",
          message,
          uids: [c.uid],
        });
      }
    }

    alerts.info(
      "organize",
      `Análisis completado: ${classified.length} correos inspeccionados, ${plan.folderProposals.length} propuestas de carpeta, ${plan.alerts.length} alertas.`,
      "agent/organizer",
      { inspected: classified.length, proposals: plan.folderProposals.length, alerts: plan.alerts.length },
    );

    return plan;
  } finally {
    await imap.close().catch(() => { /* noop */ });
  }
}

export async function applyOrganizationPlan(
  cfg: Config,
  plan: OrganizationPlan,
  log: Logger,
): Promise<void> {
  const bridgeCfg = await resolveBridgeConfig(cfg, log);
  const imap = new ImapClient(bridgeCfg, log);
  try {
    for (const folder of plan.newFolders) {
      await imap.createMailbox(folder).catch((err: unknown) => {
        // Bridge puede devolver "already subscribed" si la carpeta existe.
        if (String(err).toLowerCase().includes("already subscribed")) return;
        throw err;
      });
      log.info("Created folder", { folder });
    }

    // Labels are treated as additional IMAP mailboxes. Copy from INBOX first so
    // the message remains visible under the label even after it is moved to its
    // primary category folder.
    const foldersByPath = new Set(plan.folderProposals.map((p) => p.path.toLowerCase()));
    for (const proposal of plan.labelProposals) {
      if (foldersByPath.has(proposal.name.toLowerCase())) continue;
      await imap.createMailbox(proposal.name).catch(() => { /* may exist */ });
      let applied = 0;
      for (const uid of proposal.emails) {
        const ok = await imap.copyEmail("INBOX", uid, proposal.name).catch(() => false);
        if (ok) applied++;
      }
      log.info("Applied label", { label: proposal.name, applied });
    }

    for (const proposal of plan.folderProposals) {
      let moved = 0;
      for (const uid of proposal.emails) {
        const ok = await imap.moveEmail("INBOX", uid, proposal.path).catch(() => false);
        if (ok) moved++;
      }
      log.info("Moved emails", { folder: proposal.path, moved, expected: proposal.emails.length });

      // After moving, ensure the category labels are also applied to the moved
      // messages. This covers the case where the run was interrupted or labels
      // could not be created from INBOX because of naming issues.
      if (proposal.suggestedLabels && moved > 0) {
        const { items: movedItems } = await imap.listEmails(proposal.path, moved, 0).catch(() => ({ items: [], total: 0 }));
        for (const label of proposal.suggestedLabels) {
          if (foldersByPath.has(label.toLowerCase())) continue;
          await imap.createMailbox(label).catch(() => { /* may exist */ });
          let labelApplied = 0;
          for (const item of movedItems) {
            const ok = await imap.copyEmail(proposal.path, item.uid, label).catch(() => false);
            if (ok) labelApplied++;
          }
          log.info("Applied label from folder", { folder: proposal.path, label, applied: labelApplied });
        }
      }
    }
  } finally {
    await imap.close().catch(() => { /* noop */ });
  }
}
