/** Per-path mutex for concurrent Drive staging operations over HTTP sessions. */
const locks = new Map<string, Promise<void>>();

function normalizePath(remotePath: string): string {
  return remotePath.replace(/\/+$/, "") || "/";
}

async function acquireOne(key: string): Promise<() => void> {
  const prev = locks.get(key) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const chain = prev.then(() => gate);
  locks.set(key, chain);
  await prev;
  return () => {
    release();
    if (locks.get(key) === chain) {
      locks.delete(key);
    }
  };
}

/** Serializes async work keyed by remote_path (upload/download/organize). */
export async function withDrivePathLock<T>(
  remotePath: string,
  fn: () => Promise<T>,
): Promise<T> {
  return withDrivePathLocks([remotePath], fn);
}

/**
 * Acquires locks for multiple paths in sorted order to avoid ABBA / same-key
 * deadlocks (e.g. concurrent move A→B and B→A, or move with identical from/to).
 */
export async function withDrivePathLocks<T>(
  remotePaths: string[],
  fn: () => Promise<T>,
): Promise<T> {
  const keys = [...new Set(remotePaths.map(normalizePath))].sort();
  const releases: (() => void)[] = [];
  try {
    for (const key of keys) {
      releases.push(await acquireOne(key));
    }
    return await fn();
  } finally {
    for (const release of releases.reverse()) {
      release();
    }
  }
}

/** Clears all locks — test helper only. */
export function resetDrivePathLocks(): void {
  locks.clear();
}
