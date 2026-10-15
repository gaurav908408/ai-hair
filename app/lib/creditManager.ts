/**
 * Production-Ready Server-Side Daily Credit & Abuse Prevention Engine
 *
 * Implements:
 * - SQLite with Write-Ahead Logging (WAL) and atomic transactions (BEGIN IMMEDIATE).
 * - Per-user fixed daily credit limit with server-governed timezone resets.
 * - Race-condition prevention with atomic conditional database updates.
 * - Concurrency control (prevents simultaneous parallel generation requests).
 * - Automatic credit refund on AI provider or face-detection failure.
 * - Short-term IP burst rate limiting for secondary abuse detection.
 * - Dual-layer persistence: SQLite on persistent disks, synchronized memory fallback for serverless.
 */

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

export interface UserCreditRecord {
  userId: string;
  dailyCreditLimit: number;
  creditsUsed: number;
  creditsRemaining: number;
  lastResetDate: string;
  resetTimezone: string;
  updatedAt: number;
  createdAt: number;
  resetTimestamp: number;
  retryAfterSeconds: number;
  phone?: string | null;
  hardwareHash?: string | null;
  lastIp?: string | null;
}

export interface CreditReservationResult {
  success: boolean;
  limit: number;
  remaining: number;
  creditsUsed: number;
  resetTimestamp: number;
  retryAfterSeconds: number;
  reason?: string;
}

export interface BurstRateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
}

// Default configuration
const DEFAULT_DAILY_LIMIT = Math.max(
  1,
  parseInt(process.env.DAILY_CREDIT_LIMIT || process.env.RATE_LIMIT_MAX_REQUESTS || "5", 10)
);
const DEFAULT_TIMEZONE = process.env.RESET_TIMEZONE || "Asia/Kolkata";

/**
 * Returns the resolved absolute file path for the SQLite database.
 */
export function getDatabaseFilePath(): string {
  const dbFile =
    process.env.RATE_LIMIT_DB_PATH || process.env.CREDIT_DB_PATH || "data/credits.db";
  return path.isAbsolute(dbFile)
    ? dbFile
    : path.join(process.cwd(), "data", path.basename(dbFile || "credits.db"));
}

interface SQLiteDatabaseSync {
  exec(sql: string): void;
  prepare(sql: string): {
    run(...params: unknown[]): { changes: number; lastInsertRowid: number | bigint };
    get(...params: unknown[]): Record<string, unknown> | undefined;
    all(...params: unknown[]): Record<string, unknown>[];
  };
  close(): void;
}

let dbInstance: SQLiteDatabaseSync | null = null;
let isInitialized = false;
let initFailed = false;

// Concurrency lock to prevent simultaneous requests from the same user
const activeUserGenerations = new Set<string>();

// Memory fallback store for serverless cold-starts or environments without native sqlite
const memoryCreditsStore = new Map<string, UserCreditRecord>();
const memoryBurstStore = new Map<string, { count: number; expiresAt: number }>();

/**
 * Resets db instance (used during testing to switch databases)
 */
export function resetDatabaseInstanceForTesting(): void {
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch {
      // ignore
    }
    dbInstance = null;
  }
  isInitialized = false;
  initFailed = false;
  memoryCreditsStore.clear();
  memoryBurstStore.clear();
  activeUserGenerations.clear();
}

/**
 * Returns current date string (YYYY-MM-DD) in the specified timezone.
 */
export function getTodayDateString(timeZone: string = DEFAULT_TIMEZONE): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return formatter.format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

/**
 * Calculates epoch millisecond timestamp of the next midnight (00:00:00) in the specified timezone.
 */
