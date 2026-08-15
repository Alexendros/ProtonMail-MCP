# ADR-006: Plan B para Proton Drive ante desaparición del CLI

## Estado

Aceptado · 2026-08-15

## Contexto

Proton Suite Agent opera Drive exclusivamente a través del binario `proton-drive`
(CLI no oficial mantenido por la comunidad). No existe API pública documentada
para terceros; la autenticación E2E depende del ecosistema Proton.

Si el CLI deja de mantenerse o rompe compatibilidad, las 14 tools de Drive
quedarían inoperativas sin un plan de contingencia.

## Decisión

Mantener `proton-drive` como backend primario. Documentar dos rutas de fallback
evaluables en orden:

1. **rclone backend `protondrive`** — cuando el remote esté estable, adaptar
   `DriveClient` detrás de un puerto `IDriveClient` con la misma superficie
   `{ ok, error }`. Auth vía `rclone config` interactivo (paridad con el stub
   actual de `proton_drive_auth_login`).

2. **API web Proton Drive** — solo si Proton publica endpoints estables para
   cuentas de usuario; requeriría OAuth/device flow propio y revisión de
   licencia AGPL (el agente no puede almacenar tokens Drive en servidor
   compartido).

Hasta que un fallback se implemente, `proton_drive_status` debe reportar la
versión del CLI detectada y un warning si el binario no responde.

## Consecuencias

- Nuevo trabajo de migración acotado al adapter `src/drive.ts`; tools MCP sin
  cambio de contrato.
- Tests de contrato y E2E siguen mockeando el adapter; un spike rclone vive
  bajo `tests/` con feature flag `DRIVE_BACKEND=rclone`.
- No se implementa CalDAV ni sync E2E custom — fuera de alcance (ver ADR-005).

## Referencias

- [ADR-003](./0003-ports-and-adapters-extraction.md) — ports/adapters
- [Proton Drive CLI](https://proton.me/support/drive-cli)
- [rclone protondrive](https://rclone.org/protondrive/)
