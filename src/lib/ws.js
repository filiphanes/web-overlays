export class WebsocketBroker {
  constructor(options) {
    this.socket = new WebSocket(options.ws+options.path);
    if (options.update) {
      this.socket.addEventListener("message", (event) => {
        const data = JSON.parse(event.data);
        for (const [key, value] of Object.entries(data)) {
          options.update(key, value)
        }
      })
    }
  }

  send(key, value) {
    this.socket.send(JSON.stringify({[key]: value}));
  }
}

export function websocketState(initObject) {
  const state = $state(initObject);
  let send = () => { };

  function mount(opts) {
    const options = {
      ws: undefined,
      space: 'demo',
      password: 'demo',
      path: undefined,
    };
    Object.assign(options, opts);
    options.path = options.path || `${options.space}/${options.password}`;
    const socket = new WebSocket(options.ws + options.path);
    socket.addEventListener("open", (event) => {
      send = function send(key, value) {
        socket.send(JSON.stringify({ [key]: value }))
      }
    })
    socket.addEventListener("message", (event) => {
      const data = JSON.parse(event.data);
      for (const [key, value] of Object.entries(data)) {
        state[key] = value;
      }
    })
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


export function websocketWrapper(options) {
  const socket = new WebSocket(options.ws+options.path);
  const listeners = {};

  socket.addEventListener("message", (event) => {
    const data = JSON.parse(event.data);
    for (const [key, value] of Object.entries(data)) {
      const cb = listeners[key];
      if (cb) cb(value);
    }
	})

  return (key, writableStore) => {
    const { set, subscribe } = writableStore;
    listeners[key] = set;
    return {
      set: (value) => {
        socket.send(JSON.stringify({[key]: value}));
        set(value); // websocket server does not return our messages
      },
      subscribe,
    }
  }
}