/**
 * Extrai frames-chave de um vídeo no browser usando HTMLVideoElement + Canvas.
 * Cada frame é devolvido como base64 JPEG para envio ao Gemini.
 * Máximo de 4 frames por vídeo (início, 25%, 50%, 75%).
 */

const MAX_FRAMES = 4;
const FRAME_WIDTH = 1024;
const JPEG_QUALITY = 0.80;

export interface ExtractedFrame {
  base64: string;
  mimeType: "image/jpeg";
  timestampSeconds: number;
}

export async function extractVideoFrames(
  file: File,
  maxFrames = MAX_FRAMES
): Promise<ExtractedFrame[]> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.muted = true;
    video.preload = "auto";

    const url = URL.createObjectURL(file);
    video.src = url;

    const cleanup = () => {
      URL.revokeObjectURL(url);
      video.remove();
    };

    video.addEventListener("error", () => {
      cleanup();
      reject(new Error("Não foi possível carregar o vídeo"));
    });

    video.addEventListener("loadedmetadata", async () => {
      const duration = video.duration;
      if (!duration || duration <= 0) {
        cleanup();
        resolve([]);
        return;
      }

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        cleanup();
        resolve([]);
        return;
      }

      // Calculate timestamps at even intervals (skip first and last 5%)
      const safeStart = duration * 0.05;
      const safeEnd = duration * 0.95;
      const interval = (safeEnd - safeStart) / Math.max(1, maxFrames);
      const timestamps: number[] = [];
      for (let i = 0; i < maxFrames; i++) {
        timestamps.push(safeStart + i * interval);
      }

      const frames: ExtractedFrame[] = [];

      for (const ts of timestamps) {
        try {
          const frame = await captureFrame(video, canvas, ctx, ts);
          if (frame) frames.push(frame);
        } catch {
          // Skip failed frames
        }
      }

      cleanup();
      resolve(frames);
    });
  });
}

function captureFrame(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  timestamp: number
): Promise<ExtractedFrame | null> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(null), 5000);

    const onSeeked = () => {
      clearTimeout(timeout);
      video.removeEventListener("seeked", onSeeked);

      // Scale to max width while keeping aspect ratio
      let w = video.videoWidth;
      let h = video.videoHeight;
      if (w > FRAME_WIDTH) {
        h = Math.round((h * FRAME_WIDTH) / w);
        w = FRAME_WIDTH;
      }
      canvas.width = w;
      canvas.height = h;

      ctx.drawImage(video, 0, 0, w, h);
      const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
      const base64 = dataUrl.split(",")[1];

      if (base64 && base64.length > 100) {
        resolve({
          base64,
          mimeType: "image/jpeg",
          timestampSeconds: Math.round(timestamp * 10) / 10,
        });
      } else {
        resolve(null);
      }
    };

    video.addEventListener("seeked", onSeeked);
    video.currentTime = timestamp;
  });
}
