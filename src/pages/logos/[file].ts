import type { APIRoute, GetStaticPaths } from "astro";
import { getProjects, getSettings } from "@/lib/sanity";
import { logoFile, logoSource } from "@/lib/media";
import type { SanityImage } from "@/lib/types";

/** Copies every Sanity logo the site masks (clients, hero slides, projects) to /logos/<asset>.webp. */
export const getStaticPaths = (async () => {
  const [settings, projects] = await Promise.all([getSettings(), getProjects()]);
  const logos: (SanityImage | null | undefined)[] = [
    ...settings.clients.map((c) => c.logo),
    ...settings.heroSlides.map((s) => s.logo),
    ...projects.map((p) => p.logo),
  ];
  const seen = new Map<string, string>();
  for (const l of logos) {
    const file = logoFile(l);
    const source = logoSource(l);
    if (file && source) seen.set(file, source);
  }
  return [...seen].map(([file, source]) => ({ params: { file }, props: { source } }));
}) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
  const res = await fetch(props.source as string);
  if (!res.ok) throw new Error(`Logo fetch failed (${res.status}): ${props.source}`);
  return new Response(await res.arrayBuffer(), { headers: { "Content-Type": "image/webp" } });
};
