# Contribuir a `@alexendros/protonsuite-agent`

Abrir cuando: Quieres abrir un PR o montar el entorno de desarrollo.
Aprobado: 15 de agosto de 2026
Audiencia: Contribuidores
Autoridad: Operativa
Clase: Obligatorio
Días para revisión: 60
En repo: Sí
Estado: Aprobado
Orden: 10
Propósito: Workflow de contribución, pnpm y convenciones.
Reforma: Operativa
Responsable: Alexendros
Revisión: 14 de octubre de 2026
Rol: Contribución
Ruta: ./CONTRIBUTING.md

Gracias por considerar contribuir. MCP multi-producto para Proton Suite (Mail,
Pass, Drive, Calendar stub) con agente autónomo.

> Seguridad: NO abras issue/PR pública para vulnerabilidades. Escribe a
> **security@alexendros.me** o usa [GitHub Security Advisories](https://github.com/Iniciativas-Alexendros/agent-protonsuite/security/advisories/new).
> Ver [SECURITY.md](./SECURITY.md) y [CONSTITUTION.md](./CONSTITUTION.md).

## Formas de contribuir

- **Bug** — plantilla [bug-report](./.github/ISSUE_TEMPLATE/bug-report.yml).
- **Feature** — plantilla [feature-request](./.github/ISSUE_TEMPLATE/feature-request.yml).
- **Patch** — lee el workflow de PR y la fase activa en [ROADMAP.md](./ROADMAP.md).

## Workflow de pull request

1. Abre o enlaza una issue.
2. Fork + rama: `feat/<slug>`, `fix/<slug>`, `docs/<slug>`, `chore/<slug>`, `agent/<slug>`.
3. Desarrolla con la ficha de [AGENTS.md](./AGENTS.md).
4. PR contra `main`; rebase (no merge commits); squash-merge.
5. CI verde + revisión.

## Desarrollo local

Node ≥ 22 y **pnpm**. Mail: Bridge local o Docker. Pass: `pass` o `gopass` +
`gpg`. Drive: CLI `proton-drive` (no stub). Calendar: stub (ADR-005).

```bash
git clone https://github.com/Iniciativas-Alexendros/agent-protonsuite.git
cd agent-protonsuite
pnpm install

cp .env.example .env
# Mail: PROTON_BRIDGE_USER / PROTON_BRIDGE_PASS
# Pass: PROTON_PASS_ENABLED=true, PROTON_PASS_STORE_DIR=~/.password-store
#       opcional: PROTON_PASS_BACKEND=gopass, GOPASS_STORE_DIR=...

pnpm build
pnpm lint
pnpm typecheck
pnpm test
pnpm run smoke

node dist/agent-cli.js setup
node dist/agent-cli.js pass-audit
node dist/index.js
```

Inspector HTTP:

```bash
pnpm run inspect
```

## Convenciones

- TypeScript strict; ES modules; named exports.
- Logs solo stderr.
- Tests Vitest deterministas (sin Bridge real en unit).
- Conventional Commits + commitlint.
- `pnpm lint` / `pnpm license-check` / `pnpm license-check:prod` deben pasar.
- API pública: exports de entrypoints + tools MCP. Breaking → `BREAKING CHANGE:`.

## Código de conducta

[Contributor Covenant](./CODE_OF_CONDUCT.md). Violaciones: **conduct@alexendros.me**.

## Licencia

Contribuciones bajo [AGPL-3.0](./LICENSE).
