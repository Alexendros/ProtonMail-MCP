# Proton Suite Agent

[![CI](https://github.com/Iniciativas-Alexendros/agent-protonsuite/actions/workflows/ci.yml/badge.svg)](https://github.com/Iniciativas-Alexendros/agent-protonsuite/actions/workflows/ci.yml)
[![CodeQL](https://github.com/Iniciativas-Alexendros/agent-protonsuite/actions/workflows/codeql.yml/badge.svg)](https://github.com/Iniciativas-Alexendros/agent-protonsuite/actions/workflows/codeql.yml)
[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-blue.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%E2%89%A522-brightgreen.svg)](./package.json)
[![npm](https://img.shields.io/npm/v/@alexendros/protonsuite-agent)](https://www.npmjs.com/package/@alexendros/protonsuite-agent)

**MCP server** multi-producto para **Proton Suite**: Mail (Bridge IMAP/SMTP), Pass (pass-cli), Drive (CLI oficial) y Calendar (CalDAV stub). Un agente puede operar el buzón, gestionar contraseñas, sincronizar archivos y clasificar correo — todo sin salir de tu máquina.

| Modo                | Descripción                                                 |
| ------------------- | ----------------------------------------------------------- |
| **stdio** (default) | Sin exponer nada a la red. Ideal para agentes IA locales.   |
| **streamable HTTP** | Bearer auth + origin allowlist. Para despliegue con Docker. |

---

## Quickstart

**Prerrequisitos:** Node ≥ 22, Proton Mail Bridge corriendo en local, `pass` + `gpg` para contraseñas.

### 1. Instalar y compilar

```bash
git clone https://github.com/Iniciativas-Alexendros/agent-protonsuite.git
cd agent-protonsuite
npm install && npm run build && npm run smoke
```

### 2. Configurar variables de entorno

```bash
export PROTON_BRIDGE_USER=you@proton.me
export PROTON_BRIDGE_PASS=your-bridge-password
export PROTON_MAIL_FROM=you@proton.me
```

### 3. Conectar tu cliente MCP

```jsonc
{
  "mcpServers": {
    "protonsuite": {
      "command": "npx",
      "args": ["-y", "@alexendros/protonsuite-agent", "protonsuite-mcp"],
      "env": {
        "MCP_TRANSPORT": "stdio",
        "PROTON_BRIDGE_USER": "you@proton.me",
        "PROTON_BRIDGE_PASS": "your-bridge-password",
        "PROTON_MAIL_FROM": "you@proton.me",
        "PROTON_BRIDGE_TLS_INSECURE": "true",
        "PROTON_PASS_ENABLED": "true",
      },
    },
  },
}
```

> **Seguridad:** usa `PROTON_PASS_BRIDGE_PATH=proton/bridge/password` o el wrapper JIT en [`connectors/stdio-wrapper.sh.example`](./connectors/stdio-wrapper.sh.example) para no dejar el bridge password en disco.

### 4. Organizar el buzón (dry-run)

```bash
AGENT_DRY_RUN=true npx -y @alexendros/protonsuite-agent organize
```

El agente analiza el inbox y presenta un plan de carpetas, etiquetas y alertas **sin aplicar cambios**. Desactiva `AGENT_DRY_RUN` para ejecutar.

---

## Tools MCP

25 tools organizadas por producto. Todas aceptan `response_format: "markdown" | "json"`.

| Producto     | Tools | Resumen                                                                   |
| ------------ | ----- | ------------------------------------------------------------------------- |
| **Mail**     | 14    | List, search, read, send, reply, forward, flag, move, delete, attachments |
| **Pass**     | 4     | List, get (sin exponer valores), generate, health                         |
| **Drive**    | 8     | Status, list, download, upload, share, audit, organize, format report     |
| **Calendar** | stub  | Registradas pero `{available: false}` hasta CalDAV vía Bridge             |
| **Suite**    | 1     | Estado unificado de todos los productos                                   |

> Ver tabla completa en [`docs/agent-quickstart.md`](./docs/agent-quickstart.md#tools-mcp).

---

## Agente

| Goal                      | Pipeline                                                      |
| ------------------------- | ------------------------------------------------------------- |
| `setup`                   | Verifica Bridge (IMAP + SMTP), envía email de prueba          |
| `organize`                | Clasifica inbox, propone carpetas/etiquetas, detecta amenazas |
| `monitor`                 | Solo lectura — presenta alertas sin modificar                 |
| `alert`                   | Inspecciona amenazas de seguridad                             |
| `pass-audit`              | Fortaleza de contraseñas, duplicados, rotación                |
| `suite-status`            | Reporte unificado cross-producto                              |
| `discover` / `check-imap` | Verificación rápida de conectividad                           |

### Drive CLI

```bash
# Instalar (opcional)
sudo wget -q 'https://proton.me/download/drive/cli/linux/proton-drive' \
  -O /usr/local/bin/proton-drive && sudo chmod +x /usr/local/bin/proton-drive
proton-drive auth login
```

Requiere `DRIVE_ENABLED=true` (default). Ver [`docs/drive-audit.md`](./docs/drive-audit.md) para configuración completa.

---

## Despliegue

### Docker

```bash
docker compose up -d
```

Ver [`docs/deployment-http-docker.md`](./docs/deployment-http-docker.md) para auth, allowlist y healthcheck.

### Instalador Ubuntu

```bash
bash scripts/install.sh
```

Ver [`scripts/install.sh`](./scripts/install.sh) para la instalación interactiva completa.

---

## Documentación

| Documento                                                            | Para quién           | Qué cubre                                         |
| -------------------------------------------------------------------- | -------------------- | ------------------------------------------------- |
| [`docs/human-quickstart.md`](./docs/human-quickstart.md)             | Usuarios no técnicos | Instalación paso a paso, Bridge, Pass, primer uso |
| [`docs/agent-quickstart.md`](./docs/agent-quickstart.md)             | Agentes IA           | Tools, formatos de respuesta, ejemplos            |
| [`docs/bridge-core.md`](./docs/bridge-core.md)                       | Todos                | Bridge headless, puertos, vault, troubleshooting  |
| [`docs/deployment-http-docker.md`](./docs/deployment-http-docker.md) | DevOps               | Docker, auth, allowlist, healthcheck              |
| [`docs/local-stdio-secrets.md`](./docs/local-stdio-secrets.md)       | Operadores           | Wrapper stdio sin secretos en disco               |
| [`docs/alerting.md`](./docs/alerting.md)                             | Operadores           | Alertas de contenido, webhook, logs               |
| [`docs/knowledge-base.md`](./docs/knowledge-base.md)                 | Todos                | Clasificación profesional y categorías            |
| [`docs/drive-audit.md`](./docs/drive-audit.md)                       | Operadores           | Drive CLI, persistencia token, auditoría          |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md)                               | Desarrolladores      | Capas internas, modelo de amenazas                |
| [`SECURITY.md`](./SECURITY.md)                                       | Auditores            | Controles activos y threat model                  |
| [`CONTRIBUTING.md`](./CONTRIBUTING.md)                               | Contribuidores       | Convenciones, PRs, tests                          |

### Conectores

| Archivo                                                                        | Uso                                              |
| ------------------------------------------------------------------------------ | ------------------------------------------------ |
| [`connectors/stdio-npx.json`](./connectors/stdio-npx.json)                     | Config stdio genérica para cualquier cliente MCP |
| [`connectors/stdio-wrapper.sh.example`](./connectors/stdio-wrapper.sh.example) | Wrapper seguro con resolución JIT de secretos    |
| [`connectors/http-curl.sh.example`](./connectors/http-curl.sh.example)         | Handshake HTTP con curl                          |

### Playbooks

[`playbooks/`](./playbooks/) — workflows predefinidos: onboarding, organize inbox, triage, fraud detection, pass audit, daily briefing, setup checklist.

---

## Calidad

```bash
npm run typecheck   # TypeScript strict
npm test            # Tests (Vitest)
npm run coverage    # Coverage (v8 — 98.02% statements)
npm run build       # Compilación
npm run smoke       # Verificación stdio
npm run knip        # Unused deps/exports
```

### Seguridad

- Bearer timing-safe, origin allowlist, rate-limit 120/min/token.
- Per-session HTTP transport, sesiones idle evicted a los 30 min.
- Sin credenciales ni cuerpos de request en logs.
- Pass nunca expone valores de secreto — solo `{found: true}`.
- Dry-run por defecto en el agente.

---

### Progreso de cobertura

| Fecha | Statements | Branches | Tests | Hitos |
|-------|-----------|----------|-------|-------|
| Ago 2026 | **98.02%** | **95.35%** | — | Post-renovate cleanup, pipeline hardening |
| Jul 2026 (Branch hunt) | **98.07%** | **93.63%** | 864 | diagnostics.ts 84%→96%, addresses.ts 90%→100%, pass.ts 87%→95% |
| Jul 2026 (Ronda 3b) | 93.72% | — | 745 | server/drive.ts 89%→99%, http.ts +10 tests CORS/auth |
| Jul 2026 (Ronda 2) | 92.68% | — | 692 | server.ts 73%→96%, smtp.ts 79%→98% |
| Jul 2026 (post-merge) | 90.65% | 86.46% | 619 | Repo renombrado, PRs fusionados |
| Jun 2026 (base) | 61.7% | — | 258 | Reporte inicial |

*Conteo de tests canónico: `npx vitest run 2>&1 | grep -E 'Test Files|Tests'`.*


## Licencia

[AGPL-3.0](./LICENSE) — Copyright 2026 Alejandro Domingo Agustí (Alexendros). Sin afiliación a Proton AG.

Ver [`NOTICE.md`](./NOTICE.md) para dependencias y compatibilidad de licencias.
