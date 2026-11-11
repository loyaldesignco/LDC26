/**
 * Liquid glass for the existing `.glass` surfaces.
 *
 * A framework-free port of the refraction engine from the "apple-tahoe-liquid-glass-button"
 * React component: a squircle displacement map is painted to a canvas, fed to an SVG filter
 * (feImage → feDisplacementMap → tone table), and applied as `backdrop-filter: url(#…)` so the
 * glass bends whatever sits behind it. A second canvas paints the rim light.
 *
 * Only Chromium runs SVG filters inside backdrop-filter, so every other engine keeps the
 * frosted CSS fallback already in global.css. The work is done once per surface size, off the
 * critical path (the caller waits for idle time), and re-done only after a resize settles.
 *
 * Markup it expects (already in place):
 *   <div class="glass" data-glass="banner|chip">
 *     <div class="glass-blur"/> <div class="glass-tint"/> <div class="glass-edge"/> … <div class="glass-body">…</div>
 *   </div>
 */

type Appearance = "light" | "dark";

interface GlassOptions {
  /** Rim pull in px: 18 suits buttons and cards, large surfaces take 30–60. */
  refraction: number;
  /** Width of the curved edge in px; default half the short side, capped at 32. */
  bezel?: number;
  /** Smoothing blur after the bend. */
  blur: number;
  appearance: Appearance;
}

const PRESETS: Record<string, GlassOptions> = {
  banner: { refraction: 56, bezel: 44, blur: 1, appearance: "light" },
  chip: { refraction: 24, bezel: 24, blur: 0.75, appearance: "light" },
};

/* ------------------------------------------------------------ engine */

/** Chromium renders SVG filters in backdrop-filter; WebKit and Gecko don't. */
function isChromium(): boolean {
  const brands = (navigator as Navigator & { userAgentData?: { brands?: { brand: string }[] } }).userAgentData?.brands;
  if (brands?.length) return brands.some((b) => /Chromium|Google Chrome|Microsoft Edge/i.test(b.brand));
  return /(Chrome|Chromium|Edg|SamsungBrowser)\/\d+/.test(navigator.userAgent) && !/Firefox\//.test(navigator.userAgent);
}

/* ------------------------------------------------------------ tone (clear material) */

const CLEAR = { light: { shadowLift: 0.18, highlightRolloff: 0 }, dark: { shadowLift: 0.15, highlightRolloff: 0.2 } } as const;

function toneTable(appearance: Appearance): string {
  const dark = appearance === "dark";
  const spec = CLEAR[appearance];
  return Array.from({ length: 33 }, (_, n) => {
    const v = n / 32;
    const tone = v + spec.shadowLift * (1 - v) ** 3 - spec.highlightRolloff * v ** 3;
    const tinted = dark ? 0.38 * v + 0.2 : 0.78 * v + 0.26;
    const w = dark ? 0.14 : 0.06;
    return Math.max(0, Math.min(1, (1 - w) * tone + w * tinted)).toFixed(5);
  }).join(" ");
}

/* ------------------------------------------------------------ squircle outline (Lissé corners) */

const SMOOTHING = 0.8125;
const rad = (d: number) => (d * Math.PI) / 180;

function cornerParams(radius: number, budget: number) {
  const e = radius;
  let p = (1 + SMOOTHING) * e;
  const o = 90 * (1 - SMOOTHING);
  const i = Math.sin(rad(o / 2)) * e * Math.SQRT2;
  const g = e * Math.tan(rad((90 - o) / 4));
  const c = g * Math.cos(rad(45 * SMOOTHING));
  const d = c * Math.tan(rad(45 * SMOOTHING));
  let u = (p - i - c - d) / 3;
  let a = 2 * u;
  if (p > budget) {
    const rem = budget - d - i - c;
    const l = rem - rem / 6;
    u = Math.min(u, l);
    a = rem - u;
    p = budget;
  }
  return { a, b: u, c, d, p, i };
}

interface Outline {
  corners: [Float64Array, Float64Array, Float64Array, Float64Array];
  extent: number;
  polygon: string;
  width: number;
  height: number;
}

function bezier(out: number[], x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, steps: number) {
  for (let s = 1; s <= steps; s++) {
    const t = s / steps, w = 1 - t;
    out.push(x0 * w * w * w + 3 * w * w * t * x1 + 3 * w * t * t * x2 + t * t * t * x3, y0 * w * w * w + 3 * w * w * t * y1 + 3 * w * t * t * y2 + t * t * t * y3);
  }
}

