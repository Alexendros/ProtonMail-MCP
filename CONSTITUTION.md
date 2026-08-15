# CONSTITUTION.md

Abrir cuando: Alcance, secretos, transporte, dry-run, Calendar/Drive o conflicto entre documentos.
Aprobado: 15 de agosto de 2026
Audiencia: Agente, Dirección, Contribuidores
Autoridad: Suprema
Clase: Obligatorio
Días para revisión: 90
En repo: Sí
Estado: Aprobado
Orden: 2
Propósito: Norma de rango superior: lo no negociable del Proton Suite Agent.
Reforma: ADR + decisor
Responsable: Alexendros
Revisión: 13 de noviembre de 2026
Rol: Norma
Ruta: ./CONSTITUTION.md

<aside>
📌

**Propósito**

Este archivo fija lo no negociable. El resto de documentos lo aplican; no lo sustituyen. Si hay conflicto, prevalece esta constitución.

</aside>

---

# 1. Rango y reforma

- Este documento DEBE prevalecer si choca con README, ROADMAP, AGENTS, ARCHITECTURE, SECURITY, CONTRIBUTING o cualquier guía en `docs/`.
- [AGENTS.md](./AGENTS.md) DEBE actuar como contrato operativo derivado. NO DEBE relajar lo aquí prescrito.
- Reformar esta constitución REQUIERE decisión explícita del decisor y un ADR en [docs/adr/](./docs/adr/) que sustituya la norma afectada.
- Una norma de esta constitución NO DEBE modificarse de pasada en un PR de implementación.

---

# 2. Documentos

- Los documentos canónicos DEBEN residir en la raíz (`README`, `CONSTITUTION`, `ROADMAP`, `AGENTS`, `ARCHITECTURE`, `SECURITY`, `CONTRIBUTING`). El material de apoyo PUEDE vivir en `docs/` y `playbooks/`.
- [README.md](./README.md) DEBE ser el primer documento de lectura (pulso y enrutado). NO DEBE relajar ni sustituir esta constitución.
- Las decisiones estructurales DEBEN registrarse como ADRs MADR en [docs/adr/](./docs/adr/) (ADR-0001).
- Los documentos DEBEN usar Markdown, enlaces relativos y lenguaje prescriptivo: DEBE, NO DEBE, PUEDE, REQUIERE.
- Los documentos NO DEBEN contener secretos, tokens reales, contraseñas Bridge ni cuerpos de correo.

---

# 3. Transporte y logs

- En modo `stdio`, `stdout` DEBE quedar reservado al JSON-RPC MCP. Los logs DEBEN ir solo a `stderr`.
- NO DEBE usarse `console.log` hacia stdout en el servidor MCP.
- El transporte HTTP DEBE exigir bearer timing-safe y, en producción, `MCP_ALLOWED_ORIGINS` no vacío (fail-closed). Ver ADR-002.

---

# 4. Dry-run y mutaciones

- El agente autónomo DEBE arrancar en dry-run (`AGENT_DRY_RUN=true` por defecto). Ver ADR-004.
- NO DEBE cambiarse el default de dry-run sin revisión explícita y ADR.
- Las acciones destructivas (borrado permanente, regeneración masiva de secretos, etc.) REQUIEREN confirmación humana o `AGENT_DRY_RUN=false` consciente.

---

# 5. Secretos y Pass

- Los secretos NO DEBEN loguearse ni devolverse en respuestas MCP.
- `PassClient` / tools Pass DEBEN confirmar existencia (`{ found: true }`) sin exponer valores.
- La resolución JIT del Bridge password vía Pass o wrapper stdio DEBE preferirse frente a secretos en disco.
- Los backends Pass (`pass`, `gopass`) DEBEN invocarse con `execFile` sin shell y con validación de paths.

---

# 6. Frontera criptográfica

- Proton Mail Bridge DEBE permanecer como frontera E2E. El agente opera sobre plaintext aguas abajo por diseño.
- NO DEBE intentarse “mejorar” la E2E contactando APIs Proton no autorizadas para Mail.
- Drive DEBE hablar el CLI `proton-drive` (ADR-006). NO DEBE almacenarse el token Drive en este servidor.
- Calendar DEBE permanecer stub hasta que Bridge exponga CalDAV (ADR-005). NO DEBE implementarse CalDAV contra Proton antes de ese hito.

---

# 7. Licencia y afiliación

- El proyecto DEBE distribuirse bajo AGPL-3.0.
- Las dependencias nuevas DEBEN ser compatibles con AGPL-3.0 (`pnpm license-check` / `license-check:prod`).
- NO DEBE afirmarse afiliación con Proton AG.

---

# 8. Exfiltración y privacidad

- El contenido de correo, contraseñas y archivos NO DEBE enviarse a servicios externos de clasificación por defecto.
- Las alertas (webhook/ntfy) DEBEN limitar el payload a metadatos (UID, categoría, severidad), no cuerpos completos.
