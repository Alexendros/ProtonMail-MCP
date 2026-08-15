---
name: onboarding
description: Puesta en marcha de Proton Suite Agent desde cero hasta el primer plan de organización.
---

# Onboarding — Puesta en marcha de Proton Suite Agent

Objetivo: instalar el agente, verificar que habla con Proton Mail Bridge y dejarlo listo para operar de forma autónoma con supervisión humana.

## Precondiciones

- Node ≥ 22 instalado.
- Proton Mail Bridge headless corriendo y con la cuenta logueada.
- Bridge password disponible (`protonmail-bridge-core --cli` → `info`).

## Pasos

### 1. Instalar el paquete

```bash
npx -y @alexendros/protonsuite-agent setup
```

### 2. Configurar variables de entorno mínimas

```bash
export PROTON_BRIDGE_USER=you@proton.me
export PROTON_BRIDGE_PASS=your-bridge-password
export PROTON_MAIL_FROM=you@proton.me
export PROTON_BRIDGE_TLS_INSECURE=true
export AGENT_DRY_RUN=true
export ALERT_MIN_SEVERITY=warning
```

### 3. Verificar conectividad

```bash
npx -y @alexendros/protonsuite-agent setup
```

Salida esperada: Bridge reachable, IMAP OK, SMTP OK, lista de carpetas incluyendo INBOX.

### 4. Generar plan de organización inicial

```bash
npx -y @alexendros/protonsuite-agent organize
```

Revisa el plan en consola y en `logs/alerts-YYYY-MM-DD.jsonl`.

### 5. Configurar el cliente MCP

Añade el bloque `mcpServers` de [`docs/agent-quickstart.md`](../docs/agent-quickstart.md) a tu cliente. Si usas un gestor de secretos, utiliza [`connectors/stdio-wrapper.sh.example`](../connectors/stdio-wrapper.sh.example).

### 6. Configurar alertas (opcional)

```bash
export ALERT_WEBHOOK_URL=https://hooks.tu-servidor.com/agent
export ALERT_MIN_SEVERITY=warning
```

### 7. Pasar a modo aplicación (cuando el plan esté validado)

```bash
export AGENT_DRY_RUN=false
npx -y @alexendros/protonsuite-agent organize
```

## Checklist final

- [ ] Bridge escucha en `127.0.0.1:1143` / `1025`.
- [ ] `agent:setup` reporta IMAP OK y SMTP OK.
- [ ] El plan de organización se ha revisado en dry-run.
- [ ] El bridge password no está en claro en el disco del cliente.
- [ ] `ALERT_WEBHOOK_URL` configurado si se desean alertas remotas.
- [ ] `AGENT_DRY_RUN=false` solo después de la validación manual.
