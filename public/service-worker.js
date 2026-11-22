const publicPages = new Set(['/', '/ladda', '/energi', '/elbilsabonnemang', '/energioptimering']);
const offlinePage = `<!doctype html>
<html lang="sv">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Du är offline | Flexexa</title>
<style>
  :root { color-scheme: light; background: #f5f6ef; color: #123c35; font: 1rem/1.5 system-ui, sans-serif; }
  main { max-width: 36rem; margin: 12vh auto 0; padding: 1.5rem; }
  h1 { font-size: clamp(2rem, 8vw, 3rem); line-height: 1.1; }
  a { color: inherit; text-underline-offset: .2em; }
</style>
<main>
  <p>Flexexa</p>
  <h1>Du är offline</h1>
  <p>Anslut till internet för att öppna sidan.</p>
  <a href="">Försök igen</a>
</main>
</html>`;

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || request.mode !== 'navigate' || request.destination !== 'document' || request.headers.has('authorization')) return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.search || !publicPages.has(url.pathname)) return;

  // Only this static response can be shown without a network. Online replies
  // pass through, and requests outside the public list never enter this path.
  event.respondWith(fetch(request).catch(() => new Response(offlinePage, {
    status: 503,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'",
    },
  })));
});
