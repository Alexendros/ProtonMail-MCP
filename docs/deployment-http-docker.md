# Despliegue HTTP con Docker (modo avanzado)

> **Modo avanzado.** Para uso local, el modo **stdio** es el primario (ver [`local-stdio-secrets.md`](./local-stdio-secrets.md)). Este documento cubre el despliegue del MCP en **modo HTTP** sobre Docker, tras un reverse proxy, para clientes MCP remotos (routines, dashboards, backends propios).

En modo HTTP el MCP expone `/mcp` (JSON-RPC sobre HTTP) y `/healthz`, protegidos por un **bearer token** y una **allowlist de orígenes**.

## 1. Las dos imágenes

| Imagen | Dockerfile | Rol |
|---|---|---|
| **MCP** | `Dockerfile` | Servidor MCP en modo HTTP (`MCP_TRANSPORT=http`), Node sobre `node:22-alpine`. Escucha en `8787`. |
| **Bridge headless** | `Dockerfile.bridge` | Proton Mail Bridge headless (extiende la imagen community `shenxn/protonmail-bridge`) con el vault persistido en un volumen. Sirve IMAP/SMTP en la red interna. |

`Dockerfile.bridge` añade sobre la imagen base las dependencias que faltan en Bridge recientes (libfido2, dbus-x11, gpg-agent y los _credential helpers_ para el secret-service), de modo que el vault persista correctamente dentro del contenedor.

## 2. `docker-compose`: red interna + reverse proxy

El `docker-compose.yml` define:

- Un servicio **`proton-bridge`** que expone IMAP/SMTP **solo en la red interna** `proton-net`.
- Un servicio **`mcp`** que depende de `proton-bridge` (con `condition: service_healthy`) y habla con él por `proton-net`.
- El MCP se publica al exterior a través de una red externa (`proxy-network`) donde tu reverse proxy (Traefik, Nginx, Caddy, etc.) enruta el dominio público hacia el puerto `8787`.

El healthcheck de Bridge usa `bash` con `/dev/tcp` para comprobar que `1143` está vivo antes de arrancar el MCP.

> El bridge IMAP/SMTP **nunca** se publica al exterior: solo el MCP (autenticado) es accesible públicamente, y solo a través del reverse proxy.

## 3. Variables de entorno (modo HTTP)

```bash
# Transporte
MCP_TRANSPORT=http
MCP_HTTP_HOST=0.0.0.0      # dentro del contenedor; el reverse proxy controla el acceso
MCP_HTTP_PORT=8787

# Bearer token — genera uno fuerte:
MCP_AUTH_TOKEN="$(openssl rand -hex 32)"

# Allowlist de orígenes (CSV). Ejemplo para un cliente web:
MCP_ALLOWED_ORIGINS=https://tu-dashboard.example

# Logging
LOG_LEVEL=info

# Alertas ntfy (Organization secrets / pass alerts/ntfy — ver docs/alerting.md)
# ALERT_NTFY_TOPIC=…
# ALERT_NTFY_URL=https://ntfy.sh
# ALERT_NTFY_TOKEN=   # opcional
# ALERTS_ENABLED=true
# ALERT_MIN_SEVERITY=warning
```

El compose ya reenvía `ALERT_NTFY_*` al contenedor `agent`. En el host de despliegue, exporta el topic desde `pass` o desde los Organization secrets (no los pegues en el repo).

### Allowlist vacía en producción = arranque rechazado

En **`NODE_ENV=production`** el servidor **se niega a arrancar con la allowlist de orígenes vacía**. Define `MCP_ALLOWED_ORIGINS` antes de desplegar en producción.

## 4. Login one-off al Bridge headless dentro del contenedor

```bash
# En el host del despliegue, en el directorio del compose:
docker compose up -d proton-bridge

# Login interactivo one-off:
docker compose run --rm --entrypoint="" proton-bridge \
  /protonmail/proton-bridge --cli
# Dentro de la consola Bridge:
#   login   → cuenta Proton + contraseña + 2FA
#   info    → copiar el campo "Password" (el bridge password generado)
#   exit
```

Pega el bridge password obtenido en **`PROTON_BRIDGE_PASS`**. Recuerda: **cada re-login regenera el bridge password** y hay que reconciliarlo (ver [`bridge-core.md`](./bridge-core.md) §7).

## 5. Verificación

### Health check

```bash
curl https://tu-dominio.example/healthz
```

Respuesta esperada:

```json
{ "ok": true, "version": "0.4.0", "sessions": 0 }
```

### Handshake MCP (`initialize`)

```bash
curl -X POST https://tu-dominio.example/mcp \
  -H "Authorization: Bearer $MCP_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Origin: https://tu-dashboard.example" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2025-06-18",
      "capabilities": {},
      "clientInfo": { "name": "curl-smoke", "version": "0.0.0" }
    }
  }'
```

Una respuesta JSON-RPC con `result.serverInfo` confirma que el bearer y el `Origin` están bien y el MCP responde.

## 5b. Pass en Docker Compose

El `docker-compose.yml` monta volúmenes `pass-data` (`/home/node/.password-store`)
y `gnupg-data` (`/home/node/.gnupg`) para el servicio `agent`.

```bash
# En el host / .env del compose:
PROTON_PASS_ENABLED=true
PROTON_PASS_BACKEND=pass          # o gopass
PROTON_PASS_STORE_DIR=/home/node/.password-store
# GOPASS_STORE_DIR=...            # si backend=gopass
```

Inicializa el store una vez (gpg + pass) dentro del contenedor o copia un store
existente al volumen. Ver también [`pass-audit` playbook](../playbooks/pass-audit.md).

Auditoría (dry-run):

```bash
docker compose exec agent node dist/agent-cli.js pass-audit
```

## 6. Registro en un cliente MCP remoto

Con el endpoint HTTP verificado, regístralo en tu cliente MCP como Remote MCP Server:

```bash
# Ejemplo genérico; consulta la documentación de tu cliente para el comando exacto.
mcp-client add --transport http protonmail \
  https://tu-dominio.example/mcp \
  --header "Authorization: Bearer $MCP_AUTH_TOKEN"
```

A partir de ahí, el cliente puede invocar las 13 tools contra tu despliegue HTTP autenticado.

## 7. Reverse proxy

El `docker-compose.yml` no declara labels de Traefik ni configuración de Caddy; inyecta los tuyos en la red externa `proxy-network`. Asegúrate de:

- Terminar TLS en el reverse proxy.
- Reenviar el header `Origin` sin modificar.
- No exponer `/mcp` sin el bearer token.
