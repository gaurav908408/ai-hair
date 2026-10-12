import { NextResponse } from "next/server";
import OpenAI, { toFile } from "openai";

export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png"]);

// Official AILabTools Hairstyle Editor Pro supported hairstyle IDs
export const SUPPORTED_AILAB_HAIRSTYLES: Record<string, { name: string; file: string; apiId: string }> = {
  "comb-over": { name: "Comb Over", file: "CombOver.webp", apiId: "CombOver" },
  "faux-hawk": { name: "Faux Hawk", file: "FauxHawk.webp", apiId: "FauxHawk" },
  "high-tight-fade": { name: "High Tight Fade", file: "HighTightFade.webp", apiId: "HighTightFade" },
  "low-fade": { name: "Low Fade", file: "LowFade.webp", apiId: "LowFade" },
  pompadour: { name: "Pompadour", file: "Pompadour.webp", apiId: "Pompadour" },
  "slick-back": { name: "Slick Back", file: "SlickBack.webp", apiId: "SlickBack" },
  "textured-fringe": { name: "Textured Fringe", file: "TexturedFringe.webp", apiId: "TexturedFringe" },
  "undercut-long-hair": {
    name: "Undercut Long Hair",
    file: "UndercutLongHair copy.webp",
    apiId: "UndercutLongHair",
  },
  // Direct API IDs
  CombOver: { name: "Comb Over", file: "CombOver.webp", apiId: "CombOver" },
  FauxHawk: { name: "Faux Hawk", file: "FauxHawk.webp", apiId: "FauxHawk" },
  HighTightFade: { name: "High Tight Fade", file: "HighTightFade.webp", apiId: "HighTightFade" },
  LowFade: { name: "Low Fade", file: "LowFade.webp", apiId: "LowFade" },
  Pompadour: { name: "Pompadour", file: "Pompadour.webp", apiId: "Pompadour" },
  SlickBack: { name: "Slick Back", file: "SlickBack.webp", apiId: "SlickBack" },
  TexturedFringe: { name: "Textured Fringe", file: "TexturedFringe.webp", apiId: "TexturedFringe" },
  UndercutLongHair: {
    name: "Undercut Long Hair",
    file: "UndercutLongHair copy.webp",
    apiId: "UndercutLongHair",
  },
};

/**
 * Generate hairstyle using AILabTools Hairstyle Editor API
 */
