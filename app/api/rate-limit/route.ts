import { NextResponse } from "next/server";
import { resolveUserIdentity, setSessionCookieHeader } from "../../lib/auth";
import { getUserCredits } from "../../lib/creditManager";

export const runtime = "nodejs";

/**
 * GET /api/rate-limit
 * Retrieves current daily credit quota, usage, and reset epoch for the calling user.
 * Read-only: Does NOT consume quota credits.
 * Issues a cryptographically signed HttpOnly session cookie if not present.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const phoneParam = url.searchParams.get("phone");
  const hardwareHashHeader = request.headers.get("x-hardware-hash");

  // 1. Server-side identity resolution (signed HttpOnly cookie + optional phone/hardware hash)
  const identity = resolveUserIdentity(request, phoneParam, hardwareHashHeader);

  // 2. Fetch authoritative credit balance from database
  const record = await getUserCredits(identity.userId, {
    phone: identity.cleanPhone,
    hardwareHash: identity.hardwareHash,
    ip: identity.clientIp,
  });

  const response = NextResponse.json(
    {
      userId: identity.userId,
      limit: record.dailyCreditLimit,
      remaining: record.creditsRemaining,
      creditsUsed: record.creditsUsed,
      resetTimestamp: record.resetTimestamp,
      retryAfterSeconds: record.retryAfterSeconds,
      resetTimezone: record.resetTimezone,
    },
    {
      headers: {
        "X-RateLimit-Limit": String(record.dailyCreditLimit),
        "X-RateLimit-Remaining": String(record.creditsRemaining),
        "X-RateLimit-Reset": String(Math.floor(record.resetTimestamp / 1000)),
        "X-User-Id": identity.userId,
        "Access-Control-Expose-Headers":
          "X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, X-User-Id, Retry-After",
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );

  // 3. Issue or refresh signed HttpOnly session cookie
  if (identity.isNewSession || identity.sessionToken) {
    setSessionCookieHeader(response.headers, identity.sessionToken);
  }

  return response;
}
