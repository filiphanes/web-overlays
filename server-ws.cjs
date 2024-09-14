const WebSocket = require('ws');
const url = require('url');

const server = new WebSocket.Server({
    host: process.env.HOST || '0.0.0.0',
    port: process.env.PORT || 8089,
    perMessageDeflate: {
        zlibDeflateOptions: {
            // See zlib defaults.
            chunkSize: 1024,
            memLevel: 7,
            level: 3
        },
        zlibInflateOptions: {
            chunkSize: 10 * 1024
        },
        // Other options settable:
        clientNoContextTakeover: true, // Defaults to negotiated value.
        serverNoContextTakeover: true, // Defaults to negotiated value.
        serverMaxWindowBits: 10, // Defaults to negotiated value.
        // Below options specified as default values.
        concurrencyLimit: 10, // Limits zlib concurrency for perf.
        threshold: 1024 // Size (in bytes) below which messages
        // should not be compressed.
    }
});

let STATES = {};
let CLIENTS = {};

server.on('connection', function connection(ws, req) {
    const ip = req.socket.remoteAddress;
    const port = req.socket.remotePort;
    const pathname = url.parse(req.url).pathname;
    console.log(ip, port, pathname, 'connected', STATES[pathname]);
    if (!STATES[pathname]) {
        STATES[pathname] = {};
    }
    if (!CLIENTS[pathname]) {
        CLIENTS[pathname] = new Set();
    }
    CLIENTS[pathname].add(ws);
    ws.send(JSON.stringify(STATES[pathname]));

    ws.on('message', function incoming(message) {
        // console.log(ip, port, message)
        const data = JSON.parse(message);
        Object.assign(STATES[pathname], data);
        // Broadcast to everyone else.
        CLIENTS[pathname].forEach(function each(client) {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    });

    ws.isAlive = true;
    ws.on('error', console.error);
    ws.on('pong', heartbeat);
    ws.on('close', function() {
        CLIENTS[pathname].delete(ws);
    });
});

function heartbeat() {
    this.isAlive = true;
}

const interval = setInterval(function ping() {
    server.clients.forEach(function each(ws) {
        if (server.isAlive === false) return ws.terminate();
        ws.isAlive = false;
        ws.ping();
    });
}, 30000);

server.on('close', function close() {
    clearInterval(interval);
});