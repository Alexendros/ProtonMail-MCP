# ---- Builder ----
FROM node:22-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm@9
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
ENV HUSKY=0
RUN pnpm install --frozen-lockfile
COPY tsconfig.json ./
COPY src ./src
RUN pnpm run build

# ---- Runtime ----
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN npm install -g pnpm@9
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --prod --frozen-lockfile --ignore-scripts
COPY --from=builder /app/dist ./dist

# Optional: Proton Drive CLI (descargado de proton.me/support/drive-cli).
# ARG DRIVE_CLI_URL=https://proton.me/download/drive/cli/linux/proton-drive
# Si la URL falla en build-time, el contenedor arranca igual; el operador puede
# instalar el binario manualmente o re-build con DRIVE_CLI_URL apuntando a su
# mirror. El auth token del CLI se persiste en /home/node/.config/proton-drive
# (volumen `drive-auth-data` en docker-compose.yml).
ARG DRIVE_CLI_URL=https://proton.me/download/drive/cli/linux/proton-drive
RUN if [ -n "${DRIVE_CLI_URL}" ]; then \
      echo "Installing proton-drive CLI from ${DRIVE_CLI_URL}"; \
      wget -q "${DRIVE_CLI_URL}" -O /usr/local/bin/proton-drive \
        && chmod +x /usr/local/bin/proton-drive \
        && /usr/local/bin/proton-drive --version || \
        echo "WARN: proton-drive CLI failed to install from ${DRIVE_CLI_URL}"; \
    fi

# Listen on all interfaces inside the container (network policy is enforced by the reverse proxy)
ENV MCP_HTTP_HOST=0.0.0.0
ENV MCP_HTTP_PORT=8787
ENV MCP_TRANSPORT=http
ENV DRIVE_CLI_BIN=/usr/local/bin/proton-drive

EXPOSE 8787

# Simple healthcheck — relies on /healthz
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8787/healthz || exit 1

CMD ["node", "dist/index.js"]
