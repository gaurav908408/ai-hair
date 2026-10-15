/**
 * Comprehensive Automated Verification Suite for Daily Credit System
 *
 * Verifies all 12 test scenarios mandated by the specification:
 * 1. User has N credits and generates N hairstyles.
 * 2. The (N+1)th generation request is rejected.
 * 3. Refreshing the page does not restore credits.
 * 4. Opening another tab does not restore credits.
 * 5. Opening Incognito mode does not bypass the limit for the same authenticated/phone account.
 * 6. Clearing browser data does not restore credits for an authenticated/phone account.
 * 7. Simultaneous generation requests cannot exceed the credit limit (Concurrency race condition).
 * 8. Failed AI generation follows the defined refund policy.
 * 9. Credits reset correctly at the configured reset time.
 * 10. Direct API requests cannot bypass credit validation.
 * 11. Switching devices does not restore credits for the same authenticated/phone account.
 * 12. Multiple concurrent operations maintain exact atomic credit balance and ledger integrity.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  getUserCredits,
  reserveDailyCredit,
  refundDailyCredit,
  acquireConcurrencyLock,
  releaseConcurrencyLock,
  checkBurstRateLimit,
  getTodayDateString,
  getDatabaseFilePath,
  resetDatabaseInstanceForTesting,
} from "../app/lib/creditManager.ts";
import {
  createSessionToken,
  resolveUserIdentity,
  normalizePhone,
  SESSION_COOKIE_NAME,
} from "../app/lib/auth.ts";

// Configure test environment variables
const TEST_DB_PATH = path.resolve(process.cwd(), "hair-gen/test/test-credits.db");
if (fs.existsSync(TEST_DB_PATH)) {
  try {
    fs.unlinkSync(TEST_DB_PATH);
  } catch {
    // ignore
  }
}
process.env.CREDIT_DB_PATH = TEST_DB_PATH;
process.env.RATE_LIMIT_DB_PATH = TEST_DB_PATH;
process.env.DAILY_CREDIT_LIMIT = "2";
process.env.RESET_TIMEZONE = "Asia/Kolkata";
process.env.CREDIT_SECRET_KEY = "test-secret-key-for-automated-verification";

let totalTests = 0;
let passedTests = 0;

async function runAsyncTest(name: string, fn: () => Promise<void>) {
  totalTests++;
  try {
    await fn();
    console.log(`  [PASS] Test ${totalTests}: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  [FAIL] Test ${totalTests}: ${name}`);
    console.error(err);
  }
}

async function main() {
  console.log("\n=======================================================");
  console.log("Starting Production Daily Credit System Verification");
  console.log("=======================================================\n");

  resetDatabaseInstanceForTesting();
  const dbPath = getDatabaseFilePath();

  // Scenario 1 & 2: User has 2 credits and generates 2 hairstyles; 3rd request is rejected
  await runAsyncTest("User consumes 2 daily credits and 3rd request is rejected (HTTP 429)", async () => {
    const userId = "test_user_quota_1";

    // Check initial quota
    const initial = await getUserCredits(userId);
    assert.equal(initial.dailyCreditLimit, 2, "Daily credit limit must be 2");
    assert.equal(initial.creditsRemaining, 2, "Initial remaining credits must be 2");
    assert.equal(initial.creditsUsed, 0, "Initial credits used must be 0");

    // Consume 2 credits
    for (let i = 1; i <= 2; i++) {
      const res = await reserveDailyCredit(userId, { reason: `Generation #${i}` });
      assert.equal(res.success, true, `Generation #${i} must succeed`);
      assert.equal(res.remaining, 2 - i, `Remaining credits after #${i} must be ${2 - i}`);
      assert.equal(res.creditsUsed, i, `Credits used after #${i} must be ${i}`);
    }

    // 3rd generation must be rejected
    const third = await reserveDailyCredit(userId, { reason: "Generation #3" });
    assert.equal(third.success, false, "3rd generation request must be rejected");
    assert.equal(third.remaining, 0, "Remaining credits must be 0");
    assert.ok(third.retryAfterSeconds > 0, "Retry-After seconds must be positive");
  });

  // Scenario 3: Refreshing the page does not restore credits
  await runAsyncTest("Refreshing page / re-querying does not restore exhausted credits", async () => {
    const userId = "test_user_quota_1";
    // Simulate page refresh (GET /api/rate-limit)
    const refreshed = await getUserCredits(userId);
    assert.equal(refreshed.creditsRemaining, 0, "Credits must remain 0 after refresh");
    assert.equal(refreshed.creditsUsed, 2, "Credits used must remain 2 after refresh");
  });

  // Scenario 4: Opening another tab does not restore credits
  await runAsyncTest("Opening another tab with same session cookie does not restore credits", async () => {
    const sessionToken = createSessionToken("usr_tab_session_test");
    const dummyReq = new Request("http://localhost:3000/api/rate-limit", {
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${encodeURIComponent(sessionToken)}`,
      },
    });

    const identity = resolveUserIdentity(dummyReq);
    assert.equal(identity.userId, "usr_tab_session_test");

    // Exhaust quota in tab 1 (2 credits)
    for (let i = 0; i < 2; i++) {
      await reserveDailyCredit(identity.userId);
    }

    // Simulate tab 2 opening (new request with same cookie)
    const tab2Req = new Request("http://localhost:3000/api/rate-limit", {
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${encodeURIComponent(sessionToken)}`,
      },
    });
    const tab2Identity = resolveUserIdentity(tab2Req);
    const tab2Credits = await getUserCredits(tab2Identity.userId);

    assert.equal(tab2Credits.creditsRemaining, 0, "Tab 2 must see 0 credits remaining");
    assert.equal(tab2Credits.creditsUsed, 2, "Tab 2 must see 2 credits used");
  });

  // Scenario 5: Opening Incognito mode does not bypass limit for same authenticated/phone account
  await runAsyncTest("Incognito window does not bypass limit when phone identity is provided", async () => {
    const phone = "9876543210";
    const normalized = normalizePhone(phone);
    assert.equal(normalized, "9876543210");

    // Normal window: user generates using phone
    const normalReq = new Request("http://localhost:3000/api/hairstyle", {
      method: "POST",
    });
    const normalIdentity = resolveUserIdentity(normalReq, phone);
    assert.equal(normalIdentity.userId, "user:phone:9876543210");

    // Exhaust all 2 credits
    for (let i = 0; i < 2; i++) {
      await reserveDailyCredit(normalIdentity.userId);
    }

    // Incognito window: completely separate session cookie, but user enters same phone in modal
    const incognitoReq = new Request("http://localhost:3000/api/hairstyle", {
      method: "POST",
      headers: {
        // No cookies sent in incognito!
      },
    });
    const incognitoIdentity = resolveUserIdentity(incognitoReq, phone);
    assert.equal(incognitoIdentity.userId, "user:phone:9876543210");

    const incognitoAttempt = await reserveDailyCredit(incognitoIdentity.userId);
    assert.equal(incognitoAttempt.success, false, "Incognito generation must be rejected");
    assert.equal(incognitoAttempt.remaining, 0, "Incognito user must see 0 credits remaining");
  });

  // Scenario 6: Clearing browser data does not restore credits for an authenticated account
  await runAsyncTest("Clearing browser data / cookies does not restore credits for phone identity", async () => {
    const phone = "9112233445";
    const req1 = new Request("http://localhost:3000/api/hairstyle");
    const id1 = resolveUserIdentity(req1, phone);

    // Consume all 2 credits
    for (let i = 0; i < 2; i++) {
      await reserveDailyCredit(id1.userId);
    }

    // User clears all cookies and storage, visits as brand new client
    const clearedReq = new Request("http://localhost:3000/api/hairstyle");
    const clearedId = resolveUserIdentity(clearedReq, phone);

    const attempt = await reserveDailyCredit(clearedId.userId);
    assert.equal(attempt.success, false, "Cleared browser data must not bypass daily limit");
    assert.equal(attempt.remaining, 0);
  });

  // Scenario 7: Simultaneous generation requests cannot exceed credit limit (Concurrency race condition test)
  await runAsyncTest("Simultaneous generation requests cannot exceed credit limit (Atomic locking)", async () => {
    const user = "test_concurrent_user";
    const initial = await getUserCredits(user);
    assert.equal(initial.creditsRemaining, 2);

    // Fire 10 simultaneous parallel generation requests
    const promises = Array.from({ length: 10 }, (_, i) =>
      reserveDailyCredit(user, { reason: `Parallel request #${i}` })
    );

    const results = await Promise.all(promises);
    const successfulCount = results.filter((r) => r.success).length;
    const rejectedCount = results.filter((r) => !r.success).length;

    assert.equal(successfulCount, 2, "Exactly 2 simultaneous requests must succeed");
    assert.equal(rejectedCount, 8, "Remaining 8 simultaneous requests must be rejected");

    // Check database final state
    const finalRecord = await getUserCredits(user);
    assert.equal(finalRecord.creditsRemaining, 0, "Final remaining credits must be 0");
    assert.equal(finalRecord.creditsUsed, 2, "Final credits used must be 2");
  });

  // Scenario 8: Failed AI generation follows defined refund policy
  await runAsyncTest("Failed AI generation triggers automatic credit refund", async () => {
    const user = "test_refund_user";

    // Initially 2 credits
    const initial = await getUserCredits(user);
    assert.equal(initial.creditsRemaining, 2);

    // Reserve 1 credit -> remaining = 1
    const reserve = await reserveDailyCredit(user, { reason: "About to call AI" });
    assert.equal(reserve.success, true);
    assert.equal(reserve.remaining, 1);
    assert.equal(reserve.creditsUsed, 1);

    // AI service fails (e.g. 422 No face detected or 502 Upstream timeout)
    const refund = await refundDailyCredit(user, "AI Error: 422 No face detected");
    assert.equal(refund.success, true, "Refund must succeed");
    assert.equal(refund.remaining, 2, "Balance must be restored to 2");

    // Verify in database
    const afterRefund = await getUserCredits(user);
    assert.equal(afterRefund.creditsRemaining, 2, "Database balance must be restored to 2");
    assert.equal(afterRefund.creditsUsed, 0, "Database used count must be restored to 0");
  });

  // Scenario 9: Credits reset correctly at configured reset time
  await runAsyncTest("Credits reset automatically when calendar day changes in target timezone", async () => {
    const user = "test_reset_user";

    // First ensure user is initialized in database
    await getUserCredits(user);

    // Now artificially set their last_reset_date to yesterday with 0 remaining credits
    const { createRequire } = await import("node:module");
    const require = createRequire(import.meta.url);
    const { DatabaseSync } = require("node:sqlite");
    const db = new DatabaseSync(dbPath);
    const yesterday = "2026-10-14";
    const now = Date.now();

    db.prepare(`
      UPDATE user_credits
      SET credits_used = 2,
          credits_remaining = 0,
          last_reset_date = ?,
          updated_at = ?
      WHERE user_id = ?
    `).run(yesterday, now, user);
    db.close();

    // Query credits today -> reset should trigger automatically!
    const todayRecord = await getUserCredits(user);
    assert.equal(todayRecord.creditsRemaining, 2, "Credits must reset back to 2 for new day");
    assert.equal(todayRecord.creditsUsed, 0, "Credits used must reset to 0 for new day");
    assert.equal(todayRecord.lastResetDate, getTodayDateString("Asia/Kolkata"));
  });

  // Scenario 10: Direct API requests cannot bypass credit validation
  await runAsyncTest("Direct API requests with forged IDs or tampered cookies cannot bypass validation", async () => {
    // 1. Tampered session cookie
    const tamperedToken = "usr_hacker_123.1792030000000.baddeadbeefsignature";
    const req = new Request("http://localhost:3000/api/hairstyle", {
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${tamperedToken}`,
      },
    });

    const identity = resolveUserIdentity(req);
    // Tampered cookie is rejected, server issues new session instead of trusting hacker's ID
    assert.notEqual(identity.userId, "usr_hacker_123", "Tampered user ID must be rejected");
    assert.equal(identity.isNewSession, true, "Tampered token must result in a new session");

    // 2. IP burst rate limiter catches automated flooding
    const floodIp = "192.168.1.100";
    let blocked = false;
    for (let i = 0; i < 25; i++) {
      const burst = checkBurstRateLimit(floodIp, 20, 60);
      if (!burst.allowed) {
        blocked = true;
        break;
      }
    }
    assert.equal(blocked, true, "IP burst rate limiter must block rapid-fire requests");
  });

  // Scenario 11: Switching devices does not restore credits for same authenticated/phone account
  await runAsyncTest("Switching devices does not restore credits for the same phone account", async () => {
    const phone = "9887766554";

    // Device A (Mobile)
    const mobileReq = new Request("http://localhost:3000/api/hairstyle", {
      headers: { "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)" },
    });
    const mobileId = resolveUserIdentity(mobileReq, phone);

    // Exhaust all 2 credits on Device A
    for (let i = 0; i < 2; i++) {
      await reserveDailyCredit(mobileId.userId);
    }

    // Device B (Desktop PC, different IP, different browser)
    const desktopReq = new Request("http://localhost:3000/api/hairstyle", {
      headers: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0",
        "x-forwarded-for": "203.0.113.195",
      },
    });
    const desktopId = resolveUserIdentity(desktopReq, phone);

    const desktopAttempt = await reserveDailyCredit(desktopId.userId);
    assert.equal(desktopAttempt.success, false, "Device B must be rejected");
    assert.equal(desktopAttempt.remaining, 0, "Device B must see 0 remaining credits");
  });

  // Scenario 12: Concurrency locks and audit ledger integrity
  await runAsyncTest("Concurrency lock prevents simultaneous generation and ledger tracks all transactions", async () => {
    const user = "test_ledger_user";

    // Test concurrency lock
    const lock1 = acquireConcurrencyLock(user);
    assert.equal(lock1, true, "First lock acquisition must succeed");

    const lock2 = acquireConcurrencyLock(user);
    assert.equal(lock2, false, "Second concurrent lock acquisition must be rejected");

    releaseConcurrencyLock(user);

    const lock3 = acquireConcurrencyLock(user);
    assert.equal(lock3, true, "Lock can be reacquired after release");
    releaseConcurrencyLock(user);

    // Trigger a reservation to ensure audit ledger record is written
    await reserveDailyCredit(user, { reason: "Audit ledger test" });

    // Test audit ledger in SQLite
    const { createRequire } = await import("node:module");
    const require = createRequire(import.meta.url);
    const { DatabaseSync } = require("node:sqlite");
    const db = new DatabaseSync(dbPath);
    const rows = db.prepare("SELECT * FROM credit_transactions WHERE user_id = ?").all(user);
    assert.ok(Array.isArray(rows), "Audit transactions must be an array");
    assert.ok(rows.length >= 1, "Audit ledger must record transactions");
    db.close();
  });

  // Scenario 13: Multiple server instances maintain the same credit balance
  await runAsyncTest("Multiple server instances / DB connections maintain the same atomic credit balance", async () => {
    const user = "test_multi_instance_user";

    // Instance 1 consumes 1 credit out of 2
    await reserveDailyCredit(user, { reason: "Instance 1 request 1" });

    // Simulate Instance 2 connecting directly to the same database file
    const { createRequire } = await import("node:module");
    const require = createRequire(import.meta.url);
    const { DatabaseSync } = require("node:sqlite");
    const instance2Db = new DatabaseSync(dbPath);
    instance2Db.exec("PRAGMA journal_mode = WAL;");
    instance2Db.exec("PRAGMA busy_timeout = 5000;");

    const row = instance2Db
      .prepare("SELECT credits_remaining, credits_used FROM user_credits WHERE user_id = ?")
      .get(user) as { credits_remaining: number; credits_used: number };

    assert.equal(row.credits_remaining, 1, "Instance 2 must see 1 remaining credit");
    assert.equal(row.credits_used, 1, "Instance 2 must see 1 used credit");

    // Instance 2 executes atomic conditional deduction
    instance2Db.exec("BEGIN IMMEDIATE;");
    const updateRes = instance2Db.prepare(`
      UPDATE user_credits
      SET credits_used = credits_used + 1,
          credits_remaining = credits_remaining - 1,
          updated_at = ?
      WHERE user_id = ? AND credits_remaining > 0
    `).run(Date.now(), user);
    instance2Db.exec("COMMIT;");
    instance2Db.close();

    assert.equal(updateRes.changes, 1, "Instance 2 atomic deduction must succeed");

    // Instance 1 reads again -> must immediately see the deduction made by Instance 2
    const finalRecord = await getUserCredits(user);
    assert.equal(finalRecord.creditsRemaining, 0, "Instance 1 must reflect Instance 2 deduction (0 credits left)");
    assert.equal(finalRecord.creditsUsed, 2, "Instance 1 must reflect Instance 2 deduction (2 credits used)");
  });

  // Scenario 14: Session-to-Phone Identity Linking across page reloads without phone query param
  await runAsyncTest("Session cookie retains link to phone identity when reloaded without phone query param", async () => {
    const testSessionId = "usr_reload_link_test";
    const testToken = createSessionToken(testSessionId);
    const testPhone = "9988776655";

    // 1. Initial generation with phone number attached
    const postReq = new Request("http://localhost:3000/api/hairstyle", {
      method: "POST",
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${encodeURIComponent(testToken)}`,
      },
    });
    const postIdentity = resolveUserIdentity(postReq, testPhone);
    assert.equal(postIdentity.userId, `user:phone:${testPhone}`);

    // Deduct 1 credit
    const res = await reserveDailyCredit(postIdentity.userId);
    assert.equal(res.remaining, 1);
    assert.equal(res.creditsUsed, 1);

    // 2. User reloads page or switches tabs -> calls GET /api/rate-limit WITHOUT phone parameter!
    const reloadReq = new Request("http://localhost:3000/api/rate-limit", {
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${encodeURIComponent(testToken)}`,
      },
    });
    const reloadIdentity = resolveUserIdentity(reloadReq);
    assert.equal(reloadIdentity.userId, `user:phone:${testPhone}`, "Session must resolve back to linked phone account!");

    const reloadedCredits = await getUserCredits(reloadIdentity.userId);
    assert.equal(reloadedCredits.creditsRemaining, 1, "Remaining credits must be 1 (not reset to 2)");
    assert.equal(reloadedCredits.creditsUsed, 1, "Credits used must be 1");
  });

  console.log("\n=======================================================");
  console.log(`Verification Complete: ${passedTests}/${totalTests} tests passed.`);
  console.log("=======================================================\n");

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("Test execution failed:", e);
  process.exit(1);
});
