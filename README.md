# loyal.design

The Loyal Design Co studio site. Astro 7, Tailwind v4, Sanity.

Built to the **Loyal Design 2026** Claude Design project (v3 duotone home, editorial work grid, case study, service, about and contact pages): ink background, cream type, an orange → pink → brick gradient used only on interaction, Space Mono bracketed labels, Instrument Serif accent words and Neue Haas Grotesk Display headlines. `src/styles/global.css` holds the tokens, the Tailwind theme and the component classes; `src/scripts/motion.ts` ports the prototype's motion (Lenis, underlay menu, cursor dot, word-split reveals, letter-roll hovers, service stack, marquee, parallax, WebGL hero slideshow).

## Run it

```bash
npm install
npm run dev          # http://localhost:4321
npm run build        # static output in dist/
```

With no Sanity project configured, every page renders from `src/data/fallback.ts`, which holds the real portfolio (15 case studies from loyal.design and the Notion archive, images in `public/work/`).

## Connect Sanity

1. Create a project at sanity.io/manage (or use an existing one) and copy its ID.
2. Copy `.env.example` to `.env` and set `PUBLIC_SANITY_PROJECT_ID`.
3. Start the Studio:
   ```bash
   cd studio
   npm install
   SANITY_STUDIO_PROJECT_ID=<id> npm run dev
   ```
4. Load the current content and images into Sanity:
   ```bash
   npm run seed                                   # writes seed.ndjson
   cd studio && SANITY_STUDIO_PROJECT_ID=<id> npx sanity dataset import ../seed.ndjson production
   ```
5. Add your site's URL (and `http://localhost:4321`) as CORS origins in sanity.io/manage.

Once connected, the site reads Sanity first and falls back per query if a request fails.

### Content model

| Type | What it drives |
| --- | --- |
| Site settings (singleton) | Email, location, socials, credentials, hero slides, the three home work panels, the How we work image, the client logo marquee, the About portrait |
| Project | Work grid and list, case studies. **Year** drives sorting; **Services** (Branding, Webflow, Product Design, Strategy) drive filters and the home banner counts; **Statement** and **Client logo** show on the case study |
| Service | Home and /services rows. Give one a slug and fill the "Service page" fields to publish `/services/<slug>`; without a slug the row links to its work filter |
| Journal post | /journal |

Projects and services are drag-to-order in the Studio.

## Before launch

- **Adobe Fonts:** the site loads project `maf3dwv` with the JS embed (`BaseLayout.astro`). Make sure the project includes Neue Haas Grotesk Display (CSS name `neue-haas-grotesk-display`) and lists loyal.design and any preview domains. Override with `PUBLIC_TYPEKIT_KIT`. If it fails to load within 3s, headlines fall back to Helvetica Neue.
- **Contact form:** set `PUBLIC_FORM_ENDPOINT` (Formspree, Basin, etc). Without it the last step opens the visitor's email app.
- **Copy to confirm:** Webflow FAQ prices ($18k, $30k to $60k), the budget ranges on /contact, and the About timeline came from the design draft.
- **Bauhaus Desk Display** (menu face) is self-hosted: check the licence covers web use.
- **Years** for Fighters Market and Brandon James Construction aren't recorded, so they sort last.
- Old Adobe Portfolio URLs (`/kingz-balistico-design` etc.) 301 to `/work/<slug>`; see `astro.config.mjs`.

## Structure

```
src/
  components/   SiteNav (header + underlay menu), SiteFooter, ClientMarquee, PostCard, LocalTime
  data/         fallback.ts (typed content used without Sanity)
  layouts/      BaseLayout.astro (fonts, meta, schema.org, preloader / wipe, cursor)
  lib/          sanity.ts (client, GROQ, categories), media.ts (image URLs, logo aspect), types.ts
  pages/        index, work, work/[slug], services, services/[slug], about, contact, journal, journal/[slug], 404
  scripts/      motion.ts (site-wide), hero-gl.ts (WebGL slideshow, loaded on demand), work.ts (filters, sort, views)
  styles/       global.css
public/
  brand/        Loyal logotype, mark, globe marks, Webflow partner badge
  clients/      Client logos for the marquee (transparent PNG or SVG)
  design/       Imagery chosen in the design project (home panels, service rows, About)
  hero/         Hero slideshow backgrounds and marks
  fonts/        Bauhaus Desk Display
  work/         Portfolio images, WebP
```
