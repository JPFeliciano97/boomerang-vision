/* ═══════════════════════════════════════════════════════════════════════════
   Para que un parpadeo del Wi-Fi no deje al paciente delante de una pantalla
   muerta.

   Esto se despliega en Render y se usa con el Wi-Fi de un consultorio. Sin
   nada que guarde la app, una recarga sin red —o un Render dormido— deja la
   pantalla en blanco a mitad de examen, que es exactamente la regla que este
   proyecto no se salta: la pantalla del paciente nunca se queda sin una
   palabra.

   Lo que se guarda son cuatro ficheros y el cliente del socket. Con eso la
   pantalla del PC dibuja los ocho test y el panel los maneja enteros: lo único
   que la red se lleva es el MANDO, porque el emparejamiento pasa por el socket
   y el socket necesita servidor. Eso no se puede prometer y no se promete.

   ── Por qué «del caché primero, y de paso lo refresco» ──
   Una app clínica tiene que abrir ya y tiene que funcionar sin red, así que la
   copia guardada manda. Pero una copia guardada para siempre es peor que no
   tener ninguna: el consultorio se quedaría con una versión vieja sin forma de
   actualizarla. Así que cada petición sirve del caché Y pide la de red por
   detrás para dejarla guardada: la carga siguiente ya trae lo nuevo. Como
   mucho se va una carga por detrás, y se arregla solo — sin números de versión
   que alguien tiene que acordarse de subir.

   Dos cosas que NO pasan por aquí, y las dos a propósito:
     · `/socket.io/` — es el canal en vivo del mando. Guardar un tramo de una
       conversación por socket no tiene ningún sentido.
     · `sw.js` — lo sirve el servidor con `Cache-Control: no-cache`. Es el
       fichero que decide qué se guarda: si se guardara a sí mismo, una copia
       rota se quedaría rota para siempre.
   ═══════════════════════════════════════════════════════════════════════════ */

const CACHE = 'boomerang-v1';

/* Lo mínimo con lo que la suite se dibuja entera. El cliente del socket entra
   aunque sin red no sirva de nada: `setupRemote()` ya está escrito para que un
   fallo suyo no se lleve la pantalla por delante, pero si el fichero no está
   el navegador tarda en rendirse y la pantalla arranca tarde. */
const ESENCIALES = [
    '/',
    '/remote',
    '/OpticianSans.woff',
    '/qrcode.js',
    '/manifest.webmanifest',
    '/icono.svg',
    '/socket.io/socket.io.js'
];

self.addEventListener('install', evento => {
    /* `skipWaiting` para que una versión nueva no se quede esperando a que se
       cierren todas las pestañas: en una consulta la pantalla no se cierra en
       semanas. */
    self.skipWaiting();
    evento.waitUntil((async () => {
        const cache = await caches.open(CACHE);
        /* Uno a uno y sin romperse: `addAll` falla entera si un solo fichero
           no está —el cliente del socket no existe si el servidor arrancó sin
           socket.io— y entonces no se guardaría NADA. Guardar cuatro de cinco
           es infinitamente mejor que guardar cero. */
        await Promise.all(ESENCIALES.map(u =>
            cache.add(new Request(u, { cache: 'reload' })).catch(() => null)));
    })());
});

self.addEventListener('activate', evento => {
    evento.waitUntil((async () => {
        for (const nombre of await caches.keys()) {
            if (nombre !== CACHE) await caches.delete(nombre);
        }
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', evento => {
    const peticion = evento.request;
    if (peticion.method !== 'GET') return;

    const url = new URL(peticion.url);
    if (url.origin !== self.location.origin) return;
    if (url.pathname.startsWith('/socket.io/')
        && !url.pathname.endsWith('socket.io.js')) return;
    if (url.pathname === '/sw.js') return;

    evento.respondWith((async () => {
        const cache = await caches.open(CACHE);
        /* Las navegaciones se buscan por su ruta: `/` y `/remote` se guardaron
           así, y una navegación trae cabeceras que no casan con `match` a
           secas. */
        const clave = peticion.mode === 'navigate'
            ? new Request(url.pathname, { method: 'GET' }) : peticion;
        const guardada = await cache.match(clave, { ignoreSearch: true });

        const deRed = fetch(peticion).then(respuesta => {
            /* Solo se guarda lo que llegó bien. Una respuesta opaca o un 404
               guardados son una pantalla rota que no se cae sola. */
            if (respuesta && respuesta.ok && respuesta.type === 'basic') {
                cache.put(clave, respuesta.clone()).catch(() => {});
            }
            return respuesta;
        }).catch(() => null);

        if (guardada) return guardada;          // primero lo guardado: abre ya
        const red = await deRed;
        if (red) return red;

        /* Ni caché ni red. Para una navegación, decirlo: en negro y sin una
           palabra es lo único que aquí no vale. */
        if (peticion.mode === 'navigate') {
            return new Response(
                '<!doctype html><meta charset="utf-8">'
              + '<title>Boomerang Vision</title>'
              + '<body style="margin:0;display:flex;align-items:center;'
              + 'justify-content:center;height:100vh;background:#111;color:#bbb;'
              + 'font:14px system-ui;text-align:center;letter-spacing:1px">'
              + '<div>SIN RED Y SIN COPIA GUARDADA<br>'
              + '<span style="color:#777;font-size:12px">Abra esta pantalla una vez '
              + 'con conexión y quedará disponible sin ella.</span></div>',
                { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
        }
        return Response.error();
    })());
});
