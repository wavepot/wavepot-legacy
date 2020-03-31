self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return

  if (!event.request.url.includes('dsp.js')
    && !event.request.url.includes('DSP')
    && !event.request.url.includes('worklet')
    && !event.request.url.includes('settings.js')) return

  // respondWith needs to be called synchronously
  event.respondWith(async function () {
    const cache = await caches.open('wavepot')
    let response = await cache.match(event.request)
    if (!response) response = fetch(event.request, { cache: 'force-cache' })
    return response
  }())
})
