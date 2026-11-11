/**
 * Loyal motion layer, ported from the "Loyal Design 2026" prototype.
 *
 * Everything is opt-in through data attributes and leaves the page readable if it
 * never runs: the `motion` class that hides things is removed by a failsafe in
 * BaseLayout when this script doesn't report in, and reduced motion skips Lenis,
 * wipes, split text and scroll effects entirely.
 *
 *   data-split               words rise from behind a mask (translateY 115% + 5deg)
 *   data-reveal              fade and lift 56px on enter
 *   data-hud                 small meta that fades in after the intro
 *   data-parallax[=hero]     first child drifts inside its frame (data-depth = yPercent)
 *   data-roll / -roll-link   letter-roll hover, gradient row rolls in from below
 *   data-svc-list            service rows fan in from a stack as you scroll
 *   data-marquee-track       client logos, direction follows scroll
 *   data-hero ...            home hero: parallax, glass banner, background note, slideshow
 *   data-chapter-rail        home side rail tracking the current section
 */
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { CustomEase } from "gsap/CustomEase";
import Lenis from "lenis";

gsap.registerPlugin(ScrollTrigger, CustomEase);
CustomEase.create("energy", "M0,0 C0.32,0.72 0,1 1,1");

declare global {
  interface Window {
    __loyalMotion?: boolean;
    __lenis?: Lenis;
  }
}

const root = document.documentElement;
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const fine = matchMedia("(pointer: fine)").matches;
const $ = <T extends Element = HTMLElement>(s: string, el: ParentNode = document) => el.querySelector<T>(s);
const $$ = <T extends Element = HTMLElement>(s: string, el: ParentNode = document) => Array.from(el.querySelectorAll<T>(s));
const GRAD = "linear-gradient(100deg,#FF9C56 0%,#FF4AA1 55%,#AE433B 100%)";

let lenis: Lenis | null = null;
let menuOpen = false;
let toggleMenu: (fast?: boolean) => void = () => {};

function init() {
  window.__loyalMotion = true;
  underlayNav();
  rollText();
  toTop();
  chapterRail();
  headerHide();

  if (reduced) {
    root.classList.remove("motion");
    $("#lp-preloader")?.remove();
    $("#lp-wipe-in")?.remove();
    return;
  }

  // Above-the-fold work runs now; everything else is queued in small slices so no single
  // task blocks the main thread for long while the page is loading.
  const splits = $$("[data-split]");
  splits.filter((el) => isIntro(el)).forEach(splitWords);
  intro();
  blockReveals();
  smoothScroll();
  heroScroll();
  const later: (() => void)[] = [
    cursor,
    anchorWipe,
    ...splits.filter((el) => !isIntro(el)).map((el) => () => splitWords(el)),
    reveals,
    serviceStack,
    marquee,
    parallax,
    heroSlideshow,
    glass,
    refreshes,
    revealFailsafe,
  ];
  const run = () => {
    const end = performance.now() + 12;
    while (later.length && performance.now() < end) later.shift()!();
    if (later.length) setTimeout(run, 0);
  };
  setTimeout(run, 0);
}

/* ---------------------------------------------------------------- scroll */

