// Service Worker para PWA - Supervila DRE (Versão Simples)
const CACHE_NAME = 'supervila-dre-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/manifest.json',
  '/assets/logo_supervila.png',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js',
  'https://cdn.jsdelivr.net/npm/sweetalert2@11',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap'
];

// Instalação - cache dos arquivos
self.addEventListener('install', event => {
  console.log('[Service Worker] Instalando...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Cache aberto');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

// Ativação - limpa caches antigos
self.addEventListener('activate', event => {
  console.log('[Service Worker] Ativando...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Removendo cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Estratégia: Cache First com fallback para rede
self.addEventListener('fetch', event => {
  // Ignorar requisições de API (Google Sheets)
  if (event.request.url.includes('script.google.com')) {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          return new Response(
            JSON.stringify({ 
              status: 'offline', 
              mensagem: 'Você está offline. Os dados não puderam ser carregados.' 
            }),
            { headers: { 'Content-Type': 'application/json' } }
          );
        })
    );
    return;
  }

  // Para outros recursos: Cache First
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response; // Retorna do cache
        }
        
        // Se não está no cache, busca na rede
        return fetch(event.request).then(networkResponse => {
          // Verifica se é uma resposta válida
          if (!networkResponse || networkResponse.status !== 200) {
            return networkResponse;
          }
          
          // Cachear recursos do mesmo domínio ou CDNs
          const url = new URL(event.request.url);
          if (url.origin === location.origin || 
              url.hostname.includes('cdn.jsdelivr.net') || 
              url.hostname.includes('cdnjs.cloudflare.com') ||
              url.hostname.includes('fonts.googleapis.com')) {
            
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              })
              .catch(err => console.log('[Service Worker] Erro ao cachear:', err));
          }
          
          return networkResponse;
        }).catch(error => {
          console.log('[Service Worker] Falha na rede:', error);
          // Retorna uma resposta de erro simples
          return new Response('Offline', { 
            status: 503, 
            statusText: 'Service Unavailable' 
          });
        });
      })
  );
});