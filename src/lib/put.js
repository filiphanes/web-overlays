export class PutBroker {
  constructor(options) {
    this.prefix = options.put;
  }

  send(key, value) {
    if (typeof value === 'number') value = String(value);
    else if (typeof value !== 'string') value = JSON.stringify(value);
    fetch(this.prefix+key+'.txt', {
      method: "PUT",
      headers: {"Content-Type": "text/plain"},
      body: value,
    })
  }
}
