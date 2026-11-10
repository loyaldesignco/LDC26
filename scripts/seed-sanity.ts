/**
 * Turns the fallback content (src/data/fallback.ts) into a Sanity import file.
 * Local images under /public are attached as real Sanity assets on import.
 *
 *   npm run seed                      # writes seed.ndjson
 *   cd studio && npx sanity dataset import ../seed.ndjson production
 *
 * Re-running the import with --replace overwrites documents with the same _id.
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as data from "../src/data/fallback";
import type { SanityImage } from "../src/lib/types";

const publicDir = resolve(import.meta.dirname, "../public");
let k = 0;
const key = () => `k${(k++).toString(36)}`;

function asset(img?: SanityImage | null) {
  if (!img?.url || !img.url.startsWith("/")) return undefined;
  return {
    _type: "altImage",
    _sanityAsset: `image@${pathToFileURL(resolve(publicDir, `.${img.url}`)).href}`,
    alt: img.alt ?? "",
  };
}

const rank = (i: number) => `0|${String(i * 10000).padStart(6, "0")}:`;
const docs: Record<string, unknown>[] = [];

const keyed = <T extends object>(list: T[] | undefined) => list?.map((x) => ({ _key: key(), ...x }));
const st = data.settings;

docs.push({
  _id: "siteSettings",
  _type: "siteSettings",
  ...st,
  process: st.process.map((s) => ({ _key: key(), _type: "processStep", ...s })),
  socials: keyed(st.socials),
  heroSlides: st.heroSlides.map((s) => ({ _key: key(), label: s.label, href: s.href, image: asset(s.image), logo: asset(s.logo) })),
  homePanels: st.homePanels.map((img) => ({ _key: key(), ...asset(img) })),
  processImage: asset(st.processImage),
  portrait: asset(st.portrait),
  clients: st.clients.map((c) => ({ _key: key(), name: c.name, scale: c.scale ?? 1, logo: { ...asset(c.logo), _type: "image" } })),
});

data.services.forEach((s, i) =>
  docs.push({
    _id: s._id,
    _type: "service",
    orderRank: rank(i),
    title: s.title,
    slug: s.slug ? { _type: "slug", current: s.slug } : undefined,
    summary: s.summary,
    deliverables: s.deliverables,
    workFilter: s.workFilter,
    image: asset(s.image),
    meta: s.meta,
    statement: s.statement,
    intro: s.intro,
    capabilities: keyed(s.capabilities),
    processTitle: s.processTitle,
    stats: s.stats,
    steps: keyed(s.steps),
    faq: keyed(s.faq),
    stack: keyed(s.stack),
  }),
);

data.projects.forEach((p, i) =>
  docs.push({
    _id: p._id,
    _type: "project",
    orderRank: rank(i),
    title: p.title,
    slug: { _type: "slug", current: p.slug },
    client: p.client,
    summary: p.summary,
    industry: p.industry,
    services: p.services,
    featured: p.featured ?? false,
    url: p.url,
    launched: p.launched ?? undefined,
    statement: p.statement,
    logo: asset(p.logo),
    partnerSince: p.partnerSince ?? undefined,
    partnerUntil: p.partnerUntil ?? undefined,
    plate: { _type: "plate", ...p.plate },
    cover: asset(p.cover),
    gallery: p.gallery?.map((g) => ({ _key: key(), ...asset(g) })).filter((g) => "_sanityAsset" in g),
    facts: p.facts?.map((f) => ({ _key: key(), _type: "fact", ...f })),
    body: p.body,
  }),
);

data.posts.forEach((p) =>
  docs.push({
    _id: p._id,
    _type: "post",
    title: p.title,
    slug: { _type: "slug", current: p.slug },
    publishedAt: p.publishedAt,
    category: p.category,
    excerpt: p.excerpt,
    plate: { _type: "plate", ...p.plate },
    body: p.body,
  }),
);

const out = resolve(import.meta.dirname, "../seed.ndjson");
writeFileSync(out, docs.map((d) => JSON.stringify(d)).join("\n") + "\n");
console.log(`Wrote ${docs.length} documents to seed.ndjson`);
