/**
 * Client-Side Digital Browser Fingerprinting Utility
 *
 * 100% Software-Based - Zero Physical Biometrics or Camera Required.
 * Computes a deterministic fingerprint from stable browser, hardware, and localization settings.
 *
 * Safe for Incognito Mode, CGNAT (shared Jio/Airtel mobile IPs), and all device types
 * (Laptops, Desktops, Android, iPhone).
 */

export interface VisitorIdentification {
  /** Stable primary visitor ID shared by regular and private windows on the same device */
  visitorId: string;
  /** Stable hardware and browser profile fingerprint */
  hardwareHash: string;
  /** Persistent anonymous device UUID from localStorage / cookie */
  deviceId: string;
  /** Hardware summary for diagnostic/telemetry purposes */
  meta: {
    cores: number;
    memoryGB: number;
    screen: string;
    gpuRenderer: string;
    timezone: string;
    language: string;
  };
}

const STORAGE_KEY = "_bhg_device_id";
const COOKIE_KEY = "_bhg_did";

// Memory cache for the session so fingerprint is calculated only once
let cachedIdentification: Promise<VisitorIdentification> | null = null;

/**
 * Pure JavaScript SHA-256 implementation fallback (used when crypto.subtle is unavailable)
 */
function sha256Fallback(ascii: string): string {
  function rightRotate(value: number, amount: number) {
    return (value >>> amount) | (value << (32 - amount));
  }

  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let i = 0;
  let j = 0;
  let result = "";

  const words: number[] = [];
  const asciiBitLength = ascii.length * 8;

  let hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];

  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  for (i = 0; i < ascii.length; i++) {
    const code = ascii.charCodeAt(i);
    words[i >> 2] |= (code & 0xff) << (24 - (i % 4) * 8);
  }

  words[asciiBitLength >> 5] |= 0x80 << (24 - (asciiBitLength % 32));
  words[(((asciiBitLength + 64) >> 9) << 4) + 15] = asciiBitLength;

  for (i = 0; i < words.length; i += 16) {
    const w: number[] = [];
    for (j = 0; j < 16; j++) {
      w[j] = words[i + j] || 0;
    }
    for (j = 16; j < 64; j++) {
      const s0 = rightRotate(w[j - 15], 7) ^ rightRotate(w[j - 15], 18) ^ (w[j - 15] >>> 3);
      const s1 = rightRotate(w[j - 2], 17) ^ rightRotate(w[j - 2], 19) ^ (w[j - 2] >>> 10);
      w[j] = (((w[j - 16] + s0) | 0) + ((w[j - 7] + s1) | 0)) | 0;
    }

    let [a, b, c, d, e, f, g, h] = hash;

    for (j = 0; j < 64; j++) {
      const s1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (((((h + s1) | 0) + ch) | 0) + ((k[j] + w[j]) | 0)) | 0;
      const s0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    hash[0] = (hash[0] + a) | 0;
    hash[1] = (hash[1] + b) | 0;
    hash[2] = (hash[2] + c) | 0;
    hash[3] = (hash[3] + d) | 0;
    hash[4] = (hash[4] + e) | 0;
    hash[5] = (hash[5] + f) | 0;
    hash[6] = (hash[6] + g) | 0;
    hash[7] = (hash[7] + h) | 0;
  }

  for (i = 0; i < 8; i++) {
    result += ("00000000" + (hash[i] >>> 0).toString(16)).slice(-8);
  }
  return result;
}

/**
 * Computes SHA-256 hash using native Web Crypto API with seamless JS fallback
 */
