/**
 * Server-Side Rate Limiter using Embedded SQLite
 *
 * Zero-Infrastructure: Requires NO external Redis server or paid database services.
 * Stores rate-limiting state directly in a local SQLite database (data/ratelimit.db).
 *
 * Features:
 * - WAL (Write-Ahead Logging) mode for lightning-fast concurrent reads & writes.
 * - Auto-recovering resilient in-memory fallback for environments where filesystem writes are restricted.
 * - Fixed-window counter with smooth reset intervals.
 * - Handles CGNAT: Distinguishes multiple Jio/Airtel mobile users sharing the same public IP.
 * - Automatic background purge of expired records to keep the database compact.
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
  /** Current storage backend used (sqlite | memory-fallback) */
  storageBackend: "sqlite" | "memory-fallback";
}

// Configuration from environment variables or sensible defaults (2 requests per day)
const MAX_REQUESTS = Math.max(1, parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "2", 10));
const WINDOW_SECONDS = Math.max(10, parseInt(process.env.RATE_LIMIT_WINDOW_SECONDS || "86400", 10));
const WINDOW_MS = WINDOW_SECONDS * 1000;
const DB_RELATIVE_PATH = process.env.RATE_LIMIT_DB_PATH || "data/ratelimit.db";

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

// In-Memory Fallback Map (for serverless/read-only container environments)
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
    console.warn(`[RateLimiter] Notice: SQLite unavailable (${msg}). Switching smoothly to in-memory cache.`);
    return null;
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
 * @param visitorId - Digital browser fingerprint hash or device UUID
 * @param ipAddress - Client IP address (for CGNAT multi-tenant tracking)
 */
export function checkAndConsumeRateLimit(
  visitorId: string,
  ipAddress?: string
): RateLimitResult {
  const now = Date.now();
  const cleanId = (visitorId || "").trim() || (ipAddress || "").trim() || "anonymous";

  // Periodic cleanup every 100 requests
  if (++requestCounter % 100 === 0) {
    cleanupExpiredRecords(now);
  }

  const db = getDatabase();

  if (db) {
    try {
      const selectStmt = db.prepare(
        "SELECT requests_left, reset_timestamp, last_request_at FROM rate_limits WHERE visitor_id = ?"
      );
      const row = selectStmt.get(cleanId) as
        | { requests_left: number; reset_timestamp: number; last_request_at: number }
        | undefined;

      // Case 1: First time visitor OR quota window has expired -> Reset to new window
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

        return {
          allowed: true,
          limit: MAX_REQUESTS,
          remaining: newRequestsLeft,
          resetTimestamp: newResetTimestamp,
          retryAfterSeconds: 0,
          storageBackend: "sqlite",
        };
      }

      // Case 2: Window active with quota remaining -> Deduct 1 credit
      if (row.requests_left > 0) {
        const updatedRequestsLeft = row.requests_left - 1;

        db.prepare(
          "UPDATE rate_limits SET requests_left = ?, last_request_at = ? WHERE visitor_id = ?"
        ).run(updatedRequestsLeft, now, cleanId);

        return {
          allowed: true,
          limit: MAX_REQUESTS,
          remaining: updatedRequestsLeft,
          resetTimestamp: row.reset_timestamp,
          retryAfterSeconds: 0,
          storageBackend: "sqlite",
        };
      }

      // Case 3: Window active, quota exhausted -> DENY request
      const retryAfterSeconds = Math.max(1, Math.ceil((row.reset_timestamp - now) / 1000));

      // Record block in logs
      try {
        db.prepare(
          "INSERT INTO rate_limit_logs (visitor_id, ip_address, action, timestamp) VALUES (?, ?, 'blocked_429', ?)"
        ).run(cleanId, ipAddress || null, now);
      } catch {
        // ignore
      }

      return {
        allowed: false,
        limit: MAX_REQUESTS,
        remaining: 0,
        resetTimestamp: row.reset_timestamp,
        retryAfterSeconds,
        storageBackend: "sqlite",
      };
    } catch (dbError) {
      console.error("[RateLimiter] SQLite error, falling back to in-memory:", dbError);
      // Fall through to memory fallback below
    }
  }

  // --- Resilient In-Memory Fallback ---
  const memRecord = memoryFallbackStore.get(cleanId);

  if (!memRecord || now >= memRecord.resetTimestamp) {
    const newReset = now + WINDOW_MS;
    const remaining = MAX_REQUESTS - 1;
    memoryFallbackStore.set(cleanId, {
      requestsLeft: remaining,
      resetTimestamp: newReset,
      lastRequestAt: now,
    });
    return {
      allowed: true,
      limit: MAX_REQUESTS,
      remaining,
      resetTimestamp: newReset,
      retryAfterSeconds: 0,
      storageBackend: "memory-fallback",
    };
  }

  if (memRecord.requestsLeft > 0) {
    memRecord.requestsLeft -= 1;
    memRecord.lastRequestAt = now;
    return {
      allowed: true,
      limit: MAX_REQUESTS,
      remaining: memRecord.requestsLeft,
      resetTimestamp: memRecord.resetTimestamp,
      retryAfterSeconds: 0,
      storageBackend: "memory-fallback",
    };
  }

  const retryAfter = Math.max(1, Math.ceil((memRecord.resetTimestamp - now) / 1000));
  return {
    allowed: false,
    limit: MAX_REQUESTS,
    remaining: 0,
    resetTimestamp: memRecord.resetTimestamp,
    retryAfterSeconds: retryAfter,
    storageBackend: "memory-fallback",
  };
}

/**
 * Checks current rate limit status without consuming a credit.
 * Used by UI indicators or status endpoints.
 */
export function getRateLimitStatus(visitorId: string): RateLimitResult {
  const now = Date.now();
  const cleanId = (visitorId || "").trim();

  if (!cleanId) {
    return {
      allowed: true,
      limit: MAX_REQUESTS,
      remaining: MAX_REQUESTS,
      resetTimestamp: now + WINDOW_MS,
      retryAfterSeconds: 0,
      storageBackend: "sqlite",
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

  const mem = memoryFallbackStore.get(cleanId);
  if (!mem || now >= mem.resetTimestamp) {
    return {
      allowed: true,
      limit: MAX_REQUESTS,
      remaining: MAX_REQUESTS,
      resetTimestamp: now + WINDOW_MS,
      retryAfterSeconds: 0,
      storageBackend: "memory-fallback",
    };
  }

  return {
    allowed: mem.requestsLeft > 0,
    limit: MAX_REQUESTS,
    remaining: mem.requestsLeft,
    resetTimestamp: mem.resetTimestamp,
    retryAfterSeconds:
      mem.requestsLeft <= 0 ? Math.max(1, Math.ceil((mem.resetTimestamp - now) / 1000)) : 0,
    storageBackend: "memory-fallback",
  };
}

/**
 * Refunds a credit if an upstream processing error occurred (e.g. invalid photo / no face).
 */
export function refundRateLimit(visitorId: string): void {
  const cleanId = (visitorId || "").trim();
  if (!cleanId) return;

  const db = getDatabase();
  if (db) {
    try {
      db.prepare(
        "UPDATE rate_limits SET requests_left = MIN(?, requests_left + 1) WHERE visitor_id = ?"
      ).run(MAX_REQUESTS, cleanId);
      return;
    } catch {
      // fallback
    }
  }

  const mem = memoryFallbackStore.get(cleanId);
  if (mem) {
    mem.requestsLeft = Math.min(MAX_REQUESTS, mem.requestsLeft + 1);
  }
}

