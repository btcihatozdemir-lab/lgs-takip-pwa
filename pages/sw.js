self.addEventListener('install', function () { self.skipWaiting() })
self.addEventListener('activate', function (event) {
  event.waitUntil(Promise.all([
    caches.keys().then(function (anahtarlar) {
      return Promise.all(anahtarlar.map(function (anahtar) { return caches.delete(anahtar) }))
    }),
    self.clients.claim(),
              self.clients.matchAll({ type: 'window' }).then(function (pencereler) {
      return Promise.all(pencereler.map(function (pencere) { return pencere.navigate(pencere.url) }))
    }),
  ]))
})
self.addEventListener('fetch', function (event) {
  if (event.request.mode !== 'navigate') return
  var adres = new URL(event.request.url)
  var yol = adres.pathname.replace(/^\/lgs-takip-pwa\/?/, '')
  event.respondWith(Response.redirect('https://rota.okulotomasyon.com/' + yol + adres.search + adres.hash, 302))
})
