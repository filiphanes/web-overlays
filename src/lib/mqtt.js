import mqtt from "mqtt";

function mqttWrapper(options) {
  const client = mqtt.connect(options.mqtt);
  const listeners = {};
  if (!options.path.endsWith('/')) options.path += '/';

	client.subscribe(options.path+'+');
	client.on('message', (topic, message) => {
	  const cb = listeners[topic];
	  if (cb) cb(JSON.parse(message.toString()));
	})

  return (key, writableStore) => {
    const { set, subscribe } = writableStore;
    listeners[options.path+key] = set;
    return {
      set: (value) => {
        client.publish(options.path+key, JSON.stringify(value), {retain: true});
      },
      subscribe,
    }
  }
}

export {
	mqtt,
	mqttWrapper,
}