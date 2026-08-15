# Procedimiento de release de Proton Suite Agent

Las releases se gestionan automáticamente con [semantic-release](https://github.com/semantic-release/semantic-release) a partir de los [Conventional Commits](https://www.conventionalcommits.org/).

## Cómo funciona

1. Cada commit en `main` sigue el formato conventional commit (`feat:`, `fix:`, `BREAKING CHANGE:`).
2. commitlint + Husky bloquean commits no conformes en local.
3. Al hacer push a `main`, el workflow `release.yml` ejecuta `semantic-release`:
   - Analiza los commits desde el último release.
   - Determina la próxima versión (MAJOR, MINOR o PATCH).
   - Genera/actualiza `CHANGELOG.md`.
   - Publica el paquete en npm vía `@semantic-release/npm` (OIDC trusted publishing, sin job separado).
   - Crea un release en GitHub con las notas generadas.
   - Crea un tag `vX.Y.Z` y hace push del bump de versión a `main`.

## Publicación

- **npm:** Trusted publishing (OIDC), sin `NPM_TOKEN`. Configurado en npmjs.com.
- **GHCR:** Imagen Docker multi-tag (`:latest`, `:vX.Y.Z`, `:vX.Y`, `:sha-XXXXX`).
- **Provenance y SBOM:** Generados en cada release para la cadena de suministro.

## Hotfix

Si se necesita un hotfix, crear una rama `hotfix/<slug>` desde `main`, hacer el fix, y mergear de vuelta a `main`. Semantic-release detectará el `fix:` y hará un PATCH bump.
