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

/**
 * Logos are used as CSS masks, which the browser fetches with CORS. Rather than depend on the
 * Sanity CDN's CORS list (or bloat the HTML with data URIs), each Sanity logo is copied to
 * /logos/<asset>.webp at build time by src/pages/logos/[file].ts and served same-origin.
 */
export function logoFile(image: SanityImage | null | undefined): string | null {
  const ref = image?.asset?._ref;
  return ref ? `${ref.replace(/^image-/, "").replace(/-[a-z0-9]+$/, "")}.webp` : null;
}

/** Remote source the build copies a logo from: 400px WebP keeps the alpha the mask needs. */
export function logoSource(image: SanityImage | null | undefined): string | null {
  return imageUrl(image, 400)?.replace("auto=format", "fm=webp").replace(/q=\d+/, "q=80") ?? null;
}

/** URL for a logo used as a CSS mask: local files as-is, Sanity logos via their same-origin copy. */
export function logoUrl(image: SanityImage | null | undefined): string | null {
  if (!image) return null;
  if (image.url) return image.url;
  const file = logoFile(image);
  return file ? `/logos/${file}` : null;
}

/** Shorthand for the sizes the layouts actually use. */
export const src = (image: SanityImage | null | undefined, width = 1600, height?: number) => imageUrl(image, width, height) ?? "";

const WIDTHS = [480, 720, 960, 1280, 1600, 2000, 2400];

/**
 * srcset for a Sanity image: one candidate per width up to `max` (and never wider than the
 * original). Local images get no srcset, so the browser falls back to src.
 */
export function srcset(image: SanityImage | null | undefined, max = 2400): string | undefined {
  if (!image?.asset?._ref) return undefined;
  const m = image.asset._ref.match(/-(\d+)x(\d+)-/);
  const natural = m ? +m[1] : max;
  const ws = WIDTHS.filter((w) => w <= Math.min(max, natural));
  if (!ws.length || ws[ws.length - 1] < Math.min(max, natural)) ws.push(Math.min(max, natural));
  return ws.map((w) => `${imageUrl(image, w)} ${w}w`).join(", ");
}

/** Kept for existing callers; logos are now same-origin files, so nothing is inlined. */
export async function logoMaskUrl(image: SanityImage | null | undefined): Promise<string | null> {
  return logoUrl(image);
}
