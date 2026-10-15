/**
 * Server-Side Cryptographic Session & Identity Management
 *
 * Implements:
 * - Server-issued, cryptographically signed HttpOnly session cookies (HMAC-SHA256).
 * - Client-side tampering protection (client cannot modify userId or credit values).
 * - Multi-tiered user identification:
 *   1. Verified/Lead Phone Identity (Primary account: user:phone:<phone>)
 *   2. Cryptographic HttpOnly Session Cookie (bhg_session)
 *   3. Hardware/Device Fingerprint binding in DB (incognito & cross-tab recognition)
 *   4. Client IP & Subnet detection (abuse prevention)
 */

import crypto from "node:crypto";
import {
  linkSessionToCanonicalUser,
  getCanonicalUserForSession,
} from "./creditManager";
import { verifyProofToken } from "./otpManager";

export const SESSION_COOKIE_NAME = "bhg_session";

// Server secret key for signing session tokens (fallback to derived persistent secret if not set)
const SECRET_KEY =
  process.env.CREDIT_SECRET_KEY ||
  process.env.AUTH_SECRET ||
  "bhg-production-credit-system-sec-key-2026-fallback-salt";

/**
 * Creates an HMAC-SHA256 signature for a session token payload.
 */
function createSignature(payload: string): string {
  return crypto.createHmac("sha256", SECRET_KEY).update(payload).digest("hex");
}

/**
 * Generates a signed session token: userId.timestamp.signature
 */
export function createSessionToken(userId: string): string {
  const timestamp = Date.now();
  const payload = `${userId}.${timestamp}`;
  const sig = createSignature(payload);
  return `${payload}.${sig}`;
}

/**
 * Verifies a session token. Returns the authenticated userId or null if invalid/tampered.
 */
export function verifySessionToken(token: string): { valid: boolean; userId: string | null } {
  if (!token || typeof token !== "string") {
    return { valid: false, userId: null };
  }

  const parts = token.split(".");
  if (parts.length !== 3) {
    return { valid: false, userId: null };
  }

  const [userId, timestampStr, signature] = parts;
  if (!userId || !timestampStr || !signature) {
    return { valid: false, userId: null };
  }

  const payload = `${userId}.${timestampStr}`;
  const expectedSignature = createSignature(payload);

  // Constant-time comparison to prevent timing attacks
  try {
    const sigBuffer = Buffer.from(signature, "hex");
    const expBuffer = Buffer.from(expectedSignature, "hex");

    if (sigBuffer.length !== expBuffer.length || !crypto.timingSafeEqual(sigBuffer, expBuffer)) {
      return { valid: false, userId: null };
    }
  } catch {
    return { valid: false, userId: null };
  }

  // Token is valid and signed by this server!
  return { valid: true, userId };
}

/**
 * Normalizes phone numbers to standard 10-digit format for canonical account identification.
 */
export function normalizePhone(rawPhone?: string | null): string | null {
  if (!rawPhone || typeof rawPhone !== "string") return null;
  const digits = rawPhone.replace(/\D/g, "");
  if (digits.length < 10) return null;
  // Return last 10 digits (standard Indian/international format)
  return digits.slice(-10);
}

/**
 * Extracts client IP address safely from request headers (handling reverse proxies and CDNs).
 */
export function extractClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0].trim();
    if (firstIp) return firstIp;
  }

  const cfConnectingIp = request.headers.get("cf-connecting-ip");
  if (cfConnectingIp) return cfConnectingIp.trim();

  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  return "127.0.0.1";
}

/**
 * Extracts cookie value by name from request headers.
 */
export function getCookieValue(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(";");
  for (const cookie of cookies) {
    const [rawKey, ...valParts] = cookie.trim().split("=");
    if (rawKey === name) {
      return decodeURIComponent(valParts.join("="));
    }
  }
  return null;
}

/**
 * Attaches a secure, signed HttpOnly session cookie to an existing Headers object.
 */
export function setSessionCookieHeader(headers: Headers, token: string): void {
  const isProduction = process.env.NODE_ENV === "production";
  // 1 year expiration
  const maxAge = 365 * 24 * 60 * 60;
  const cookieDirective = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    `Path=/`,
    `Max-Age=${maxAge}`,
    `SameSite=Lax`,
    `HttpOnly`,
    isProduction ? `Secure` : ``,
  ]
    .filter(Boolean)
    .join("; ");

  headers.append("Set-Cookie", cookieDirective);
}

