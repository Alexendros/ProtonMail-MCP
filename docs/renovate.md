# Renovate — matriz de decisiones

Configuración: [`.github/renovate.json5`](../.github/renovate.json5).

Reemplaza a Dependabot por completo (update PRs **y** GitHub vulnerability alerts).
Base: presets org `infraestructura-stack` + overrides explícitos por tipo de dependencia.

| Regla | ¿Qué cubre? | update-type | Auto-merge | Label extra | Razonamiento |
|-------|-------------|-------------|-----------|-------------|--------------|
| [1] MCP SDK | `@modelcontextprotocol/sdk` | todo | nunca | `mcp` | Núcleo del protocolo; apretado a `server.json`/`mcpName`/transports (ADR-002). Revisión obligatoria. |
| [2] Prod deps | `dependencies` (npm) | minor/patch | nunca | — | Runtime + supply chain; agrupado para review eficiente. |
| [3] Dev deps | `devDependencies` (npm) | minor/patch | **sí** (CI verde) | `dev-deps` | Toolchain; bajo riesgo; `automergeType:branch` tras CI verde. |
| [4] Majors | todo | major | nunca | `breaking-change` | Siempre revisión manual; se abre fuera de schedule. |
| [5] GitHub Actions | `github-actions` | digest | nunca | — | Supply-chain; SHAs ya pinneados (zizmor). |
| [6] Docker base | `docker` (node) | digest | nunca | — | Pin a digest para inmutabilidad (SLSA). |
| vuln alerts | advisories | fix | nunca | `security` | Inmediato (`before 10am` weekdays), `lowest` fix = cambio mínimo. |
| lockfile maint | pnpm-lock.yaml | — | nunca | — | Weekly; consolida todos los updates. |

**Nota sobre `automerge` [3]:** funciona si `main` tiene *required status checks* (ci.yml + Quality) y deja a Renovate mergear; si no hay branch protection, Renovate espera a que CI esté verde (comportamiento seguro por defecto). El preset org `:default` ya incluye los defaults recomendados; las reglas arriba son **overrides explícitos** para este repo.
