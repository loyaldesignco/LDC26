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

const maskCache = new Map<string, string>();

/**
 * Logo URL for CSS masks. Masks are fetched with CORS, and the Sanity CDN only answers
 * origins on the project's CORS list, so remote logos are inlined as data URIs at build time.
 */
export async function logoMaskUrl(image: SanityImage | null | undefined): Promise<string | null> {
  const url = logoUrl(image);
  if (!url || url.startsWith("/") || url.startsWith("data:")) return url;
  if (maskCache.has(url)) return maskCache.get(url)!;
  try {
    const res = await fetch(url);
    if (!res.ok) return url;
    const type = res.headers.get("content-type") ?? "image/png";
    const data = `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}`;
    maskCache.set(url, data);
    return data;
  } catch {
    return url;
  }
}
