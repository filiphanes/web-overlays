import mqtt from "mqtt";

export class MqttBroker {
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

  send(key, value) {
    this.client.publish(this.options.path+key, JSON.stringify(value), {retain: true});
  }
}

export function mqttState(initObject) {
  const state = $state(initObject);
  let send = () => { };

  function mount(opts) {
    const options = {
      mqtt: 'wss://test.mosquitto.org:8081',
      space: 'demo',
      password: 'demo',
      path: undefined,
    };
    Object.assign(options, opts);
    options.path = options.path || `${options.space}/${options.password}`;
    if (!options.path.endsWith('/')) options.path += '/';
    const client = mqtt.connect(options.mqtt);
    client.subscribe(options.path + '+');
    client.on('message', (topic, message) => {
      if (topic.startsWith(options.path)) {
        const key = topic.slice(options.path.length);
        state[key] = JSON.parse(message.toString());
      }
    })
    send = function send(key, value) {
      client.publish(options.path + key, JSON.stringify(value), { retain: true });
    }
  }

  const o = { mount };
  /* Build getters/setters */
  for (const [key, value] of Object.entries(initObject)) {
    Object.defineProperty(o, key, {
      enumerable: true,
      get() {
        return state[key];
      },
      set(v) {
        state[key] = v;
        send(key, v);
      },
    })
  }
  return o;
}


export function mqttWrapper(options) {
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