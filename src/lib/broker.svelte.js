import { BroadcastBroker } from '$lib/broadcast.js';
import { GunBroker } from '$lib/gun.js';
import { MqttBroker } from '$lib/mqtt.js';
import { WebsocketBroker } from '$lib/ws.js';


export function multiBrokerState(initObject) {
  const state = $state(initObject);
  const brokers = [];

  function connect(opts) {
    const options = {
      gun: 'https://gun.filiphanes.sk/gun',
      mqtt: undefined,
      ws: undefined,
      broadcast: undefined,
      space: 'demo',
      password: 'demo',
      path: undefined,
      update: function(key, value) {
        state[key] = value;
      },
    };
    Object.assign(options, opts);
    options.path = options.path || `${options.space}/${options.password}`;
    if (options.ws) brokers.push(new WebsocketBroker(options));
    else if (options.mqtt) brokers.push(new MqttBroker(options));
    else if (options.gun) brokers.push(new GunBroker(options));
    else if (options.broadcast) brokers.push(new BroadcastBroker(options));
  }

  function send(key, value) {
    for (const broker of brokers) broker.send(key, value);
  }

  const o = { connect };
  /* Build getters/setters */
  for (const [key, value] of Object.entries(initObject)) {
    Object.defineProperty(o, key, {
      enumerable: true,
      get() { return state[key]; },
      set(v) { state[key] = v; send(key, v) },
    })
  }
  return o;
}
