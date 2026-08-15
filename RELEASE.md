# Procedimiento de release de Proton Suite Agent

Las releases se gestionan automáticamente con [semantic-release](https://github.com/semantic-release/semantic-release) a partir de los [Conventional Commits](https://www.conventionalcommits.org/).

## Cómo funciona

1. Cada commit en `main` sigue el formato conventional commit (`feat:`, `fix:`, `BREAKING CHANGE:`).
2. commitlint + Husky bloquean commits no conformes en local; el workflow `pr-title.yml` valida el título del PR (squash-merge → mensaje que analiza semantic-release).
3. Al hacer push a `main`, el workflow `release.yml` ejecuta `semantic-release`:
   - Analiza los commits desde el último release.
   - Determina la próxima versión (MAJOR, MINOR o PATCH).
   - Genera/actualiza `CHANGELOG.md`.
   - Publica el paquete en npm vía `@semantic-release/npm` (OIDC trusted publishing, sin job separado).
   - Crea un release en GitHub con las notas generadas.
   - Crea un tag `vX.Y.Z` y hace push del bump de versión a `main` (`@semantic-release/git`, mensaje `[skip ci]`).
4. Si hubo release nueva, `publish-ghcr` construye desde el tag `vX.Y.Z` y publica `:latest`, `:X.Y.Z`, `:X.Y` y `:sha-…`.
5. Dry-run: `gh workflow run release.yml -f dry-run=true` (no publica npm/GHCR).

## Publicación

- **npm:** Trusted publishing (OIDC) desde el job `release`, sin `NPM_TOKEN`. Configurado en npmjs.com.
- **GHCR:** Imagen Docker multi-tag (`:latest`, `:vX.Y.Z`, `:vX.Y`, `:sha-XXXXX`) solo cuando semantic-release publica una versión.
- **Provenance:** Generado con OIDC en la publicación npm; Docker build usa `provenance: true`.
- **PR metadata:** `release-preview.yml` comenta el bump previsto; `@semantic-release/github` aplica el label `released` a PRs incluidos en la release.

## Hotfix

Si se necesita un hotfix, crear una rama `hotfix/<slug>` desde `main`, hacer el fix, y mergear de vuelta a `main`. Semantic-release detectará el `fix:` y hará un PATCH bump.
