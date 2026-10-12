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
        <h2 id="hair-photo-upload-title" className="sr-only">
          {title}
        </h2>

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
          className={`mx-auto flex w-full max-w-[560px] flex-col items-center justify-center rounded-[28px] sm:rounded-[32px] border-2 border-solid px-6 py-10 sm:py-12 text-center transition-colors ${
            isDragging
              ? "border-[#00a392] bg-[#f0fbfa]"
              : "border-[#00bba7] bg-white"
          }`}
        >
          {selection ? (
            <div className="flex w-full flex-col items-center">
              <div className="relative mb-5 flex h-48 w-full max-w-sm items-center justify-center overflow-hidden rounded-2xl bg-[#f5f9f8] sm:h-56">
                <Image
                  src={selection.previewUrl}
                  alt="Selected photo preview"
                  width={640}
                  height={480}
                  unoptimized
                  className="h-full w-full object-contain"
                />
              </div>
              <p className="mb-4 max-w-full truncate text-sm font-semibold text-[#111827]">
                {selection.file.name}
              </p>
              <button
                type="button"
                onClick={
                  selection.source === "camera" ? openCamera : openGallery
                }
                className="rounded-full border-2 border-[#00bba7] bg-white px-7 py-2.5 text-sm sm:text-base font-bold text-[#00bba7] transition-colors hover:bg-[#e6f7f5] cursor-pointer"
              >
                {selection.source === "camera"
                  ? "Recapture image"
                  : "Change photo"}
              </button>
            </div>
          ) : (
            <>
              {/* Top Circular Icon */}
              <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[#e0f7f5] text-[#00bba7]">
                <svg
                  className="h-10 w-10 text-[#00bba7]"
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
              <h3 className="text-2xl font-extrabold text-[#111827] sm:text-[28px] tracking-tight">
                Drop your photo here
              </h3>

              {/* Subheading */}
              <button
                type="button"
                onClick={openGallery}
                className="mt-2 text-base text-[#1f2937] hover:text-[#00bba7] cursor-pointer sm:text-lg"
              >
                or click to browse your gallery
              </button>

              {/* Divider */}
              <p className="my-5 text-base sm:text-lg font-bold text-[#111827]">-or-</p>

              {/* Choose from gallery button */}
              <button
                type="button"
                onClick={openGallery}
                className="rounded-full bg-[#00bba7] px-8 py-3.5 text-base font-bold text-white transition-colors hover:bg-[#00a392] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00a392] sm:text-lg shadow-xs cursor-pointer"
              >
                Choose from gallery
              </button>

              {/* Disclaimer Text */}
              <p className="mt-6 max-w-md text-xs leading-relaxed text-[#4b5563] sm:text-sm">
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
        <div className="mx-auto mt-6 grid w-full max-w-[560px] grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
          <button
            type="button"
            onClick={openGallery}
            className="flex min-h-[56px] w-full items-center justify-center rounded-full bg-[#00bba7] px-6 py-3.5 text-base font-bold text-white transition-colors hover:bg-[#00a392] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00a392] sm:text-lg shadow-xs cursor-pointer"
          >
            Upload image
          </button>
          <button
            type="button"
            onClick={openCamera}
            className="flex min-h-[56px] w-full items-center justify-center rounded-full bg-[#00bba7] px-6 py-3.5 text-base font-bold text-white transition-colors hover:bg-[#00a392] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00a392] sm:text-lg shadow-xs cursor-pointer"
          >
            Capture photo
          </button>
        </div>

        {cameraOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="camera-dialog-title"
          >
            <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl sm:p-6">
              <h2
                id="camera-dialog-title"
                className="mb-4 text-xl font-bold text-black"
              >
                Capture your photo
              </h2>
              {cameraStream ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="max-h-[60vh] w-full rounded-xl bg-black object-contain"
                />
              ) : (
                !cameraError && (
                  <p className="py-12 text-center text-sm text-[#667270]">
                    Waiting for camera access…
                  </p>
                )
              )}
              {cameraError && (
                <p className="mt-3 text-sm text-red-700" role="alert">
                  {cameraError}
                </p>
              )}
              <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeCamera}
                  className="rounded-full border border-[#319f99] px-6 py-3 font-semibold text-[#258d87] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#258d87]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={capturePhoto}
                  disabled={!cameraStream}
                  className="rounded-full bg-[#319f99] px-6 py-3 font-bold text-white hover:bg-[#258d87] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#258d87]"
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
