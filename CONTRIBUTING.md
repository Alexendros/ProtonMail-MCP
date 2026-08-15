# Contribuir a `@alexendros/protonsuite-agent`

Gracias por considerar contribuir. Este proyecto es un agente MCP multi-producto para Proton Suite (Mail, Pass, Calendar, Drive) con capa de agente autónomo para organización, alertas y configuración guiada.

> 🔒 **Seguridad:** NO abras una issue o PR pública para vulnerabilidades. Escribe a **security@alexendros.me** o usa [GitHub Security Advisories](https://github.com/Iniciativas-Alexendros/agent-protonsuite/security/advisories/new). Ver [SECURITY.md](./SECURITY.md) para el threat model completo.

## Formas de contribuir

- **🐛 Reportar un bug** — usa la [plantilla de bug](./.github/ISSUE_TEMPLATE/bug-report.yml). Incluye versión, transporte, Node, SO y pasos de reproducción.
- **💡 Proponer una feature** — usa la [plantilla de feature](./.github/ISSUE_TEMPLATE/feature-request.yml). Sé concreto: nombre de tool, inputs, outputs, o capacidad de agente.
- **💬 Preguntar** — usa [Issues](https://github.com/Iniciativas-Alexendros/agent-protonsuite/issues/new?template=question.yml), no el issue tracker.
- **🧑‍💻 Enviar un patch** — lee el workflow de PR abajo.

## Workflow de pull request

1. **Abre o enlaza una issue primero.** PRs sin issue asociada pueden cerrarse.
2. **Fork + rama.** Nombres: `feat/<slug>`, `fix/<slug>`, `docs/<slug>`, `chore/<slug>`, `agent/<slug>`.
3. **Desarrolla.** Sigue la checklist de la [plantilla de PR](./.github/PULL_REQUEST_TEMPLATE.md).
4. **Abre el PR** contra `main` y rellena la plantilla.
5. **Itera.** Revisión normalmente en una semana. Rebase sobre `main` en lugar de merge.
6. **Merge.** Squash-merge por defecto una vez CI verde y revisión aprobada.
   Preferir **commits atómicos** en la rama (una unidad lógica por commit) para
   facilitar `git blame`/`bisect`; el squash del PR sigue siendo el mensaje
   conventional que analiza semantic-release.

## Desarrollo local

Requiere Node ≥ 22. Para Mail, Proton Mail Bridge corriendo en local (o en Docker). Pass usa `pass` CLI. Calendar y Drive son stubs.

```bash
# 1. Clone + install
git clone https://github.com/Iniciativas-Alexendros/agent-protonsuite.git
cd agent-protonsuite
npm install

# 2. Configura entorno
cp .env.example .env
# Rellena PROTON_BRIDGE_USER y PROTON_BRIDGE_PASS como mínimo para Mail.
# Para Pass: PROTON_PASS_ENABLED=true, PROTON_PASS_STORE_DIR=~/.password-store

# 3. Build + verifica
npm run build         # tsc → dist/
npm run lint           # eslint
npm run typecheck      # tsc --noEmit
npm test               # vitest run
npm run smoke          # smoke stdio

# 4. Ejecuta agente o MCP localmente
node dist/agent-cli.js setup              # verifica conexión a Bridge
node dist/agent-cli.js pass-audit         # audita vault de Pass
node dist/index.js                        # MCP server en stdio
# o
PORT=3000 node dist/index.js              # MCP server HTTP en :3000
```

Para depurar HTTP, el [MCP inspector](https://github.com/modelcontextprotocol/inspector) es útil:

```bash
npm run inspect
```

## Convenciones de código

- **Lenguaje:** TypeScript strict (`"strict": true`). Sin `any` nuevo sin comentario justificando.
- **Módulos:** ES Modules (`"type": "module"`). Usa named exports.
- **Manejo de errores:** valida en los boundaries con Zod (`src/config.ts` es la referencia).
- **Logging:** stderr only. El transporte stdio reserva stdout para el protocolo.
- **Tests:** Vitest. Añade tests en `tests/`. Deterministas: sin red real ni Bridge real en unit tests.
- **Commits:** [Conventional Commits](https://www.conventionalcommits.org/) forzados por commitlint. Scopes: `imap`, `smtp`, `http`, `agent`, `alerts`, `pass`, `config`, `deps`, `release`, `ci`, `docs`, `tests`.
- **Lint:** `npm run lint` (ESLint flat config con reglas strict). 0 errores requeridos. Warnings informativos.
- **API pública:** todo lo exportado desde `src/index.ts`, `src/agent/index.ts` o registrado en `tools/list` es público. Cambios breaking requieren `BREAKING CHANGE:` en el commit.
- **Licencias:** `npm run license-check` y `npm run license-check:prod` deben pasar. Nuevas dependencias deben ser compatibles con AGPL-3.0.

## Política de triaje de issues

Al abrir una issue se añade la etiqueta `triage`. El mantenedor:

- **En 7 días:** reconocer, pedir aclaración o etiquetar severidad.
- **Bugs críticos** (data loss, auth bypass, secret leak): parche ASAP y hotfix release.
- **Bugs:** planificados para la siguiente minor release.
- **Features:** evaluadas contra el alcance.

## Código de conducta

La participación se rige por el [Contributor Covenant](./CODE_OF_CONDUCT.md). Violaciones: reportar a **conduct@alexendros.me**.

## Licencia

Al enviar un PR aceptas que tu contribución se licencia bajo la [AGPL-3.0](./LICENSE) de este repositorio.

