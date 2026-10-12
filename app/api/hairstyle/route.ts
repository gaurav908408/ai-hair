import { NextResponse } from "next/server";
import OpenAI, { toFile } from "openai";

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
  endpointUrl: string,
): Promise<NextResponse> {
  const isProEndpoint = !endpointUrl.endsWith("/hairstyle-editor");

  const imageBytes = await photo.arrayBuffer();
  const mimeType = photo.type || "image/jpeg";
  const fileName = photo.name || (mimeType === "image/png" ? "portrait.png" : "portrait.jpg");

  const formData = new FormData();
  if (isProEndpoint) {
    // Hairstyle Changer Pro contract: 'image', 'hair_style', and 'task_type'="async"
    formData.append("image", new Blob([imageBytes], { type: mimeType }), fileName);
    formData.append("hair_style", hairstyle.apiId);
    formData.append("task_type", "async");
  } else {
    // Legacy Hairstyle Changer contract: 'image_target' and numeric 'hair_type'
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
      { status: 502 },
    );
  }

  const rawText = await response.text();
  let result: Record<string, unknown> | null = null;
  try {
    result = JSON.parse(rawText) as Record<string, unknown>;
  } catch {
    // Upstream returned non-JSON body
  }

  // Safe server-side telemetry: never log raw API keys or binary image contents
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

  const requestId = (result?.request_id as string | undefined) || "N/A";
  const logId = (result?.log_id as string | undefined) || "N/A";

  console.log(
    `[AILabTools] Submission Response - Status: ${response.status}, Request ID: ${requestId}, Log ID: ${logId}, Error Code: ${errorCode ?? 0}, Error Msg: ${errorMsg ?? "None"}`
  );

  // Handle immediate upstream failure (HTTP 4xx/5xx or non-zero error_code)
  if (!response.ok || (typeof result?.error_code === "number" && result.error_code !== 0)) {
    console.error(
      `[AILabTools] Submission Error Details - Status: ${response.status}, Request ID: ${requestId}, Log ID: ${logId}, Code: ${errorCode ?? "N/A"}, Msg: ${errorMsg ?? "N/A"}`
    );

    let userMessage = errorMsg || "The AI Lab hairstyle service could not process this photo.";

    if (response.status === 401 || userMessage.toLowerCase().includes("invalid api key")) {
      userMessage = "Invalid or unauthorized AILabTools API key. Please verify your AILABAPI_API_KEY configuration in Vercel.";
    } else if (
      response.status === 403 ||
      errorCode === "NO_AVAILABLE_BALANCE" ||
      userMessage.toLowerCase().includes("balance") ||
      userMessage.toLowerCase().includes("quota")
    ) {
      userMessage = "AILabTools quota or account balance exhausted. Please check your AILabTools credits.";
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

  // If sync result with immediate image
  const dataObj = result?.data as Record<string, unknown> | undefined;
  const immediateBase64 = (dataObj?.image as string | undefined) || (dataObj?.result_image as string | undefined);
  if (immediateBase64) {
    const cleanB64 = immediateBase64.replace(/^data:image\/[a-zA-Z]+;base64,/, "");
    return NextResponse.json({ image: `data:image/png;base64,${cleanB64}` });
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
        console.warn(`[AILabTools] Polling attempt ${attempt} network warning:`, msg);
        continue;
      }

      const queryRaw = await queryRes.text();
      let queryData: Record<string, unknown> | null = null;
      try {
        queryData = JSON.parse(queryRaw) as Record<string, unknown>;
      } catch {
        console.warn(`[AILabTools] Polling attempt ${attempt} non-JSON response:`, queryRaw);
        continue;
      }

      const pollErrorDetail = queryData?.error_detail as { code?: string; message?: string; code_message?: string } | undefined;
      const pollTaskStatus = queryData?.task_status as number | undefined;
      const pollErrorCode = queryData?.error_code as number | undefined;

      // Check for async task failure (task_status === 3 or non-zero error_code)
      if (pollTaskStatus === 3 || (typeof pollErrorCode === "number" && pollErrorCode !== 0)) {
        console.error(
          `[AILabTools] Async Task Failed - Task ID: ${taskId}, Status: ${pollTaskStatus}, Code: ${pollErrorCode}, Msg: ${queryData?.error_msg || pollErrorDetail?.message}`
        );
        const pollCode = pollErrorDetail?.code;
        let failMessage =
          pollErrorDetail?.message ||
          pollErrorDetail?.code_message ||
          (queryData?.error_msg as string | undefined) ||
          (queryData?.message as string | undefined) ||
          "Hairstyle processing failed.";

        if (pollCode === "ERROR_NO_FACE_IN_FILE" || failMessage.toLowerCase().includes("no face")) {
          failMessage = "No face detected in the photo. Please upload a clear, front-facing portrait.";
        }

        return NextResponse.json({ error: `AI Lab error: ${failMessage}` }, { status: 422 });
      }

      // Check for success (task_status === 2 or data with image available)
      const pollData = queryData?.data as Record<string, unknown> | undefined;
      const pollImages = pollData?.images as string[] | undefined;
      const imageUrl =
        pollImages?.[0] ||
        (pollData?.image_url as string | undefined) ||
        (pollData?.result_image as string | undefined);
      const base64Image = pollData?.image as string | undefined;

      if (pollTaskStatus === 2 || imageUrl || base64Image) {
        if (base64Image) {
          const cleanB64 = base64Image.replace(/^data:image\/[a-zA-Z]+;base64,/, "");
          return NextResponse.json({ image: `data:image/png;base64,${cleanB64}` });
        }

        if (!imageUrl) {
          return NextResponse.json(
            { error: "AI Lab returned a success status but no image URL was found." },
            { status: 502 },
          );
        }

        try {
          const imgFetch = await fetch(imageUrl, {
            signal: AbortSignal.timeout(15000),
          });
          if (!imgFetch.ok) {
            throw new Error(`Failed to download result image from CDN (HTTP ${imgFetch.status})`);
          }
          const imgBuffer = await imgFetch.arrayBuffer();
          const base64 = Buffer.from(imgBuffer).toString("base64");
          return NextResponse.json({ image: `data:image/png;base64,${base64}` });
        } catch (downloadErr: unknown) {
          const msg = downloadErr instanceof Error ? downloadErr.message : String(downloadErr);
          console.error("[AILabTools] Download generated image error:", msg);
          return NextResponse.json(
            { error: "Could not download the generated hairstyle image from AI Lab CDN." },
            { status: 502 },
          );
        }
      }
    }

    return NextResponse.json(
      { error: "Hairstyle generation timed out. Please try again with a smaller image." },
      { status: 504 },
    );
  }

  return NextResponse.json(
    { error: "The AI Lab hairstyle service returned no task or result image. Please try again." },
    { status: 502 },
  );
}