function smoothScroll() {
  lenis = new Lenis({ duration: 1.7, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: true, wheelMultiplier: 0.9 });
  window.__lenis = lenis;
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((t) => lenis?.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}

const scrollToY = (y: number, smooth: boolean) => {
  if (lenis) lenis.scrollTo(y, smooth ? { duration: 1.6 } : { immediate: true, force: true });
  else scrollTo({ top: y, behavior: smooth && !reduced ? "smooth" : "auto" });
};

function refreshes() {
  const refresh = () => ScrollTrigger.refresh();
  document.fonts?.ready.then(() => setTimeout(refresh, 60));
  addEventListener("load", refresh);
  [400, 1200, 2400].forEach((ms) => setTimeout(refresh, ms));
  addEventListener("loyal:layout", () => requestAnimationFrame(refresh));
  let t = 0;
  new ResizeObserver(() => { clearTimeout(t); t = window.setTimeout(refresh, 140); }).observe(document.body);
}

/* ---------------------------------------------------------------- chrome */

function cursor() {
  const dot = $("#lp-cursor");
  if (!dot || !fine) return;
  dot.style.display = "block";
  gsap.set(dot, { xPercent: -50, yPercent: -50, x: -40, y: -40 });
  const qx = gsap.quickTo(dot, "x", { duration: 0.5, ease: "power3" });
  const qy = gsap.quickTo(dot, "y", { duration: 0.5, ease: "power3" });
  addEventListener("mousemove", (e) => { qx(e.clientX); qy(e.clientY); });
  addEventListener("mouseover", (e) => {
    const hit = (e.target as Element).closest?.("a,button,select,input,textarea,label,summary");
    gsap.to(dot, { scale: hit ? 3.4 : 1, duration: 0.3, ease: "power2.out" });
  });
  document.addEventListener("mouseleave", () => gsap.to(dot, { scale: 0, duration: 0.2 }));
  document.addEventListener("mouseenter", () => gsap.to(dot, { scale: 1, duration: 0.2 }));
}

function headerHide() {
  const h = $("#lp-header");
  if (!h) return;
  let last = scrollY;
  const on = () => {
    const y = scrollY;
    if (y > 400 && y > last + 4 && !menuOpen) h.style.transform = "translateY(-100%)";
    else if (y < last - 4 || y <= 400) h.style.transform = "";
    last = y;
  };
  addEventListener("scroll", on, { passive: true });
  h.addEventListener("focusin", () => (h.style.transform = ""));
}

function toTop() {
  const btn = $("[data-totop]");
  if (!btn) return;
  const on = () => btn.classList.toggle("is-on", scrollY > innerHeight * 1.5);
  addEventListener("scroll", on, { passive: true });
  on();
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    scrollToY(0, true);
    $<HTMLElement>("#main")?.focus({ preventScroll: true });
  });
}

/** Same-page anchors: an ink panel wipes up, the page jumps, the panel wipes away. */
function anchorWipe() {
  const wipe = $("#lp-wipe");
  let busy = false;
  document.addEventListener("click", (e) => {
    const a = (e.target as Element).closest?.<HTMLAnchorElement>('a[href^="#"]');
    if (!a || a.hasAttribute("data-totop") || a.getAttribute("href") === "#main") return;
    const target = document.getElementById(a.getAttribute("href")!.slice(1));
    if (!target) return;
    e.preventDefault();
    if (menuOpen) toggleMenu(true);
    const go = () => {
      scrollToY(target.getBoundingClientRect().top + scrollY - 64, false);
      ScrollTrigger.refresh();
    };
    if (!wipe || busy) return go();
    busy = true;
    gsap.timeline({ onComplete: () => (busy = false) })
      .set(wipe, { display: "block", yPercent: 100 })
      .to(wipe, { yPercent: 0, duration: 0.6, ease: "expo.in" })
      .add(go)
      .to(wipe, { yPercent: -100, duration: 0.9, ease: "expo.out" }, "+=0.12")
      .set(wipe, { display: "none" });
  });
}

/* ---------------------------------------------------------------- underlay nav */

