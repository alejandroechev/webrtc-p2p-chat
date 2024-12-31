const express = require('express');
const WebSocket = require('ws');

const app = express();
const server = require('http').createServer(app);
const wss = new WebSocket.Server({ port: 8080 });

app.use(express.static('public'));

wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        console.log('received: %s', message);
        console.log();
        wss.clients.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    });
});
console.log("WebSocket signaling server running on ws://localhost:8080");

server.listen(3000, () => {
    console.log('App running on http://localhost:3000');
});


