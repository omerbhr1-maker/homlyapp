const CACHE = "homly-v1";
const STATIC = /\/_next\/static\//;

// Install — activate immediately without waiting for old tabs to close.
self.addEventListener("install", () => self.skipWaiting());

// Activate — delete stale caches and claim all clients.
self.addEventListener("activate", (e) =>
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  ),
);

self.addEventListener("fetch", (e) => {
  const { request } = e;

  // Only handle GET; skip API routes and cross-origin requests.
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // Cache-first for hashed static assets — they never change.
  if (STATIC.test(url.pathname)) {
    e.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((res) => {
            caches.open(CACHE).then((c) => c.put(request, res.clone()));
            return res;
          }),
      ),
    );
    return;
  }

  // Stale-while-revalidate for pages and other assets.
  e.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(request).then((cached) => {
        const fresh = fetch(request).then((res) => {
          cache.put(request, res.clone());
          return res;
        });
        return cached ?? fresh;
      }),
    ),
  );
});
