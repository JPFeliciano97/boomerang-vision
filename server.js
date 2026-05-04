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
    socket.on('comando', (cmd) => {
        socket.broadcast.emit('comando', cmd);
    });
});

const port = process.env.PORT || 3000;
server.listen(port, () => {
    console.log(`Servidor escuchando en puerto ${port}`);
});