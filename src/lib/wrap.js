import { gunWrapper } from '$lib/gun.js';
import { mqttWrapper } from '$lib/mqtt.js';
import { websocketWrapper } from '$lib/ws.js';

function makeWrapStore(opts) {
  let wrapStore;
  const options = {
    gun: 'https://gun.filiphanes.sk/gun',
    mqtt: undefined,
    ws: undefined,
    space: 'default',
    password: 'demo',
    path: undefined,
  };
  Object.assign(options, opts);
  options.path = options.path || `${options.space}/${options.password}`;

  if (options.ws) {
    wrapStore = websocketWrapper(options);
  } else if (options.mqtt) {
    wrapStore = mqttWrapper(options);
  } else if (options.gun) {
    wrapStore = gunWrapper(options)
  }
  return wrapStore;
}

export {
  makeWrapStore,
}