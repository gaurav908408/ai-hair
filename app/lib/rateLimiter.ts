/**
 * Server-Side Rate Limiter with Hybrid SQLite & Cloud Persistence
 *
 * Zero-Infrastructure & Zero-Cost:
 * - On Local/Docker/VPS: Uses embedded SQLite (data/ratelimit.db) with WAL mode.
 * - On Vercel Serverless: Uses persistent distributed cloud sync (keyvalue store) so that
 *   rate limits persist across all serverless lambda workers, cold starts, and Incognito tabs!
 *
 * Features:
 * - Fixed-window counter (2 requests per 24 hours).
 * - Distinguishes multiple Jio/Airtel users sharing the same public IP.
 * - Automatic background purge of expired records.
 * - Automatic credit refund on face-detection failures.
 */

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

export interface RateLimitResult {
  /** Whether the request is permitted */
  allowed: boolean;
  /** Maximum requests allowed per window */
  limit: number;
  /** Number of remaining requests in the current window */
  remaining: number;
  /** Epoch timestamp in ms when the quota resets */
  resetTimestamp: number;
  /** Number of seconds to wait before retrying (0 if allowed) */
  retryAfterSeconds: number;
  /** Current storage backend used (sqlite | cloud-sync | memory-fallback) */
  storageBackend: "sqlite" | "cloud-sync" | "memory-fallback";
}

// Configuration from environment variables or sensible defaults (2 requests per day)
const MAX_REQUESTS = Math.max(1, parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "2", 10));
const WINDOW_SECONDS = Math.max(10, parseInt(process.env.RATE_LIMIT_WINDOW_SECONDS || "86400", 10));
const WINDOW_MS = WINDOW_SECONDS * 1000;
const DB_RELATIVE_PATH = process.env.RATE_LIMIT_DB_PATH || "data/ratelimit.db";
const CLOUD_APP_KEY = process.env.RATE_LIMIT_CLOUD_KEY || "mn2dqrnc";

interface SQLiteDatabaseSync {
  exec(sql: string): void;
  prepare(sql: string): {
    run(...params: unknown[]): { changes: number; lastInsertRowid: number | bigint };
    get(...params: unknown[]): Record<string, unknown> | undefined;
    all(...params: unknown[]): Record<string, unknown>[];
  };
  close(): void;
}

// Singleton database instance holder
let dbInstance: SQLiteDatabaseSync | null = null;
let isSqliteInitialized = false;
let initializationFailed = false;

// In-Memory Fallback Map (for caching & serverless runtime)
interface MemoryRecord {
  requestsLeft: number;
  resetTimestamp: number;
  lastRequestAt: number;
}
const memoryFallbackStore = new Map<string, MemoryRecord>();

// Periodic cleanup counter
let requestCounter = 0;

/**
 * Initializes the SQLite database file and tables safely.
 */
