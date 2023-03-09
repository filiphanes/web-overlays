import mqtt from 'mqtt';

const client  = mqtt.connect('ws://gun.filiphanes.sk:8008', {
    username: "demo",
    password: "demo",
})

client.on('connect', function () {
  client.subscribe('#', function (err) {
    if (!err) {
      client.publish('mt/line', 'Hello mqtt')
      client.publish('za/line', 'Hello mqtt')
      client.publish('demo/line', 'Hello mqtt')
    }
  })
})

client.on('message', function (topic, message) {
  // message is Buffer
  console.log(topic, message.toString())
  client.end()
})