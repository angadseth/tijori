// Tijori app shell: works offline after the first visit. Vault data lives in IndexedDB, never here.
const CACHE = "tijori-app-v4";
// The first visit loads everything before this worker controls the page, so the fetch handler
// below never sees it: precache the shell on install, or the app would not open offline until
// a second online visit. That is the page, what index.html loads, and the files those name
// (lazy chunks, fonts), minus the big AI runtime and PDF worker, which still cache on first use.
const SKIP = /\/assets\/(ort-wasm|transformers|pdf\.worker)/;
async function precache() {
  const cache = await caches.open(CACHE), base = new URL("./", location.href);
  const page = await fetch(base, { cache: "no-cache" });
  if (!page.ok) return;
  const html = await page.clone().text();
  await cache.put("./", page);
  const first = new Set([...html.matchAll(/(?:src|href)="([^"#?]+)"/g)].map((m) => new URL(m[1], base).href));
  const more = new Set();
  await Promise.allSettled([...first].map(async (u) => {
    const r = await fetch(u, { cache: "no-cache" });
    if (!r.ok) return;
    if (/\.(js|css)$/.test(u)) for (const m of (await r.clone().text()).matchAll(/assets\/[\w.-]+?\.(?:js|css|woff2)/g)) more.add(new URL(m[0], base).href);
    await cache.put(u, r);
  }));
  await Promise.allSettled([...more].filter((u) => !first.has(u) && !SKIP.test(u)).map((u) => cache.add(u)));
}
self.addEventListener("install", (e) => { self.skipWaiting(); e.waitUntil(precache().catch(() => undefined)); });
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith("tijori-app-") && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  // pages: network first so updates arrive; everything else (hashed files): cache first
  if (e.request.mode === "navigate") {
    e.respondWith(fetch(e.request).then((r) => { const c = r.clone(); caches.open(CACHE).then((x) => x.put("./", c)); return r; }).catch(() => caches.match("./")));
    return;
  }
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((r) => {
    if (r.ok) { const c = r.clone(); caches.open(CACHE).then((x) => x.put(e.request, c)); }
    return r;
  })));
});
