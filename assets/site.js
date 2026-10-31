// Tijori website: the only script. No libraries, no tracking, no third-party requests.
// It fills in release details from version.json, wires the copy buttons and the phone
// menu, and adds two small touches (the sticky header line, the closing dial).
(() => {
  "use strict";
  const doc = document;
  const root = doc.documentElement;
  const $$ = (sel, el = doc) => Array.from(el.querySelectorAll(sel));

  // ---------- header line once the page scrolls ----------
  const head = doc.querySelector(".site-head");
  if (head) {
    let queued = false;
    const paint = () => { head.classList.toggle("is-stuck", window.scrollY > 6); queued = false; };
    window.addEventListener("scroll", () => { if (!queued) { queued = true; requestAnimationFrame(paint); } }, { passive: true });
    paint();
  }

  // ---------- phone menu: close on navigation, Escape, or a wide window ----------
  const menu = doc.querySelector(".menu");
  if (menu) {
    const close = () => { menu.open = false; };
    menu.addEventListener("click", (e) => { if (e.target.closest("a")) close(); });
    doc.addEventListener("keydown", (e) => { if (e.key === "Escape" && menu.open) { close(); menu.querySelector("summary").focus(); } });
    matchMedia("(min-width: 901px)").addEventListener("change", (e) => { if (e.matches) close(); });
    menu.addEventListener("toggle", () => { root.style.overflow = menu.open ? "hidden" : ""; });
  }

  // ---------- release details from version.json ----------
  const MiB = 1024 * 1024;
  const size = (b) => (typeof b === "number" && b > 0 ? (b >= MiB ? (b / MiB).toFixed(1) + " MB" : Math.max(1, Math.round(b / 1024)) + " KB") : null);
  const day = (iso) => {
    if (!iso) return null;
    const d = new Date(iso.length === 10 ? iso + "T12:00:00+05:30" : iso);
    if (isNaN(d)) return null;
    return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(d);
  };
  const read = (rel, key) => {
    const files = (rel && rel.files) || {};
    switch (key) {
      case "version": return rel && rel.version;
      case "date": return day(rel && rel.date);
      case "line": {
        if (!rel || !rel.version) return null;
        const s = size(files.setup && files.setup.size);
        return ["Version " + rel.version, s, "Windows 10 and 11"].filter(Boolean).join(" · ");
      }
      default: {
        const [f, prop] = key.split(".");
        const file = files[f];
        if (!file) return null;
        return prop === "size" ? size(file.size) : file[prop] || null;
      }
    }
  };
  const apply = (rel) => {
    const pending = !rel || !rel.version;
    root.dataset.release = pending ? "pending" : "live";
    $$("[data-v]").forEach((el) => {
      const value = read(rel, el.dataset.v);
      if (value) el.textContent = value;
      else if (pending && el.dataset.pending) el.textContent = el.dataset.pending;
    });
    $$("[data-href]").forEach((el) => {
      const key = el.dataset.href;
      const url = key === "notes" ? rel && rel.notesUrl : rel && rel.files && rel.files[key] && rel.files[key].url;
      if (url && /^https:\/\/github\.com\//.test(url)) el.href = url;
    });
    $$("[data-needs]").forEach((el) => { el.hidden = !read(rel, el.dataset.needs); });
  };
  if (doc.querySelector("[data-v],[data-href],[data-needs]")) {
    fetch("version.json", { cache: "no-cache" })
      .then((r) => (r.ok ? r.json() : null))
      .then(apply)
      .catch(() => { /* keep the text that ships in the page */ });
  }

  // ---------- copy buttons ----------
  const say = doc.createElement("p");
  say.className = "sr-only";
  say.setAttribute("role", "status");
  doc.body.appendChild(say);
  const copyText = async (text) => {
    try { await navigator.clipboard.writeText(text); return true; } catch { /* fall through */ }
    const t = doc.createElement("textarea");
    t.value = text; t.setAttribute("readonly", ""); t.className = "sr-only";
    doc.body.appendChild(t); t.select();
    let ok = false;
    try { ok = doc.execCommand("copy"); } catch { ok = false; }
    t.remove();
    return ok;
  };
  doc.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-copy]");
    if (!btn) return;
    const src = doc.querySelector(btn.dataset.copy);
    const text = src ? src.textContent.trim() : "";
    if (!text) return;
    const ok = await copyText(text);
    const label = btn.querySelector(".label");
    const before = label ? label.textContent : "";
    btn.classList.toggle("is-done", ok);
    if (label) label.textContent = ok ? "Copied" : "Press Ctrl+C";
    say.textContent = ok ? "Copied to the clipboard" : "Couldn't copy. Select the text and press Ctrl+C.";
    clearTimeout(btn._t);
    btn._t = setTimeout(() => { btn.classList.remove("is-done"); if (label) label.textContent = before; }, 2200);
  });

  // ---------- screenshots that have not been taken yet show a quiet plate ----------
  $$(".frame img").forEach((img) => {
    const miss = () => img.closest(".frame").classList.add("is-missing");
    if (img.complete && img.naturalWidth === 0) miss();
    else img.addEventListener("error", miss, { once: true });
  });

  // ---------- open a FAQ answer linked by #id ----------
  const openFromHash = () => {
    const id = decodeURIComponent(location.hash.slice(1));
    const el = id && doc.getElementById(id);
    if (el && el.tagName === "DETAILS") el.open = true;
  };
  window.addEventListener("hashchange", openFromHash);
  openFromHash();

  // ---------- table of contents: open in the page's HTML for wide screens, folded on phones ----------
  const toc = doc.querySelector("details.toc");
  if (toc && matchMedia("(max-width: 900px)").matches) toc.open = false;
  if (toc) toc.addEventListener("click", (e) => { if (e.target.closest("a") && matchMedia("(max-width: 900px)").matches) toc.open = false; });

  // ---------- table of contents follows the reading position ----------
  const tocLinks = $$(".toc a[href^='#']");
  if (tocLinks.length && "IntersectionObserver" in window) {
    const byId = new Map(tocLinks.map((a) => [decodeURIComponent(a.hash.slice(1)), a]));
    const seen = new Set();
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => (en.isIntersecting ? seen.add(en.target.id) : seen.delete(en.target.id)));
      const first = $$("[data-toc]").find((h) => seen.has(h.id));
      if (!first) return;
      tocLinks.forEach((a) => a.classList.toggle("is-active", a === byId.get(first.id)));
    }, { rootMargin: "-80px 0px -55% 0px" });
    $$("[data-toc]").forEach((h) => io.observe(h));
  }

  // ---------- the closing dial turns once, when it comes into view ----------
  const finale = doc.querySelector(".finale");
  if (finale && "IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      if (entries.some((en) => en.isIntersecting)) { finale.classList.add("is-in"); io.disconnect(); }
    }, { threshold: 0.35 });
    io.observe(finale);
  } else if (finale) {
    finale.classList.add("is-in");
  }
})();
