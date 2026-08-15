import { describe, it, expect, beforeEach } from "vitest";
import {
  withDrivePathLock,
  withDrivePathLocks,
  resetDrivePathLocks,
} from "../src/drive-mutex.js";

describe("withDrivePathLock", () => {
  beforeEach(() => {
    resetDrivePathLocks();
  });

  it("serializes concurrent work on the same path", async () => {
    const order: string[] = [];
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((r) => {
      releaseFirst = r;
    });

    const p1 = withDrivePathLock("/a", async () => {
      order.push("p1-start");
      await firstGate;
      order.push("p1-end");
    });
    const p2 = withDrivePathLock("/a", async () => {
      order.push("p2");
    });

    // Flush acquire microtasks until first holder starts.
    for (let i = 0; i < 10 && !order.includes("p1-start"); i++) {
      await Promise.resolve();
    }
    expect(order).toEqual(["p1-start"]);
    expect(order).not.toContain("p2");
    releaseFirst();
    await Promise.all([p1, p2]);
    expect(order).toEqual(["p1-start", "p1-end", "p2"]);
  });

  it("allows different paths in parallel", async () => {
    const order: string[] = [];
    let releaseA!: () => void;
    const gateA = new Promise<void>((r) => {
      releaseA = r;
    });

    const pa = withDrivePathLock("/a", async () => {
      order.push("a-start");
      await gateA;
      order.push("a-end");
    });
    const pb = withDrivePathLock("/b", async () => {
      order.push("b");
    });

    for (let i = 0; i < 10 && order.length < 2; i++) {
      await Promise.resolve();
    }
    expect(order).toContain("a-start");
    expect(order).toContain("b");
    releaseA();
    await Promise.all([pa, pb]);
  });

  it("acquires multi-path locks without deadlock on same from/to", async () => {
    await expect(
      withDrivePathLocks(["/a/", "/a"], async () => "ok"),
    ).resolves.toBe("ok");
  });

  it("avoids ABBA deadlock for crossed moves", async () => {
    const order: string[] = [];
    let releaseAb!: () => void;
    const gateAb = new Promise<void>((r) => {
      releaseAb = r;
    });

    const ab = withDrivePathLocks(["/a", "/b"], async () => {
      order.push("ab-start");
      await gateAb;
      order.push("ab-end");
    });
    const ba = withDrivePathLocks(["/b", "/a"], async () => {
      order.push("ba");
    });

    for (let i = 0; i < 20 && !order.includes("ab-start"); i++) {
      await Promise.resolve();
    }
    expect(order).toEqual(["ab-start"]);
    releaseAb();
    await Promise.all([ab, ba]);
    expect(order).toEqual(["ab-start", "ab-end", "ba"]);
  });
});
