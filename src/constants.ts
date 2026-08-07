/**
 * Constantes de configuración y tuning centralizadas.
 *
 * Centraliza timeouts, tamaños de buffer, thresholds y demás valores mágicos
 * que estaban dispersos en el código. Facilita el ajuste operacional sin
 * tocar lógica de negocio.
 */

// ── IMAP ──────────────────────────────────────────────────────────────────
export const IMAP_MAX_RETRIES = 3
export const IMAP_RETRY_BASE_MS = 500
export const IMAP_MAX_IDLE_MS = 60_000

// ── SMTP ──────────────────────────────────────────────────────────────────
export const SMTP_POOL_MAX_CONNECTIONS = 2
export const SMTP_POOL_MAX_MESSAGES = 50

// ── Bridge ────────────────────────────────────────────────────────────────
export const BRIDGE_CLI_TIMEOUT = 30_000
export const BRIDGE_SPAWN_PROMPT_TIMEOUT = 15_000
export const BRIDGE_SHUTDOWN_TIMEOUT = 5_000
export const BRIDGE_IMAP_PORT = 1143
export const BRIDGE_SMTP_PORT = 1025

// ── Drive ─────────────────────────────────────────────────────────────────
export const DRIVE_EXEC_MAX_BUFFER = 50 * 1024 * 1024

// ── HTTP ──────────────────────────────────────────────────────────────────
export const HTTP_IDLE_SESSION_TIMEOUT_MS = 30 * 60 * 1000
export const HTTP_RATE_LIMIT_WINDOW_MS = 60_000
export const HTTP_RATE_LIMIT_MAX = 120

// ── Diagnostics ───────────────────────────────────────────────────────────
export const DIAG_TCP_TIMEOUT_MS = 5000
export const DIAG_EXEC_TIMEOUT_MS = 5000

// ── Ecosystem ─────────────────────────────────────────────────────────────
export const ECO_DISCOVERY_TIMEOUT_MS = 5000
export const ECO_APT_INSTALL_TIMEOUT_MS = 120_000
export const ECO_VERSION_TIMEOUT_MS = 3000

// ── Security ──────────────────────────────────────────────────────────────
export const SEC_MIN_SANITIZE_LENGTH = 4

// ── Alert rules ───────────────────────────────────────────────────────────
export const ALERT_THREAT_CONFIDENCE_FACTOR = 0.4

// ── Agent ─────────────────────────────────────────────────────────────────
export const AGENT_DEFAULT_MAX_INSPECT = 1000
export const AGENT_DEFAULT_MIN_CONFIDENCE = 0.6

// ── Attachment limits ─────────────────────────────────────────────────────
export const ATTACH_MAX_SIZE = 50 * 1024 * 1024
export const ATTACH_INLINE_THRESHOLD = 10 * 1024 * 1024
