import { describe, it, expect } from "vitest";
import { getToolRateClass } from "../src/http-tool-rate.js";
import type { Request } from "express";

function req(body: unknown): Request {
  return { body } as Request;
}

describe("getToolRateClass", () => {
  it("classifies audit tools", () => {
    expect(
      getToolRateClass(
        req({ method: "tools/call", params: { name: "proton_drive_audit" } }),
      ),
    ).toBe("audit");
    expect(
      getToolRateClass(
        req({ method: "tools/call", params: { name: "proton_drive_organize" } }),
      ),
    ).toBe("audit");
  });

  it("classifies write tools", () => {
    expect(
      getToolRateClass(
        req({ method: "tools/call", params: { name: "proton_send_email" } }),
      ),
    ).toBe("write");
  });

  it("defaults non-tool RPC and unknown tools to read", () => {
    expect(getToolRateClass(req({ method: "initialize" }))).toBe("read");
    expect(getToolRateClass(req(null))).toBe("read");
    expect(getToolRateClass(req({ method: "tools/call", params: null }))).toBe(
      "read",
    );
    expect(
      getToolRateClass(req({ method: "tools/call", params: { name: 42 } })),
    ).toBe("read");
    expect(
      getToolRateClass(
        req({ method: "tools/call", params: { name: "proton_list_emails" } }),
      ),
    ).toBe("read");
  });
});
