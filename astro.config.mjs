// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import sitemap from "@astrojs/sitemap";
import { legacyRedirects } from "./redirects.mjs";


export default defineConfig({
  site: "https://www.loyal.design",
  build: { inlineStylesheets: "always" },
  trailingSlash: "never",
  prefetch: { prefetchAll: true },
  redirects: Object.fromEntries(Object.entries(legacyRedirects).map(([from, to]) => [from, { status: 301, destination: to }])),
  integrations: [sitemap({ filter: (page) => !page.includes("/404") })],
  vite: {
    plugins: [tailwindcss()],
  },
});
