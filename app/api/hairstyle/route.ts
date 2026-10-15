import { NextResponse } from "next/server";
import OpenAI, { toFile } from "openai";
import {
  resolveUserIdentity,
  extractClientIp,
  setSessionCookieHeader,
} from "../../lib/auth";
import {
  reserveDailyCredit,
  refundDailyCredit,
  acquireConcurrencyLock,
  releaseConcurrencyLock,
  checkBurstRateLimit,
} from "../../lib/creditManager";

export const runtime = "nodejs";
// Allow up to 60 seconds for serverless function execution on Vercel
export const maxDuration = 60;

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png"]);

// Official AILabTools Hairstyle Editor Pro supported hairstyle IDs
export const SUPPORTED_AILAB_HAIRSTYLES: Record<
  string,
  { name: string; file: string; apiId: string; legacyId?: number }
> = {
  "comb-over": { name: "Comb Over", file: "CombOver.webp", apiId: "CombOver", legacyId: 401 },
  "faux-hawk": { name: "Faux Hawk", file: "FauxHawk.webp", apiId: "FauxHawk", legacyId: 401 },
  "high-tight-fade": { name: "High Tight Fade", file: "HighTightFade.webp", apiId: "HighTightFade", legacyId: 603 },
  "low-fade": { name: "Low Fade", file: "LowFade.webp", apiId: "LowFade", legacyId: 603 },
  pompadour: { name: "Pompadour", file: "Pompadour.webp", apiId: "Pompadour", legacyId: 401 },
  "slick-back": { name: "Slick Back", file: "SlickBack.webp", apiId: "SlickBack", legacyId: 401 },
  "textured-fringe": { name: "Textured Fringe", file: "TexturedFringe.webp", apiId: "TexturedFringe", legacyId: 101 },
  "undercut-long-hair": {
    name: "Undercut Long Hair",
    file: "UndercutLongHair copy.webp",
    apiId: "UndercutLongHair",
    legacyId: 201,
  },
  // Direct API IDs
  CombOver: { name: "Comb Over", file: "CombOver.webp", apiId: "CombOver", legacyId: 401 },
  FauxHawk: { name: "Faux Hawk", file: "FauxHawk.webp", apiId: "FauxHawk", legacyId: 401 },
  HighTightFade: { name: "High Tight Fade", file: "HighTightFade.webp", apiId: "HighTightFade", legacyId: 603 },
  LowFade: { name: "Low Fade", file: "LowFade.webp", apiId: "LowFade", legacyId: 603 },
  Pompadour: { name: "Pompadour", file: "Pompadour.webp", apiId: "Pompadour", legacyId: 401 },
  SlickBack: { name: "Slick Back", file: "SlickBack.webp", apiId: "SlickBack", legacyId: 401 },
  TexturedFringe: { name: "Textured Fringe", file: "TexturedFringe.webp", apiId: "TexturedFringe", legacyId: 101 },
  UndercutLongHair: {
    name: "Undercut Long Hair",
    file: "UndercutLongHair copy.webp",
    apiId: "UndercutLongHair",
    legacyId: 201,
  },
};

/**
 * Generate hairstyle using AILabTools Hairstyle Editor API
 */