async function generateWithAILab(
  photo: File,
  hairstyle: { name: string; file: string; apiId: string },
  apiKey: string,
  endpointUrl: string,
): Promise<NextResponse> {
  const imageBytes = await photo.arrayBuffer();
  const formData = new FormData();
  formData.append(
    "image",
    new Blob([imageBytes], { type: photo.type }),
    photo.name || "portrait.jpg",
  );
  // Important: The parameter name MUST be "hair_style" (not hair_type)
  // and the value must be a valid supported hairstyle ID like "TexturedFringe"
  formData.append("hair_style", hairstyle.apiId);

  let response: Response;
  try {
    response = await fetch(endpointUrl, {
      method: "POST",
      headers: {
        "ailabapi-api-key": apiKey,
      },
      body: formData,
    });
  } catch (err) {
    console.error("AI Lab connection error:", err);
    return NextResponse.json(
      { error: "Could not connect to the AI Lab hairstyle service. Please check your network and try again." },
      { status: 502 },
    );
  }

  const result = (await response.json().catch(() => null)) as {
    error_code?: number;
    error_code_str?: string;
    error_msg?: string;
    error_detail?: {
      code?: string;
      message?: string;
      code_message?: string;
    };
    task_id?: string;
    task_type?: string;
    data?: {
      image_url?: string;
      images?: string[];
      image?: string;
      result_image?: string;
    };
  } | null;

  // Handle immediate 422 or API submission error
  if (!response.ok || (result && result.error_code && result.error_code !== 0)) {
    console.error("AI Lab API Error Response:", JSON.stringify(result, null, 2));

    const errorCode = result?.error_detail?.code || result?.error_code_str;
    let userMessage = result?.error_detail?.message || result?.error_msg || "The AI Lab hairstyle service could not process this photo.";

    if (errorCode === "ERROR_NO_FACE_IN_FILE" || userMessage.toLowerCase().includes("no face detected")) {
      userMessage = "No face detected in the photo. Please upload a clear, front-facing portrait.";
    } else if (errorCode === "UNSUPPORTED_PARAMETER_VALUES" || userMessage.toLowerCase().includes("hair_style")) {
      userMessage = `Unsupported hairstyle selection: "${hairstyle.name}". Please choose another style.`;
    }

    const status = response.status >= 400 && response.status < 600 ? response.status : 422;
    return NextResponse.json({ error: `AI Lab error: ${userMessage}` }, { status });
  }

  // If sync result with immediate image
  const immediateBase64 = result?.data?.image || result?.data?.result_image;
  if (immediateBase64) {
    const cleanB64 = immediateBase64.replace(/^data:image\/[a-zA-Z]+;base64,/, "");
    return NextResponse.json({ image: `data:image/png;base64,${cleanB64}` });
  }

  // If async task, poll query endpoint
  if (result?.task_id) {
    const taskId = result.task_id;
    const queryEndpoint = "https://www.ailabapi.com/api/common/query-async-task-result";
    const maxPollAttempts = 25; // Poll up to ~40-50 seconds
    const pollIntervalMs = 1800;

    for (let attempt = 1; attempt <= maxPollAttempts; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));

      let queryRes: Response;
      try {
        queryRes = await fetch(`${queryEndpoint}?task_id=${encodeURIComponent(taskId)}`, {
          headers: { "ailabapi-api-key": apiKey },
        });
      } catch (err) {
        console.error(`AI Lab polling attempt ${attempt} network error:`, err);
        continue;
      }

      const queryData = (await queryRes.json().catch(() => null)) as {
        task_status?: number; // 0: queued, 1: processing, 2: success, 3: failed
        error_code?: number;
        error_detail?: { code?: string; message?: string };
        error_msg?: string;
        data?: {
          images?: string[];
          image_url?: string;
          result_image?: string;
        };
      } | null;

      // Check for failure
      if (queryData?.task_status === 3 || (queryData?.error_code && queryData.error_code !== 0)) {
        console.error("AI Lab task failed:", JSON.stringify(queryData, null, 2));
        const errorCode = queryData?.error_detail?.code;
        let failMessage = queryData?.error_detail?.message || queryData?.error_msg || "Hairstyle processing failed.";

        if (errorCode === "ERROR_NO_FACE_IN_FILE" || failMessage.toLowerCase().includes("no face")) {
          failMessage = "No face detected in the photo. Please upload a clear, front-facing portrait.";
        }

        return NextResponse.json({ error: `AI Lab error: ${failMessage}` }, { status: 422 });
      }

      // Check for success (task_status === 2 or data with image available)
      const imageUrl =
        queryData?.data?.images?.[0] ||
        queryData?.data?.image_url;

      if (queryData?.task_status === 2 || imageUrl) {
        if (!imageUrl) {
          return NextResponse.json(
            { error: "AI Lab returned a success status but no image URL was found." },
            { status: 502 },
          );
        }

        try {
          const imgFetch = await fetch(imageUrl);
          if (!imgFetch.ok) {
            throw new Error(`Failed to download result image from ${imageUrl}`);
          }
          const imgBuffer = await imgFetch.arrayBuffer();
          const base64 = Buffer.from(imgBuffer).toString("base64");
          return NextResponse.json({ image: `data:image/png;base64,${base64}` });
        } catch (downloadErr) {
          console.error("Download generated image error:", downloadErr);
          return NextResponse.json(
            { error: "Could not download the generated hairstyle image from AI Lab." },
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
    { error: "The AI Lab hairstyle service returned no result image. Please try again." },
    { status: 502 },
  );
}

/**
 * Generate hairstyle using official OpenAI SDK
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
  } catch (error: any) {
    const message =
      error?.message || "The OpenAI image generation service could not process this photo.";
    const status = typeof error?.status === "number" && error.status >= 400 && error.status < 600
      ? error.status
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

  const aiLabApiKey = process.env.AILABAPI_API_KEY;
  const aiLabEndpoint =
    process.env.AILAB_HAIRSTYLE_ENDPOINT ||
    "https://www.ailabapi.com/api/portrait/effects/hairstyle-editor-pro";
  const openAiApiKey = process.env.OPENAI_API_KEY;

  // Verify at least one provider is configured
  if (!aiLabApiKey && !openAiApiKey) {
    return NextResponse.json(
      {
        error:
          "Image generation is not configured. Please ensure AILABAPI_API_KEY is configured in .env.local.",
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
        "Image generation is not configured. Please ensure AILABAPI_API_KEY is configured in .env.local.",
    },
    { status: 503 },
  );
}
