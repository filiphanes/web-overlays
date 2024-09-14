const aedes = require('aedes')()
const httpServer = require('http').createServer()
const ws = require('websocket-stream')
const port = 8888

ws.createServer({ server: httpServer }, aedes.handle)

httpServer.listen(port, function () {
  console.log('websocket server listening on port ', port)
})

aedes.authorizeSubscribe = function (client, sub, callback) {
  if (sub.topic === 'aaaa') {
    return callback(new Error('wrong topic'))
  }
  if (sub.topic === 'bbb') {
    // overwrites subscription
    sub.topic = 'foo'
    sub.qos = 1
  }
  callback(null, sub)
}