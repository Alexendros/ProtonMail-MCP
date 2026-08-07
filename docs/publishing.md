# Publicación a npm

Este documento describe cómo publicar el paquete `@alexendros/protonsuite-agent`
en npm desde GitHub Actions usando **OIDC Trusted Publishing** (sin `NPM_TOKEN`).

## Cómo funciona

1. Cada push a `main` dispara `release.yml` → `semantic-release` analiza commits.
2. Si hay un `feat:`, `fix:` o `BREAKING CHANGE:`, se crea una nueva versión.
3. `semantic-release` actualiza `CHANGELOG.md`, crea un tag y un GitHub Release.
4. El job `publish-npm` se ejecuta tras el release exitoso y publica a npm vía OIDC.

## Configuración requerida (una sola vez)

### 1. npmjs.com — Trusted Publishing

1. Inicia sesión en [npmjs.com](https://npmjs.com)
2. Ve al paquete: <https://npmjs.com/package/@alexendros/protonsuite-agent/settings/publish>
3. Settings → Publishing
4. Activa **"GitHub OIDC Trusted Publishing"**
5. Añade un publisher:
   - **Repository**: `Iniciativas-Alexendros/agent-protonsuite`
   - **Workflow**: `release.yml`
   - **Environment**: (opcional) `npm`

### 2. GitHub repo — Environment (opcional pero recomendado)

1. Settings → Environments → New environment
2. Nombre: `npm`
3. Protection rules: añadir reviewers si se desea aprobación manual

## Cómo publicar una nueva versión

```bash
# Crea un commit conventional
git commit -m "feat: nueva funcionalidad"
# o
git commit -m "fix: corrección de bug"

# Push a main
git push origin main
```

`release.yml` hará automáticamente:

- Análisis de commits → determina versión (MAJOR/MINOR/PATCH)
- Actualiza `CHANGELOG.md`
- Crea tag `vX.Y.Z`
- Crea GitHub Release con notas
- Publica a npm con provenance
- Publica imagen Docker a GHCR

## Verificar publicación

```bash
# Ver última versión en npm
npm view @alexendros/protonsuite-agent version

# Ver metadatos del paquete
npm view @alexendros/protonsuite-agent
```

## Troubleshooting

| Problema | Solución |
|----------|----------|
| `ENEEDPUBLISH` | El paquete no tiene permisos de publicación. Verificar OIDC config en npmjs.com. |
| `E403 Forbidden` | El trusted publisher no coincide con repo/workflow. Verificar configuración. |
| `npm publish` no se ejecuta | Verificar que el commit tenga prefijo `feat:` o `fix:`. |
| Version no aparece en npm | Verificar que `semantic-release` detectó el commit y creó el release. |

## Seguridad

- **No se usa `NPM_TOKEN`**: La autenticación es vía OIDC (tokens efímeros de GitHub).
- **Provenance habilitada**: `--provenance` genera attestations de build verificables.
- **Cache poisoning deshabilitado**: `package-manager-cache: false` previene ataques de supply chain.
