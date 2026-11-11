import { createClient, type SanityClient } from "@sanity/client";
import { createImageUrlBuilder } from "@sanity/image-url";
import { toHTML } from "@portabletext/to-html";
import type { PortableTextBlock } from "@portabletext/types";
import * as fallback from "@/data/fallback";
import type { Post, Project, SanityImage, Service, SiteSettings, Testimonial } from "./types";

// Sanity project "Loyal". Set PUBLIC_SANITY_PROJECT_ID to an empty string to build from src/data/fallback.ts instead.
const projectId = (import.meta.env.PUBLIC_SANITY_PROJECT_ID as string | undefined) ?? "9xn8x41p";
const dataset = (import.meta.env.PUBLIC_SANITY_DATASET as string | undefined) ?? "production";
const apiVersion = (import.meta.env.PUBLIC_SANITY_API_VERSION as string | undefined) ?? "2026-11-01";
const token = import.meta.env.SANITY_API_READ_TOKEN as string | undefined;

/** Null when Sanity isn't configured — every query then serves fallback content. */
export const client: SanityClient | null = projectId
  // Builds read straight from the API, not the CDN, so a rebuild right after publishing never picks up a stale copy.
  ? createClient({ projectId, dataset, apiVersion, useCdn: false, token, perspective: "published" })
  : null;

const builder = projectId ? createImageUrlBuilder({ projectId, dataset }) : null;

export function imageUrl(image: SanityImage | null | undefined, width = 1600, height?: number, quality = 75): string | null {
  if (image?.url) return image.url;
  if (!builder || !image?.asset?._ref) return null;
  let b = builder.image(image).width(width).auto("format").quality(quality);
  if (height) b = b.height(height).fit("crop");
  return b.url();
}

export function renderBody(blocks: PortableTextBlock[] | undefined): string {
  if (!blocks?.length) return "";
  return toHTML(blocks, {
    components: {
      types: {
        image: ({ value }) => {
          const src = imageUrl(value, 1800);
          if (!src) return "";
          const alt = (value.alt ?? "").replace(/"/g, "&quot;");
          const caption = value.caption ? `<figcaption>${value.caption}</figcaption>` : "";
          return `<figure><img src="${src}" alt="${alt}" loading="lazy" />${caption}</figure>`;
        },
      },
    },
  });
}

async function query<T>(groq: string, params: Record<string, unknown>, fallbackValue: T): Promise<T> {
  if (!client) return fallbackValue;
  try {
    const result = await client.fetch<T | null>(groq, params);
    return result ?? fallbackValue;
  } catch (err) {
    console.warn(`[sanity] query failed, serving fallback content: ${(err as Error).message}`);
    return fallbackValue;
  }
}

/* ------------------------------ GROQ ------------------------------ */

const plate = `"plate": coalesce(plate, { "background": "#000000", "foreground": "#f6f4e7", "motif": "grid" })`;

const projectCard = `
  _id, title, "slug": slug.current, client, summary, industry, services,
  partnerSince, partnerUntil, launched, statement, logo, url, featured, cover, ${plate}
`;

export const getSettings = () =>
  query<SiteSettings>(
    `*[_id == "siteSettings"][0]{
      title, description, email, location, timezone, coordinates,
      availability, "socials": coalesce(socials, []), "sameAs": coalesce(sameAs, []), "credentials": coalesce(credentials, []),
      "process": coalesce(process, []),
      "heroSlides": coalesce(heroSlides, []), "homePanels": coalesce(homePanels, []),
      processImage, portrait, "clients": coalesce(clients, [])
    }`,
    {},
    fallback.settings,
  );

export const getProjects = () =>
  query<Project[]>(
    `*[_type == "project" && defined(slug.current)] | order(orderRank asc, partnerSince desc){ ${projectCard} }`,
    {},
    fallback.projects,
  );

export const getProject = async (slug: string) =>
  query<Project | null>(
    `*[_type == "project" && slug.current == $slug][0]{ ${projectCard}, gallery, facts, body }`,
    { slug },
    fallback.projects.find((p) => p.slug === slug) ?? null,
  );

export const getServices = () =>
  query<Service[]>(
    `*[_type == "service"] | order(orderRank asc){
      _id, title, "slug": slug.current, summary, "deliverables": coalesce(deliverables, []), workFilter, image,
      meta, statement, intro, capabilities, processTitle, stats, steps, faq, stack
    }`,
    {},
    fallback.services,
  );

const postCard = `_id, title, "slug": slug.current, publishedAt, category, excerpt, cover, ${plate}`;

export const getPosts = () =>
  query<Post[]>(
    `*[_type == "post" && defined(slug.current)] | order(publishedAt desc){ ${postCard} }`,
    {},
    fallback.posts,
  );

export const getPost = (slug: string) =>
  query<Post | null>(
    `*[_type == "post" && slug.current == $slug][0]{ ${postCard}, body }`,
    { slug },
    fallback.posts.find((p) => p.slug === slug) ?? null,
  );

export const getTestimonials = () =>
  query<Testimonial[]>(
    `*[_type == "testimonial"] | order(_createdAt desc){ _id, quote, name, role, company }`,
    {},
    fallback.testimonials,
  );

/* ----------------------------- helpers ---------------------------- */

/** The filter set on /work and the counts on the home banner. Order matters. */
export const WORK_CATEGORIES = ["Branding", "Webflow", "Product Design", "Strategy"] as const;

export function categoriesOf(p: Pick<Project, "services">): string[] {
  return p.services.filter((s) => (WORK_CATEGORIES as readonly string[]).includes(s));
}

/** Newest first; undated work sinks to the end in its existing order. */
export function byNewest<T extends Pick<Project, "launched">>(list: T[]): T[] {
  return list.map((p, i) => ({ p, i })).sort((a, b) => (b.p.launched ?? 0) - (a.p.launched ?? 0) || a.i - b.i).map((x) => x.p);
}

export const CURRENT_YEAR = new Date().getFullYear();

/** Years partnered, counting the current year as a full year (min 1). 0 when no start year is recorded. */
export function tenureYears(p: Pick<Project, "partnerSince" | "partnerUntil">): number {
  if (!p.partnerSince) return 0;
  const end = p.partnerUntil ?? CURRENT_YEAR;
  return Math.max(1, end - p.partnerSince + 1);
}

export function formatDate(iso: string): string {
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}