function underlayNav() {
  const btn = $<HTMLButtonElement>("[data-underlay-nav-toggle]");
  const menu = $("[data-underlay-nav-menu]");
  const main = $("[data-main]");
  const overlay = $("[data-underlay-nav-overlay]");
  if (!btn || !menu || !main || !overlay) return;
  const labels = $$(".underlay-nav__toggle-label");
  const bars = $$(".underlay-nav__toggle-bar");
  const large = $$("[data-reveal-l]", menu);
  const small = $$("[data-reveal-s]", menu);
  const border = $(".underlay-nav__bottom-border", menu);
  const dark = $(".underlay-nav__dark", overlay);
  const corners = $$(".underlay-nav__corner", overlay);
  const rows = $$(".underlay-nav__border-row", overlay);
  const meta = $$("[data-header-meta]");
  const offset = () => -menu.offsetWidth;

  const setState = (open: boolean) => {
    menuOpen = open;
    btn.setAttribute("aria-expanded", String(open));
    btn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    menu.toggleAttribute("inert", !open);
    main.toggleAttribute("inert", open);
    document.body.dataset.menu = open ? "open" : "";
    if (open) lenis?.stop(); else lenis?.start();
  };

  if (reduced) {
    toggleMenu = (fast) => {
      setState(fast ? false : !menuOpen);
      gsap.set(menu, { visibility: menuOpen ? "visible" : "hidden" });
      gsap.set([main, overlay], { x: menuOpen ? offset() : 0 });
      gsap.set(overlay, { visibility: menuOpen ? "visible" : "hidden", pointerEvents: menuOpen ? "auto" : "none" });
      gsap.set(dark, { autoAlpha: menuOpen ? 1 : 0 });
      gsap.set(labels, { yPercent: menuOpen ? -100 : 0 });
      if (!menuOpen) gsap.set(main, { clearProps: "transform" });
    };
  } else {
    gsap.set(dark, { autoAlpha: 0 });
    gsap.set(border, { scaleX: 0 });
    gsap.set(rows[0], { yPercent: -100 });
    gsap.set(rows[1], { yPercent: 100 });
    gsap.set(corners, { scale: 0 });
    const tl = gsap.timeline({ paused: true, defaults: { ease: "energy" } });
    tl.set([overlay, menu], { visibility: "visible" }, 0)
      .set(overlay, { pointerEvents: "auto" }, 0)
      .to([main, overlay], { x: offset, duration: 0.7 }, 0)
      .to(dark, { autoAlpha: 1, duration: 0.5 }, 0)
      .to(corners, { scale: 1, duration: 0.5 }, 0)
      .to(rows, { yPercent: 0, duration: 0.5 }, 0)
      .to(labels, { yPercent: -100, duration: 0.4 }, 0)
      .to(meta, { autoAlpha: 0, duration: 0.3 }, 0)
      .to(bars[0], { y: 3.5, rotation: 45, duration: 0.35, ease: "back.out(1.4)" }, 0.05)
      .to(bars[1], { y: -3.5, rotation: -45, duration: 0.35, ease: "back.out(1.4)" }, 0.05)
      .fromTo(large, { autoAlpha: 0, xPercent: 25 }, { autoAlpha: 1, xPercent: 0, duration: 0.7, stagger: 0.05 }, 0)
      .fromTo(small, { autoAlpha: 0, yPercent: 100 }, { autoAlpha: 1, yPercent: 0, duration: 0.5, stagger: 0.03, ease: "power3.out" }, 0.3)
      .to(border, { scaleX: 1, duration: 0.5 }, "<");
    const enterEnd = tl.duration();
    tl.addPause();
    tl.to([large, small], { autoAlpha: 0, duration: 0.3 }, "<")
      .to([main, overlay], { x: 0, duration: 0.6 }, "<")
      .to(dark, { autoAlpha: 0, duration: 0.35, ease: "power2.inOut" }, "<")
      .to(corners, { scale: 0, duration: 0.5 }, "<")
      .to(rows[0], { yPercent: -100, duration: 0.5 }, "<")
      .to(rows[1], { yPercent: 100, duration: 0.5 }, "<")
      .to(labels, { yPercent: 0, duration: 0.25, ease: "power3.in" }, "<+=0.1")
      .to(bars, { y: 0, rotation: 0, duration: 0.25, ease: "power3.in" }, "<")
      .to(meta, { autoAlpha: 1, duration: 0.3 }, "<")
      .set(overlay, { visibility: "hidden", pointerEvents: "none" })
      .set(menu, { visibility: "hidden" })
      // A transform left on the page wrapper breaks every position:fixed child inside it.
      .set(main, { clearProps: "transform" });

    toggleMenu = (fast) => {
      if (fast && !menuOpen) return;
      setState(fast ? false : !menuOpen);
      if (menuOpen) {
        tl.invalidate();
        if (tl.time() >= enterEnd) tl.restart(); else tl.play();
      } else if (fast) {
        tl.pause(tl.duration());
      } else if (tl.time() < enterEnd) tl.reverse();
      else tl.play();
    };

    let rt = 0;
    addEventListener("resize", () => {
      clearTimeout(rt);
      rt = window.setTimeout(() => (menuOpen ? gsap.set([main, overlay], { x: offset() }) : tl.invalidate()), 150);
    });
  }

  btn.addEventListener("click", () => toggleMenu());
  overlay.addEventListener("click", () => menuOpen && toggleMenu());
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && menuOpen) { toggleMenu(); btn.focus(); }
  });
  // Links in the menu that stay on this page close it first.
  menu.addEventListener("click", (e) => {
    const a = (e.target as Element).closest("a");
    if (a && a.pathname === location.pathname && !a.hash) { e.preventDefault(); toggleMenu(); }
  });
}