async function generateWithAILab(
  photo: File,
  hairstyle: { name: string; file: string; apiId: string; legacyId?: number },
  apiKey: string,
  endpointUrl: string
): Promise<NextResponse> {
  const isProEndpoint = !endpointUrl.endsWith("/hairstyle-editor");

  const imageBytes = await photo.arrayBuffer();
  const mimeType = photo.type || "image/jpeg";
  const fileName = photo.name || (mimeType === "image/png" ? "portrait.png" : "portrait.jpg");

  const formData = new FormData();
  if (isProEndpoint) {
    formData.append("image", new Blob([imageBytes], { type: mimeType }), fileName);
    formData.append("hair_style", hairstyle.apiId);
    formData.append("task_type", "async");
  } else {
    formData.append("image_target", new Blob([imageBytes], { type: mimeType }), fileName);
    formData.append("hair_type", String(hairstyle.legacyId ?? 101));
  }

  let response: Response;
  try {
    response = await fetch(endpointUrl, {
      method: "POST",
      headers: {
        "ailabapi-api-key": apiKey,
      },
      body: formData,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[AILabTools] Connection error:", errorMsg);
    return NextResponse.json(
      { error: "Could not connect to the AI Lab hairstyle service. Please check your network and try again." },
      { status: 502 }
    );
  }

  const rawText = await response.text();
  let result: Record<string, unknown> | null = null;
  try {
    result = JSON.parse(rawText) as Record<string, unknown>;
  } catch {
    // Upstream returned non-JSON body
  }

  const errorCode =
    (result?.error_detail as { code?: string } | undefined)?.code ||
    (result?.error_code_str as string | undefined) ||
    (typeof result?.error_code === "number" && result.error_code !== 0
      ? String(result.error_code)
      : undefined);

  const errorMsg =
    (result?.error_detail as { message?: string; code_message?: string } | undefined)?.message ||
    (result?.error_detail as { message?: string; code_message?: string } | undefined)?.code_message ||
    (result?.error_msg as string | undefined) ||
    (result?.message as string | undefined) ||
    (result?.error as string | undefined);

  // Handle immediate upstream failure (HTTP 4xx/5xx or non-zero error_code)
  if (!response.ok || (typeof result?.error_code === "number" && result.error_code !== 0)) {
    let userMessage = errorMsg || "The AI Lab hairstyle service could not process this photo.";

    if (response.status === 401 || userMessage.toLowerCase().includes("invalid api key")) {
      userMessage = "Invalid or unauthorized AILabTools API key configuration.";
    } else if (
      response.status === 403 ||
      errorCode === "NO_AVAILABLE_BALANCE" ||
      userMessage.toLowerCase().includes("balance") ||
      userMessage.toLowerCase().includes("quota")
    ) {
      userMessage = "AILabTools service balance exhausted. Please contact system administrator.";
    } else if (response.status === 404 || errorCode === "ERROR_AI_NOT_EXISTS") {
      userMessage = `AILabTools endpoint not found or deactivated (${endpointUrl}).`;
    } else if (
      errorCode === "ERROR_NO_FACE_IN_FILE" ||
      userMessage.toLowerCase().includes("no face detected") ||
      userMessage.toLowerCase().includes("no face")
    ) {
      userMessage = "No face detected in the photo. Please upload a clear, front-facing portrait.";
    } else if (
      errorCode === "UNSUPPORTED_PARAMETER_VALUES" ||
      userMessage.toLowerCase().includes("hair_style")
    ) {
      userMessage = `Unsupported hairstyle selection: "${hairstyle.name}". Please choose another style.`;
    }

    const status = response.status >= 400 && response.status < 600 ? response.status : 422;
    return NextResponse.json({ error: `AI Lab error: ${userMessage}` }, { status });
  }

  // Helper to extract image URL or Base64 from any AILab response object
  function extractImageUrlOrBase64(data: Record<string, unknown> | undefined): {
    url?: string;
    base64?: string;
  } {
    if (!data) return {};
    // 1. Array of image URLs: standard AILabTools async output is { images: ["https://..."] }
    if (Array.isArray(data.images) && data.images.length > 0 && typeof data.images[0] === "string") {
      const val = data.images[0].trim();
      if (val.startsWith("http://") || val.startsWith("https://")) return { url: val };
      return { base64: val };
    }
    if (Array.isArray(data.image_list) && data.image_list.length > 0 && typeof data.image_list[0] === "string") {
      const val = data.image_list[0].trim();
      if (val.startsWith("http://") || val.startsWith("https://")) return { url: val };
      return { base64: val };
    }
    // 2. Direct string fields
    const candidates = [
      data.result_url,
      data.image_url,
      data.url,
      data.result_image,
      data.image,
      data.result,
    ];
    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.trim().length > 0) {
        const val = candidate.trim();
        if (val.startsWith("http://") || val.startsWith("https://")) {
          return { url: val };
        }
        if (val.startsWith("data:image/") || val.length > 200) {
          return { base64: val };
        }
      }
    }
    return {};
  }

  // If sync result with immediate image
  const dataObj = result?.data as Record<string, unknown> | undefined;
  const syncImage =
    extractImageUrlOrBase64(dataObj).url || extractImageUrlOrBase64(dataObj).base64
      ? extractImageUrlOrBase64(dataObj)
      : extractImageUrlOrBase64(result || undefined);

  if (syncImage.base64) {
    const cleanB64 = syncImage.base64.replace(/^data:image\/[a-zA-Z]+;base64,/, "");
    return NextResponse.json({ image: `data:image/png;base64,${cleanB64}` });
  }
  if (syncImage.url) {
    try {
      const imgRes = await fetch(syncImage.url);
      if (imgRes.ok) {
        const buffer = await imgRes.arrayBuffer();
        const b64 = Buffer.from(buffer).toString("base64");
        return NextResponse.json({ image: `data:image/png;base64,${b64}` });
      }
    } catch (err: unknown) {
      console.error("[AILabTools] Immediate image download error:", err);
    }
  }

  // If async task, poll query endpoint
  const taskId = result?.task_id as string | undefined;
  if (taskId) {
    const queryEndpoint = "https://www.ailabapi.com/api/common/query-async-task-result";
    const maxPollAttempts = 25; // Poll up to ~40-45 seconds
    const pollIntervalMs = 1800;

    for (let attempt = 1; attempt <= maxPollAttempts; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));

      let queryRes: Response;
      try {
        queryRes = await fetch(`${queryEndpoint}?task_id=${encodeURIComponent(taskId)}`, {
          headers: { "ailabapi-api-key": apiKey },
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[AILabTools] Polling attempt ${attempt} warning:`, msg);
        continue;
      }

      const queryRaw = await queryRes.text();
      let queryData: Record<string, unknown> | null = null;
      try {
        queryData = JSON.parse(queryRaw) as Record<string, unknown>;
      } catch {
        continue;
      }

      const pollErrorDetail = queryData?.error_detail as
        | { code?: string; message?: string; code_message?: string }
        | undefined;
      const pollTaskStatus = queryData?.task_status as number | undefined;
      const pollErrorCode = queryData?.error_code as number | undefined;

      // Check for async task failure (task_status === 3 or non-zero error_code)
      if (pollTaskStatus === 3 || (typeof pollErrorCode === "number" && pollErrorCode !== 0)) {
        const asyncErrorCode =
          pollErrorDetail?.code ||
          (queryData?.error_code_str as string | undefined) ||
          (typeof pollErrorCode === "number" ? String(pollErrorCode) : "ASYNC_ERROR");

        const asyncErrorMsg =
          pollErrorDetail?.message ||
          pollErrorDetail?.code_message ||
          (queryData?.error_msg as string | undefined) ||
          (queryData?.message as string | undefined) ||
          "Generation failed during async processing.";

        let userMessage = asyncErrorMsg;
        if (
          asyncErrorCode === "ERROR_NO_FACE_IN_FILE" ||
          asyncErrorMsg.toLowerCase().includes("no face detected") ||
          asyncErrorMsg.toLowerCase().includes("no face")
        ) {
          userMessage = "No face detected in the photo. Please upload a clear, front-facing portrait.";
        }

        return NextResponse.json({ error: `AI Lab error: ${userMessage}` }, { status: 422 });
      }

      // Check for async task completion (task_status === 2)
      if (pollTaskStatus === 2) {
        const asyncData = queryData?.data as Record<string, unknown> | undefined;
        const extracted =
          extractImageUrlOrBase64(asyncData).url || extractImageUrlOrBase64(asyncData).base64
            ? extractImageUrlOrBase64(asyncData)
            : extractImageUrlOrBase64(queryData || undefined);

        if (extracted.base64) {
          const cleanB64 = extracted.base64.replace(/^data:image\/[a-zA-Z]+;base64,/, "");
          return NextResponse.json({ image: `data:image/png;base64,${cleanB64}` });
        }

        if (extracted.url) {
          try {
            const imgRes = await fetch(extracted.url);
            if (imgRes.ok) {
              const buffer = await imgRes.arrayBuffer();
              const b64 = Buffer.from(buffer).toString("base64");
              return NextResponse.json({ image: `data:image/png;base64,${b64}` });
            }
          } catch (err: unknown) {
            console.error("[AILabTools] Image download error:", err);
          }
        }

        console.error(
          "[AILabTools] Task finished (status 2) but no image found in response:",
          JSON.stringify(queryData)
        );
        return NextResponse.json(
          { error: "Hairstyle transformation finished but no image could be retrieved." },
          { status: 502 }
        );
      }
    }

    return NextResponse.json(
      { error: "Generation timed out. Please try again with a smaller or clearer photo." },
      { status: 504 }
    );
  }

  return NextResponse.json(
    { error: "The AI service response was incomplete. Please try again." },
    { status: 502 }
  );
}

/**
 * Generate hairstyle using official OpenAI SDK (fallback provider)
 */
async function generateWithOpenAI(
  photo: File,
  hairstyle: { name: string; file: string; apiId: string },
  apiKey: string
): Promise<NextResponse> {
  const openai = new OpenAI({ apiKey });
  const photoBuffer = Buffer.from(await photo.arrayBuffer());

  try {
    const photoFile = await toFile(photoBuffer, photo.name || "input.png", {
      type: photo.type,
    });

    const prompt = `A realistic photo edit applying a ${hairstyle.name} haircut to the person in the photo. Keep the face, facial expression, skin tone, eye color, clothing, and background identical to the original photo. Seamlessly blend the ${hairstyle.name} hairstyle onto the head with natural hairline and texture.`;

    const editResponse = await openai.images.edit({
      image: photoFile,
      prompt,
      model: "dall-e-2",
      n: 1,
      size: "1024x1024",
      response_format: "b64_json",
    });

    const b64 = editResponse.data?.[0]?.b64_json;
    if (!b64) {
      throw new Error("No image data returned from OpenAI");
    }

    return NextResponse.json({ image: `data:image/png;base64,${b64}` });
  } catch (error: unknown) {
    const errObj = error as { message?: string; status?: number };
    const message =
      errObj?.message || "The OpenAI image generation service could not process this photo.";
    const status =
      typeof errObj?.status === "number" && errObj.status >= 400 && errObj.status < 600
        ? errObj.status
        : 502;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_IMAGE_BYTES * 2 + 1024 * 1024) {
    return NextResponse.json(
      { error: "The uploaded request is too large. Please use a photo smaller than 10 MB." },
      { status: 413 }
    );
  }

  // 1. Client IP & Burst Rate Limit Abuse Check
  const clientIp = extractClientIp(request);
  const burst = checkBurstRateLimit(clientIp, 20, 60);
  if (!burst.allowed) {
    return NextResponse.json(
      {
        error: "Too many requests. Please wait a moment before trying again.",
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(burst.retryAfterSeconds),
        },
      }
    );
  }

  // 2. Validate provider credentials
  const rawAiLabApiKey =
    process.env.AILABAPI_API_KEY || process.env.AILAB_API_KEY || process.env.AI_LAB_API_KEY;

  const aiLabApiKey = rawAiLabApiKey
    ? rawAiLabApiKey.trim().replace(/^["']|["']$/g, "").trim()
    : "";

  const rawEndpoint =
    process.env.AILAB_HAIRSTYLE_ENDPOINT ||
    process.env.AILAB_ENDPOINT ||
    process.env.AI_LAB_HAIRSTYLE_ENDPOINT;

  const aiLabEndpoint = (
    rawEndpoint?.trim().replace(/^["']|["']$/g, "").trim() ||
    "https://www.ailabapi.com/api/portrait/effects/hairstyle-editor-pro"
  ).trim();

  const rawOpenAiApiKey = process.env.OPENAI_API_KEY;
  const openAiApiKey = rawOpenAiApiKey
    ? rawOpenAiApiKey.trim().replace(/^["']|["']$/g, "").trim()
    : "";

  if (!aiLabApiKey && !openAiApiKey) {
    return NextResponse.json(
      {
        error:
          "Image generation is not configured. Please ensure AILABAPI_API_KEY is configured in your environment variables.",
      },
      { status: 503 }
    );
  }

  // 3. Read and validate form payload
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Unable to read the submitted photo." }, { status: 400 });
  }

  const photo = form.get("photo");
  const hairstyleId = form.get("hairstyleId");
  if (!(photo instanceof File) || typeof hairstyleId !== "string") {
    return NextResponse.json(
      { error: "A photo and hairstyle selection are required." },
      { status: 400 }
    );
  }
  if (!ALLOWED_IMAGE_TYPES.has(photo.type)) {
    return NextResponse.json({ error: "Please upload a JPG or PNG photo." }, { status: 415 });
  }
  if (photo.size === 0 || photo.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "The photo must be smaller than 10 MB." }, { status: 413 });
  }

  // Validate hairstyle selection
  const hairstyle = SUPPORTED_AILAB_HAIRSTYLES[hairstyleId];
  if (!hairstyle) {
    return NextResponse.json(
      {
        error:
          "Please select a valid supported hairstyle (e.g. Textured Fringe, Comb Over, Undercut Long Hair, Pompadour, Slick Back, Faux Hawk, Low Fade, High Tight Fade).",
      },
      { status: 400 }
    );
  }

  // 4. Server-Side Identity Resolution
  // Extract user phone (from lead modal / account) and hardware hash (secondary signal)
  const phoneInput =
    typeof form.get("phone") === "string" ? (form.get("phone") as string) : null;
  const hardwareHashInput =
    request.headers.get("x-hardware-hash") ||
    (typeof form.get("hardwareHash") === "string" ? (form.get("hardwareHash") as string) : null);

  const identity = resolveUserIdentity(request, phoneInput, hardwareHashInput);

  // 5. Concurrency Control: Prevent parallel generation requests from the same user
  const lockAcquired = acquireConcurrencyLock(identity.userId);
  if (!lockAcquired) {
    return NextResponse.json(
      {
        error: "A hairstyle generation is already in progress for your account. Please wait for it to complete.",
      },
      {
        status: 429,
        headers: {
          "Retry-After": "5",
        },
      }
    );
  }

  try {
    // 6. Database Atomic Credit Reservation: Reserve 1 credit BEFORE expensive AI operation
    const reservation = await reserveDailyCredit(identity.userId, {
      ip: identity.clientIp,
      phone: identity.cleanPhone || undefined,
      hardwareHash: identity.hardwareHash || undefined,
      reason: `Generate Hairstyle: ${hairstyle.name}`,
    });

    if (!reservation.success) {
      const waitHours = Math.ceil(reservation.retryAfterSeconds / 3600);
      const waitText =
        waitHours > 1
          ? `in ${waitHours} hours`
          : `in ${Math.max(1, Math.ceil(reservation.retryAfterSeconds / 60))} minutes`;

      const response = NextResponse.json(
        {
          error: `You have used all your daily credits (${reservation.limit}/${reservation.limit} styles used). Your credits will reset ${waitText}.`,
          rateLimit: {
            limit: reservation.limit,
            remaining: 0,
            creditsUsed: reservation.creditsUsed,
            resetTimestamp: reservation.resetTimestamp,
            retryAfterSeconds: reservation.retryAfterSeconds,
          },
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(reservation.retryAfterSeconds),
            "X-RateLimit-Limit": String(reservation.limit),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(Math.floor(reservation.resetTimestamp / 1000)),
          },
        }
      );

      if (identity.isNewSession || identity.sessionToken) {
        setSessionCookieHeader(response.headers, identity.sessionToken);
      }

      return response;
    }

    // 7. Invoke AI Model Provider
    let generationResponse: NextResponse;
    if (aiLabApiKey) {
      generationResponse = await generateWithAILab(photo, hairstyle, aiLabApiKey, aiLabEndpoint);
    } else if (openAiApiKey) {
      generationResponse = await generateWithOpenAI(photo, hairstyle, openAiApiKey);
    } else {
      await refundDailyCredit(identity.userId, "Missing AI Provider Configuration");
      return NextResponse.json(
        { error: "Image generation provider is not configured." },
        { status: 503 }
      );
    }

    // 8. Handle Failure: Refund reserved credit if AI generation failed (422, 5xx, timeouts)
    if (!generationResponse.ok) {
      const refundResult = await refundDailyCredit(
        identity.userId,
        `AI Generation Failed (${generationResponse.status})`
      );

      generationResponse.headers.set("X-RateLimit-Limit", String(reservation.limit));
      generationResponse.headers.set("X-RateLimit-Remaining", String(refundResult.remaining));
      generationResponse.headers.set(
        "X-RateLimit-Reset",
        String(Math.floor(reservation.resetTimestamp / 1000))
      );

      if (identity.isNewSession || identity.sessionToken) {
        setSessionCookieHeader(generationResponse.headers, identity.sessionToken);
      }

      return generationResponse;
    }

    // 9. Attach updated credit balance & session cookie to successful response
    generationResponse.headers.set("X-RateLimit-Limit", String(reservation.limit));
    generationResponse.headers.set("X-RateLimit-Remaining", String(reservation.remaining));
    generationResponse.headers.set(
      "X-RateLimit-Reset",
      String(Math.floor(reservation.resetTimestamp / 1000))
    );
    generationResponse.headers.set("X-User-Id", identity.userId);

    if (identity.isNewSession || identity.sessionToken) {
      setSessionCookieHeader(generationResponse.headers, identity.sessionToken);
    }

    return generationResponse;
  } finally {
    releaseConcurrencyLock(identity.userId);
  }
}
