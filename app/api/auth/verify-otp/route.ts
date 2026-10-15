import { NextResponse } from "next/server";
import { verifySubmittedOtp } from "../../../lib/otpManager";
import {
  createSessionToken,
  setSessionCookieHeader,
} from "../../../lib/auth";
import {
  getUserCredits,
  linkSessionToCanonicalUser,
} from "../../../lib/creditManager";

export const runtime = "nodejs";

/**
 * POST /api/auth/verify-otp
 * Validates the 6-digit OTP code, issues a signed session cookie, and returns credit quota.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { phone?: string; otp?: string };
    const { phone, otp } = body || {};

    if (!phone || !otp) {
      return NextResponse.json(
        { error: "Both mobile number and verification code are required." },
        { status: 400 }
      );
    }

    const verification = await verifySubmittedOtp(phone, otp);
    if (!verification.success || !verification.phone) {
      return NextResponse.json(
        { error: verification.error || "Invalid verification code." },
        { status: 400 }
      );
    }

    const cleanPhone = verification.phone;
    const canonicalUserId = `user:phone:${cleanPhone}`;

    // Create verified session token
    const sessionToken = createSessionToken(canonicalUserId);

    // Link session to phone account in DB
    linkSessionToCanonicalUser(canonicalUserId, canonicalUserId, cleanPhone);

    // Fetch authoritative credit balance for this phone account
    const credits = await getUserCredits(canonicalUserId, { phone: cleanPhone });

    const response = NextResponse.json({
      success: true,
      verified: true,
      phone: cleanPhone,
      verificationToken: verification.verificationToken,
      credits: {
        limit: credits.dailyCreditLimit,
        remaining: credits.creditsRemaining,
        creditsUsed: credits.creditsUsed,
        resetTimestamp: credits.resetTimestamp,
        retryAfterSeconds: credits.retryAfterSeconds,
      },
    });

    // Attach secure HttpOnly cookie
    setSessionCookieHeader(response.headers, sessionToken);

    return response;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[VerifyOTP] Error:", msg);
    return NextResponse.json(
      { error: "Internal server error verifying code." },
      { status: 500 }
    );
  }
}