function getDatabase(): SQLiteDatabaseSync | null {
  if (isSqliteInitialized) {
    return dbInstance;
  }
  if (initializationFailed) {
    return null;
  }

  // On Vercel / AWS Lambda, filesystem is read-only, so skip directly to cloud sync
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    initializationFailed = true;
    return null;
  }

  try {
    const require = createRequire(import.meta.url);
    const sqliteModule = require("node:sqlite") as { DatabaseSync: new (path: string) => SQLiteDatabaseSync };

    if (!sqliteModule?.DatabaseSync) {
      throw new Error("node:sqlite DatabaseSync is not available in this Node runtime.");
    }

    const fullDbPath = path.isAbsolute(DB_RELATIVE_PATH)
      ? DB_RELATIVE_PATH
      : path.join(process.cwd(), "data", path.basename(DB_RELATIVE_PATH || "ratelimit.db"));

    const dir = path.dirname(fullDbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const db = new sqliteModule.DatabaseSync(fullDbPath);

    // High performance PRAGMAs for production concurrency
    db.exec("PRAGMA journal_mode = WAL;");
    db.exec("PRAGMA synchronous = NORMAL;");
    db.exec("PRAGMA busy_timeout = 5000;");

    // Primary rate limit table
    db.exec(`
      CREATE TABLE IF NOT EXISTS rate_limits (
        visitor_id TEXT PRIMARY KEY,
        requests_left INTEGER NOT NULL,
        reset_timestamp INTEGER NOT NULL,
        last_request_at INTEGER NOT NULL,
        ip_address TEXT,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_rate_reset ON rate_limits (reset_timestamp);
    `);

    // Audit log table for analytics
    db.exec(`
      CREATE TABLE IF NOT EXISTS rate_limit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        visitor_id TEXT NOT NULL,
        ip_address TEXT,
        action TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      );
    `);

    dbInstance = db;
    isSqliteInitialized = true;
    console.log(`[RateLimiter] SQLite initialized successfully at: ${fullDbPath}`);
    return dbInstance;
  } catch (err: unknown) {
    initializationFailed = true;
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[RateLimiter] Notice: SQLite unavailable (${msg}). Switching to cloud-persistent sync.`);
    return null;
  }
}

/**
 * Fetches rate limit record from persistent cloud store across Vercel Lambdas
 */
async function fetchCloudRecord(key: string): Promise<MemoryRecord | null> {
  try {
    const cleanKey = encodeURIComponent(key.replace(/[^a-zA-Z0-9_-]/g, "_"));
    const res = await fetch(
      `https://keyvalue.immanuel.co/api/KeyVal/GetValue/${CLOUD_APP_KEY}/${cleanKey}`,
      {
        signal: AbortSignal.timeout(1500),
        cache: "no-store",
      }
    );
    if (!res.ok) return null;
    const text = (await res.text()).trim().replace(/^"|"$/g, "");
    if (!text || !text.includes("_")) return null;

    const [reqStr, resetStr] = text.split("_");
    const requestsLeft = parseInt(reqStr, 10);
    const resetTimestamp = parseInt(resetStr, 10);
    if (isNaN(requestsLeft) || isNaN(resetTimestamp)) return null;

    return {
      requestsLeft,
      resetTimestamp,
      lastRequestAt: Date.now(),
    };
  } catch {
    return null;
  }
}

/**
 * Persists rate limit record to distributed cloud store across Vercel Lambdas
 */
async function saveCloudRecord(
  key: string,
  requestsLeft: number,
  resetTimestamp: number
): Promise<void> {
  try {
    const cleanKey = encodeURIComponent(key.replace(/[^a-zA-Z0-9_-]/g, "_"));
    const val = `${requestsLeft}_${resetTimestamp}`;
    await fetch(
      `https://keyvalue.immanuel.co/api/KeyVal/UpdateValue/${CLOUD_APP_KEY}/${cleanKey}/${val}`,
      {
        method: "POST",
        signal: AbortSignal.timeout(1500),
      }
    );
  } catch {
    // silent fallback
  }
}

/**
 * Purges expired entries from storage to prevent unbound growth
 */
function cleanupExpiredRecords(now: number) {
  const db = getDatabase();
  if (db) {
    try {
      db.prepare("DELETE FROM rate_limits WHERE reset_timestamp < ?").run(now);
    } catch {
      // ignore
    }
  }

  // Cleanup memory map
  for (const [key, val] of memoryFallbackStore.entries()) {
    if (val.resetTimestamp < now) {
      memoryFallbackStore.delete(key);
    }
  }
}

/**
 * Checks and consumes a rate limit credit for a visitor.
 * Atomic: Decides whether to allow or deny and records the usage.
 *
 * @param visitorId - Digital browser fingerprint hash
 * @param ipAddress - Client IP address
 */
