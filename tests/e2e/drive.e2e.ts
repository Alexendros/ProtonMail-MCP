import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { DriveAuditor } from "../../src/drive-audit.js";
import { DriveClient } from "../../src/drive.js";

const STAGING_DIR = mkdtempSync(join(tmpdir(), "drive-e2e-staging-"));
const silentLog = { error() {}, warn() {}, info() {}, debug() {} };

beforeAll(() => {
  writeFileSync(join(STAGING_DIR, "readme.md"), "# Test");
  writeFileSync(join(STAGING_DIR, "data.csv"), "a,b,c\n1,2,3");
  writeFileSync(join(STAGING_DIR, "archive.doc"), "old format");
  writeFileSync(join(STAGING_DIR, "duplicate_a.txt"), "same content");
  writeFileSync(join(STAGING_DIR, "duplicate_b.txt"), "same content");
});

afterAll(() => {
  rmSync(STAGING_DIR, { recursive: true, force: true });
});

describe("Drive E2E · staging real", () => {
  it("status reports staging directory state", async () => {
    const client = new DriveClient(
      {
        enabled: true,
        cliBin: "proton-drive",
        stagingDir: STAGING_DIR,
        obsoleteExtensions: [".doc"],
      },
      silentLog,
    );
    const st = await client.status();
    expect(st.stagingExists).toBe(true);
    expect(st.stagingFiles).toBeGreaterThanOrEqual(5);
  });

  it("audit detects obsolete formats", async () => {
    const auditor = new DriveAuditor([".doc"], silentLog);
    const report = await auditor.formatReport(STAGING_DIR);
    expect(report.obsoleteFiles.length).toBeGreaterThanOrEqual(1);
    expect(report.obsoleteFiles.some((f) => f.ext === ".doc")).toBe(true);
  });

  it("audit detects duplicates", async () => {
    const auditor = new DriveAuditor([".doc"], silentLog);
    const dups = await auditor.findDuplicates(STAGING_DIR);
    expect(dups.length).toBeGreaterThanOrEqual(1);
    const txtDup = dups.find((d) =>
      d.files.some((f) => f.name.includes("duplicate")),
    );
    expect(txtDup).toBeDefined();
    expect(txtDup!.files.length).toBe(2);
  });

  it("inventory reports file counts by extension", async () => {
    const auditor = new DriveAuditor([".doc"], silentLog);
    const inv = await auditor.scanInventory(STAGING_DIR);
    expect(inv.totalFiles).toBeGreaterThanOrEqual(5);
    expect(inv.byExt[".csv"]).toBe(1);
    expect(inv.byExt[".doc"]).toBe(1);
  });
});
