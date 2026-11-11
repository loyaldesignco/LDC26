// Writes redirects.mjs into vercel.json as permanent (301/308) redirects.
import { readFileSync, writeFileSync } from "node:fs";
import { legacyRedirects } from "../redirects.mjs";

const file = new URL("../vercel.json", import.meta.url);
const config = JSON.parse(readFileSync(file, "utf8"));
config.redirects = [
  ...Object.entries(legacyRedirects).map(([source, destination]) => ({ source, destination, statusCode: 301 })),
  // Search Console and old links know the sitemap at /sitemap.xml; Astro writes /sitemap-index.xml.
  { source: "/sitemap.xml", destination: "/sitemap-index.xml", statusCode: 301 },
];
writeFileSync(file, JSON.stringify(config, null, 2) + "\n");
console.log(`vercel.json: ${config.redirects.length} redirects`);
