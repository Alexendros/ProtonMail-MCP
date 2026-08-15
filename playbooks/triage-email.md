---
name: triage-email
description: Revisa y tria el INBOX de Proton Mail vía Proton Suite Agent. Clasifica correos, resume los relevantes y aparta la basura comercial. SIEMPRE dry-run antes de mover. No usa proton_delete_email.
---

# Triaje de correo

## Objetivo

Revisar el INBOX, resumir lo relevante y apartar la basura comercial moviéndola a la carpeta de promociones. La operación es reversible; nunca se borra.

## Precondiciones

1. `proton_list_folders` confirma que existe la carpeta destino de promociones.
2. Bridge está vivo (`proton_bridge_host` alcanzable).
3. Las tools `proton_*` están disponibles en la sesión.

## Configuración

Lee estas variables del entorno si existen; si no, usa los defaults:

| Variable | Default | Uso |
|---|---|---|
| `TRIAGE_PROMO_FOLDER` | `Folders/Marketing-Promo` | Destino de correos comerciales. Si no existe, créala con `proton_create_folder`. |
| `TRIAGE_PROTECTED_FOLDERS` | `Folders/Admin-Estado,Folders/Banca-Pagos,Folders/Abogados,Folders/Salud` | Carpetas cuyo contenido se considera relevante por naturaleza. |
| `TRIAGE_PROMO_SUBJECTS` | `dto,oferta,rebajas,Black Friday,última oportunidad,cupón,descuento exclusivo` | Palabras clave que activan clasificación comercial. |
| `TRIAGE_DRY_RUN_DEFAULT` | `true` | Si el modo por defecto es dry-run. |

## Regla de oro — UIDs

Usa UIDs (no sequence numbers) al mover/marcar. No reordenes ni cachees UIDs entre pasadas.

## Flujo

### Modo DRY-RUN (predeterminado, SIEMPRE primero)

1. `proton_list_folders` → confirmar/crear `TRIAGE_PROMO_FOLDER`.
2. `proton_list_emails` sobre `INBOX` (paginar). Recoger: UID, remitente, asunto, fecha, flags, header `List-Unsubscribe`.
3. Clasificar cada correo con los criterios de abajo.
4. Emitir tabla markdown:
   - **RELEVANTES** (se quedan): remitente · asunto · resumen · acción sugerida.
   - **COMERCIAL → mover** (candidatos): remitente · asunto · motivo.
   - **DUDOSOS** (no tocar): quedan en INBOX.
5. Resumen: `relevantes N · comercial M · dudosos K · total = INBOX`.
6. **Parar.** Pedir OK explícito antes del modo APPLY.

### Modo APPLY (solo tras OK explícito)

1. Re-listar INBOX (UIDs pueden haber cambiado).
2. Re-clasificar.
3. Para cada candidato COMERCIAL confirmado: `proton_move_email` con UID → `TRIAGE_PROMO_FOLDER`.
4. **Nunca** `proton_delete_email`. Mover es reversible.
5. Verificación post:
   - `proton_mailbox_status INBOX` y `proton_mailbox_status TRIAGE_PROMO_FOLDER`.
   - Cuadrar: `movidos + restantes_INBOX == total_inicial`.
   - Si no cuadra, parar y reportar.
6. Emitir resumen de relevantes.

## Criterios de clasificación

**COMERCIAL (mover) — requiere ≥1 señal fuerte O ≥2 débiles:**

- Señal fuerte: header `List-Unsubscribe` presente + remitente `no-reply@` / `newsletter@` / `marketing@` / `info@` de dominio de marca.
- Señal fuerte: asunto con patrón promo claro (`% dto`, `oferta`, `rebajas`, `Black Friday`, `última oportunidad`, `cupón`, `descuento exclusivo`).
- Débiles: remitente de plataforma de email marketing (mailchimp, sendgrid, sendinblue, hubspot, mailgun en `Return-Path`); frecuencia alta del mismo remitente; sin destinatario personal (va a lista).

**RELEVANTE (NO mover — ante la duda, se queda):**

- **Transaccional:** facturas, recibos, confirmaciones de pedido/pago, OTP, alertas de seguridad, restablecer contraseña, avisos de banca. NUNCA mover aunque traiga `List-Unsubscribe`.
- **Personal/humano:** remitente persona (no `no-reply`), hilo con respuestas, te menciona por nombre.
- **Cuenta/servicio activo:** renovaciones, vencimientos, cambios de servicio que usas (no su newsletter).
- **Administración/legal/salud:** cualquier cosa de `TRIAGE_PROTECTED_FOLDERS` por naturaleza → relevante.

**DUDOSO (no tocar):** si no hay confianza alta de que es comercial → se queda en INBOX. Cero falsos positivos sobre transaccional/personal es la prioridad.

## Validadores

- **estabilidad:** flujo completo sin excepción de tool; carpeta destino existe.
- **calidad:** en dry-run, el operador valida una muestra de ~20 → ≥90% acierto, 0 falsos positivos sobre transaccional/personal.
- **seguridad:** ningún `proton_delete_email`; solo `proton_move_email`; conteo pre/post cuadra; operación reversible.

## Tools MCP usadas

`proton_list_folders` · `proton_mailbox_status` · `proton_list_emails` · `proton_search_emails` · `proton_get_email` (para inspeccionar dudosos) · `proton_move_email` (solo APPLY). **Prohibida** `proton_delete_email` en este flujo.
