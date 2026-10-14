import { NextResponse } from "next/server";
import { getRateLimitStatus } from "@/app/lib/rateLimiter";

export const runtime = "nodejs";

/**
 * GET /api/rate-limit
 * Retrieves current rate limit quota and reset epoch for the calling visitor.
 * Read-only: Does NOT consume quota credits.
 */
export async function GET(request: Request) {
  // Extract visitor identity from headers
  const visitorId =
    request.headers.get("x-visitor-id") ||
    request.headers.get("x-hardware-hash") ||
    request.headers.get("x-device-id");

  // Extract client IP (handling proxies, CDN, CGNAT)
  const forwardedFor = request.headers.get("x-forwarded-for");
  const clientIp =
    (forwardedFor ? forwardedFor.split(",")[0].trim() : null) ||
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    "127.0.0.1";

  const identifier = visitorId || clientIp;
  const status = getRateLimitStatus(identifier);

  return NextResponse.json(
    {
      limit: status.limit,
      remaining: status.remaining,
      resetTimestamp: status.resetTimestamp,
      retryAfterSeconds: status.retryAfterSeconds,
      storageBackend: status.storageBackend,
    },
    {
      headers: {
        "X-RateLimit-Limit": String(status.limit),
        "X-RateLimit-Remaining": String(status.remaining),
        "X-RateLimit-Reset": String(Math.floor(status.resetTimestamp / 1000)),
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}
