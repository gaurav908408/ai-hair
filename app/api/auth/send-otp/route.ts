import { NextResponse } from "next/server";
import { createAndSendOtp } from "../../../lib/otpManager";
import { extractClientIp } from "../../../lib/auth";

export const runtime = "nodejs";

/**
 * POST /api/auth/send-otp
 * Dispatches a 6-digit OTP code to the provided mobile number.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { phone?: string };
    const phone = body?.phone;

    if (!phone || typeof phone !== "string") {
      return NextResponse.json(
        { error: "A valid 10-digit mobile number is required." },
        { status: 400 }
      );
    }

    const clientIp = extractClientIp(request);
    const result = await createAndSendOtp(phone, clientIp);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Unable to send verification code." },
        {
          status: 429,
          headers: result.retryAfterSeconds
            ? { "Retry-After": String(result.retryAfterSeconds) }
            : undefined,
        }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      retryAfterSeconds: result.retryAfterSeconds ?? 30,
      devOtp: result.devOtp, // Only populated in dev / test mode
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[SendOTP] Error:", msg);
    return NextResponse.json(
      { error: "Internal server error sending verification code." },
      { status: 500 }
    );
  }
}
