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

server.on('connection', function connection(ws, req) {
    const ip = req.socket.remoteAddress;
    const port = req.socket.remotePort;
    const pathname = url.parse(req.url).pathname;
    console.log(ip, port, pathname, 'connected', STATES[pathname]);
    if (!STATES[pathname]) {
        STATES[pathname] = {};
    }
    ws.pathname = pathname;
    ws.send(JSON.stringify(STATES[pathname]));

    ws.on('message', function incoming(message) {
        message = message.toString()
        console.log(ip, port, message)
        const data = JSON.parse(message);
        Object.assign(STATES[pathname], data);
        // Broadcast to everyone else.
        server.clients.forEach(function each(client) {
            if (client.pathname == pathname
              && client !== ws
              && client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    });
});
