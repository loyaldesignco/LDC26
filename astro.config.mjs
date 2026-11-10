// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

// Old Adobe Portfolio URLs (loyal.design/<slug>) → new case study routes.
// Keeps existing links and search rankings pointing at the right page.
const legacy = {
  "/home": "/",
  "/maeda-akashio": "/work/maeda-akashio",
  "/guarded-globe": "/work/guarded-globe",
  "/all-roads-counseling": "/work/all-roads-counseling",
  "/shellproof-security": "/work/shellproof-security",
  "/maeda-red-label": "/work/maeda-red-label",
  "/2022-choke-republic-collection": "/work/choke-republic-2022",
  "/love-bridal-branding": "/work/love-bridal",
  "/bgd-enterprises": "/work/bgd-enterprises",
  "/choke-republic-design-tee-design": "/work/choke-republic-tee",
  "/kingz-balistico-design": "/work/kingz-balistico",
  "/david-branch-brazilian-jiu-jitsu-logo": "/work/david-branch",
  "/rollshop-branding": "/work/rollshop",
  "/ronin-emperor": "/work/ronin-emperor",
};

export default defineConfig({
  site: "https://loyal.design",
  trailingSlash: "never",
  prefetch: { prefetchAll: true },
  redirects: Object.fromEntries(Object.entries(legacy).map(([from, to]) => [from, { status: 301, destination: to }])),
  vite: {
    plugins: [tailwindcss()],
  },
});
