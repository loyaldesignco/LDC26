// Every URL in the old Adobe Portfolio sitemap (loyal.design/sitemap.xml, Dec 2024) → its new home.
// Pages without a matching case study go to /work. "/", "/contact" and "/work" keep their URLs.
// Used by astro.config.mjs; run `npm run redirects` after editing to regenerate vercel.json.
export const legacyRedirects = {
  "/home": "/",
  "/2019-world-jiu-jitsu-championship-event-shirt": "/work/fighters-market-ibjjf",
  "/2022-choke-republic-collection": "/work/choke-republic-2022",
  "/all-roads-counseling": "/work/all-roads-counseling",
  "/bgd-enterprises": "/work/bgd-enterprises",
  "/brandon-james-construction": "/work/brandon-james-construction",
  "/choke-republic-design-tee-design": "/work/choke-republic-tee",
  "/christopher-d-connors-website": "/work",
  "/david-branch-brazilian-jiu-jitsu-logo": "/work/david-branch",
  "/guarded-globe": "/work/guarded-globe",
  "/kingz-balistico-design": "/work/kingz-balistico",
  "/ladies-winter-boots-poster": "/work",
  "/love-bridal-branding": "/work/love-bridal",
  "/maeda-akashio": "/work/maeda-akashio",
  "/maeda-brand-jiu-jitsu-kimono-conde-koma-comeco": "/work",
  "/maeda-red-label": "/work/maeda-red-label",
  "/orkal-banner": "/work",
  "/orkal-industries": "/work",
  "/pizza-by-certe": "/work",
  "/rollshop-branding": "/work/rollshop",
  "/ronin-emperor": "/work/ronin-emperor",
  "/ronin-lonewolf-gi-rashguard": "/work",
  "/shellproof-security": "/work/shellproof-security",
};
