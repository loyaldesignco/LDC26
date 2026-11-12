/**
 * Sites the shared forms service accepts submissions from.
 *
 * Form mail is sent from notify.loyal.design (verified in Postmark), kept apart from the domain used for
 * everyday email. Client sites can send from it too ("<Client> website <forms@notify.loyal.design>"),
 * so a new site needs no DNS changes on the client's domain.
 *
 * To add a client site:
 *   1. (Optional) To send from the client's own domain instead, verify it in Postmark first.
 *   2. Add its domain to the reCAPTCHA v3 key's domain list (or give it its own key, see `recaptchaSecretEnv`).
 *   3. Add an entry below, then point the site's form at https://www.loyal.design/api/forms with a hidden
 *      `site` field set to the entry's key.
 */
export interface SiteConfig {
  /** Shown in subjects and logs. */
  name: string;
  /** Exact origins allowed to post (scheme + host, no trailing slash). */
  origins: string[];
  /** Who receives submissions. */
  to: string[];
  /** Sender, on a domain verified in Postmark. */
  from: string;
  /** Subject line; {name} and {company} are filled from the form when present. */
  subject: string;
  /** Env var holding this site's reCAPTCHA secret, if it has its own key (default RECAPTCHA_SECRET). */
  recaptchaSecretEnv?: string;
  /** Env var holding a Postmark server token for this site, if it uses its own server (default POSTMARK_SERVER_TOKEN). */
  postmarkTokenEnv?: string;
  /** Minimum reCAPTCHA v3 score to accept (0–1, default 0.5). */
  minScore?: number;
}

export const SITES: Record<string, SiteConfig> = {
  "loyal-design": {
    name: "Loyal Design Co.",
    origins: ["https://www.loyal.design", "https://loyal.design"],
    to: ["hello@loyal.design"],
    from: "Loyal Design Co. website <forms@notify.loyal.design>",
    subject: "New project inquiry: {company}{name}",
  },
};
