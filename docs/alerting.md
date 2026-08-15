# Alertas de contenido y seguridad

Proton Suite Agent incluye un subsistema de alertas que analiza el contenido de
los correos (sin enviarlo a terceros) y emite avisos cuando detecta patrones de
riesgo o categorías sensibles.

Implementación: [`src/alerts/`](../src/alerts/) — sinks **file**, **webhook** y **ntfy**.

## Qué detecta

| Categoría | Severidad | Ejemplo de patrón |
|---|---|---|
| `fraud` | critical | Phishing, credenciales solicitadas, premios falsos, dominios suplantadores. |
| `spam` | warning | Ofertas agresivas, "unsubscribe now", palabras de marketing de alto riesgo. |
| `legal` | alert | Abogados, contratos, NDA, tribunales, propiedad intelectual. |
| `admin` | alert | Hacienda, Seguridad Social, registros, certificados digitales. |
| `government` | alert | Ministerios, subvenciones, citas oficiales, DNI/NIE. |
| `banking` | alert | Banca, transferencias, tarjetas, nóminas, facturas. |
| `tech` | info | CI/CD, APIs, incidentes, despliegues, dependencias. |
| `commercial` | info | Ventas, cotizaciones, reuniones, partnership. |
| `personal` | info | Familia, viajes, salud, eventos personales. |

Además, el sistema detecta amenazas específicas:

- `phishing_link` — enlaces a dominios sospechosos o suplantadores.
- `credential_request` — solicitudes de contraseña o verificación de cuenta.
- `urgent_pressure` — lenguaje de urgencia para forzar acciones.
- `suspicious_attachment` — adjuntos con extensiones ejecutables u ofimáticas con macros.

## Configuración

```bash
ALERTS_ENABLED=true
ALERT_MIN_SEVERITY=warning   # info | warning | alert | critical
ALERT_LOG_DIR=logs

# Webhook genérico (Discord/Slack-compatible POST JSON)
ALERT_WEBHOOK_URL=https://hooks.example.com/protonsuite-agent

# ntfy (opcional) — requiere topic; URL por defecto https://ntfy.sh
# ALERT_NTFY_TOPIC=protonsuite-alerts
# ALERT_NTFY_URL=https://ntfy.sh
# ALERT_NTFY_TOKEN=tk_...
```

- `ALERT_WEBHOOK_URL` (opcional): POST JSON por cada alerta ≥ `ALERT_MIN_SEVERITY`.
- `ALERT_NTFY_TOPIC` (opcional): activa el sink ntfy (`src/alerts/ntfy.ts`).
- `ALERT_NTFY_URL` (opcional): servidor ntfy (default `https://ntfy.sh`).
- `ALERT_NTFY_TOKEN` (opcional): bearer para topics privados.
- `ALERT_LOG_DIR`: `alerts-YYYY-MM-DD.jsonl` y `audit-YYYY-MM-DD.jsonl`.
- `ALERT_MIN_SEVERITY`: filtro para webhook/ntfy/fichero; `stderr` sigue el `LOG_LEVEL`.

## Secretos en GitHub (organización)

Misma política que Mail: valores reales en **Organization secrets** (no en `.env` del repo).

| Secreto | Obligatorio | Notas |
| --- | --- | --- |
| `PROTON_BRIDGE_USER` | sí (Mail) | Ya en org |
| `PROTON_BRIDGE_PASS` | sí (Mail) | Ya en org |
| `PROTON_MAIL_FROM` | sí (Mail) | Ya en org |
| `ALERT_NTFY_TOPIC` | para ntfy | Ya en org (selected → `agent-protonsuite`) |
| `ALERT_NTFY_URL` | no | Ya en org (`https://ntfy.sh`) |
| `ALERT_NTFY_TOKEN` | si el topic es privado | Opcional; crear con cuenta ntfy |

Copia local del topic (no commitear): `pass show alerts/ntfy | head -1`.

Rotar o añadir token (visibilidad selected → `agent-protonsuite`):

```bash
# Solo si reservas el topic / usas cuenta ntfy
gh secret set ALERT_NTFY_TOKEN --org Iniciativas-Alexendros \
  --visibility selected --repos agent-protonsuite --body 'tk_...'
```

**Compose:** `docker-compose.yml` pasa `ALERT_NTFY_*` al servicio `agent` desde el entorno / `.env` del host.  
**Actions:** `integration.yml` inyecta los secretos con `ALERTS_ENABLED=false` (sin spam en CI). En un despliegue real, deja `ALERTS_ENABLED=true` y las mismas variables. El agente las lee en `parseAlertConfig` (`src/config.ts`).

## Formato del webhook

```json
{
  "severity": "critical",
  "category": "threat",
  "message": "Amenaza phishing_link detectada en UID 42",
  "timestamp": "2026-07-04T07:30:00.000Z",
  "source": "agent/organizer",
  "context": {
    "uid": 42,
    "category": "fraud",
    "threat": "phishing_link",
    "indicators": ["https?://...proton\\.ru"]
  }
}
```

## Privacidad

- No se envían cuerpos de correo completos al webhook/ntfy, solo metadatos y UIDs.
- El análisis ocurre localmente sobre el texto ya descifrado por Bridge.
- El agente no envía correos a servicios de clasificación externos.

## Integración con clientes MCP

La tool `proton_agent_plan` devuelve el plan de organización y alertas sin aplicar
cambios. Un cliente MCP puede mostrarla al usuario antes de `agent:organize`.