async function hashString(str: string): Promise<string> {
  if (typeof window !== "undefined" && window.crypto?.subtle?.digest) {
    try {
      const buffer = new TextEncoder().encode(str);
      const hashBuffer = await window.crypto.subtle.digest("SHA-256", buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    } catch {
      // Fallback if subtle crypto throws in restricted contexts
    }
  }
  return sha256Fallback(str);
}

/**
 * Extracts the GPU renderer for display diagnostics only; it is not part of the quota identity.
 */
function getWebGLRenderer(): string {
  try {
    if (typeof document === "undefined") {
      return "unknown";
    }
    const canvas = document.createElement("canvas");
    const gl =
      (canvas.getContext("webgl") as WebGLRenderingContext | null) ||
      (canvas.getContext("experimental-webgl") as WebGLRenderingContext | null);

    if (!gl) {
      return "unsupported";
    }

    const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || "" : "";

    return String(renderer || "standard-renderer");
  } catch {
    return "error";
  }
}

/**
 * Manages dual-layer anonymous device UUID persistence (LocalStorage + Cookie)
 */
function getOrCreateDeviceUUID(): string {
  if (typeof window === "undefined") return "server-node";

  // 1. Try LocalStorage
  try {
    const localId = localStorage.getItem(STORAGE_KEY);
    if (localId && localId.length >= 16) {
      return localId;
    }
  } catch {
    // LocalStorage blocked
  }

  // 2. Try Cookie
  try {
    const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_KEY}=([^;]*)`));
    if (match && match[1] && match[1].length >= 16) {
      const cookieId = decodeURIComponent(match[1]);
      try {
        localStorage.setItem(STORAGE_KEY, cookieId);
      } catch {
        // ignore
      }
      return cookieId;
    }
  } catch {
    // Cookie blocked
  }

  // 3. Generate New Cryptographic Device UUID
  let newId: string;
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    newId = crypto.randomUUID();
  } else {
    newId = "dev_" + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
  }

  // Persist to LocalStorage
  try {
    localStorage.setItem(STORAGE_KEY, newId);
  } catch {
    // ignore
  }

  // Persist to Cookie (1 year duration)
  try {
    const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString();
    document.cookie = `${COOKIE_KEY}=${encodeURIComponent(newId)}; expires=${expires}; path=/; SameSite=Lax`;
  } catch {
    // ignore
  }

  return newId;
}

/**
 * Primary function to calculate client visitor identification.
 * Fast, resilient, 0.01s execution with memory caching.
 */
export async function getVisitorIdentification(): Promise<VisitorIdentification> {
  if (cachedIdentification) {
    return cachedIdentification;
  }

  cachedIdentification = (async () => {
    if (typeof window === "undefined") {
      return {
        visitorId: "server-id",
        hardwareHash: "server-hw",
        deviceId: "server-dev",
        meta: {
          cores: 0,
          memoryGB: 0,
          screen: "0x0",
          gpuRenderer: "server",
          timezone: "UTC",
          language: "en",
        },
      };
    }

    const deviceId = getOrCreateDeviceUUID();

    // 1. Hardware attributes (physical laptop/phone parameters)
    const cores = navigator.hardwareConcurrency || 4;
    const memoryGB = (navigator as unknown as { deviceMemory?: number }).deviceMemory || 4;
    const touchPoints = navigator.maxTouchPoints || 0;
    const screenWidth = window.screen?.width || 0;
    const screenHeight = window.screen?.height || 0;
    const screenAvailWidth = window.screen?.availWidth || 0;
    const screenAvailHeight = window.screen?.availHeight || 0;
    const colorDepth = window.screen?.colorDepth || 24;
    const pixelRatio = window.devicePixelRatio || 1;

    // 2. Localization & OS profile
    let timezone = "UTC";
    try {
      timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    } catch {
      // fallback
    }
    const timezoneOffset = new Date().getTimezoneOffset();
    const language = navigator.language || "en";
    const languages = (navigator.languages || []).join(",");
    const platform = navigator.platform || "";

    // Rendering fingerprints can vary in private mode, so only stable browser/device
    // attributes are used for the quota identity.
    const hardwarePayload = {
      cores,
      memoryGB,
      touchPoints,
      screen: `${screenWidth}x${screenHeight}x${colorDepth}@${pixelRatio}`,
      tz: `${timezone}:${timezoneOffset}`,
      lang: `${language}:${languages}`,
      plat: platform,
      userAgent: navigator.userAgent,
    };

    const gpuRenderer = getWebGLRenderer();
    const rawHash = await hashString(JSON.stringify(hardwarePayload));
    const hardwareHash = `hw_${rawHash}`;

    // The stable hardware hash is shared between regular and private windows.
    const visitorId = hardwareHash;

    return {
      visitorId,
      hardwareHash,
      deviceId,
      meta: {
        cores,
        memoryGB,
        screen: `${screenWidth}x${screenHeight}`,
        gpuRenderer,
        timezone,
        language,
      },
    };
  })();

  return cachedIdentification;
}
