import mqtt from "mqtt";

class MqttBroker {
  constructor(options) {
    this.options = options;
    this.client = mqtt.connect(options.mqtt);
    if (!options.path.endsWith('/')) options.path += '/';

    if (options.update) {
      this.client.subscribe(options.path+'+');
      this.client.on('message', (topic, message) => {
        if (topic.startsWith(options.path)) {
          const key = topic.slice(options.path.length);
          options.update(key, JSON.parse(message.toString()));
        }
      })
    }
  }

  set(key, value) {
    this.client.publish(this.options.path+key, JSON.stringify(value), {retain: true});
  }
}


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
  MqttBroker,
	mqttWrapper,
}