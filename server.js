const express = require('express');
const compression = require('compression');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

/* Las dos páginas son ficheros sueltos y grandes a propósito —toda la lógica
   va dentro, sin empaquetador— así que `index.html` pesa 250 KB y
   `remote.html` 92. Sin comprimir, el que los paga es el móvil del
   optometrista, que muchas veces entra por datos y no por el Wi-Fi de la
   consulta. Es HTML: se queda en la quinta parte. */
app.use(compression());

/* El service worker se sirve SIN caché de navegador. Es el fichero que decide
   qué se guarda y qué no: si el navegador se queda con una copia vieja, la
   pantalla puede quedarse con una versión antigua de la app para siempre y sin
   forma de actualizarla. Es la única pieza que tiene que llegar fresca. */
app.get('/sw.js', (req, res) => {
    res.set('Cache-Control', 'no-cache');
    res.type('application/javascript');
    res.sendFile(path.join(__dirname, 'public', 'sw.js'));
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/remote', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'remote.html'));
});

// Para el health check de Render y para saber si el servicio ya despertó.
app.get('/healthz', (req, res) => res.type('text/plain').send('ok'));

/* ═══════════ EMPAREJAMIENTO POR SALA ═══════════
   Antes esto reenviaba con socket.broadcast, o sea a TODOS los clientes
   conectados al servidor. Con la app publicada eso significa que cualquier
   móvil que abra /remote maneja la pantalla de cualquier consultorio, y que
   dos consultorios usándola a la vez se pisan entre sí.
   Ahora cada pantalla abre una sala con su código (va dentro del QR) y solo
   se reenvía dentro de la sala. Un socket que no se ha unido no reenvía nada. */
const CODIGO_VALIDO = /^[A-Z0-9]{4,8}$/;
const EVENTOS = ['comando', 'modo', 'screenUpdate', 'requestScreenUpdate'];

/* ═══════════ EL FRENO DEL EMPAREJAMIENTO ═══════════
   El código de sala es lo único que separa dos consultorios: cinco caracteres
   de A-Z y 0-9. Sin freno, un socket puede probar códigos tan rápido como el
   servidor conteste, y el servidor contesta muy rápido.

   Lo que esto compra, dicho sin adornos: un cliente legítimo se une UNA vez
   por conexión —la pantalla a la sala que acaba de generar, el mando a la que
   le dictaron—, así que un límite de unas cuantas uniones por ventana no le
   estorba nunca y a un script le pone el recorrido de 60 millones de códigos
   fuera de alcance por esa conexión. Lo que NO compra: quien abra mil sockets
   sigue teniendo mil ventanas. Frenar eso de verdad es trabajo de
   infraestructura —un proxy con límite por IP—, no de este fichero, y aquí se
   dice en vez de disimularlo.

   Por SOCKET y no por IP a propósito: por IP, las pruebas —que levantan varias
   salas a la vez desde 127.0.0.1— se frenarían entre sí, y un consultorio con
   varios equipos detrás del mismo router también.

   Y cuenta TODA unión, no solo las de forma inválida: un código bien formado
   que no es de ninguna pantalla es indistinguible de una pantalla que acaba de
   abrir su propia sala, así que castigar ese caso cortaría a la pantalla buena
   cada vez que el socket se reconecta. Lo que se limita es el RITMO. */
const UNIONES_MAX = 10;          // por ventana y por conexión
const VENTANA_MS = 10000;

io.on('connection', (socket) => {
    let sala = null;
    let uniones = [];

    // Cuántos hay en la sala: con 2 o más, pantalla y mando se ven.
    const anunciar = (cual) => {
        if (!cual) return;
        io.to(cual).emit('peers', io.sockets.adapter.rooms.get(cual)?.size || 0);
    };

    socket.on('join', (codigo) => {
        const ahora = Date.now();
        uniones = uniones.filter(t => ahora - t < VENTANA_MS);
        uniones.push(ahora);
        if (uniones.length > UNIONES_MAX) {
            socket.emit('joinError', 'demasiados intentos, espere');
            console.log(`${socket.id} → ${uniones.length} uniones en ${VENTANA_MS / 1000} s: se corta`);
            socket.disconnect(true);
            return;
        }
        const nueva = String(codigo || '').trim().toUpperCase();
        if (!CODIGO_VALIDO.test(nueva)) {
            socket.emit('joinError', 'código inválido');
            return;
        }
        if (sala === nueva) { socket.emit('joined', nueva); anunciar(sala); return; }
        const previa = sala;
        if (previa) socket.leave(previa);
        sala = nueva;
        socket.join(sala);
        socket.emit('joined', sala);
        anunciar(previa);
        anunciar(sala);
        console.log(`${socket.id} → sala ${sala}`);
    });

    EVENTOS.forEach(evento => socket.on(evento, (datos) => {
        if (!sala) return;
        socket.to(sala).emit(evento, datos);
    }));

    socket.on('disconnect', () => {
        // El socket ya salió de la sala, así que el recuento sale correcto.
        anunciar(sala);
    });
});

const port = process.env.PORT || 3000;
server.listen(port, () => {
    console.log(`Servidor escuchando en puerto ${port}`);
});
