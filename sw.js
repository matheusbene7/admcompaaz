// ═══════════════════════════════════════════════════════════════════
// SERVICE WORKER — COMPAAz PWA
// Cache-first para assets estáticos, network-first para atualizações
// ═══════════════════════════════════════════════════════════════════

const CACHE_NAME   = 'compaaz-v4';
const STATIC_CACHE = 'compaaz-static-v4';

// Assets to cache on install
const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Inter:wght@300;400;500;600;700&display=swap',
];

// ── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', function(e){
  console.log('[SW] Installing COMPAAz v3...');
  e.waitUntil(
    caches.open(STATIC_CACHE).then(function(cache){
      return cache.addAll(PRECACHE.map(function(url){
        return new Request(url, { cache: 'reload' });
      })).catch(function(err){
        console.warn('[SW] Pre-cache partial fail (ok):', err.message);
      });
    }).then(function(){
      return self.skipWaiting();
    })
  );
});

// ── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', function(e){
  console.log('[SW] Activating...');
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(
        keys.filter(function(k){ return k !== STATIC_CACHE && k !== CACHE_NAME; })
            .map(function(k){ console.log('[SW] Deleting old cache:', k); return caches.delete(k); })
      );
    }).then(function(){
      return self.clients.claim();
    })
  );
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', function(e){
  var url = e.request.url;

  // Skip non-GET and chrome-extension
  if(e.request.method !== 'GET') return;
  if(url.startsWith('chrome-extension')) return;
  if(url.includes('localhost') && !url.includes('/admcompaaz')) return;

  // Fonts: cache-first (they don't change)
  if(url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')){
    e.respondWith(
      caches.match(e.request).then(function(cached){
        return cached || fetch(e.request).then(function(res){
          var clone = res.clone();
          caches.open(STATIC_CACHE).then(function(c){ c.put(e.request, clone); });
          return res;
        });
      })
    );
    return;
  }

  // index.html: network-first (always try to get latest)
  if(url.endsWith('/') || url.endsWith('index.html') || url.endsWith('admcompaaz/')){
    e.respondWith(
      fetch(e.request)
        .then(function(res){
          var clone = res.clone();
          caches.open(STATIC_CACHE).then(function(c){ c.put(e.request, clone); });
          return res;
        })
        .catch(function(){
          return caches.match('./index.html') || caches.match('./');
        })
    );
    return;
  }

  // manifest + sw: network-first
  if(url.endsWith('manifest.json') || url.endsWith('sw.js')){
    e.respondWith(
      fetch(e.request).then(function(res){
        var clone = res.clone();
        caches.open(STATIC_CACHE).then(function(c){ c.put(e.request, clone); });
        return res;
      }).catch(function(){
        return caches.match(e.request);
      })
    );
    return;
  }

  // Everything else: stale-while-revalidate
  e.respondWith(
    caches.open(STATIC_CACHE).then(function(cache){
      return cache.match(e.request).then(function(cached){
        var fetchPromise = fetch(e.request).then(function(res){
          if(res && res.status === 200) cache.put(e.request, res.clone());
          return res;
        }).catch(function(){});
        return cached || fetchPromise;
      });
    })
  );
});

// ── Background Sync (if supported) ──────────────────────────────────────────
self.addEventListener('sync', function(e){
  if(e.tag === 'sync-data'){
    console.log('[SW] Background sync triggered');
  }
});

// ── Push Notifications (placeholder) ─────────────────────────────────────────
self.addEventListener('push', function(e){
  var data = e.data ? e.data.json() : { title: 'COMPAAz', body: 'Nova notificação' };
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 192 192\'%3E%3Crect width=\'192\' height=\'192\' rx=\'32\' fill=\'%230c1e3a\'/%3E%3Ctext x=\'96\' y=\'130\' font-size=\'110\' text-anchor=\'middle\' fill=\'%2360a5fa\'%3E%E2%9A%93%3C/text%3E%3C/svg%3E',
      badge: 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 96 96\'%3E%3Ctext y=\'.9em\' font-size=\'90\'%3E%E2%9A%93%3C/text%3E%3C/svg%3E',
      vibrate: [100, 50, 100],
      tag: 'compaaz-notif',
    })
  );
});
