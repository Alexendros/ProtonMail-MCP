/**
 * Métricas de observabilidad — formato Prometheus text, implementación stdlib.
 *
 * Contadores, gauges e histogramas con etiquetas, expuestos en `/metrics`.
 * Implementación minimalista (sin dependencias) basada en prom-client, suficiente
 * para observar el transport HTTP del MCP server. Operaciones síncronas y O(1)
 * para no impactar el request path.
 *
 * Ver ADR-004 (config + dry-run) y ADR-002 (observabilidad mínima sin deps externas).
 */

export type Labels = Record<string, string>;

/** Escapa un valor de etiqueta para formato Prometheus text. */
function escapeValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/** Serializa etiquetas en `{k="v",...}` (vacío si no hay labelNames). */
function formatLabels(labelNames: string[], labels: Labels): string {
  if (labelNames.length === 0) return "";
  const parts: string[] = [];
  for (const name of labelNames) {
    parts.push(`${name}="${escapeValue(labels[name] ?? "")}"`);
  }
  return `{${parts.join(",")}}`;
}

/** Clave interna para indexar el almacenamiento por combinación de etiquetas. */
function storageKey(labelNames: string[], labels: Labels): string {
  return formatLabels(labelNames, labels);
}

export class Counter {
  private readonly store = new Map<string, number>();
  readonly name: string;
  readonly help: string;
  readonly labelNames: string[];

  constructor(name: string, help: string, labelNames: string[] = []) {
    this.name = name;
    this.help = help;
    this.labelNames = labelNames;
  }

  /** Incrementa en `amount` (default 1) para el conjunto de etiquetas dado. */
  inc(labels: Labels = {}, amount = 1): void {
    const key = storageKey(this.labelNames, labels);
    this.store.set(key, (this.store.get(key) ?? 0) + amount);
  }

  /** Itera las muestras `[labelsStr, value]` para serialización. */
  *samples(): IterableIterator<[string, number]> {
    for (const entry of this.store) {
      yield entry;
    }
  }

  readonly _type = "counter";
}

export class Gauge {
  private readonly store = new Map<string, number>();
  readonly name: string;
  readonly help: string;
  readonly labelNames: string[];

  constructor(name: string, help: string, labelNames: string[] = []) {
    this.name = name;
    this.help = help;
    this.labelNames = labelNames;
  }

  /** Fija el valor para el conjunto de etiquetas dado. */
  set(labels: Labels, value: number): void {
    const key = storageKey(this.labelNames, labels);
    this.store.set(key, value);
  }

  *samples(): IterableIterator<[string, number]> {
    for (const entry of this.store) {
      yield entry;
    }
  }

  readonly _type = "gauge";
}

export interface HistogramOptions {
  buckets?: number[];
  labelNames?: string[];
}

export class Histogram {
  private readonly buckets: number[];
  private readonly labelNames: string[];
  private readonly store = new Map<string, HistogramEntry>();
  readonly name: string;
  readonly help: string;

  constructor(name: string, help: string, options: HistogramOptions = {}) {
    this.name = name;
    this.help = help;
    this.labelNames = options.labelNames ?? [];
    // Buckets acumulativos ascendentes; +Inf siempre implícito al final.
    this.buckets = options.buckets ?? [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];
  }

  observe(labels: Labels, value: number): void {
    const key = storageKey(this.labelNames, labels);
    const entry = this.store.get(key);
    if (entry) {
      entry.observe(value);
    } else {
      this.store.set(key, new HistogramEntry(this.buckets).observe(value));
    }
  }

  *samples(): IterableIterator<[string, HistogramEntry]> {
    for (const entry of this.store) {
      yield entry;
    }
  }

  readonly _type = "histogram";
}

interface HistogramSample {
  readonly buckets: { bound: number; count: number }[];
  sum: number;
  count: number;
}

class HistogramEntry implements HistogramSample {
  readonly buckets: { bound: number; count: number }[];
  sum: number;
  count: number;

  constructor(buckets: number[]) {
    // Límites superiores acumulativos + +Inf implícito al final.
    this.buckets = [...buckets, Number.POSITIVE_INFINITY].map((bound) => ({
      bound,
      count: 0,
    }));
    this.sum = 0;
    this.count = 0;
  }

  observe(value: number): this {
    this.sum += value;
    this.count += 1;
    for (const bucket of this.buckets) {
      if (value <= bucket.bound) {
        bucket.count += 1;
      }
    }
    return this;
  }
}

/** Registro central de métricas (único, estilo prom-client). */
export class Registry {
  private readonly metrics = new Map<string, Counter | Gauge | Histogram>();

  register(metric: Counter | Gauge | Histogram): this {
    this.metrics.set(metric.name, metric);
    return this;
  }

  has(name: string): boolean {
    return this.metrics.has(name);
  }

  /** Serializa todo el registro al formato Prometheus text. */
  text(): string {
    const lines: string[] = [];
    for (const metric of this.metrics.values()) {
      lines.push(`# HELP ${metric.name} ${escapeHelp(metric.help)}`);
      lines.push(`# TYPE ${metric.name} ${metric._type}`);
      if (metric instanceof Histogram) {
        for (const [labelStr, entry] of metric.samples()) {
          for (const bucket of entry.buckets) {
            const leValue = bucket.bound === Number.POSITIVE_INFINITY ? "+Inf" : formatMetricValue(bucket.bound);
            const leLabels = addLeLabel(labelStr, leValue);
            lines.push(`${metric.name}_bucket${leLabels} ${bucket.count}`);
          }
          lines.push(`${metric.name}_sum${labelStr} ${formatMetricValue(entry.sum)}`);
          lines.push(`${metric.name}_count${labelStr} ${formatMetricValue(entry.count)}`);
        }
      } else {
        for (const [labelStr, value] of metric.samples()) {
          lines.push(`${metric.name}${labelStr} ${formatMetricValue(value)}`);
        }
      }
    }
    return lines.join("\n") + "\n";
  }
}

/** El registry de uso único para la aplicación. */
export const registry = new Registry();

// Métricas predefinidas para el transport HTTP del MCP server.
export const mcpRequestsTotal = new Counter(
  "mcp_requests_total",
  "Total de peticiones MCP (transport HTTP)",
  ["transport", "method", "status"],
);
export const mcpRequestDuration = new Histogram(
  "mcp_request_duration_seconds",
  "Duración de peticiones MCP (transport HTTP)",
  { labelNames: ["transport", "method"], buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10] },
);
export const mcpActiveSessions = new Gauge(
  "mcp_active_sessions",
  "Sesiones MCP HTTP activas",
  [],
);
export const mcpDryRunMode = new Gauge(
  "mcp_dry_run_mode",
  "1 si AGENT_DRY_RUN está activado (0 si no)",
  [],
);

registry.register(mcpRequestsTotal);
registry.register(mcpRequestDuration);
registry.register(mcpActiveSessions);
registry.register(mcpDryRunMode);

/** Formatea el valor numérico: enteros sin decimales. */
function formatMetricValue(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return String(value);
}

/** Escapa el texto de ayuda (Prometheus permite multi-línea con `\n`). */
function escapeHelp(help: string): string {
  return help.replace(/\\/g, "\\\\").replace(/\n/g, "\\n");
}

/** Añade `le="..."` a una etiqueta existente ({a="b"} → {a="b",le="0.005"}). */
function addLeLabel(labelStr: string, leValue: string): string {
  const le = `le="${leValue}"`;
  if (labelStr === "") return `{${le}}`;
  return labelStr.slice(0, -1) + `,${le}}`;
}
