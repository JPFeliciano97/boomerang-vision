const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

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

io.on('connection', (socket) => {
    let sala = null;

    // Cuántos hay en la sala: con 2 o más, pantalla y mando se ven.
    const anunciar = (cual) => {
        if (!cual) return;
        io.to(cual).emit('peers', io.sockets.adapter.rooms.get(cual)?.size || 0);
    };

    socket.on('join', (codigo) => {
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