export function getNextResetTimestamp(timeZone: string = DEFAULT_TIMEZONE, forDate: Date = new Date()): number {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      hour12: false,
    });
    const parts = formatter.formatToParts(forDate);
    const map: Record<string, number> = {};
    for (const part of parts) {
      if (part.type !== "literal") {
        map[part.type] = parseInt(part.value, 10);
      }
    }
    const hour = map.hour === 24 ? 0 : map.hour || 0;
    const minute = map.minute || 0;
    const second = map.second || 0;
    const msSinceMidnight = ((hour * 60 + minute) * 60 + second) * 1000;
    const msUntilMidnight = Math.max(1000, 86400000 - msSinceMidnight);
    return forDate.getTime() + msUntilMidnight;
  } catch {
    // Fallback: 24 hours from now
    return forDate.getTime() + 86400000;
  }
}

/**
 * Initializes SQLite database tables with WAL mode for safe concurrency.
 */
function getDatabase(): SQLiteDatabaseSync | null {
  if (isInitialized) return dbInstance;
  if (initFailed) return null;

  try {
    const require = createRequire(import.meta.url);
    const sqliteModule = require("node:sqlite") as { DatabaseSync: new (path: string) => SQLiteDatabaseSync };

    if (!sqliteModule?.DatabaseSync) {
      throw new Error("node:sqlite DatabaseSync not available in this Node runtime.");
    }

    const fullDbPath = getDatabaseFilePath();

    const dir = path.dirname(fullDbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const db = new sqliteModule.DatabaseSync(fullDbPath);

    // High performance PRAGMAs for production concurrency
    db.exec("PRAGMA journal_mode = WAL;");
    db.exec("PRAGMA synchronous = NORMAL;");
    db.exec("PRAGMA busy_timeout = 5000;");

    // 1. Core user credit table
    db.exec(`
      CREATE TABLE IF NOT EXISTS user_credits (
        user_id TEXT PRIMARY KEY,
        daily_credit_limit INTEGER NOT NULL,
        credits_used INTEGER NOT NULL,
        credits_remaining INTEGER NOT NULL,
        last_reset_date TEXT NOT NULL,
        reset_timezone TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        phone TEXT,
        hardware_hash TEXT,
        last_ip TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_user_credits_phone ON user_credits(phone);
      CREATE INDEX IF NOT EXISTS idx_user_credits_hw ON user_credits(hardware_hash);
      CREATE INDEX IF NOT EXISTS idx_user_credits_reset ON user_credits(last_reset_date);
    `);

    // 2. Audit ledger table for transactions
    db.exec(`
      CREATE TABLE IF NOT EXISTS credit_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        action TEXT NOT NULL,
        amount INTEGER NOT NULL,
        balance_after INTEGER NOT NULL,
        reason TEXT,
        ip_address TEXT,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_credit_tx_user ON credit_transactions(user_id);
    `);

    // 3. Short term burst rate limit table
    db.exec(`
      CREATE TABLE IF NOT EXISTS rate_limit_bursts (
        key TEXT PRIMARY KEY,
        count INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_bursts_expires ON rate_limit_bursts(expires_at);
    `);

    dbInstance = db;
    isInitialized = true;
    return dbInstance;
  } catch (err: unknown) {
    initFailed = true;
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[CreditManager] SQLite unavailable (${msg}). Using synchronized in-memory credit engine.`);
    return null;
  }
}

/**
 * Retrieves the user's credit balance. Automatically resets credits if a new day has arrived.
 */
export async function getUserCredits(
  userId: string,
  options?: { phone?: string | null; hardwareHash?: string | null; ip?: string | null }
): Promise<UserCreditRecord> {
  const cleanId = (userId || "").trim();
  const now = Date.now();
  const todayStr = getTodayDateString(DEFAULT_TIMEZONE);
  const resetTimestamp = getNextResetTimestamp(DEFAULT_TIMEZONE);
  const retryAfterSeconds = Math.max(1, Math.ceil((resetTimestamp - now) / 1000));

  const db = getDatabase();

  if (db) {
    try {
      db.exec("BEGIN IMMEDIATE;");
      let row = db
        .prepare("SELECT * FROM user_credits WHERE user_id = ?")
        .get(cleanId) as Record<string, unknown> | undefined;

      // Also check if user can be recognized by hardwareHash if anonymous session is empty
      if (!row && options?.hardwareHash) {
        const hwRow = db
          .prepare("SELECT * FROM user_credits WHERE hardware_hash = ? AND last_reset_date = ?")
          .get(options.hardwareHash, todayStr) as Record<string, unknown> | undefined;
        if (hwRow) {
          row = hwRow;
        }
      }

      // Case 1: Brand new user -> Create record
      if (!row) {
        db.prepare(`
          INSERT INTO user_credits (
            user_id, daily_credit_limit, credits_used, credits_remaining,
            last_reset_date, reset_timezone, updated_at, created_at, phone, hardware_hash, last_ip
          ) VALUES (?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          cleanId,
          DEFAULT_DAILY_LIMIT,
          DEFAULT_DAILY_LIMIT,
          todayStr,
          DEFAULT_TIMEZONE,
          now,
          now,
          options?.phone || null,
          options?.hardwareHash || null,
          options?.ip || null
        );

        db.exec("COMMIT;");

        return {
          userId: cleanId,
          dailyCreditLimit: DEFAULT_DAILY_LIMIT,
          creditsUsed: 0,
          creditsRemaining: DEFAULT_DAILY_LIMIT,
          lastResetDate: todayStr,
          resetTimezone: DEFAULT_TIMEZONE,
          updatedAt: now,
          createdAt: now,
          resetTimestamp,
          retryAfterSeconds: 0,
          phone: options?.phone,
          hardwareHash: options?.hardwareHash,
          lastIp: options?.ip,
        };
      }

      // Case 2: Daily reset is due (new day in configured timezone)
      const lastReset = String(row.last_reset_date || "");
      const limit = Number(row.daily_credit_limit) || DEFAULT_DAILY_LIMIT;

      if (lastReset !== todayStr) {
        db.prepare(`
          UPDATE user_credits
          SET credits_used = 0,
              credits_remaining = daily_credit_limit,
              last_reset_date = ?,
              updated_at = ?
          WHERE user_id = ?
        `).run(todayStr, now, cleanId);

        // Record reset in audit ledger
        db.prepare(`
          INSERT INTO credit_transactions (user_id, action, amount, balance_after, reason, ip_address, created_at)
          VALUES (?, 'reset', ?, ?, 'Daily midnight reset', ?, ?)
        `).run(cleanId, limit, limit, options?.ip || null, now);

        db.exec("COMMIT;");

        return {
          userId: cleanId,
          dailyCreditLimit: limit,
          creditsUsed: 0,
          creditsRemaining: limit,
          lastResetDate: todayStr,
          resetTimezone: DEFAULT_TIMEZONE,
          updatedAt: now,
          createdAt: Number(row.created_at) || now,
          resetTimestamp,
          retryAfterSeconds: 0,
          phone: (row.phone as string) || options?.phone,
          hardwareHash: (row.hardware_hash as string) || options?.hardwareHash,
          lastIp: options?.ip,
        };
      }

      // Case 3: Existing active record
      db.exec("COMMIT;");

      const remaining = Number(row.credits_remaining);
      const used = Number(row.credits_used);

      return {
        userId: cleanId,
        dailyCreditLimit: limit,
        creditsUsed: used,
        creditsRemaining: remaining,
        lastResetDate: lastReset,
        resetTimezone: String(row.reset_timezone || DEFAULT_TIMEZONE),
        updatedAt: Number(row.updated_at) || now,
        createdAt: Number(row.created_at) || now,
        resetTimestamp,
        retryAfterSeconds: remaining <= 0 ? retryAfterSeconds : 0,
        phone: (row.phone as string) || options?.phone,
        hardwareHash: (row.hardware_hash as string) || options?.hardwareHash,
        lastIp: options?.ip,
      };
    } catch {
      try {
        db.exec("ROLLBACK;");
      } catch {
        // ignore
      }
    }
  }

  // Memory Fallback Store
  let mem = memoryCreditsStore.get(cleanId);
  if (!mem) {
    mem = {
      userId: cleanId,
      dailyCreditLimit: DEFAULT_DAILY_LIMIT,
      creditsUsed: 0,
      creditsRemaining: DEFAULT_DAILY_LIMIT,
      lastResetDate: todayStr,
      resetTimezone: DEFAULT_TIMEZONE,
      updatedAt: now,
      createdAt: now,
      resetTimestamp,
      retryAfterSeconds: 0,
      phone: options?.phone,
      hardwareHash: options?.hardwareHash,
      lastIp: options?.ip,
    };
    memoryCreditsStore.set(cleanId, mem);
    return mem;
  }

  // Check reset for memory record
  if (mem.lastResetDate !== todayStr) {
    mem.creditsUsed = 0;
    mem.creditsRemaining = mem.dailyCreditLimit;
    mem.lastResetDate = todayStr;
    mem.updatedAt = now;
  }

  mem.resetTimestamp = resetTimestamp;
  mem.retryAfterSeconds = mem.creditsRemaining <= 0 ? retryAfterSeconds : 0;
  return mem;
}

