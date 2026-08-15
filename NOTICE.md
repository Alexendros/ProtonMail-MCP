# Avisos legales y atribuciones

## Proton Suite Agent

Copyright (C) 2026 Alejandro Domingo Agustí (Alexendros) <https://alexendros.me>

Proton Suite Agent es software libre: puedes redistribuirlo y/o modificarlo bajo los términos de la **GNU Affero General Public License v3.0 o posterior**, publicada por la Free Software Foundation. Consulta el archivo [`LICENSE`](./LICENSE) para el texto completo.

> **Nota de licencia:** Proton Suite Agent se distribuye con la esperanza de que sea útil, pero **SIN NINGUNA GARANTÍA**; sin siquiera la garantía implícita de comerciabilidad o idoneidad para un propósito particular. Para más detalles, véase la licencia AGPL-3.0.

## Autoría y marca personal

- Autor, mantenedor y responsable del proyecto: **Alejandro Domingo Agustí**, operando bajo el alias técnico **Alexendros**.
- Sin afiliación a Proton AG. "Proton Mail" y "Proton Mail Bridge" son marcas comerciales de Proton AG. Este proyecto es un cliente independiente que se comunica con Proton Mail a través de la interfaz IMAP/SMTP expuesta por Proton Mail Bridge.

## Dependencias y compatibilidad de licencias

El árbol de dependencias directas se revisa periódicamente para garantizar la compatibilidad con la licencia AGPL-3.0:

### Allowlist de licencias permitidas

- Permisivas de uso general: `MIT`, `ISC`, `BSD-2-Clause`, `BSD-3-Clause`, `Apache-2.0`, `MIT-0`.
- Copyleft compatible con AGPL: `AGPL-3.0`, `GPL-3.0`, `LGPL-3.0`.
- Copyleft débil: `MPL-2.0` — aceptable como dependencia sin modificación cuando no se combina en un trabajo derivado mayor.
- Licencias de datos/tooling: `CC-BY-3.0`, `CC0-1.0` — aceptables en dependencias de desarrollo que no se distribuyen en el tarball de producción.
- Licencias duales: se acepta `(MIT OR EUPL-1.1+)` únicamente consumiendo el paquete bajo los términos MIT. No se activan obligaciones copyleft de EUPL.

### Dependencias con licencias especiales

- `@zone-eu/mailsplit@5.x` — licencia dual `MIT OR EUPL-1.1+`. Este proyecto la consume bajo los términos MIT.
- `lightningcss@1.x` y sus crates binarios de plataforma — `MPL-2.0`. Son dependencias de desarrollo (`vitest`) y no se incluyen en el tarball de producción.

### Verificación

- `pnpm run license-check` — verifica el árbol directo completo contra la allowlist.
- `pnpm run license-check:prod` — verifica solo dependencias de producción.

## Cambio de licencia respecto a versiones anteriores

Versiones anteriores de este proyecto (bajo el nombre `protonmail-mcp` / `@alexendros/protonmail-mcp`) se publicaron bajo la licencia MIT. A partir de la versión `0.5.0` y del cambio de nombre a `ProtonMail Agent` / `@alexendros/protonmail-agent`, el código se distribuye bajo **AGPL-3.0**. El cambio de licencia ha sido realizado por el titular del copyright sin contribuciones externas significativas que lo impidan.