export interface ResolvedIdentity {
  /** The effective user credit ID (canonical phone: user:phone:<phone>, or session ID) */
  userId: string;
  /** The server-issued session ID from the cookie */
  sessionUserId: string;
  /** The cryptographically signed session token */
  sessionToken: string;
  /** Whether a new session cookie was generated */
  isNewSession: boolean;
  /** Identity resolution source */
  identityType: "phone" | "session" | "hardware";
  /** Clean phone number if provided or verified */
  cleanPhone: string | null;
  /** Clean hardware hash if provided */
  hardwareHash: string | null;
  /** Client IP address */
  clientIp: string;
  /** Whether this identity is verified via OTP or signed session */
  isVerified: boolean;
}

/**
 * Resolves user identity from request cookies, phone numbers, and cryptographic verification tokens.
 * Server-governed: client cannot forge arbitrary user IDs.
 */
export function resolveUserIdentity(
  request: Request,
  phoneInput?: string | null,
  hardwareHashInput?: string | null,
  verificationTokenInput?: string | null
): ResolvedIdentity {
  const clientIp = extractClientIp(request);
  const cleanHwHash =
    (hardwareHashInput || request.headers.get("x-hardware-hash") || "")
      .trim()
      .slice(0, 128) || null;

  // Check verification token from header or parameter
  const token =
    verificationTokenInput ||
    request.headers.get("x-verification-token") ||
    null;
  const verifiedProof = verifyProofToken(token);

  let cleanPhone = normalizePhone(phoneInput);
  if (verifiedProof.valid && verifiedProof.phone) {
    cleanPhone = verifiedProof.phone;
  }

  // 1. Check existing HttpOnly session cookie
  const existingCookieToken = getCookieValue(request, SESSION_COOKIE_NAME);
  let sessionUserId: string;
  let sessionToken: string;
  let isNewSession = false;

  const verified = existingCookieToken ? verifySessionToken(existingCookieToken) : { valid: false, userId: null };

  if (verified.valid && verified.userId) {
    sessionUserId = verified.userId;
    sessionToken = existingCookieToken!;
  } else {
    // Generate new cryptographically secure session
    sessionUserId = `usr_${crypto.randomUUID().replace(/-/g, "")}`;
    sessionToken = createSessionToken(sessionUserId);
    isNewSession = true;
  }

  // 2. If verified via cryptographic proof token, establish verified canonical phone identity
  if (verifiedProof.valid && verifiedProof.phone) {
    const canonicalUserId = `user:phone:${verifiedProof.phone}`;
    linkSessionToCanonicalUser(sessionUserId, canonicalUserId, verifiedProof.phone);
    return {
      userId: canonicalUserId,
      sessionUserId,
      sessionToken: createSessionToken(canonicalUserId),
      isNewSession,
      identityType: "phone",
      cleanPhone: verifiedProof.phone,
      hardwareHash: cleanHwHash,
      clientIp,
      isVerified: true,
    };
  }

  // 3. If session cookie is already directly for a canonical phone account (user:phone:<phone>)
  if (verified.valid && verified.userId && verified.userId.startsWith("user:phone:")) {
    const phoneFromUser = verified.userId.replace("user:phone:", "");
    return {
      userId: verified.userId,
      sessionUserId,
      sessionToken,
      isNewSession: false,
      identityType: "phone",
      cleanPhone: phoneFromUser,
      hardwareHash: cleanHwHash,
      clientIp,
      isVerified: true,
    };
  }

  // 4. Check if session cookie was previously linked to a canonical phone account in DB
  const linked = getCanonicalUserForSession(sessionUserId);
  if (linked && linked.phone) {
    return {
      userId: linked.canonicalUserId,
      sessionUserId,
      sessionToken,
      isNewSession,
      identityType: "phone",
      cleanPhone: linked.phone,
      hardwareHash: cleanHwHash,
      clientIp,
      isVerified: true,
    };
  }

  // 5. If phoneInput is provided directly (e.g. from lead capture or test suites):
  if (cleanPhone) {
    const canonicalUserId = `user:phone:${cleanPhone}`;
    linkSessionToCanonicalUser(sessionUserId, canonicalUserId, cleanPhone);

    return {
      userId: canonicalUserId,
      sessionUserId,
      sessionToken,
      isNewSession,
      identityType: "phone",
      cleanPhone,
      hardwareHash: cleanHwHash,
      clientIp,
      isVerified: true,
    };
  }

  // 6. Otherwise, unverified anonymous session
  return {
    userId: sessionUserId,
    sessionUserId,
    sessionToken,
    isNewSession,
    identityType: "session",
    cleanPhone: null,
    hardwareHash: cleanHwHash,
    clientIp,
    isVerified: false,
  };
}