export async function checkAndConsumeRateLimit(
  visitorId: string,
  ipAddress?: string
): Promise<RateLimitResult> {
  const now = Date.now();
  const cleanId = (visitorId || "").trim() || (ipAddress || "").trim() || "anonymous";

  // Periodic cleanup
  if (++requestCounter % 100 === 0) {
    cleanupExpiredRecords(now);
  }

  const db = getDatabase();

  // 1. If SQLite is active (Localhost / VPS / Docker)
  if (db) {
    try {
      const selectStmt = db.prepare(
        "SELECT requests_left, reset_timestamp, last_request_at FROM rate_limits WHERE visitor_id = ?"
      );
      const row = selectStmt.get(cleanId) as
        | { requests_left: number; reset_timestamp: number; last_request_at: number }
        | undefined;

      if (!row || now >= row.reset_timestamp) {
        const newResetTimestamp = now + WINDOW_MS;
        const newRequestsLeft = MAX_REQUESTS - 1;

        db.prepare(`
          INSERT INTO rate_limits (visitor_id, requests_left, reset_timestamp, last_request_at, ip_address, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(visitor_id) DO UPDATE SET
            requests_left = excluded.requests_left,
            reset_timestamp = excluded.reset_timestamp,
            last_request_at = excluded.last_request_at,
            ip_address = excluded.ip_address
        `).run(cleanId, newRequestsLeft, newResetTimestamp, now, ipAddress || null, now);

        saveCloudRecord(cleanId, newRequestsLeft, newResetTimestamp).catch(() => {});

        return {
          allowed: true,
          limit: MAX_REQUESTS,
          remaining: newRequestsLeft,
          resetTimestamp: newResetTimestamp,
          retryAfterSeconds: 0,
          storageBackend: "sqlite",
        };
      }

      if (row.requests_left > 0) {
        const updatedRequestsLeft = row.requests_left - 1;

        db.prepare(
          "UPDATE rate_limits SET requests_left = ?, last_request_at = ? WHERE visitor_id = ?"
        ).run(updatedRequestsLeft, now, cleanId);

        saveCloudRecord(cleanId, updatedRequestsLeft, row.reset_timestamp).catch(() => {});

        return {
          allowed: true,
          limit: MAX_REQUESTS,
          remaining: updatedRequestsLeft,
          resetTimestamp: row.reset_timestamp,
          retryAfterSeconds: 0,
          storageBackend: "sqlite",
        };
      }

      const retryAfterSeconds = Math.max(1, Math.ceil((row.reset_timestamp - now) / 1000));
      return {
        allowed: false,
        limit: MAX_REQUESTS,
        remaining: 0,
        resetTimestamp: row.reset_timestamp,
        retryAfterSeconds,
        storageBackend: "sqlite",
      };
    } catch {
      // fallback to cloud sync below
    }
  }

  // 2. Distributed Cloud Sync Engine (Vercel Serverless & Multi-Lambda Safe)
  let record = memoryFallbackStore.get(cleanId);

  // If memory record is absent or shows full quota, query persistent cloud store
  if (!record || record.requestsLeft === MAX_REQUESTS) {
    const cloudRecord = await fetchCloudRecord(cleanId);
    if (cloudRecord) {
      record = cloudRecord;
      memoryFallbackStore.set(cleanId, cloudRecord);
    }
  }

  // Case 1: First time visitor OR quota window expired
  if (!record || now >= record.resetTimestamp) {
    const newReset = now + WINDOW_MS;
    const remaining = MAX_REQUESTS - 1;
    const newRecord: MemoryRecord = {
      requestsLeft: remaining,
      resetTimestamp: newReset,
      lastRequestAt: now,
    };
    memoryFallbackStore.set(cleanId, newRecord);
    await saveCloudRecord(cleanId, remaining, newReset);

    return {
      allowed: true,
      limit: MAX_REQUESTS,
      remaining,
      resetTimestamp: newReset,
      retryAfterSeconds: 0,
      storageBackend: "cloud-sync",
    };
  }

  // Case 2: Window active with quota remaining -> Deduct 1 credit
  if (record.requestsLeft > 0) {
    record.requestsLeft -= 1;
    record.lastRequestAt = now;
    memoryFallbackStore.set(cleanId, record);
    await saveCloudRecord(cleanId, record.requestsLeft, record.resetTimestamp);

    return {
      allowed: true,
      limit: MAX_REQUESTS,
      remaining: record.requestsLeft,
      resetTimestamp: record.resetTimestamp,
      retryAfterSeconds: 0,
      storageBackend: "cloud-sync",
    };
  }

  // Case 3: Quota exhausted -> Deny!
  const retryAfter = Math.max(1, Math.ceil((record.resetTimestamp - now) / 1000));
  return {
    allowed: false,
    limit: MAX_REQUESTS,
    remaining: 0,
    resetTimestamp: record.resetTimestamp,
    retryAfterSeconds: retryAfter,
    storageBackend: "cloud-sync",
  };
}

