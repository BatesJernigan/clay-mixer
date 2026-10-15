import { PixelGrid } from "./palette";

/** Images are decoded no larger than this on their long side, to bound memory. */
export const MAX_DECODE_SIDE = 4096;

export type ImageLoadErrorKind = "invalid-url" | "load-failed" | "blocked";

export class ImageLoadError extends Error {
  readonly kind: ImageLoadErrorKind;

  constructor(kind: ImageLoadErrorKind) {
    super(`Image load failed: ${kind}`);
    this.name = "ImageLoadError";
    this.kind = kind;
  }
}

/** The trimmed URL if `text` is an http(s) URL, otherwise null. */
export function parseImageUrl(text: string): string | null {
  try {
    const url = new URL(text.trim());
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

export function fitWithin(
  width: number,
  height: number,
  maxSide: number
): { width: number; height: number } {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

interface ClipboardItemLike {
  kind: string;
  type: string;
  getAsFile(): File | null;
}

/** The first image file in a paste, or null if it holds only text or other files. */
export function imageFromClipboard(
  data: { items: ArrayLike<ClipboardItemLike> } | null
): File | null {
  if (!data) return null;
  for (const item of Array.from(data.items)) {
    if (item.kind === "file" && item.type.startsWith("image/")) {
      return item.getAsFile();
    }
  }
  return null;
}

/** The first image among files from a file picker or a drop, or null if there is none. */
export function imageFromFiles(files: ArrayLike<File> | null): File | null {
  if (!files) return null;
  return Array.from(files).find((file) => file.type.startsWith("image/")) ?? null;
}

function decode(src: string, crossOrigin: boolean): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (crossOrigin) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new ImageLoadError("load-failed"));
    img.src = src;
  });
}

/**
 * A cross-origin image whose host sends no CORS headers fails to load
 * outright when requested with `crossOrigin`. Loading it again without tells
 * "this site blocks reading its images" apart from "there's no image here".
 */
async function decodeRemote(url: string): Promise<HTMLImageElement> {
  try {
    return await decode(url, true);
  } catch {
    await decode(url, false); // rethrows load-failed if there's no image at all
    throw new ImageLoadError("blocked");
  }
}

/** Decodes an image URL, or an uploaded/pasted file, into RGBA pixels. */
export async function loadImagePixels(source: string | Blob): Promise<PixelGrid> {
  let img: HTMLImageElement;
  if (typeof source === "string") {
    const url = parseImageUrl(source);
    if (!url) throw new ImageLoadError("invalid-url");
    img = await decodeRemote(url);
  } else {
    const objectUrl = URL.createObjectURL(source);
    try {
      img = await decode(objectUrl, false);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  const { width, height } = fitWithin(
    img.naturalWidth,
    img.naturalHeight,
    MAX_DECODE_SIDE
  );
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, width, height);
  try {
    return { width, height, data: ctx.getImageData(0, 0, width, height).data };
  } catch {
    // SecurityError: the canvas is tainted by a cross-origin image.
    throw new ImageLoadError("blocked");
  }
}
