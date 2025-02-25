export class LenWsBroker {
  constructor(options) {
    this.socket = new WebSocket(options.len+options.path);
    this.state = {};
    if (options.update) {
      this.socket.addEventListener("message", (event) => {
        const data = JSON.parse(event.data);
        for (const [key, value] of Object.entries(data)) {
          if (this.state[key] !== value) {
            this.state[key] = value;
            options.update(key, value);
          }
        }
      })
    }
  }

  send(key, value) {
    if (this.state[key] === value) return;
    console.log('send', key, value);
    this.state[key] = value;
    if (!this.timeout) {
      this.timeout = setTimeout(() => {
        this.socket.send(JSON.stringify(this.state));
        clearTimeout(this.timeout);
        this.timeout = 0;
      }, 50);
    }
  }
}

