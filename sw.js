// Kill switch for the old phone app's service worker, which was registered at this URL
// (/tijori/sw.js, scope /tijori/) before the app moved to /tijori/app/. Browsers re-check
// this script on the next visit, install this version, and it removes itself.
// It deletes only the old app's own caches (the origin is shared with other sites), never
// IndexedDB, so the vault on the phone stays. No fetch handler: everything goes to the network.
// Keep this file deployed for good, for phones that have not opened Tijori in a while.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k.startsWith("tijori-shell")) await caches.delete(k);
  await self.registration.unregister();
  for (const c of await self.clients.matchAll({ type: "window" })) c.navigate(c.url);
})()));