/* ---------------------------------------------------------------- letter roll */

function rollText() {
  $$<HTMLAnchorElement>("[data-roll], [data-roll-link]").forEach((a) => {
    if (a.dataset.fx) return;
    a.dataset.fx = "1";
    const walker = document.createTreeWalker(a, NodeFilter.SHOW_TEXT);
    let tn: Text | null = null;
    for (let n = walker.nextNode(); n; n = walker.nextNode()) if (n.textContent?.trim()) { tn = n as Text; break; }
    if (!tn) return;
    const text = tn.textContent!.replace(/\s+$/, "");
    const n = text.length;
    const wrap = document.createElement("span");
    wrap.setAttribute("aria-hidden", "true");
    wrap.style.cssText = "position:relative;display:inline-block;overflow:hidden;vertical-align:bottom;padding-bottom:0.14em;margin-bottom:-0.14em";
    const row = (grad: boolean) => {
      const r = document.createElement("span");
      r.style.cssText = "display:block;white-space:nowrap" + (grad ? ";position:absolute;inset:0" : "");
      for (let i = 0; i < n; i++) {
        const s = document.createElement("span");
        s.textContent = text[i] === " " ? " " : text[i];
        let css = `display:inline-block;transform:translateY(${grad ? "110%" : "0"});transition:transform 0.55s cubic-bezier(0.76,0,0.24,1) ${i * 26}ms`;
        if (grad) css += `;background-image:${GRAD};background-size:${n * 100}% 100%;background-position:${n > 1 ? (i / (n - 1)) * 100 : 0}% 0;-webkit-background-clip:text;background-clip:text;color:transparent`;
        s.style.cssText = css;
        r.append(s);
      }
      return r;
    };
    const base = row(false), over = row(true);
    wrap.append(base, over);
    const sr = document.createElement("span");
    sr.className = "sr-only";
    sr.textContent = text;
    tn.replaceWith(sr, wrap);
    const set = (on: boolean) => {
      for (const s of base.children) (s as HTMLElement).style.transform = on ? "translateY(-110%)" : "translateY(0)";
      for (const s of over.children) (s as HTMLElement).style.transform = on ? "translateY(0)" : "translateY(110%)";
    };
    const host = a.closest<HTMLElement>("[data-roll-host]") || a;
    host.addEventListener("mouseenter", () => set(true));
    host.addEventListener("mouseleave", () => set(false));
    a.addEventListener("focus", () => set(true));
    a.addEventListener("blur", () => set(false));
  });
}

/* ---------------------------------------------------------------- split + intro */

function splitWords(el: HTMLElement) {
  const wrap = () => {
    const o = document.createElement("span");
    o.className = "lp-w-o";
    const i = document.createElement("span");
    i.className = "lp-w";
    o.append(i);
    return { o, i };
  };
  Array.from(el.childNodes).forEach((node) => {
    if (node.nodeType === 3) {
      const frag = document.createDocumentFragment();
      node.textContent!.split(/(\s+)/).forEach((part) => {
        if (!part) return;
        if (/^\s+$/.test(part)) return frag.append(" ");
        const { o, i } = wrap();
        i.textContent = part;
        frag.append(o);
      });
      node.replaceWith(frag);
    } else if (node.nodeType === 1 && (node as Element).tagName !== "BR") {
      const { o, i } = wrap();
      node.replaceWith(o);
      i.append(node);
    }
  });
  el.classList.add("is-split");
}

const isIntro = (el: Element) => Boolean(el.closest("#top")) || (el.tagName === "H1" && !document.getElementById("top"));

