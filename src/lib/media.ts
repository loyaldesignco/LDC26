import { resolve } from "node:path";
import sharp from "sharp";
import { imageUrl } from "./sanity";
import type { SanityImage } from "./types";

const cache = new Map<string, number>();

/**
 * Width ÷ height of an image, read at build time.
 * Sanity asset refs carry their dimensions (image-<id>-1200x800-png); local files are measured with sharp.
 */
export async function aspectOf(image: SanityImage | null | undefined, fallback = 3): Promise<number> {
  const ref = image?.asset?._ref;
  if (ref) {
    const m = ref.match(/-(\d+)x(\d+)-/);
    return m ? +m[1] / +m[2] : fallback;
  }
  const url = image?.url;
  if (!url?.startsWith("/")) return fallback;
  if (cache.has(url)) return cache.get(url)!;
  try {
    const { width, height } = await sharp(resolve("public", `.${url}`)).metadata();
    const ar = width && height ? width / height : fallback;
    cache.set(url, ar);
    return ar;
  } catch {
    return fallback;
  }
}

/** URL for a logo used as a CSS mask: keep SVGs as-is, ask Sanity for PNG so alpha survives. */
export function logoUrl(image: SanityImage | null | undefined): string | null {
  if (!image) return null;
  if (image.url) return image.url;
  return imageUrl(image, 600)?.replace("auto=format", "fm=png") ?? null;
}

/** Shorthand for the sizes the layouts actually use. */
export const src = (image: SanityImage | null | undefined, width = 1600, height?: number) => imageUrl(image, width, height) ?? "";
