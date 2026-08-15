import { describe, it, expect } from "vitest";
import { parseCalendarConfig } from "../../src/config/calendar.js";

function env(vars: Record<string, string> = {}): NodeJS.ProcessEnv {
  return { ...vars };
}

describe("parseCalendarConfig", () => {
  it("defaults enabled and experimental to false", () => {
    const cfg = parseCalendarConfig(env());
    expect(cfg.enabled).toBe(false);
    expect(cfg.experimental).toBe(false);
  });

  it("parses PROTON_CALENDAR_ENABLED=true", () => {
    const cfg = parseCalendarConfig(env({ PROTON_CALENDAR_ENABLED: "true" }));
    expect(cfg.enabled).toBe(true);
    expect(cfg.experimental).toBe(false);
  });

  it("parses PROTON_CALENDAR_EXPERIMENTAL=1", () => {
    const cfg = parseCalendarConfig(env({
      PROTON_CALENDAR_ENABLED: "true",
      PROTON_CALENDAR_EXPERIMENTAL: "1",
    }));
    expect(cfg.enabled).toBe(true);
    expect(cfg.experimental).toBe(true);
  });
});
