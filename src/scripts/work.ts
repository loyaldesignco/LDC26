/**
 * /work: category filter, sort, gallery/list toggle and the cursor-following preview card.
 * Every item is rendered at build time; this only filters, reorders and re-flows them.
 * Filter comes from ?f=, sort and view persist in localStorage (lp-work-sort, lp-work-view).
 */
import gsap from "gsap";

type Rhythm = { col: string; ratio: string; top: string };
type SortKey = "newest" | "oldest" | "az" | "za";

const SORT_LABELS: Record<SortKey, string> = { newest: "Most Recent", oldest: "Oldest", az: "A–Z", za: "Z–A" };
const store = {
  get: (k: string) => {
    try { return localStorage.getItem(k); } catch { return null; }
  },
  set: (k: string, v: string) => {
    try { localStorage.setItem(k, v); } catch { /* private mode */ }
  },
};

export function initWorkIndex() {
  const root = document.querySelector<HTMLElement>("[data-work]");
  if (!root) return;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const RHYTHM: Rhythm[] = JSON.parse(root.dataset.rhythm || "[]");
  const gallery = root.querySelector<HTMLElement>('[data-results="gallery"]')!;
  const list = root.querySelector<HTMLElement>('[data-results="list"]')!;
  const listOl = list.querySelector("ol")!;
  const empty = root.querySelector<HTMLElement>("[data-empty]")!;
  const status = root.querySelector<HTMLElement>("[data-results-status]")!;
  const filterBtns = Array.from(root.querySelectorAll<HTMLButtonElement>("[data-filter]"));
  const viewBtns = Array.from(root.querySelectorAll<HTMLButtonElement>("[data-view]"));
  const sortToggle = root.querySelector<HTMLButtonElement>("[data-sort-toggle]")!;
  const sortList = root.querySelector<HTMLElement>("#sort-list")!;
  const sortOpts = Array.from(sortList.querySelectorAll<HTMLButtonElement>("[data-sort]"));

  const cards = Array.from(gallery.querySelectorAll<HTMLElement>("[data-item]"));
  const rows = Array.from(listOl.querySelectorAll<HTMLElement>("[data-item]"));
  const original = new Map(cards.map((c, i) => [c.dataset.slug!, i]));

  const fromUrl = new URLSearchParams(location.search).get("f");
  const state = {
    filter: filterBtns.some((b) => b.dataset.filter === fromUrl) ? fromUrl! : "All",
    sort: ((s) => (s && s in SORT_LABELS ? s : "newest"))(store.get("lp-work-sort")) as SortKey,
    view: store.get("lp-work-view") === "list" ? "list" : "gallery",
  };

  const compare = (a: HTMLElement, b: HTMLElement) => {
    const ya = +(a.dataset.year || 0), yb = +(b.dataset.year || 0);
    const ta = a.dataset.title!, tb = b.dataset.title!;
    const tie = original.get(a.dataset.slug!)! - original.get(b.dataset.slug!)!;
    switch (state.sort) {
      case "oldest": return (ya || 9999) - (yb || 9999) || tie;
      case "az": return ta.localeCompare(tb);
      case "za": return tb.localeCompare(ta);
      default: return yb - ya || tie;
    }
  };
  const matches = (el: HTMLElement) => state.filter === "All" || el.dataset.cats!.split("|").includes(state.filter);

  function apply() {
    const visibleCards = cards.filter(matches).sort(compare);
    cards.forEach((c) => (c.hidden = !matches(c)));
    visibleCards.forEach((c, i) => {
      const r = RHYTHM[i % RHYTHM.length];
      c.style.gridColumn = r.col;
      c.style.marginTop = r.top;
      c.querySelector<HTMLElement>("[data-ratio]")!.style.aspectRatio = r.ratio;
      gallery.append(c);
    });
    const visibleRows = rows.filter(matches).sort(compare);
    rows.forEach((r) => (r.hidden = !matches(r)));
    visibleRows.forEach((r, i) => {
      r.querySelector("[data-num]")!.textContent = String(i + 1).padStart(2, "0");
      listOl.append(r);
    });

    gallery.hidden = state.view !== "gallery";
    list.hidden = state.view !== "list";
    empty.hidden = visibleCards.length > 0;
    status.textContent = `${visibleCards.length} ${visibleCards.length === 1 ? "project" : "projects"}${state.filter === "All" ? "" : ` in ${state.filter}`}`;

    filterBtns.forEach((b) => {
      const on = b.dataset.filter === state.filter;
      b.setAttribute("aria-pressed", String(on));
      b.textContent = on ? `[ ${b.dataset.filter} ]` : b.dataset.filter!;
    });
    viewBtns.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.view === state.view)));
    sortOpts.forEach((o) => o.setAttribute("aria-selected", String(o.dataset.sort === state.sort)));
    root!.querySelector("[data-sort-label]")!.textContent = `[ ${SORT_LABELS[state.sort]} ]`;
    window.dispatchEvent(new Event("loyal:layout"));
  }

  // Fade the results out, swap, then stagger them back in.
  function transition(change: () => void) {
    const current = state.view === "gallery" ? gallery : list;
    if (reduced) { change(); apply(); return; }
    gsap.to(current, {
      opacity: 0, y: 18, duration: 0.24, ease: "power2.in",
      onComplete: () => {
        change();
        apply();
        const next = state.view === "gallery" ? gallery : list;
        gsap.set([gallery, list], { opacity: 1, y: 0 });
        const kids = state.view === "gallery" ? cards.filter((c) => !c.hidden) : [listOl];
        gsap.fromTo(kids.slice(0, 20), { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 0.55, ease: "power3.out", stagger: 0.045, clearProps: "opacity,transform" });
        if (next !== current) next.style.opacity = "1";
      },
    });
  }

  filterBtns.forEach((b) =>
    b.addEventListener("click", () => {
      if (b.dataset.filter === state.filter) return;
      transition(() => {
        state.filter = b.dataset.filter!;
        const url = new URL(location.href);
        if (state.filter === "All") url.searchParams.delete("f"); else url.searchParams.set("f", state.filter);
        history.replaceState(null, "", url);
      });
    }),
  );
  viewBtns.forEach((b) =>
    b.addEventListener("click", () => {
      if (b.dataset.view === state.view) return;
      store.set("lp-work-view", b.dataset.view!);
      transition(() => (state.view = b.dataset.view as "gallery" | "list"));
    }),
  );

  // Sort menu
  const setOpen = (open: boolean) => {
    sortList.hidden = !open;
    sortToggle.setAttribute("aria-expanded", String(open));
    root!.querySelector<HTMLElement>("[data-sort-chevron]")!.style.transform = open ? "rotate(180deg)" : "";
    if (open) sortList.querySelector<HTMLElement>('[aria-selected="true"]')?.focus();
  };
  sortToggle.addEventListener("click", () => setOpen(sortList.hidden === true));
  sortOpts.forEach((o) =>
    o.addEventListener("click", () => {
      setOpen(false);
      sortToggle.focus();
      const k = o.dataset.sort as SortKey;
      store.set("lp-work-sort", k);
      if (k !== state.sort) transition(() => (state.sort = k));
    }),
  );
  sortList.addEventListener("keydown", (e) => {
    const i = sortOpts.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      sortOpts[(i + (e.key === "ArrowDown" ? 1 : -1) + sortOpts.length) % sortOpts.length].focus();
    }
    if (e.key === "Escape") { setOpen(false); sortToggle.focus(); }
  });
  document.addEventListener("click", (e) => {
    const t = e.target as Element;
    if (!sortList.hidden && !t.closest("[data-sort-toggle]") && !t.closest("#sort-list")) setOpen(false);
  });

  // List view: dim siblings, shift the active row, float a preview card after the cursor.
  const card = document.getElementById("lp-float-card");
  const fine = matchMedia("(pointer: fine)").matches;
  if (card && fine) {
    const img = card.querySelector<HTMLElement>("[data-float-img]")!;
    const label = card.querySelector<HTMLElement>("[data-float-label]")!;
    const qx = gsap.quickTo(card, "x", { duration: 0.55, ease: "power3" });
    const qy = gsap.quickTo(card, "y", { duration: 0.55, ease: "power3" });
    gsap.set(card, { x: innerWidth / 2, y: innerHeight / 2, scale: 0.7 });
    document.addEventListener("mousemove", (e) => { qx(e.clientX + 24); qy(e.clientY + 24); });
    rows.forEach((li) => {
      const a = li.querySelector<HTMLAnchorElement>("a")!;
      a.addEventListener("mouseenter", () => {
        list.classList.add("has-hover");
        rows.forEach((r) => r.querySelector("a")!.classList.toggle("is-active", r === li));
        if (a.dataset.img) {
          img.style.backgroundImage = `url('${a.dataset.img}')`;
          label.textContent = li.dataset.title!;
          gsap.to(card, { autoAlpha: 1, scale: 1, filter: "blur(0px)", duration: 0.45, ease: "power3.out", overwrite: "auto" });
        }
      });
      a.addEventListener("mouseleave", () => {
        list.classList.remove("has-hover");
        a.classList.remove("is-active");
        gsap.to(card, { autoAlpha: 0, scale: 0.7, filter: "blur(8px)", duration: 0.35, ease: "power2.in", overwrite: "auto" });
      });
    });
  }

  apply();
  if (fromUrl && state.filter !== "All") {
    setTimeout(() => {
      const el = document.getElementById("work-grid");
      if (!el) return;
      const y = el.getBoundingClientRect().top + scrollY - 80;
      if (window.__lenis) window.__lenis.scrollTo(y, { duration: 1.4 }); else scrollTo({ top: y, behavior: reduced ? "auto" : "smooth" });
    }, 900);
  }
}
