const CACHE_NAME = 'unique-salon-v2.0.5';
const RUNTIME_CACHE = 'runtime-cache-v2';
const IMAGE_CACHE = 'image-cache-v1';

const PRECACHE_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json'
];

// Install Event - Precache Assets
self.addEventListener('install', (event) => {
    console.log('[SW] Installing Service Worker v2.0.5...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[SW] Precaching app shell');
                return cache.addAll(PRECACHE_ASSETS);
            })
            .then(() => {
                console.log('[SW] Skip waiting');
                return self.skipWaiting();
            })
            .catch(err => console.error('[SW] Precache failed:', err))
    );
});

// Activate Event - Clean Old Caches
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating new service worker...');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE && cacheName !== IMAGE_CACHE) {
                        console.log('[SW] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('[SW] Claiming clients');
            return self.clients.claim();
        })
    );
});

// Fetch Event - Network First Strategy
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-http(s) requests
    if (!url.protocol.startsWith('http')) {
        return;
    }

    // Skip Chrome extensions
    if (url.protocol === 'chrome-extension:') {
        return;
    }

    // Firebase & External Scripts - Network Only
    if (url.hostname.includes('firebase') || 
        url.hostname.includes('googleapis') || 
        url.hostname.includes('profitablecpmratenetwork') ||
        url.hostname.includes('gstatic')) {
        event.respondWith(
            fetch(request)
                .then(response => {
                    // Cache successful responses
                    if (response && response.status === 200) {
                        const responseClone = response.clone();
                        caches.open(RUNTIME_CACHE).then(cache => {
                            cache.put(request, responseClone);
                        });
                    }
                    return response;
                })
                .catch(() => {
                    // Fallback to cache if available
                    return caches.match(request);
                })
        );
        return;
    }

    // HTML Pages - Network First, Cache Fallback
    if (request.mode === 'navigate' || request.headers.get('accept').includes('text/html')) {
        event.respondWith(
            fetch(request)
                .then(response => {
                    const responseClone = response.clone();
                    caches.open(RUNTIME_CACHE).then(cache => {
                        cache.put(request, responseClone);
                    });
                    return response;
                })
                .catch(() => {
                    return caches.match(request)
                        .then(cached => {
                            if (cached) return cached;
                            return caches.match('/index.html');
                        })
                        .catch(() => {
                            return new Response(
                                `<!DOCTYPE html>
                                <html>
                                <head>
                                    <meta charset="UTF-8">
                                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                                    <title>Offline - Unique Salon</title>
                                    <style>
                                        body {
                                            margin: 0;
                                            padding: 0;
                                            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                                            background: linear-gradient(135deg, #0a0e27 0%, #1a1d3e 100%);
                                            color: white;
                                            display: flex;
                                            justify-content: center;
                                            align-items: center;
                                            min-height: 100vh;
                                            text-align: center;
                                        }
                                        .offline-container {
                                            max-width: 400px;
                                            padding: 40px 20px;
                                        }
                                        .offline-icon {
                                            font-size: 100px;
                                            margin-bottom: 30px;
                                            animation: pulse 2s infinite;
                                        }
                                        @keyframes pulse {
                                            0%, 100% { transform: scale(1); }
                                            50% { transform: scale(1.1); }
                                        }
                                        h1 {
                                            color: #FFD700;
                                            font-size: 32px;
                                            margin-bottom: 15px;
                                        }
                                        p {
                                            font-size: 16px;
                                            line-height: 1.6;
                                            opacity: 0.9;
                                            margin-bottom: 30px;
                                        }
                                        button {
                                            background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%);
                                            color: #0a0e27;
                                            border: none;
                                            padding: 15px 40px;
                                            font-size: 16px;
                                            font-weight: bold;
                                            border-radius: 30px;
                                            cursor: pointer;
                                            box-shadow: 0 5px 20px rgba(255, 215, 0, 0.4);
                                            transition: all 0.3s;
                                        }
                                        button:hover {
                                            transform: translateY(-2px);
                                            box-shadow: 0 8px 25px rgba(255, 215, 0, 0.6);
                                        }
                                    </style>
                                </head>
                                <body>
                                    <div class="offline-container">
                                        <div class="offline-icon">📵</div>
                                        <h1>You're Offline</h1>
                                        <p>Please check your internet connection and try again.</p>
                                        <button onclick="window.location.reload()">🔄 Retry</button>
                                    </div>
                                </body>
                                </html>`,
                                {
                                    headers: { 'Content-Type': 'text/html' }
                                }
                            );
                        });
                })
        );
        return;
    }

    // Images - Cache First
    if (request.destination === 'image' || url.pathname.match(/\.(jpg|jpeg|png|gif|svg|webp|ico)$/)) {
        event.respondWith(
            caches.match(request)
                .then(cached => {
                    if (cached) return cached;

                    return fetch(request)
                        .then(response => {
                            if (!response || response.status !== 200 || response.type === 'error') {
                                return response;
                            }

                            const responseClone = response.clone();
                            caches.open(IMAGE_CACHE).then(cache => {
                                cache.put(request, responseClone);
                            });

                            return response;
                        })
                        .catch(() => {
                            // Return placeholder image if offline
                            return new Response(
                                `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
                                    <rect width="100" height="100" fill="#0a0e27"/>
                                    <text y="50" x="50" text-anchor="middle" fill="#FFD700" font-size="40">💈</text>
                                </svg>`,
                                { headers: { 'Content-Type': 'image/svg+xml' } }
                            );
                        });
                })
        );
        return;
    }

    // All Other Requests - Cache First, Network Fallback
    event.respondWith(
        caches.match(request)
            .then(cached => {
                if (cached) return cached;

                return fetch(request)
                    .then(response => {
                        if (!response || response.status !== 200 || response.type === 'error') {
                            return response;
                        }

                        const responseClone = response.clone();
                        caches.open(RUNTIME_CACHE).then(cache => {
                            cache.put(request, responseClone);
                        });

                        return response;
                    });
            })
    );
});