/**
 * Generate hairstyle using official OpenAI SDK (fallback provider)
 */
async function generateWithOpenAI(
  photo: File,
  hairstyle: { name: string; file: string; apiId: string },
  apiKey: string,
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
      { status: 413 },
    );
  }

  // Support all common variable naming variations and sanitize quotes / whitespace
  const rawAiLabApiKey =
    process.env.AILABAPI_API_KEY ||
    process.env.AILAB_API_KEY ||
    process.env.AI_LAB_API_KEY ||
    process.env.NEXT_PUBLIC_AILABAPI_API_KEY;

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

  // Verify at least one provider is configured
  if (!aiLabApiKey && !openAiApiKey) {
    return NextResponse.json(
      {
        error:
          "Image generation is not configured. Please ensure AILABAPI_API_KEY is configured in your environment variables.",
      },
      { status: 503 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Unable to read the submitted photo." },
      { status: 400 },
    );
  }

  const photo = form.get("photo");
  const hairstyleId = form.get("hairstyleId");
  if (!(photo instanceof File) || typeof hairstyleId !== "string") {
    return NextResponse.json(
      { error: "A photo and hairstyle selection are required." },
      { status: 400 },
    );
  }
  if (!ALLOWED_IMAGE_TYPES.has(photo.type)) {
    return NextResponse.json(
      { error: "Please upload a JPG or PNG photo." },
      { status: 415 },
    );
  }
  if (photo.size === 0 || photo.size > MAX_IMAGE_BYTES) {
    return NextResponse.json(
      { error: "The photo must be smaller than 10 MB." },
      { status: 413 },
    );
  }

  // Validate hairstyle selection against supported hairstyles
  const hairstyle = SUPPORTED_AILAB_HAIRSTYLES[hairstyleId];
  if (!hairstyle) {
    return NextResponse.json(
      {
        error:
          "Please select a valid supported hairstyle (e.g. Textured Fringe, Comb Over, Undercut Long Hair, Pompadour, Slick Back, Faux Hawk, Low Fade, High Tight Fade).",
      },
      { status: 400 },
    );
  }

  // Priority 1: Use AI Lab Hairstyle Endpoint if configured
  if (aiLabApiKey) {
    return generateWithAILab(photo, hairstyle, aiLabApiKey, aiLabEndpoint);
  }

  // Priority 2: Use OpenAI Image Generation
  if (openAiApiKey) {
    return generateWithOpenAI(photo, hairstyle, openAiApiKey);
  }

  return NextResponse.json(
    {
      error:
        "Image generation is not configured. Please ensure AILABAPI_API_KEY is configured in your environment variables.",
    },
    { status: 503 },
  );
}