function intro() {
  const pre = $("#lp-preloader");
  const counter = $("#lp-counter");
  const wipeIn = $("#lp-wipe-in");
  const words = $$(".lp-w").filter((w) => isIntro(w.closest("[data-split]")!));
  const huds = $$("[data-hud]").filter((h) => !h.closest("#top"));
  // Hero copy stays painted from the first frame (it's the page's largest text, so hiding it
  // would hold back LCP); it only slides into place.
  const heroHuds = $$("#top [data-hud]");
  const heroFrame = $('[data-parallax="hero"]');
  const tl = gsap.timeline();

  let seen = false;
  try { seen = sessionStorage.getItem("lp-intro") === "1"; sessionStorage.setItem("lp-intro", "1"); } catch { /* private mode */ }

  if (pre && !seen) {
    const n = { v: 0 };
    tl.to(n, { v: 100, duration: 1.6, ease: "power2.inOut", onUpdate: () => counter && (counter.textContent = String(Math.round(n.v)).padStart(3, "0")) })
      .to(pre, { yPercent: -100, duration: 1.15, ease: "expo.inOut" }, "+=0.15")
      .set(pre, { display: "none" });
  } else if (pre) {
    tl.to(pre, { yPercent: -100, duration: 0.9, ease: "expo.inOut" }).set(pre, { display: "none" });
  } else if (wipeIn) {
    tl.to(wipeIn, { yPercent: -100, duration: 0.9, ease: "expo.inOut" }).set(wipeIn, { display: "none" });
  }
  if (heroFrame) tl.fromTo(heroFrame, { scale: 1.12, opacity: 0.001 }, { scale: 1, opacity: 1, duration: 2, ease: "expo.out" }, "-=0.5");
  if (words.length) tl.to(words, { y: 0, rotate: 0, duration: 1.5, ease: "expo.out", stagger: { each: 0.06, ease: "power1.in" } }, heroFrame ? "<0.1" : "-=0.4");
  if (heroHuds.length) tl.fromTo(heroHuds, { y: 14 }, { y: 0, duration: 1.1, stagger: 0.12, ease: "power2.out" }, "<0.4");
  if (huds.length) tl.fromTo(huds, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 1.1, stagger: 0.12, ease: "power2.out" }, "<");
}

/* ---------------------------------------------------------------- reveals */

function observe(el: Element, fn: (el: Element, instant: boolean) => void) {
  const io = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (e.isIntersecting) { io.unobserve(e.target); fn(e.target, false); }
        // Already above the viewport (anchor jump, restored scroll): snap to the end state.
        else if (e.boundingClientRect.bottom < 0) { io.unobserve(e.target); fn(e.target, true); }
      }),
    { rootMargin: "0px 0px -8% 0px", threshold: 0.01 },
  );
  io.observe(el);
}

function reveals() {
  $$("[data-split]").forEach((el) => {
    if (isIntro(el)) return;
    observe(el, (t, now) => gsap.to($$(".lp-w", t), { y: 0, rotate: 0, duration: now ? 0 : 1.4, ease: "expo.out", stagger: now ? 0 : 0.05 }));
  });
}

/** Block reveals are wired first thing, so content in the opening view starts fading in on the first frames. */
function blockReveals() {
  $$("[data-reveal]").forEach((el) => {
    if (el.closest("#top")) return;
    observe(el, (t, now) => gsap.to(t, { opacity: 1, y: 0, duration: now ? 0 : 1.6, ease: "expo.out" }));
  });
}

/** Anything in view that's still hidden after 3.5s gets shown: a missed observer never hides content. */
function revealFailsafe() {
  setTimeout(() => {
    const vh = innerHeight;
    const inView = (el: Element) => { const r = el.getBoundingClientRect(); return r.top < vh * 0.85 && r.bottom > 0; };
    $$("[data-split]").filter(inView).forEach((el) => {
      const w = $(".lp-w", el);
      if (w && Math.abs(gsap.getProperty(w, "y") as number) > 2) gsap.to($$(".lp-w", el), { y: 0, rotate: 0, duration: 0.7, ease: "expo.out", stagger: 0.02, overwrite: true });
    });
    $$("[data-reveal], [data-hud]").filter((el) => inView(el) && parseFloat(getComputedStyle(el).opacity) < 0.9)
      .forEach((el) => gsap.to(el, { opacity: 1, y: 0, duration: 0.7, ease: "expo.out", overwrite: true }));
  }, 3500);
}

