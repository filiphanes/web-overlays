
function websocketWrapper(options) {
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

export {
	websocketWrapper,
}