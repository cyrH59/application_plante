const CACHE_NAME = "plantcare-v6";
const APP_ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./styles.css?v=2",
  "./styles.css?v=3",
  "./styles.css?v=4",
  "./styles.css?v=5",
  "./styles.css?v=6",
  "./app.js",
  "./app.js?v=2",
  "./app.js?v=3",
  "./app.js?v=4",
  "./app.js?v=5",
  "./app.js?v=6",
  "./src/config.js",
  "./src/config.js?v=3",
  "./src/engines.js",
  "./src/engines.js?v=3",
  "./src/supabase-config.js",
  "./src/supabase-config.js?v=5",
  "./src/supabase-config.js?v=6",
  "./src/supabase-client.js",
  "./src/supabase-client.js?v=5",
  "./src/supabase-client.js?v=6",
  "./src/supabase-repository.js",
  "./src/supabase-repository.js?v=5",
  "./src/supabase-repository.js?v=6",
  "./manifest.webmanifest",
  "./icon.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match("./index.html"));
    })
  );
});
