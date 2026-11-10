import type { PortableTextBlock } from "@portabletext/types";

/** A Sanity image field (asset reference + optional crop/hotspot). */
export interface SanityImage {
  _type?: "image";
  /** A direct URL (local /public path or external). Used by fallback content; Sanity images use `asset`. */
  url?: string;
  asset?: { _ref: string; _type?: "reference" };
  alt?: string;
  caption?: string;
  hotspot?: { x: number; y: number; height: number; width: number };
  crop?: { top: number; bottom: number; left: number; right: number };
}

/**
 * Generated cover art used whenever a project or post has no uploaded image.
 * Editors can also pick it deliberately in the Studio.
 */
export interface Plate {
  background: string;
  foreground: string;
  motif: "grid" | "orbit" | "stripes" | "stack" | "type";
  mark?: string;
}

export interface Fact {
  label: string;
  value: string;
}

export interface Project {
  _id: string;
  title: string;
  slug: string;
  client: string;
  summary: string;
  industry: string;
  services: string[];
  /** Year the relationship started. When set, drives the tenure squares. */
  partnerSince?: number | null;
  /** Year the relationship ended. Empty means the client is still with us. */
  partnerUntil?: number | null;
  /** Year the work shipped. Drives the year column and the Most Recent sort on /work. */
  launched?: number | null;
  /** One-line headline for the case study's brief. Falls back to the summary. */
  statement?: string;
  /** Client logo (SVG or transparent PNG). Shown on the case study and over the work grid card. */
  logo?: SanityImage | null;
  url?: string;
  featured?: boolean;
  cover?: SanityImage | null;
  plate: Plate;
  gallery?: SanityImage[];
  facts?: Fact[];
  body?: PortableTextBlock[];
}

export interface Service {
  _id: string;
  title: string;
  /** Present when the service has its own page at /services/<slug>. */
  slug?: string;
  /** Short list shown on the home row, e.g. "Logo & mark design · Visual identity systems". */
  summary: string;
  deliverables: string[];
  /** Work filter this row links to when the service has no page of its own. */
  workFilter?: string;
  image?: SanityImage | null;
  meta?: string;
  statement?: string;
  intro?: string[];
  capabilities?: { name: string; desc: string }[];
  processTitle?: string;
  stats?: string[];
  steps?: { name: string; dur: string; desc: string }[];
  faq?: { q: string; a: string }[];
  stack?: { name: string; role: string }[];
}

export interface ClientLogo {
  name: string;
  logo: SanityImage;
  /** Visual size tweak, 0.8 to 1.2. Logos with lots of whitespace read small. */
  scale?: number;
}

export interface HeroSlide {
  image: SanityImage;
  label: string;
  href?: string;
  /** Small mark shown beside the label. */
  logo?: SanityImage | null;
}

export interface ProcessStep {
  title: string;
  body: string;
}

export interface Post {
  _id: string;
  title: string;
  slug: string;
  publishedAt: string;
  category: string;
  excerpt: string;
  cover?: SanityImage | null;
  plate: Plate;
  body?: PortableTextBlock[];
}

export interface Testimonial {
  _id: string;
  quote: string;
  name: string;
  role: string;
  company: string;
}

export interface SiteSettings {
  title: string;
  description: string;
  email: string;
  location: string;
  timezone: string;
  coordinates: string;
  availability: {
    status: "open" | "limited" | "booked";
    note: string;
  };
  socials: { label: string; url: string }[];
  /** Extra profiles for schema.org sameAs only (directories, review sites). Socials are included automatically. */
  sameAs?: string[];
  credentials: string[];
  process: ProcessStep[];
  /** Home hero backgrounds. Two or more cross-fade with a lens transition. */
  heroSlides: HeroSlide[];
  /** The three full-bleed panels under "Selected work" on the home page. */
  homePanels: SanityImage[];
  /** Full-bleed image behind "How we work". */
  processImage?: SanityImage | null;
  /** Logos in the client marquee. */
  clients: ClientLogo[];
  /** Portrait on the About page. */
  portrait?: SanityImage | null;
}
