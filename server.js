const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

app.get('/remote', (req, res) => {
    res.sendFile(__dirname + '/public/remote.html');
});

io.on('connection', (socket) => {
    console.log('Cliente conectado:', socket.id);

    // Reenviar comandos a todos los demás (del remote al index)
    socket.on('comando', (cmd) => {
        socket.broadcast.emit('comando', cmd);
    });

    // Reenviar el modo actual a los demás
    socket.on('modo', (modo) => {
        socket.broadcast.emit('modo', modo);
    });

    // Reenviar el estado de la pantalla (del index al remote)
    socket.on('screenUpdate', (data) => {
        socket.broadcast.emit('screenUpdate', data);
    });

    // Cuando el remote pide el estado actual, se lo pedimos al index
    socket.on('requestScreenUpdate', () => {
        socket.broadcast.emit('requestScreenUpdate');
    });
});

const port = process.env.PORT || 3000;
server.listen(port, () => {
    console.log(`Servidor escuchando en puerto ${port}`);
});