// Background Sync for Offline Data
self.addEventListener('sync', (event) => {
    console.log('[SW] Background sync event:', event.tag);
    
    if (event.tag === 'sync-appointments') {
        event.waitUntil(syncAppointments());
    } else if (event.tag === 'sync-messages') {
        event.waitUntil(syncMessages());
    }
});

async function syncAppointments() {
    console.log('[SW] Syncing appointments...');
    try {
        // Get pending appointments from IndexedDB or localStorage
        const response = await fetch('/api/sync-appointments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.ok) {
            console.log('[SW] Appointments synced successfully');
        }
    } catch (error) {
        console.error('[SW] Sync failed:', error);
        throw error; // Retry sync
    }
}

async function syncMessages() {
    console.log('[SW] Syncing messages...');
    // Similar to syncAppointments
}

// Push Notifications
self.addEventListener('push', (event) => {
    console.log('[SW] Push notification received');
    
    const data = event.data ? event.data.json() : {};
    const title = data.title || 'Unique Hair Salon 💈';
    const options = {
        body: data.body || 'You have a new notification',
        icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 192 192'><rect width='192' height='192' rx='40' fill='%230a0e27'/><text y='.9em' x='50%' text-anchor='middle' font-size='140'>💈</text></svg>",
        badge: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 96 96'><circle cx='48' cy='48' r='48' fill='%23FFD700'/><text y='.9em' x='50%' text-anchor='middle' font-size='60'>💈</text></svg>",
        vibrate: [200, 100, 200, 100, 200],
        data: {
            url: data.url || '/',
            dateOfArrival: Date.now(),
            primaryKey: data.id || Date.now()
        },
        actions: [
            { 
                action: 'open', 
                title: '✅ Open App',
                icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><text y='20' x='2' font-size='20'>✅</text></svg>"
            },
            { 
                action: 'close', 
                title: '❌ Dismiss',
                icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><text y='20' x='2' font-size='20'>❌</text></svg>"
            }
        ],
        requireInteraction: true,
        tag: data.tag || 'salon-notification',
        renotify: true,
        silent: false,
        image: data.image,
        timestamp: Date.now()
    };

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

// Notification Click Handler
self.addEventListener('notificationclick', (event) => {
    console.log('[SW] Notification clicked:', event.action);
    
    event.notification.close();

    if (event.action === 'close') {
        return;
    }

    const urlToOpen = event.notification.data.url || '/';

    event.waitUntil(
        clients.matchAll({
            type: 'window',
            includeUncontrolled: true
        })
        .then(windowClients => {
            // Check if app is already open
            for (let i = 0; i < windowClients.length; i++) {
                const client = windowClients[i];
                if (client.url === urlToOpen && 'focus' in client) {
                    return client.focus();
                }
            }
            // Open new window if not open
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});

// Message Handler from Main Thread
self.addEventListener('message', (event) => {
    console.log('[SW] Message received:', event.data);
    
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'CLEAR_CACHE') {
        event.waitUntil(
            caches.keys().then(names => {
                return Promise.all(
                    names.map(name => caches.delete(name))
                );
            }).then(() => {
                console.log('[SW] All caches cleared');
            })
        );
    }

    if (event.data && event.data.type === 'GET_VERSION') {
        event.ports[0].postMessage({
            version: CACHE_NAME
        });
    }
});

// Periodic Background Sync (Chrome 80+)
self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'check-appointments') {
        event.waitUntil(checkUpcomingAppointments());
    }
});

async function checkUpcomingAppointments() {
    console.log('[SW] Checking upcoming appointments...');
    // Check localStorage for appointments and send notifications
    // This runs even when app is closed
}

// Handle Errors
self.addEventListener('error', (event) => {
    console.error('[SW] Error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
    console.error('[SW] Unhandled rejection:', event.reason);
});

// Log Service Worker Ready
console.log('[SW] Service Worker v2.0.5 loaded successfully! 🎉');