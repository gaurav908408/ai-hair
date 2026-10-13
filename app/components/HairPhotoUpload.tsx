"use client";

import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import Image from "next/image";

type HairPhotoUploadProps = {
  onImageSelect?: (file: File) => void;
  title?: string;
  className?: string;
};

type ImageSelection = {
  file: File;
  previewUrl: string;
  source: "gallery" | "camera";
};

const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png"]);

export default function HairPhotoUpload({
  onImageSelect,
  title = "Your transformation starts here",
  className = "",
}: HairPhotoUploadProps) {
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [selection, setSelection] = useState<ImageSelection | null>(null);
  const [error, setError] = useState("");
  const [cameraError, setCameraError] = useState("");
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(
    () => () => {
      if (selection) {
        URL.revokeObjectURL(selection.previewUrl);
      }
    },
    [selection],
  );

  useEffect(() => {
    if (videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
    }

    return () => cameraStream?.getTracks().forEach((track) => track.stop());
  }, [cameraStream]);

  const selectImage = (file: File, source: ImageSelection["source"]) => {
    const extension = file.name.split(".").pop()?.toLowerCase();
    const hasAcceptedType =
      ACCEPTED_IMAGE_TYPES.has(file.type) ||
      (!file.type && ["jpg", "jpeg", "png"].includes(extension ?? ""));

    if (!hasAcceptedType) {
      setError("Please choose a JPG, JPEG, or PNG image.");
      return;
    }

    const nextSelection = {
      file,
      previewUrl: URL.createObjectURL(file),
      source,
    };

    setSelection(nextSelection);
    setError("");
    onImageSelect?.(file);
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";

    if (file) {
      selectImage(file, "gallery");
    }
  };

  const openGallery = () => galleryInputRef.current?.click();

  const openCamera = async () => {
    setCameraError("");
    setCameraOpen(true);

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera access is not available in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: "user" },
      });
      setCameraStream(stream);
    } catch {
      setCameraError(
        "Unable to access your camera. Check your browser permissions and try again.",
      );
    }
  };

  const closeCamera = () => {
    cameraStream?.getTracks().forEach((track) => track.stop());
    setCameraStream(null);
    setCameraError("");
    setCameraOpen(false);
  };

  const capturePhoto = async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      setCameraError("The camera is not ready yet. Please try again.");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");

    if (!context) {
      setCameraError("Unable to capture the photo. Please try again.");
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const photo = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.92),
    );

    if (!photo) {
      setCameraError("Unable to capture the photo. Please try again.");
      return;
    }

    selectImage(
      new File([photo], "camera-photo.jpg", { type: "image/jpeg" }),
      "camera",
    );
    closeCamera();
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);

    const file = event.dataTransfer.files[0];
    if (file) {
      selectImage(file, "gallery");
    }
  };

  return (
    <section
      className={`flex w-full flex-col ${className || "px-4 py-12 sm:py-16"}`.trim()}
      aria-labelledby="hair-photo-upload-title"
    >
      <div className="mx-auto w-full max-w-none">
        <div className="mx-auto mb-5 sm:mb-6 w-full max-w-[560px] text-left">
          <p className="text-xs sm:text-sm font-bold tracking-wider text-[#111827] uppercase">
            AI HAIR GENERATOR
          </p>
          <h2
            id="hair-photo-upload-title"
            className="mt-1.5 sm:mt-2 text-2xl sm:text-3xl lg:text-[34px] font-extrabold tracking-tight text-[#111827] leading-tight"
          >
            {title}
          </h2>
        </div>

        <input
          ref={galleryInputRef}
          type="file"
          accept="image/jpeg,image/png,.jpg,.jpeg,.png"
          className="hidden"
          onChange={handleInputChange}
          tabIndex={-1}
          aria-hidden="true"
        />
        <div
          onDragEnter={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={(event) => {
            const nextTarget = event.relatedTarget;
            if (
              !(nextTarget instanceof Node) ||
              !event.currentTarget.contains(nextTarget)
            ) {
              setIsDragging(false);
            }
          }}
          onDrop={handleDrop}
          className={`mx-auto flex w-full max-w-[560px] flex-col items-center justify-center rounded-2xl sm:rounded-[32px] border-2 border-solid px-4 py-8 sm:px-6 sm:py-10 md:py-12 text-center transition-colors ${
            isDragging
              ? "border-[#00a392] bg-[#f0fbfa]"
              : "border-[#00bba7] bg-white"
          }`}
        >
          {selection ? (
            <div className="flex w-full flex-col items-center">
              <div className="relative mb-4 sm:mb-5 flex h-40 w-full max-w-sm items-center justify-center overflow-hidden rounded-xl sm:rounded-2xl bg-[#f5f9f8] sm:h-56">
                <Image
                  src={selection.previewUrl}
                  alt="Selected photo preview"
                  width={640}
                  height={480}
                  unoptimized
                  className="h-full w-full object-contain"
                />
              </div>
              <p className="mb-4 max-w-full truncate px-2 text-xs sm:text-sm font-semibold text-[#111827]">
                {selection.file.name}
              </p>
              <button
                type="button"
                onClick={
                  selection.source === "camera" ? openCamera : openGallery
                }
                className="rounded-full border-2 border-[#00bba7] bg-white px-5 sm:px-7 py-2 sm:py-2.5 text-xs sm:text-sm md:text-base font-bold text-[#00bba7] transition-colors hover:bg-[#e6f7f5] cursor-pointer"
              >
                {selection.source === "camera"
                  ? "Recapture image"
                  : "Re-upload image"}
              </button>
            </div>
          ) : (
            <>
              {/* Top Circular Icon */}
              <div className="mb-4 sm:mb-6 flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-full bg-[#e0f7f5] text-[#00bba7]">
                <svg
                  className="h-8 w-8 sm:h-10 sm:w-10 text-[#00bba7]"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect width="18" height="18" x="3" y="3" rx="3" ry="3" />
                  <circle cx="9" cy="9" r="2" />
                  <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                  <path d="M14 17l4-4m0 0h-3.5m3.5 0v3.5" />
                </svg>
              </div>

              {/* Heading */}
              <h3 className="text-xl sm:text-2xl md:text-[28px] font-extrabold text-[#111827] tracking-tight">
                Drop your photo here
              </h3>

              {/* Subheading */}
              <button
                type="button"
                onClick={openGallery}
                className="mt-1.5 sm:mt-2 text-sm sm:text-base md:text-lg text-[#1f2937] hover:text-[#00bba7] cursor-pointer"
              >
                or click to browse your gallery
              </button>

              {/* Divider */}
              <p className="my-3 sm:my-5 text-sm sm:text-base md:text-lg font-bold text-[#111827]">-or-</p>

              {/* Choose from gallery button */}
              <button
                type="button"
                onClick={openGallery}
                className="w-full sm:w-auto rounded-full bg-[#00bba7] px-6 sm:px-8 py-3 sm:py-3.5 text-sm sm:text-base md:text-lg font-bold text-white transition-colors hover:bg-[#00a392] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00a392] shadow-xs cursor-pointer"
              >
                Choose from gallery
              </button>

              {/* Disclaimer Text */}
              <p className="mt-4 sm:mt-6 max-w-md text-xs leading-relaxed text-[#4b5563] sm:text-sm px-1">
                JPG or PNG front-facing photo. Good lighting. Your photo stays
                <br className="hidden sm:inline" />{" "}
                on your device — never uploaded until you confirm.
              </p>
            </>
          )}
        </div>

        <p
          className="mt-3 min-h-5 text-center text-sm text-red-700"
          role="status"
          aria-live="polite"
        >
          {error}
        </p>

        {/* Bottom Two Buttons */}
        <div className="mx-auto mt-4 sm:mt-6 grid w-full max-w-[560px] grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 md:gap-5">
          <button
            type="button"
            onClick={openGallery}
            className="flex min-h-[48px] sm:min-h-[54px] md:min-h-[56px] w-full items-center justify-center rounded-full bg-[#00bba7] px-4 sm:px-6 py-3 sm:py-3.5 text-sm sm:text-base md:text-lg font-bold text-white transition-colors hover:bg-[#00a392] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00a392] shadow-xs cursor-pointer"
          >
            {selection?.source === "gallery" ? "Re-upload image" : "Upload image"}
          </button>
          <button
            type="button"
            onClick={openCamera}
            className="flex min-h-[48px] sm:min-h-[54px] md:min-h-[56px] w-full items-center justify-center rounded-full bg-[#00bba7] px-4 sm:px-6 py-3 sm:py-3.5 text-sm sm:text-base md:text-lg font-bold text-white transition-colors hover:bg-[#00a392] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00a392] shadow-xs cursor-pointer"
          >
            {selection?.source === "camera" ? "Recapture photo" : "Capture photo"}
          </button>
        </div>

        {cameraOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-4 backdrop-blur-xs"
            role="dialog"
            aria-modal="true"
            aria-labelledby="camera-dialog-title"
          >
            <div className="w-full max-w-lg rounded-2xl bg-white p-4 sm:p-6 shadow-xl max-h-[90vh] overflow-y-auto">
              <h2
                id="camera-dialog-title"
                className="mb-3 sm:mb-4 text-lg sm:text-xl font-bold text-black"
              >
                Capture your photo
              </h2>
              {cameraStream ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="max-h-[50vh] sm:max-h-[60vh] w-full rounded-xl bg-black object-contain"
                />
              ) : (
                !cameraError && (
                  <p className="py-8 sm:py-12 text-center text-sm text-[#667270]">
                    Waiting for camera access…
                  </p>
                )
              )}
              {cameraError && (
                <p className="mt-3 text-sm text-red-700" role="alert">
                  {cameraError}
                </p>
              )}
              <div className="mt-4 sm:mt-5 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeCamera}
                  className="w-full sm:w-auto rounded-full border border-[#319f99] px-5 sm:px-6 py-2.5 sm:py-3 font-semibold text-[#258d87] text-sm sm:text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#258d87]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={capturePhoto}
                  disabled={!cameraStream}
                  className="w-full sm:w-auto rounded-full bg-[#319f99] px-5 sm:px-6 py-2.5 sm:py-3 font-bold text-white text-sm sm:text-base hover:bg-[#258d87] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#258d87] disabled:opacity-50"
                >
                  Take photo
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