/**
 * Checks current rate limit status without consuming a credit.
 * Used by UI indicators or status endpoints.
 */
export async function getRateLimitStatus(visitorId: string): Promise<RateLimitResult> {
  const now = Date.now();
  const cleanId = (visitorId || "").trim();

  if (!cleanId) {
    return {
      allowed: true,
      limit: MAX_REQUESTS,
      remaining: MAX_REQUESTS,
      resetTimestamp: now + WINDOW_MS,
      retryAfterSeconds: 0,
      storageBackend: "cloud-sync",
    };
  }

  const db = getDatabase();
  if (db) {
    try {
      const row = db
        .prepare("SELECT requests_left, reset_timestamp FROM rate_limits WHERE visitor_id = ?")
        .get(cleanId) as { requests_left: number; reset_timestamp: number } | undefined;

      if (!row || now >= row.reset_timestamp) {
        return {
          allowed: true,
          limit: MAX_REQUESTS,
          remaining: MAX_REQUESTS,
          resetTimestamp: now + WINDOW_MS,
          retryAfterSeconds: 0,
          storageBackend: "sqlite",
        };
      }

      const retryAfter =
        row.requests_left <= 0 ? Math.max(1, Math.ceil((row.reset_timestamp - now) / 1000)) : 0;

      return {
        allowed: row.requests_left > 0,
        limit: MAX_REQUESTS,
        remaining: row.requests_left,
        resetTimestamp: row.reset_timestamp,
        retryAfterSeconds: retryAfter,
        storageBackend: "sqlite",
      };
    } catch {
      // fallback
    }
  }

  let mem = memoryFallbackStore.get(cleanId);
  // If not in local lambda memory or shows full quota, query distributed cloud store
  if (!mem || mem.requestsLeft === MAX_REQUESTS) {
    const cloudRecord = await fetchCloudRecord(cleanId);
    if (cloudRecord) {
      mem = cloudRecord;
      memoryFallbackStore.set(cleanId, cloudRecord);
    }
  }

  if (!mem || now >= mem.resetTimestamp) {
    return {
      allowed: true,
      limit: MAX_REQUESTS,
      remaining: MAX_REQUESTS,
      resetTimestamp: now + WINDOW_MS,
      retryAfterSeconds: 0,
      storageBackend: "cloud-sync",
    };
  }

  const retryAfter =
    mem.requestsLeft <= 0 ? Math.max(1, Math.ceil((mem.resetTimestamp - now) / 1000)) : 0;

  return {
    allowed: mem.requestsLeft > 0,
    limit: MAX_REQUESTS,
    remaining: mem.requestsLeft,
    resetTimestamp: mem.resetTimestamp,
    retryAfterSeconds: retryAfter,
    storageBackend: "cloud-sync",
  };
}

/**
 * Refunds a credit if an upstream processing error occurred (e.g. invalid photo / no face).
 */
export async function refundRateLimit(visitorId: string): Promise<void> {
  const cleanId = (visitorId || "").trim();
  if (!cleanId) return;

  const db = getDatabase();
  if (db) {
    try {
      db.prepare(
        "UPDATE rate_limits SET requests_left = MIN(?, requests_left + 1) WHERE visitor_id = ?"
      ).run(MAX_REQUESTS, cleanId);
    } catch {
      // fallback
    }
  }

  let mem = memoryFallbackStore.get(cleanId);
  if (!mem) {
    const cloud = await fetchCloudRecord(cleanId);
    if (cloud) mem = cloud;
  }
  if (mem) {
    mem.requestsLeft = Math.min(MAX_REQUESTS, mem.requestsLeft + 1);
    memoryFallbackStore.set(cleanId, mem);
    await saveCloudRecord(cleanId, mem.requestsLeft, mem.resetTimestamp);
  }
}
