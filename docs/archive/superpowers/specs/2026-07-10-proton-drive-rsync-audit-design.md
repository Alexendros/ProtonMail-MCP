> **Estado: superseded** · Archivado 2026-08-15. No es fuente de verdad. Ver [docs/archive/README.md](../../README.md) y ADRs vigentes.

# Proton Drive — Sincronización con rsync y Auditoría de Contenido

**Fecha:** 2026-07-10  
**Proyecto:** Proton Suite Agent (v0.7.0)  
**Estado:** Aprobado

## 1. Propósito

Integrar Proton Drive en el agente usando `rclone` como backend de sincronización,
permitiendo auditoría de contenido (inventario, formato, duplicados, organización)
desde el MCP server y los agent goals.

## 2. Arquitectura

```
rclone ←→ Proton Drive (API REST, E2E cifrado)
   │  rclone sync / rclone mount
   ▼
DRIVE_STAGING_DIR (directorio local, ej. ~/.protonmail/drive/)
   │
   ▼
DriveClient / DriveAuditor (src/drive.ts, src/drive-audit.ts)
   │
   ▼
MCP Tools (proton_drive_*) + Agent goals (drive-audit, drive-organize, drive-sync)
```

- `rclone` es el único proceso que habla con Proton Drive. Ya tiene backend nativo
  con manejo de cifrado E2E.
- `DriveClient` opera sobre el directorio de staging local — escanea, mueve, renombra, analiza.
- `DriveAuditor` contiene la lógica de escaneo: inventario, formatos, duplicados.
- El MCP server expone tools de solo lectura y write (reorganización con dry-run).
- El agente orquesta goals usando tools MCP y comandos `rclone` directos.

### Flujo típico (modo pull)

1. `rclone sync proton-drive: /staging/` — pull lo más reciente
2. `proton_drive_audit` — inventario completo
3. Agente analiza duplicados, formatos obsoletos, estructura de carpetas
4. Agente mueve/renombra localmente → `rclone sync /staging/ proton-drive:` — push cambios

## 3. Configuración (env)

| Variable                    | Default                | Descripción                                                                             |
| --------------------------- | ---------------------- | --------------------------------------------------------------------------------------- |
| `DRIVE_RCLONE_REMOTE`       | —                      | Nombre del remote en rclone config (ej. `proton-drive:`). Requerido para activar tools. |
| `DRIVE_STAGING_DIR`         | `~/.protonmail/drive/` | Directorio local donde rclone sincroniza.                                               |
| `DRIVE_SYNC_MODE`           | `pull`                 | `pull` (sync explícito) o `watch` (FUSE mount, proceso bg).                             |
| `DRIVE_RCLONE_BIN`          | `rclone`               | Path al binario de rclone.                                                              |
| `DRIVE_OBSOLETE_EXTENSIONS` | `.doc,.ppt,.xls,.bmp`  | Formatos considerados obsoletos para el reporte.                                        |

Resolución en `src/config.ts` con Zod, mismo patrón que `BRIDGE_*` y `PASS_*`.

## 4. Tools MCP

Todas se registran condicionalmente cuando `DRIVE_RCLONE_REMOTE` está configurado.

| Tool                         | Tipo  | Descripción                                                                             |
| ---------------------------- | ----- | --------------------------------------------------------------------------------------- |
| `proton_drive_audit`         | read  | Escanea staging: total archivos, por tipo/tamaño/fecha, duplicados, formatos obsoletos. |
| `proton_drive_status`        | read  | Estado de sincronización: última sync, modo, salud del remote, espacio en staging.      |
| `proton_drive_organize`      | write | Mueve/renombra archivos según plan. Dry-run por defecto.                                |
| `proton_drive_format_report` | read  | Reporte detallado de formatos: extensiones, mime types, sin extensión, obsoletos.       |
| `proton_drive_sync`          | write | Trigger manual de `rclone sync` (solo en modo `pull`). Idempotente.                     |

### outputSchema

Todas aceptan `response_format: "markdown" | "json"`.

## 5. Agent Goals

| Goal             | Descripción                                                                                         | Dry-run     |
| ---------------- | --------------------------------------------------------------------------------------------------- | ----------- |
| `drive-audit`    | Escanea staging, genera inventario + reporte de formato + duplicados + espacio. Sólo lectura.       | Siempre     |
| `drive-organize` | Como audit + propone y aplica reestructuración (mover a carpetas por tipo/año, normalizar nombres). | Por defecto |
| `drive-sync`     | Sincroniza bidireccional: pull → (opcional) push si hay cambios locales aprobados.                  | No          |

Los goals se integran en `agent/goals.ts` (nuevo goal type `drive`) y
`agent/executor.ts` para enrutamiento.

## 6. Implementación

### Fase 1: DriveSyncClient (src/drive.ts, ~200 loc)

Reemplazar el stub actual por un wrapper real sobre rclone:

- `execRclone(args: string[])` — ejecuta rclone con logging y timeout
- `syncPull()` / `syncPush()` — sync bidireccional
- `mount()` / `unmount()` — para modo watch
- `status()` — salud del remote y última sync
- `checkDeps()` — verifica rclone instalado y remote configurado (usado en setup goal)

### Fase 2: DriveAuditor (src/drive-audit.ts, ~250 loc)

- `scanInventory(stagingDir)` — walk del árbol, agrupa por tipo/tamaño/fecha
- `findDuplicates(stagingDir)` — detecta duplicados por hash (xxHash) + nombre
- `formatReport(stagingDir)` — clasifica extensiones, detecta obsoletas
- `buildOrganizePlan(stagingDir)` — sugiere estructura de carpetas según tipo/año

### Fase 3: Tools + Agent (src/server.ts, src/agent/*.ts, ~200 loc)

- Tools MCP con handlers que llaman a DriveAuditor
- Goal `drive-audit` llama a `proton_drive_audit + proton_drive_format_report`
- Goal `drive-organize` llama a audit + organize con confirmación
- Tests en `tests/drive.test.ts` con directorio staging temporal

## 7. Tests

- `tests/drive.test.ts` — DriveSyncClient con rclone mockeado, DriveAuditor con staging dir temporal
- `tests/agent.test.ts` — goals `drive-audit` y `drive-organize`
- Tests unitarios de detección de duplicados y formato obsoleto

## 8. Seguridad

- Las credenciales de Proton Drive viven en `rclone config` (su propio encrypted config), no en el agente.
- `rclone sync` se ejecuta con `--ignore-existing` en push si hay dudas de consistencia.
- Las operaciones write (`organize`) requieren confirmación explícita en modo dry-run.
- No se exponen rutas absolutas del servidor en respuestas MCP.