function squircleOutline(w: number, h: number, radius: number): Outline {
  const hw = w / 2, hh = h / 2;
  const budget = Math.min(hw, hh);
  const r = Math.min(radius, budget);
  if (r < 0.5) {
    const empty = new Float64Array(0);
    return { corners: [empty, empty, empty, empty], extent: 0, polygon: `polygon(0px 0px, ${w}px 0px, ${w}px ${h}px, 0px ${h}px)`, width: w, height: h };
  }
  const { a, b, c, d, p, i } = cornerParams(r, budget);
  const pts: number[] = [];
  const x0 = hw - p, y0 = -hh;
  bezier(pts, x0, y0, x0 + a, y0, x0 + a + b, y0, x0 + a + b + c, y0 + d, 24);
  const ax = x0 + a + b + c, ay = y0 + d;
  const chord = i * Math.SQRT2;
  const offset = Math.sqrt(Math.max(0, r * r - (chord * chord) / 4));
  const cx = ax + i / 2 - (i / chord) * offset;
  const cy = ay + i / 2 + (i / chord) * offset;
  const angle = Math.atan2(ay - cy, ax - cx);
  const sweep = 2 * Math.asin(Math.min(1, chord / (2 * r)));
  for (let s = 1; s <= 8; s++) pts.push(cx + r * Math.cos(angle + (sweep * s) / 8), cy + r * Math.sin(angle + (sweep * s) / 8));
  const qx = ax + i, qy = ay + i;
  bezier(pts, qx, qy, qx + d, qy + c, qx + d, qy + b + c, qx + d, qy + a + b + c, 24);

  const all = [x0, y0, ...pts, hw, -hh + p];
  const count = all.length / 2;
  const trP = new Float64Array(count * 2);
  const trN = new Float64Array(count * 2);
  for (let k = 0; k < count; k++) {
    const pk = Math.max(0, k - 1), nk = Math.min(count - 1, k + 1);
    let tdx = all[2 * nk] - all[2 * pk], tdy = all[2 * nk + 1] - all[2 * pk + 1];
    if (k === 0) { tdx = 1; tdy = 0; }
    if (k === count - 1) { tdx = 0; tdy = 1; }
    const len = Math.hypot(tdx, tdy) || 1;
    trP[2 * k] = all[2 * k];
    trP[2 * k + 1] = all[2 * k + 1];
    trN[2 * k] = tdy / len;
    trN[2 * k + 1] = -tdx / len;
  }
  const mirror = (mx: boolean, my: boolean) => {
    const run = new Float64Array(count * 4);
    const sx = mx ? -1 : 1, sy = my ? -1 : 1;
    for (let k = 0; k < count; k++) {
      run[4 * k] = sx * trP[2 * k];
      run[4 * k + 1] = sy * trP[2 * k + 1];
      run[4 * k + 2] = sx * trN[2 * k];
      run[4 * k + 3] = sy * trN[2 * k + 1];
    }
    return run;
  };
  const tr = mirror(false, false), br = mirror(false, true), bl = mirror(true, true), tl = mirror(true, false);
  const poly: string[] = [];
  const push = (run: Float64Array, step: number) => {
    for (let k = step > 0 ? 0 : count - 1; step > 0 ? k < count : k >= 0; k += step) poly.push(`${(run[4 * k] + hw).toFixed(2)}px ${(run[4 * k + 1] + hh).toFixed(2)}px`);
  };
  push(tr, 1);
  push(br, -1);
  push(bl, 1);
  push(tl, -1);
  return { corners: [tr, br, bl, tl], extent: p, polygon: `polygon(${poly.join(", ")})`, width: w, height: h };
}

const sat = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Signed distance and outward normal of the squircle at a point (centered coords). */
function outlineField(px: number, py: number, o: Outline): { d: number; nx: number; ny: number } {
  const hw = o.width / 2, hh = o.height / 2, p = o.extent;
  const ax = Math.abs(px), ay = Math.abs(py);
  const qx = ax - (hw - p), qy = ay - (hh - p);
  if (qx > 0 && qy > 0) {
    const run = px >= 0 ? (py < 0 ? o.corners[0] : o.corners[1]) : py < 0 ? o.corners[3] : o.corners[2];
    if (!run.length) {
      const dx = ax - hw, dy = ay - hh, dist = Math.hypot(dx, dy);
      return { d: dist, nx: dx / (dist || 1), ny: dy / (dist || 1) };
    }
    let best = Infinity, bx = 0, by = 0, bnx = 0, bny = 0;
    const n = run.length / 4;
    for (let k = 0; k < n - 1; k++) {
      const x1 = run[4 * k], y1 = run[4 * k + 1];
      const ex = run[4 * k + 4] - x1, ey = run[4 * k + 5] - y1;
      const l2 = ex * ex + ey * ey;
      const t = l2 > 1e-12 ? sat(((px - x1) * ex + (py - y1) * ey) / l2) : 0;
      const sx = x1 + ex * t, sy = y1 + ey * t;
      const d2 = (px - sx) ** 2 + (py - sy) ** 2;
      if (d2 < best) { best = d2; bx = sx; by = sy; bnx = run[4 * k + 2]; bny = run[4 * k + 3]; }
    }
    const dist = Math.sqrt(best);
    const dx = px - bx, dy = py - by;
    const dir = dx * bnx + dy * bny >= 0 ? 1 : -1;
    return dist > 1e-5 ? { d: dist * dir, nx: (dx / dist) * dir, ny: (dy / dist) * dir } : { d: 0, nx: bnx, ny: bny };
  }
  return qx > qy ? { d: qx - p, nx: Math.sign(px) || 1, ny: 0 } : { d: qy - p, nx: 0, ny: Math.sign(py) || 1 };
}

