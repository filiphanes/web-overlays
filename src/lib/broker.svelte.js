import { BroadcastBroker } from '$lib/broadcast.js';
import { GunBroker } from '$lib/gun.js';
import { MqttBroker } from '$lib/mqtt.js';
import { WebsocketBroker } from '$lib/ws.js';


class MultiBroker {
  constructor() {
    this.brokers = [];
    this.states = {};
    this.deriveds = {};
  }
  
  set(key, val) {
    for (const broker of this.brokers) {
      broker.set(key, val);
    }
  }
  
  updateState(key, val) {
    const state = this.states[key];
    if (state) state.value = val;
  }

  state(key, d) {
    let state = $state(d);
    this.states[key] = {
      get value() { return state },
      set value(newState) { state = newState },
    };
    // $effect(() => {set(key, $state.snapshot(state))});
    return state;
  }

  derivedby(key, fn) {
    let state = $derived.by(fn);
    self.deriveds[key] = {
      get value() { return state },
    };
    // $effect(() => {set(key, $state.snapshot(state))});
    return state
  }
    
  setup(opts) {
    const options = {
      gun: 'https://gun.filiphanes.sk/gun',
      mqtt: undefined,
      ws: undefined,
      broadcast: undefined,
      space: 'default',
      password: 'demo',
      path: undefined,
      // update: this.updateState,
    };
    Object.assign(options, opts);
    options.path = options.path || `${options.space}/${options.password}`;
    if (options.ws) this.brokers.push(new WebsocketBroker(options));
    else if (options.mqtt) this.brokers.push(new MqttBroker(options));
    else if (options.gun) this.brokers.push(new GunBroker(options));
    else if (options.broadcast) this.brokers.push(new BroadcastBroker(options));
  }
}


export {
  MultiBroker,
}