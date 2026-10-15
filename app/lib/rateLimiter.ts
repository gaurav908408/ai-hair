/**
 * Legacy Adapter for Rate Limiter
 *
 * Bridges the legacy checkAndConsumeRateLimit, getRateLimitStatus, and refundRateLimit
 * signatures to the new production-ready creditManager and SQLite database.
 */

import {
  getUserCredits,
  reserveDailyCredit,
  refundDailyCredit,
  type UserCreditRecord,
} from "./creditManager";

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTimestamp: number;
  retryAfterSeconds: number;
  storageBackend: "sqlite" | "cloud-sync" | "memory-fallback";
}

/**
 * Checks and consumes a daily credit atomically.
 */
export async function checkAndConsumeRateLimit(
  visitorId: string,
  ipAddress?: string
): Promise<RateLimitResult> {
  const cleanId = (visitorId || "").trim() || (ipAddress || "").trim() || "anonymous";
  const result = await reserveDailyCredit(cleanId, { ip: ipAddress });

  return {
    allowed: result.success,
    limit: result.limit,
    remaining: result.remaining,
    resetTimestamp: result.resetTimestamp,
    retryAfterSeconds: result.retryAfterSeconds,
    storageBackend: "sqlite",
  };
}

/**
 * Gets the current rate limit status without consuming a credit.
 */
export async function getRateLimitStatus(visitorId: string): Promise<RateLimitResult> {
  const cleanId = (visitorId || "").trim() || "anonymous";
  const record: UserCreditRecord = await getUserCredits(cleanId);

  return {
    allowed: record.creditsRemaining > 0,
    limit: record.dailyCreditLimit,
    remaining: record.creditsRemaining,
    resetTimestamp: record.resetTimestamp,
    retryAfterSeconds: record.retryAfterSeconds,
    storageBackend: "sqlite",
  };
}

/**
 * Refunds a credit if upstream processing failed.
 */
export async function refundRateLimit(visitorId: string): Promise<void> {
  const cleanId = (visitorId || "").trim();
  if (!cleanId) return;
  await refundDailyCredit(cleanId, "Legacy refundRateLimit");
}
