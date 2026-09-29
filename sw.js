const CACHE = "last-man-v15-codename-refresh";
const ASSETS = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./astra.css", "./astra.js?v=codename-2", "./game-launcher.js", "./game.html", "./game.css?v=expedition-1", "./game.js?v=expedition-1", "./game-rules.mjs", "./scope-shot.mjs", "./touch-controls.mjs", "./expedition-rules.mjs", "./vendor/three.module.js"];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS.map(url => new Request(url, { cache: "reload" })))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request, new URL(e.request.url).origin === self.location.origin ? { cache: "no-cache" } : {})
      .then(res => {
        const cp = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, cp));
        return res;
      })
      .catch(() => caches.match(e.request).then(r => r || caches.match("./index.html")))
  );
});
