import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

function readText(rel: string): string {
  return readFileSync(resolve(root, rel), "utf8");
}

describe("playbooks · structure", () => {
  it("every playbook is a markdown file with frontmatter", () => {
    const files = readdirSync(resolve(root, "playbooks")).filter(
      (f) => f.endsWith(".md") && f !== "README.md",
    );
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      const raw = readText(`playbooks/${f}`);
      expect(raw.startsWith("---")).toBe(true);
    }
  });
});

describe("playbooks · triage-email.md", () => {
  const raw = readText("playbooks/triage-email.md");

  it("references the required tools", () => {
    expect(raw).toMatch(/proton_list_folders/);
    expect(raw).toMatch(/proton_list_emails/);
    expect(raw).toMatch(/proton_move_email/);
  });

  it("forbids proton_delete_email", () => {
    expect(raw).toMatch(/proton_delete_email/);
    expect(raw).toMatch(/Prohibida/);
  });

  it("requires dry-run first", () => {
    expect(raw).toMatch(/dry-run/i);
    expect(raw).toMatch(/SIEMPRE primero/);
  });
});

describe("playbooks · reply-organize.md", () => {
  const raw = readText("playbooks/reply-organize.md");

  it("references reply and move tools", () => {
    expect(raw).toMatch(/proton_reply_email/);
    expect(raw).toMatch(/proton_move_email/);
  });

  it("requires operator confirmation before sending", () => {
    expect(raw).toMatch(/No enviar sin confirmación/);
  });
});

describe("playbooks · setup-checklist.md", () => {
  const raw = readText("playbooks/setup-checklist.md");

  it("covers stdio and HTTP modes", () => {
    expect(raw).toMatch(/modo stdio/);
    expect(raw).toMatch(/modo HTTP/);
  });
});
