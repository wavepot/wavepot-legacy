self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return

  // respondWith needs to be called synchronously
  event.respondWith(async function () {
    const cache = await caches.open('wavepot')
    let response = await cache.match(event.request)
    if (!response) response = fetch(event.request)
    return response
  }())
})