/* ------------------------------------------------------------ map planes */

const COS_SPREAD = Math.cos(1.08);
const COS_DIFFUSE = Math.cos(1.08 * 0.65);
const COS_SIDE = Math.cos(0.98);
const PAD = 2;

const pixelScale = (w: number, h: number) => (w * h > 250_000 ? 0.5 : Math.min(Math.max(devicePixelRatio || 1, 1), 2));

/** Paints the displacement field and the rim-light overlay. The expensive per-pixel pass. */
function renderPlanes(w: number, h: number, outline: Outline, bezel: number, dark: boolean): { field: string; overlay: HTMLCanvasElement } | null {
  const hw = w / 2, hh = h / 2, p = outline.extent;
  const bz = Math.max(1, Math.min(bezel, hw, hh));
  const paint = (isField: boolean): HTMLCanvasElement | null => {
    const cw = isField ? w : w + PAD * 2, ch = isField ? h : h + PAD * 2;
    const k = pixelScale(cw, ch);
    const width = Math.max(1, Math.round(cw * k)), height = Math.max(1, Math.round(ch * k));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const img = ctx.createImageData(width, height);
    const data = img.data;
    for (let j = 0; j < height; j++) {
      const py = (j + 0.5) / k - ch / 2;
      for (let i = 0; i < width; i++) {
        const px = (i + 0.5) / k - cw / 2;
        const o = (j * width + i) * 4;
        if (isField) {
          // Deep interior is neutral: skip the distance search entirely.
          // (Inside the straight-edge bands the distance is exact, so this is safe.)
          const ix = Math.abs(px), iy = Math.abs(py);
          if ((ix < hw - p && iy < hh - bz - 4) || (iy < hh - p && ix < hw - bz - 4)) { data[o] = data[o + 1] = data[o + 2] = 128; data[o + 3] = 255; continue; }
          const { d, nx, ny } = outlineField(px, py, outline);
          if (d < -(bz + 4)) { data[o] = data[o + 1] = data[o + 2] = 128; data[o + 3] = 255; continue; }
          const depth = sat(-d / bz);
          const edge = 1 - sat(Math.sqrt((2 - depth) * depth));
          data[o] = Math.round(255 * (0.5 - nx * edge * 0.5));
          data[o + 1] = Math.round(255 * (0.5 - ny * edge * 0.5));
          data[o + 2] = 128;
          data[o + 3] = Math.round(255 * sat(0.5 - d));
        } else {
          const qx = Math.abs(px) - (hw - p), qy = Math.abs(py) - (hh - p);
          if (Math.max(qx, qy) - p > PAD + 6 || Math.max(qx, qy) - p < -8) continue;
          const { d, nx, ny } = outlineField(px, py, outline);
          const coverage = sat(0.5 - d);
          const directional = Math.pow(sat((Math.abs(ny) - COS_SPREAD) / (1 - COS_SPREAD)), 1.25);
          const diffuseDir = Math.pow(sat((Math.abs(ny) - COS_DIFFUSE) / (1 - COS_DIFFUSE)), 1.25);
          const stroke = sat(d + 0.9 + 0.5) * sat(0.5 - d);
          let spec = directional * stroke;
          spec = spec / (1 + 0.5 * (1 - spec));
          const diffuse = diffuseDir * 0.18 * Math.pow(1 - sat(-d / 4.5), 2) * coverage;
          const highlight = sat(spec * (dark ? 0.82 : 1) + diffuse * (dark ? 0.4 : 1));
          const adj = d - 0.5;
          const fall = 1 - sat(-adj / 0.5);
          const ramp = (fall > 0 ? 1 : 0) * 0.25 + fall * 0.75;
          const band = ramp * sat(adj + 0.5 + 0.5) * sat(-adj + 0.5);
          const wx = sat((nx - COS_SIDE) / (1 - COS_SIDE)) * band;
          const wy = sat((-nx - COS_SIDE) / (1 - COS_SIDE)) * band;
          const shade = (wx / (1 + 0.4 * (1 - wx)) + wy / (1 + 0.4 * (1 - wy))) * (dark ? 0.6 : 0.48);
          const alpha = highlight + shade * (1 - highlight);
          if (alpha <= 0.002) continue;
          const light = ((dark ? 0.82 : 1) * highlight) / Math.max(alpha, 1e-5);
          data[o] = data[o + 1] = data[o + 2] = Math.round(255 * Math.min(1, light));
          data[o + 3] = Math.round(255 * alpha);
        }
      }
    }
    ctx.putImageData(img, 0, 0);
    return canvas;
  };
  try {
    const field = paint(true);
    const overlay = paint(false);
    return field && overlay ? { field: field.toDataURL("image/png"), overlay } : null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------ filters */

let defs: SVGSVGElement | null = null;
function defsHost(): SVGSVGElement {
  if (defs) return defs;
  defs = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  defs.setAttribute("aria-hidden", "true");
  defs.setAttribute("width", "0");
  defs.setAttribute("height", "0");
  defs.style.cssText = "position:fixed;width:0;height:0;overflow:hidden;pointer-events:none";
  document.body.appendChild(defs);
  return defs;
}

function setFilter(id: string, w: number, h: number, field: string, o: GlassOptions) {
  let filter = document.getElementById(id) as SVGFilterElement | null;
  if (!filter) {
    filter = document.createElementNS("http://www.w3.org/2000/svg", "filter");
    filter.id = id;
    filter.setAttribute("color-interpolation-filters", "sRGB");
    defsHost().appendChild(filter);
  }
  const table = toneTable(o.appearance);
  filter.innerHTML =
    `<feImage href="${field}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none" result="field"/>` +
    `<feDisplacementMap in="SourceGraphic" in2="field" scale="${o.refraction * 2}" xChannelSelector="R" yChannelSelector="G" result="refracted"/>` +
    `<feComponentTransfer in="refracted" result="tone"><feFuncR type="table" tableValues="${table}"/><feFuncG type="table" tableValues="${table}"/><feFuncB type="table" tableValues="${table}"/></feComponentTransfer>` +
    `<feComposite in="tone" in2="field" operator="in"/>`;
}

/* ------------------------------------------------------------ surfaces */

let uid = 0;

function enhance(el: HTMLElement) {
  const lens = el.querySelector<HTMLElement>(":scope > .glass-blur");
  if (!lens) return;
  const opts = PRESETS[el.dataset.glass ?? ""] ?? PRESETS.chip;
  const id = `lg-${++uid}`;
  // The rim is a canvas, not a background image: images count as LCP candidates, canvases don't.
  const rim = document.createElement("canvas");
  rim.className = "glass-rim";
  rim.setAttribute("aria-hidden", "true");
  lens.after(rim);

  let last = "";
  const build = () => {
    const w = Math.round(el.offsetWidth), h = Math.round(el.offsetHeight);
    if (w < 8 || h < 8) return;
    const radius = Math.round(Math.min(parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0, w / 2, h / 2));
    const key = `${w}x${h}r${radius}`;
    if (key === last) return;
    last = key;
    const outline = squircleOutline(w, h, radius);
    const planes = renderPlanes(w, h, outline, opts.bezel ?? Math.min(32, Math.min(w, h) / 2), opts.appearance === "dark");
    if (!planes) return;
    setFilter(id, w, h, planes.field, opts);
    const backdrop = `url(#${id}) blur(${opts.blur}px)`;
    lens.style.backdropFilter = backdrop;
    lens.style.setProperty("-webkit-backdrop-filter", backdrop);
    lens.style.filter = "none";
    lens.style.clipPath = outline.polygon;
    rim.width = planes.overlay.width;
    rim.height = planes.overlay.height;
    rim.getContext("2d")?.drawImage(planes.overlay, 0, 0);
    el.dataset.liquid = "refract";
  };

  // Resizes (the banner widens on scroll) rebuild once things settle; the old map stretches meanwhile.
  let t = 0;
  new ResizeObserver(() => {
    clearTimeout(t);
    t = window.setTimeout(() => requestIdleCallback?.(build, { timeout: 500 }) ?? build(), 160);
  }).observe(el);
  build();
}

export function liquidGlass(root: ParentNode = document) {
  if (!isChromium() || matchMedia("(prefers-reduced-transparency: reduce)").matches) return;
  const surfaces = Array.from(root.querySelectorAll<HTMLElement>(".glass[data-glass]"));
  // Build each surface the first time it nears the viewport.
  const io = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        enhance(e.target as HTMLElement);
      }),
    { rootMargin: "200px 0px" },
  );
  surfaces.forEach((s) => io.observe(s));
}
