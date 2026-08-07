import { describe, it, expect } from "vitest";
import {
  Counter,
  Gauge,
  Histogram,
  Registry,
  registry,
  mcpRequestsTotal,
  mcpRequestDuration,
  mcpActiveSessions,
  mcpDryRunMode,
} from "../../src/utils/metrics.js";

describe("Counter", () => {
  it("starts at zero and increments by default amount", () => {
    const c = new Counter("test_total", "help");
    c.inc();
    expect([...c.samples()]).toEqual([["", 1]]);
  });

  it("increments by a custom amount", () => {
    const c = new Counter("custom", "help");
    c.inc({}, 5);
    expect([...c.samples()]).toEqual([["", 5]]);
  });

  it("accumulates across multiple calls", () => {
    const c = new Counter("acc", "help");
    c.inc({}, 2);
    c.inc({}, 3);
    expect([...c.samples()]).toEqual([["", 5]]);
  });

  it("tracks separate label sets independently", () => {
    const c = new Counter("labeled", "help", ["method"]);
    c.inc({ method: "GET" }, 3);
    c.inc({ method: "POST" }, 1);
    const samples = [...c.samples()];
    expect(samples).toEqual(
      expect.arrayContaining([
        ['{method="GET"}', 3],
        ['{method="POST"}', 1],
      ]),
    );
    expect(samples.length).toBe(2);
  });
});

describe("Gauge", () => {
  it("sets and returns the value", () => {
    const g = new Gauge("g", "help");
    g.set({}, 42);
    expect([...g.samples()]).toEqual([["", 42]]);
  });

  it("overwrites on repeated set", () => {
    const g = new Gauge("g", "help");
    g.set({}, 1);
    g.set({}, 99);
    expect([...g.samples()]).toEqual([["", 99]]);
  });

  it("tracks per-label values", () => {
    const g = new Gauge("sessions", "help", ["transport"]);
    g.set({ transport: "http" }, 3);
    g.set({ transport: "stdio" }, 1);
    expect([...g.samples()].length).toBe(2);
  });
});

describe("Histogram", () => {
  it("counts observations into correct buckets", () => {
    const h = new Histogram("h", "help", { buckets: [0.1, 0.5, 1] });
    h.observe({}, 0.05);
    h.observe({}, 0.3);
    h.observe({}, 0.8);
    h.observe({}, 2.0);

    const samples = [...h.samples()];
    expect(samples.length).toBe(1);
    const [, entry] = samples[0]!;

    // Buckets acumulativos [0.1, 0.5, 1, +Inf]
    expect(entry.buckets.map((b) => b.count)).toEqual([1, 2, 3, 4]);
    expect(entry.count).toBe(4);
    expect(entry.sum).toBeCloseTo(3.15, 5);
  });

  it("uses default buckets when none specified", () => {
    const h = new Histogram("h2", "help");
    h.observe({}, 0.001);
    const [, entry] = [...h.samples()][0]!;
    expect(entry.buckets[0]!.count).toBe(1);
    expect(entry.count).toBe(1);
  });

  it("handles Infinity boundary correctly", () => {
    const h = new Histogram("h3", "help", { buckets: [10] });
    h.observe({}, 100);
    const [, entry] = [...h.samples()][0]!;
    // Buckets [10, +Inf] → 100 > 10 (0), 100 <= Inf (1)
    expect(entry.buckets.map((b) => b.count)).toEqual([0, 1]);
  });

  it("tracks per-label histograms independently", () => {
    const h = new Histogram("labeled", "help", { buckets: [1], labelNames: ["method"] });
    h.observe({ method: "GET" }, 0.5);
    h.observe({ method: "POST" }, 2.0);
    const samples = [...h.samples()];
    expect(samples.length).toBe(2);
  });
});

describe("Registry", () => {
  it("register and text() produces Prometheus format", () => {
    const reg = new Registry();
    const c = new Counter("my_counter", "A test counter", ["a"]);
    c.inc({ a: "x" }, 3);
    reg.register(c);

    const text = reg.text();
    expect(text).toContain("# HELP my_counter A test counter");
    expect(text).toContain("# TYPE my_counter counter");
    expect(text).toContain('my_counter{a="x"} 3');
  });

  it("text() renders histogram with _bucket, _sum, _count", () => {
    const reg = new Registry();
    const h = new Histogram("dur", "duration", { buckets: [0.5, 1] });
    h.observe({}, 0.1);
    h.observe({}, 0.8);
    reg.register(h);

    const text = reg.text();
    expect(text).toContain("# TYPE dur histogram");
    expect(text).toContain('dur_bucket{le="0.5"} 1');
    expect(text).toContain('dur_bucket{le="1"} 2');
    expect(text).toContain('dur_bucket{le="+Inf"} 2');
    expect(text).toContain("dur_sum");
    expect(text).toContain("dur_count 2");
  });

  it("has() checks registered metrics", () => {
    const reg = new Registry();
    expect(reg.has("x")).toBe(false);
    const g = new Gauge("x", "help");
    reg.register(g);
    expect(reg.has("x")).toBe(true);
  });
});

describe("Default pre-built metrics", () => {
  it("are registered in the singleton registry", () => {
    expect(registry.has("mcp_requests_total")).toBe(true);
    expect(registry.has("mcp_request_duration_seconds")).toBe(true);
    expect(registry.has("mcp_active_sessions")).toBe(true);
    expect(registry.has("mcp_dry_run_mode")).toBe(true);
  });

  it("mcpRequestsTotal has correct label names", () => {
    expect(mcpRequestsTotal.labelNames).toEqual(["transport", "method", "status"]);
    mcpRequestsTotal.inc({ transport: "http", method: "tools/call", status: "200" });
    expect([...mcpRequestsTotal.samples()].length).toBeGreaterThanOrEqual(1);
  });

  it("mcpActiveSessions can be set", () => {
    mcpActiveSessions.set({}, 5);
    expect([...mcpActiveSessions.samples()][0]![1]).toBe(5);
  });

  it("mcpDryRunMode can be set", () => {
    mcpDryRunMode.set({}, 1);
    expect([...mcpDryRunMode.samples()][0]![1]).toBe(1);
  });

  it("mcpRequestDuration accepts observations", () => {
    mcpRequestDuration.observe({ transport: "http", method: "initialize" }, 0.023);
    expect([...mcpRequestDuration.samples()].length).toBeGreaterThanOrEqual(1);
  });

  it("registry.text() includes HELP and TYPE for all default metrics", () => {
    const text = registry.text();
    expect(text).toContain("# HELP mcp_requests_total");
    expect(text).toContain("# TYPE mcp_requests_total counter");
    expect(text).toContain("# HELP mcp_request_duration_seconds");
    expect(text).toContain("# TYPE mcp_request_duration_seconds histogram");
    expect(text).toContain("# HELP mcp_active_sessions");
    expect(text).toContain("# TYPE mcp_active_sessions gauge");
    expect(text).toContain("# HELP mcp_dry_run_mode");
    expect(text).toContain("# TYPE mcp_dry_run_mode gauge");
  });
});