/**
 * Atomically reserves a single credit for an AI generation request.
 * Enforces:
 * 1. Daily credit limit check
 * 2. Atomic conditional decrement (credits_remaining > 0)
 * 3. Daily reset handling
 * 4. Audit ledger entry
 */
export async function reserveDailyCredit(
  userId: string,
  metadata?: { ip?: string; phone?: string; hardwareHash?: string; reason?: string }
): Promise<CreditReservationResult> {
  const cleanId = (userId || "").trim();
  const now = Date.now();
  const todayStr = getTodayDateString(DEFAULT_TIMEZONE);
  const resetTimestamp = getNextResetTimestamp(DEFAULT_TIMEZONE);
  const retryAfterSeconds = Math.max(1, Math.ceil((resetTimestamp - now) / 1000));

  const db = getDatabase();

  if (db) {
    try {
      db.exec("BEGIN IMMEDIATE;");

      let row = db
        .prepare("SELECT * FROM user_credits WHERE user_id = ?")
        .get(cleanId) as Record<string, unknown> | undefined;

      // Handle brand new user during reservation
      if (!row) {
        db.prepare(`
          INSERT INTO user_credits (
            user_id, daily_credit_limit, credits_used, credits_remaining,
            last_reset_date, reset_timezone, updated_at, created_at, phone, hardware_hash, last_ip
          ) VALUES (?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          cleanId,
          DEFAULT_DAILY_LIMIT,
          DEFAULT_DAILY_LIMIT,
          todayStr,
          DEFAULT_TIMEZONE,
          now,
          now,
          metadata?.phone || null,
          metadata?.hardwareHash || null,
          metadata?.ip || null
        );

        row = db
          .prepare("SELECT * FROM user_credits WHERE user_id = ?")
          .get(cleanId) as Record<string, unknown>;
      }

      const limit = Number(row.daily_credit_limit) || DEFAULT_DAILY_LIMIT;
      let remaining = Number(row.credits_remaining);
      let used = Number(row.credits_used);

      // Perform daily reset if date changed
      if (String(row.last_reset_date) !== todayStr) {
        remaining = limit;
        used = 0;
        db.prepare(`
          UPDATE user_credits
          SET credits_used = 0,
              credits_remaining = daily_credit_limit,
              last_reset_date = ?,
              updated_at = ?
          WHERE user_id = ?
        `).run(todayStr, now, cleanId);
      }

      // Strict check: if no credits left, reject atomically!
      if (remaining <= 0) {
        db.exec("COMMIT;");
        return {
          success: false,
          limit,
          remaining: 0,
          creditsUsed: used,
          resetTimestamp,
          retryAfterSeconds,
          reason: "Daily credit quota exhausted.",
        };
      }

      // Atomic conditional decrement: WHERE credits_remaining > 0 prevents race conditions
      const updateResult = db.prepare(`
        UPDATE user_credits
        SET credits_used = credits_used + 1,
            credits_remaining = credits_remaining - 1,
            updated_at = ?,
            last_ip = COALESCE(?, last_ip),
            phone = COALESCE(?, phone),
            hardware_hash = COALESCE(?, hardware_hash)
        WHERE user_id = ? AND credits_remaining > 0
      `).run(
        now,
        metadata?.ip || null,
        metadata?.phone || null,
        metadata?.hardwareHash || null,
        cleanId
      );

      if (updateResult.changes === 0) {
        // Concurrency collision caught: remaining was 0 by another simultaneous query
        db.exec("COMMIT;");
        return {
          success: false,
          limit,
          remaining: 0,
          creditsUsed: limit,
          resetTimestamp,
          retryAfterSeconds,
          reason: "Daily credit quota exhausted by concurrent request.",
        };
      }

      const newRemaining = remaining - 1;
      const newUsed = used + 1;

      // Write audit ledger record
      db.prepare(`
        INSERT INTO credit_transactions (user_id, action, amount, balance_after, reason, ip_address, created_at)
        VALUES (?, 'reserve', 1, ?, ?, ?, ?)
      `).run(cleanId, newRemaining, metadata?.reason || "Hairstyle Generation", metadata?.ip || null, now);

      db.exec("COMMIT;");

      return {
        success: true,
        limit,
        remaining: newRemaining,
        creditsUsed: newUsed,
        resetTimestamp,
        retryAfterSeconds: 0,
      };
    } catch (err) {
      try {
        db.exec("ROLLBACK;");
      } catch {
        // ignore
      }
      console.error("[CreditManager] Error during credit reservation:", err);
    }
  }

  // Memory fallback logic
  const record = await getUserCredits(cleanId, metadata);
  if (record.creditsRemaining <= 0) {
    return {
      success: false,
      limit: record.dailyCreditLimit,
      remaining: 0,
      creditsUsed: record.creditsUsed,
      resetTimestamp,
      retryAfterSeconds,
      reason: "Daily credit quota exhausted.",
    };
  }

  record.creditsRemaining -= 1;
  record.creditsUsed += 1;
  record.updatedAt = now;
  memoryCreditsStore.set(cleanId, record);

  return {
    success: true,
    limit: record.dailyCreditLimit,
    remaining: record.creditsRemaining,
    creditsUsed: record.creditsUsed,
    resetTimestamp,
    retryAfterSeconds: 0,
  };
}

/**
 * Atomically refunds a credit if AI generation fails (e.g. invalid photo, no face detected, timeout).
 */
export async function refundDailyCredit(
  userId: string,
  reason: string = "AI Generation Refund"
): Promise<{ success: boolean; remaining: number }> {
  const cleanId = (userId || "").trim();
  const now = Date.now();
  const db = getDatabase();

  if (db) {
    try {
      db.exec("BEGIN IMMEDIATE;");

      const row = db
        .prepare("SELECT * FROM user_credits WHERE user_id = ?")
        .get(cleanId) as Record<string, unknown> | undefined;

      if (row) {
        const limit = Number(row.daily_credit_limit) || DEFAULT_DAILY_LIMIT;
        db.prepare(`
          UPDATE user_credits
          SET credits_used = MAX(0, credits_used - 1),
              credits_remaining = MIN(daily_credit_limit, credits_remaining + 1),
              updated_at = ?
          WHERE user_id = ?
        `).run(now, cleanId);

        const updatedRow = db
          .prepare("SELECT credits_remaining FROM user_credits WHERE user_id = ?")
          .get(cleanId) as { credits_remaining: number };

        const newRemaining = updatedRow?.credits_remaining ?? 1;

        db.prepare(`
          INSERT INTO credit_transactions (user_id, action, amount, balance_after, reason, ip_address, created_at)
          VALUES (?, 'refund', 1, ?, ?, NULL, ?)
        `).run(cleanId, newRemaining, reason, now);

        db.exec("COMMIT;");
        return { success: true, remaining: newRemaining };
      }

      db.exec("COMMIT;");
    } catch (err) {
      try {
        db.exec("ROLLBACK;");
      } catch {
        // ignore
      }
      console.error("[CreditManager] Error during credit refund:", err);
    }
  }

  // Memory fallback refund
  const mem = memoryCreditsStore.get(cleanId);
  if (mem) {
    mem.creditsRemaining = Math.min(mem.dailyCreditLimit, mem.creditsRemaining + 1);
    mem.creditsUsed = Math.max(0, mem.creditsUsed - 1);
    mem.updatedAt = now;
    return { success: true, remaining: mem.creditsRemaining };
  }

  return { success: false, remaining: 0 };
}

/**
 * Concurrency guard: Ensures a single user cannot run parallel generation requests.
 */
export function acquireConcurrencyLock(userId: string): boolean {
  const cleanId = (userId || "").trim();
  if (!cleanId) return true;
  if (activeUserGenerations.has(cleanId)) {
    return false; // Already generating!
  }
  activeUserGenerations.add(cleanId);
  return true;
}

/**
 * Releases the concurrency guard once the generation request completes or errors out.
 */
export function releaseConcurrencyLock(userId: string): void {
  const cleanId = (userId || "").trim();
  activeUserGenerations.delete(cleanId);
}

/**
 * Secondary abuse prevention: Short-term request burst limiter (e.g. max 15 requests/min per IP).
 */
export function checkBurstRateLimit(
  ip: string,
  limit: number = 20,
  windowSeconds: number = 60
): BurstRateLimitResult {
  const now = Date.now();
  const key = `burst:${ip.trim()}`;
  const windowMs = windowSeconds * 1000;

  const db = getDatabase();
  if (db) {
    try {
      db.prepare("DELETE FROM rate_limit_bursts WHERE expires_at < ?").run(now);

      const row = db
        .prepare("SELECT count, expires_at FROM rate_limit_bursts WHERE key = ?")
        .get(key) as { count: number; expires_at: number } | undefined;

      if (!row) {
        const expiresAt = now + windowMs;
        db.prepare("INSERT INTO rate_limit_bursts (key, count, expires_at) VALUES (?, 1, ?)").run(
          key,
          expiresAt
        );
        return { allowed: true, limit, remaining: limit - 1, retryAfterSeconds: 0 };
      }

      if (row.count >= limit) {
        const retryAfter = Math.max(1, Math.ceil((row.expires_at - now) / 1000));
        return { allowed: false, limit, remaining: 0, retryAfterSeconds: retryAfter };
      }

      const newCount = row.count + 1;
      db.prepare("UPDATE rate_limit_bursts SET count = ? WHERE key = ?").run(newCount, key);

      return {
        allowed: true,
        limit,
        remaining: Math.max(0, limit - newCount),
        retryAfterSeconds: 0,
      };
    } catch {
      // fallback
    }
  }

  // Memory burst store fallback
  const mem = memoryBurstStore.get(key);
  if (!mem || now >= mem.expiresAt) {
    memoryBurstStore.set(key, { count: 1, expiresAt: now + windowMs });
    return { allowed: true, limit, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  if (mem.count >= limit) {
    const retryAfter = Math.max(1, Math.ceil((mem.expiresAt - now) / 1000));
    return { allowed: false, limit, remaining: 0, retryAfterSeconds: retryAfter };
  }

  mem.count += 1;
  return { allowed: true, limit, remaining: Math.max(0, limit - mem.count), retryAfterSeconds: 0 };
}
