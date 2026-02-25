const CACHE_NAME = 'supervila-dre-v3'; // Mude a versão para forçar atualização
const urlsToCache = [
  './',  // Mudou de '/' para './'
  './index.html',
  './manifest.json',
  './style.css',
  './script.js',
  './offline.html',
  './assets/logo_supervila.png',
  './assets/icon-72x72.png',
  './assets/icon-96x96.png',
  './assets/icon-128x128.png',
  './assets/icon-144x144.png',
  './assets/icon-152x152.png',
  './assets/icon-192x192.png',
  './assets/icon-384x384.png',
  './assets/icon-512x512.png',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js',
  'https://cdn.jsdelivr.net/npm/sweetalert2@11',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap'
];

// Instalação
self.addEventListener('install', event => {
  console.log('Service Worker: Instalando...');
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache aberto');
        return cache.addAll(urlsToCache);
      })
      .catch(error => {
        console.error('Erro no cache:', error);
      })
  );
});

// Ativação
self.addEventListener('activate', event => {
  console.log('Service Worker: Ativando...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Removendo cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Interceptar requisições
self.addEventListener('fetch', event => {
  // Ignorar requisições de API e não-GET
  if (event.request.url.includes('script.google.com') || 
      event.request.url.includes('googleapis') ||
      event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }

        return fetch(event.request)
          .then(response => {
            // Verificar se é uma resposta válida
            if (!response || response.status !== 200) {
              return response;
            }

            // Clonar a resposta para cache
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                // Não fazer cache de URLs externas que não sejam da lista
                if (event.request.url.startsWith(self.location.origin) || 
                    urlsToCache.some(url => event.request.url.includes(url))) {
                  cache.put(event.request, responseToCache);
                }
              });

            return response;
          })
          .catch(() => {
            // Se for uma requisição de página HTML, mostra página offline
            if (event.request.headers.get('accept').includes('text/html')) {
              return caches.match('./offline.html');
            }
          });
      })
  );
});
