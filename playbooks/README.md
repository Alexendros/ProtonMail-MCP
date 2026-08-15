# Playbooks — Proton Suite Agent

Workflows operativos listos para humanos y agentes. Cada archivo tiene
frontmatter `name` / `description`.

## Índice

| Playbook | Uso |
| --- | --- |
| [onboarding.md](./onboarding.md) | Puesta en marcha hasta el primer plan |
| [setup-checklist.md](./setup-checklist.md) | Precondiciones (pnpm, Bridge, Pass) |
| [organize-inbox.md](./organize-inbox.md) | Organización del buzón |
| [triage-email.md](./triage-email.md) | Triage INBOX (siempre dry-run primero) |
| [reply-organize.md](./reply-organize.md) | Responder y organizar |
| [fraud-detection.md](./fraud-detection.md) | Fraude / phishing |
| [phishing-response.md](./phishing-response.md) | Respuesta a phishing |
| [pass-audit.md](./pass-audit.md) | Auditoría de vault Pass |
| [suite-daily-briefing.md](./suite-daily-briefing.md) | Briefing cross-producto |
| [security-incident-response.md](./security-incident-response.md) | Incidente de seguridad |

## Ejemplos de prompts

### Organizar inbox (dry-run)

```
Eres el operador de Proton Suite Agent. Ejecuta el goal `organize` en dry-run
(AGENT_DRY_RUN=true). Resume carpetas propuestas, etiquetas y alertas críticas.
No apliques cambios. Usa UIDs IMAP, no sequence numbers.
```

### Auditoría Pass

```
Ejecuta `pass-audit` con PROTON_PASS_ENABLED=true. Devuélveme total de entradas,
débiles, duplicados y el rotationPlan. No regeneres secretos (deja dry-run).
Nunca muestres valores de contraseña.
```

### Briefing diario

```
Sigue playbooks/suite-daily-briefing.md: estado Mail/Pass/Drive vía
proton_suite_status y un resumen de alertas del día. Solo lectura.
```
