/**
 * Shared forms service: www.loyal.design/api/forms
 *
 * Any site listed in ./_sites.ts can post its contact form here (multipart, urlencoded or JSON).
 * Each submission is checked (known site + allowed origin, honeypot, reCAPTCHA v3, size limits)
 * and then emailed through Postmark from that site's verified domain, with Reply-To set to the
 * visitor so a reply goes straight back to them.
 *
 * Environment (Vercel → Project → Settings → Environment Variables):
 *   POSTMARK_SERVER_TOKEN  Postmark server API token
 *   RECAPTCHA_SECRET       reCAPTCHA v3 secret key (shared key listing every site's domain)
 *
 * GET returns a health check that says whether those are configured, without revealing them.
 */
import { SITES, type SiteConfig } from "./_sites.js";

/** Fields the service uses itself; everything else in the form goes into the email. */
const META = new Set(["site", "_gotcha", "_subject", "g-recaptcha-response", "_redirect"]);
const MAX_FIELDS = 30;
const MAX_VALUE = 5000;

const json = (body: unknown, status: number, origin?: string) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...cors(origin) },
  });

function cors(origin?: string): Record<string, string> {
  return origin ? { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Accept", Vary: "Origin" } : {};
}

/** The request's origin if some configured site allows it. */
function allowedOrigin(request: Request): string | undefined {
  const origin = request.headers.get("origin") ?? "";
  return Object.values(SITES).some((s) => s.origins.includes(origin)) ? origin : undefined;
}

export function OPTIONS(request: Request) {
  const origin = allowedOrigin(request);
  return new Response(null, { status: origin ? 204 : 403, headers: cors(origin) });
}

export function GET() {
  return json({ ok: true, service: "forms", sites: Object.keys(SITES), postmark: Boolean(process.env.POSTMARK_SERVER_TOKEN), recaptcha: Boolean(process.env.RECAPTCHA_SECRET) }, 200);
}

async function readFields(request: Request): Promise<Map<string, string>> {
  const type = request.headers.get("content-type") ?? "";
  const out = new Map<string, string>();
  if (type.includes("application/json")) {
    const body = (await request.json()) as Record<string, unknown>;
    for (const [k, v] of Object.entries(body ?? {})) if (typeof v === "string" || typeof v === "number") out.set(k, String(v));
  } else {
    const form = await request.formData();
    for (const [k, v] of form.entries()) if (typeof v === "string") out.set(k, out.has(k) ? `${out.get(k)}, ${v}` : v);
  }
  return out;
}

async function verifyRecaptcha(site: SiteConfig, token: string | undefined, ip: string | null): Promise<string | null> {
  const secret = process.env[site.recaptchaSecretEnv ?? "RECAPTCHA_SECRET"];
  if (!secret) return null; // reCAPTCHA not configured for this site: rely on the other checks
  if (!token) return "missing reCAPTCHA token";
  const params = new URLSearchParams({ secret, response: token });
  if (ip) params.set("remoteip", ip);
  const res = await fetch("https://www.google.com/recaptcha/api/siteverify", { method: "POST", body: params });
  const r = (await res.json()) as { success: boolean; score?: number; action?: string; hostname?: string; "error-codes"?: string[] };
  if (!r.success) return `reCAPTCHA failed (${(r["error-codes"] ?? []).join(", ")})`;
  if ((r.score ?? 0) < (site.minScore ?? 0.5)) return `reCAPTCHA score too low (${r.score})`;
  if (r.action && r.action !== "submit") return "unexpected reCAPTCHA action";
  const hosts = site.origins.map((o) => new URL(o).hostname);
  if (r.hostname && !hosts.includes(r.hostname)) return `reCAPTCHA hostname ${r.hostname} not allowed`;
  return null;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const label = (k: string) => k.replace(/[_-]+/g, " ").replace(/^\w/, (c) => c.toUpperCase());
const isEmail = (s: string) => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(s);

export async function POST(request: Request) {
  const origin = allowedOrigin(request);
  let fields: Map<string, string>;
  try {
    fields = await readFields(request);
  } catch {
    return json({ ok: false, error: "Unreadable form data" }, 400, origin);
  }

  const siteKey = fields.get("site") ?? "";
  const site = SITES[siteKey];
  if (!site) return json({ ok: false, error: "Unknown site" }, 400, origin);
  if (!origin || !site.origins.includes(origin)) return json({ ok: false, error: "Origin not allowed" }, 403, origin);

  // Honeypot: bots fill the hidden field. Answer as if it worked so they don't adapt.
  if (fields.get("_gotcha")) return json({ ok: true }, 200, origin);

  const content = [...fields].filter(([k]) => !META.has(k));
  if (content.length > MAX_FIELDS || content.some(([k, v]) => k.length > 64 || v.length > MAX_VALUE)) return json({ ok: false, error: "Submission too large" }, 413, origin);

  const email = (fields.get("email") ?? "").trim();
  if (email && !isEmail(email)) return json({ ok: false, error: "Invalid email" }, 422, origin);

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const captcha = await verifyRecaptcha(site, fields.get("g-recaptcha-response"), ip);
  if (captcha) return json({ ok: false, error: "Spam check failed" }, 422, origin);

  const token = process.env[site.postmarkTokenEnv ?? "POSTMARK_SERVER_TOKEN"];
  if (!token) return json({ ok: false, error: "Email service not configured" }, 503, origin);

  const name = (fields.get("name") ?? "").trim();
  const company = (fields.get("company") ?? "").trim();
  const subject = site.subject.replace("{company}", company && name ? `${company}, ` : company).replace("{name}", name).replace(/[:,]\s*$/, "") || `New submission, ${site.name}`;
  const rows = content.filter(([, v]) => v.trim());
  const TextBody = rows.map(([k, v]) => `${label(k)}:\n${v}\n`).join("\n") + `\n— Sent from ${origin}`;
  const HtmlBody =
    `<table cellpadding="0" cellspacing="0" style="font:15px/1.5 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#111;max-width:640px">` +
    rows.map(([k, v]) => `<tr><td style="padding:10px 0;border-bottom:1px solid #eee"><div style="font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#888">${esc(label(k))}</div><div style="white-space:pre-wrap">${esc(v)}</div></td></tr>`).join("") +
    `<tr><td style="padding-top:14px;font-size:12px;color:#999">Sent from ${esc(origin)}</td></tr></table>`;

  const res = await fetch("https://api.postmarkapp.com/email", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json", "X-Postmark-Server-Token": token },
    body: JSON.stringify({
      From: site.from,
      To: site.to.join(", "),
      ReplyTo: email ? (name ? `"${name.replace(/"/g, "")}" <${email}>` : email) : undefined,
      Subject: subject,
      TextBody,
      HtmlBody,
      MessageStream: "outbound",
      Tag: `form-${siteKey}`,
      Metadata: { site: siteKey },
    }),
  });
  if (!res.ok) {
    console.error("postmark", res.status, await res.text());
    return json({ ok: false, error: "Email failed to send" }, 502, origin);
  }
  return json({ ok: true }, 200, origin);
}
