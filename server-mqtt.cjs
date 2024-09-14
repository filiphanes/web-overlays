const aedes = require('aedes')()
const httpServer = require('http').createServer()
const ws = require('websocket-stream')
const port = process.env.PORT || 8888

ws.createServer({ server: httpServer }, aedes.handle)

httpServer.listen(port, function () {
  console.log('websocket server listening on port ', port)
})

aedes.authorizeSubscribe = function (client, sub, callback) {
  const s = sub.topic.split('/');
  if (s.length <= 2) {
    return callback(new Error('too short topic'))
  } else if (s[0] == '+' || s[1] == '#' ||
             s[0] == '+' || s[1] == '#' ) {
    return callback(new Error('wildcards not allowed here'))
  }
  callback(null, sub)
}