/* ---------------------------------------------------------------- scroll-linked */

/** Service rows start stacked at the bottom of the list, slightly fanned, and deal out as you scroll. */
function serviceStack() {
  const list = $("[data-svc-list]");
  const rows = $$("[data-svc-row]");
  if (!list || rows.length < 2) return;
  const n = rows.length;
  const restY = (r: Element, i: number) => {
    const lb = list.getBoundingClientRect(), rb = r.getBoundingClientRect();
    return lb.bottom - rb.bottom + ((gsap.getProperty(r, "y") as number) || 0) - (n - 1 - i) * 7;
  };
  gsap.timeline({ scrollTrigger: { trigger: list, start: "top 88%", end: "bottom 62%", scrub: 0.7, invalidateOnRefresh: true } })
    .fromTo(
      rows,
      { y: (i, t) => restY(t, i), rotate: (i) => (i % 2 ? 3.4 : -3.4) * (1 - i / n), scale: 0.95, opacity: 0.55 },
      { y: 0, rotate: 0, scale: 1, opacity: 1, ease: "power2.out", duration: 1, stagger: 0.32 },
    );
}

/** Logos drift left while scrolling down, right while scrolling up. */
function marquee() {
  const tracks = $$("[data-marquee-track]");
  if (!tracks.length) return;
  tracks.forEach((t) => { t.style.animation = "none"; t.style.willChange = "transform"; });
  const BASE = 58;
  let x = 0, speed = -BASE, target = -BASE, last = performance.now(), lastY = scrollY;
  addEventListener("scroll", () => {
    const y = scrollY;
    if (Math.abs(y - lastY) < 1) return;
    target = y > lastY ? -BASE : BASE;
    lastY = y;
  }, { passive: true });
  const band = tracks[0].parentElement!;
  let visible = true;
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(band);
  const loop = (t: number) => {
    const dt = Math.min(0.05, (t - last) / 1000);
    last = t;
    if (visible) {
      speed += (target - speed) * Math.min(1, dt * 3.4);
      x += speed * dt;
      const w = tracks[0].getBoundingClientRect().width;
      if (w) x = (((x % w) + w) % w) - w;
      const tx = `translate3d(${x.toFixed(2)}px,0,0)`;
      tracks.forEach((tr) => (tr.style.transform = tx));
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

function parallax() {
  $$("[data-parallax]").forEach((el) => {
    if (el.closest("#top")) return;
    const img = el.firstElementChild as HTMLElement | null;
    if (!img) return;
    const depth = parseFloat(el.dataset.depth || "8");
    gsap.set(img, { scale: 1 + depth / 50 + 0.012 });
    gsap.fromTo(img, { yPercent: -depth }, { yPercent: depth, ease: "none", scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: 0.6 } });
  });
}

/** Home hero: background drifts, the glass sheen sweeps, the note draws in, the banner widens on release. */
function heroScroll() {
  const hero = $("[data-hero]");
  const img = $("[data-parallax-img]");
  if (!hero || !img) return;
  const canvas = $("[data-hero-canvas]");
  const sheen = $("[data-glass-sheen]", hero);
  const banner = $("[data-glass-banner]");
  const line = $("[data-hero-note-line]");
  const label = $("[data-hero-note-label]");
  let docked: boolean | undefined;
  let ticking = false;
  const frame = () => {
    ticking = false;
    const r = hero.getBoundingClientRect();
    const total = Math.max(1, r.height - innerHeight);
    const p = Math.min(1, Math.max(0, -r.top / total));
    const tf = `translateY(${((p - 0.5) * r.height * 0.085).toFixed(1)}px) scale(1.2)`;
    img.style.transform = tf;
    if (canvas) canvas.style.transform = tf;
    const lp = Math.min(1, Math.max(0, (p - 0.02) / 0.14));
    if (line) line.style.transform = `scaleX(${lp.toFixed(3)})`;
    label?.classList.toggle("is-on", lp > 0.85);
    if (sheen) sheen.style.backgroundPosition = `${(100 - p * 100).toFixed(2)}% 0`;
    const d = p < 0.96;
    if (banner && d !== docked) {
      docked = d;
      gsap.to(banner, { width: d ? "90%" : "100%", duration: 1, ease: "expo.out", overwrite: "auto" });
    }
  };
  const on = () => { if (!ticking) { ticking = true; requestAnimationFrame(frame); } };
  addEventListener("scroll", on, { passive: true });
  addEventListener("resize", on);
  frame();
}

/** Two or more hero backgrounds cross over with a lens-refraction reveal every 25s (WebGL, loaded on demand). */
function heroSlideshow() {
  const canvas = $<HTMLCanvasElement>("[data-hero-canvas]");
  const hero = $("[data-hero]");
  if (!canvas || !hero) return;
  const slides: string[] = JSON.parse(canvas.dataset.slides || "[]");
  const meta: { label: string; href: string; logo: string }[] = JSON.parse(canvas.dataset.meta || "[]");
  if (slides.length < 2) return;
  // The first cross-over is 25s in, so the WebGL layer (three.js + shader compile + texture
  // uploads) waits for the visitor to do something, or 15s, keeping it off the critical path.
  let started = false;
  const evs = ["pointermove", "pointerdown", "keydown", "wheel", "touchstart", "scroll"] as const;
  const start = () => {
    if (started) return;
    started = true;
    evs.forEach((e) => removeEventListener(e, start));
    const go = () => import("./hero-gl").then(({ heroGL }) => heroGL(canvas, hero, slides, (i) => setNote(meta[i]))).catch(() => {});
    if ("requestIdleCallback" in window) requestIdleCallback(go, { timeout: 2000 }); else setTimeout(go, 200);
  };
  evs.forEach((e) => addEventListener(e, start, { once: true, passive: true }));
  setTimeout(start, 15000);
}

/** Upgrades .glass surfaces to refracting liquid glass once the page is idle (Chromium only). */
function glass() {
  if (!document.querySelector(".glass[data-glass]")) return;
  // Built on the visitor's first move or scroll (or after 10s): the frosted fallback shows
  // until then, and the map painting stays out of the page-load window.
  const evs = ["pointermove", "pointerdown", "keydown", "wheel", "touchstart", "scroll"] as const;
  let done = false;
  const go = () => {
    if (done) return;
    done = true;
    evs.forEach((e) => removeEventListener(e, go));
    import("./liquid-glass").then(({ liquidGlass }) => liquidGlass()).catch(() => {});
  };
  evs.forEach((e) => addEventListener(e, go, { once: true, passive: true }));
  setTimeout(go, 10000);
}

function setNote(m?: { label: string; href: string; logo: string }) {
  if (!m) return;
  const a = $<HTMLAnchorElement>("[data-hero-note-label]");
  const text = $("[data-hero-note-text]");
  const logo = $("[data-hero-note-logo]");
  if (a) a.href = m.href;
  if (text) text.textContent = `${m.label} ↗`;
  if (logo) {
    logo.style.display = m.logo ? "" : "none";
    if (m.logo) logo.style.setProperty("mask-image", `url('${m.logo}')`), logo.style.setProperty("-webkit-mask-image", `url('${m.logo}')`);
  }
}

/* ---------------------------------------------------------------- chapter rail */

function chapterRail() {
  const rail = $("[data-chapter-rail]");
  if (!rail) return;
  const items = $$("[data-rail-item]", rail);
  const paint = (id: string) => items.forEach((it) => it.classList.toggle("is-on", it.dataset.for === id));
  const io = new IntersectionObserver(
    (entries) => {
      const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (vis) paint(vis.target.id);
    },
    { rootMargin: "-45% 0px -45% 0px", threshold: [0, 0.01, 0.5, 1] },
  );
  items.forEach((it) => { const s = document.getElementById(it.dataset.for!); if (s) io.observe(s); });
}

init();
