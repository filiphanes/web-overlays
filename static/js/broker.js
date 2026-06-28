// Shared VanJS broker + reactive synced state, used by the static (build-free)
// controllers. Mirrors src/lib/broker.svelte.js + the transport classes, but
// built on VanJS state instead of Svelte 5 $state.
//
// Transport precedence (set in connect()): ws > mqtt > put > gun > broadcast.
// gun + mqtt are loaded on demand from a CDN.

import van from "https://cdn.jsdelivr.net/gh/vanjs-org/van/public/van-1.6.0.min.js";

const GLOBAL_SOURCES = {
  // local gun first (matches static/js convention), then public CDN fallback
  gun:  ["../js/gun.min.js", "https://cdn.jsdelivr.net/npm/gun/gun.js"],
  mqtt: ["https://cdn.jsdelivr.net/npm/mqtt@5/dist/mqtt.min.js"],
};
const _loadedScripts = {};
function loadScript(url) {
  return _loadedScripts[url] || (_loadedScripts[url] = new Promise((resolve, reject) => {
    const el = document.createElement("script");
    el.src = url;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error("script load failed: " + url));
    document.head.appendChild(el);
  }));
}
async function ensureGlobal(name, urls) {
  if (window[name]) return window[name];
  for (const url of (Array.isArray(urls) ? urls : [urls])) {
    try { await loadScript(url); } catch { /* try next source */ }
    if (window[name]) return window[name];
  }
  throw new Error("could not load global: " + name);
}

class WebsocketBroker {
  constructor(o) {
    this.socket = new WebSocket(o.ws + o.path);
    if (o.update) this.socket.addEventListener("message", (e) => {
      for (const [k, v] of Object.entries(JSON.parse(e.data))) o.update(k, v);
    });
  }
  send(k, v) { this.socket.send(JSON.stringify({ [k]: v })); }
}

class BroadcastBroker {
  constructor(o) {
    this.channel = new BroadcastChannel(o.broadcast);
    if (o.update) this.channel.onmessage = (e) => {
      for (const [k, v] of Object.entries(e.data)) o.update(k, v);
    };
  }
  send(k, v) { this.channel.postMessage({ [k]: v }); }
}

class PutBroker {
  constructor(o) { this.prefix = o.put; }
  send(k, v) {
    if (typeof v === "number") v = String(v);
    else if (typeof v !== "string") v = JSON.stringify(v);
    fetch(this.prefix + k + ".txt", { method: "PUT", headers: { "Content-Type": "text/plain" }, body: v });
  }
}

class GunBroker {
  constructor(o) {
    let root = window.Gun([o.gun]);
    for (const part of o.path.split("/")) if (part) root = root.get(part);
    this.root = root;
    if (o.update) this.root.map(o.update);
  }
  send(k, v) { this.root.get(k).put(v); }
}

class MqttBroker {
  constructor(o) {
    this.options = o;
    if (!o.path.endsWith("/")) o.path += "/";
    this.client = window.mqtt.connect(o.mqtt);
    if (o.update) {
      this.client.subscribe(o.path + "+");
      this.client.on("message", (topic, message) => {
        if (!topic.startsWith(o.path)) return;
        o.update(topic.slice(o.path.length), JSON.parse(message.toString()));
      });
    }
  }
  send(k, v) { this.client.publish(this.options.path + k, JSON.stringify(v), { retain: true }); }
}

/* Reactive synced state: one van.state per key; getters/setters broadcast writes. */
export function multiBrokerState(init) {
  const states = {};
  for (const [k, v] of Object.entries(init)) states[k] = van.state(v);
  const brokers = [];

  async function connect(opts) {
    const o = {
      gun: "https://gun.filiphanes.sk/gun",
      mqtt: undefined, ws: undefined, broadcast: undefined, put: undefined,
      space: "demo", password: "demo", path: undefined,
      update(k, v) { if (states[k]) states[k].val = v; },
    };
    Object.assign(o, opts);
    o.path = o.path || `${o.space}/${o.password}`;
    try {
      if (o.ws)             brokers.push(new WebsocketBroker(o));
      else if (o.mqtt)      { await ensureGlobal("mqtt", GLOBAL_SOURCES.mqtt); brokers.push(new MqttBroker(o)); }
      else if (o.put)       brokers.push(new PutBroker(o));
      else if (o.gun)       { await ensureGlobal("Gun",  GLOBAL_SOURCES.gun);  brokers.push(new GunBroker(o)); }
      else if (o.broadcast) brokers.push(new BroadcastBroker(o));
    } catch (e) {
      console.warn("[broker] running local-only:", e.message);
    }
  }
  const send = (k, v) => { for (const b of brokers) b.send?.(k, v); };

  const self = { connect, states };
  for (const key of Object.keys(init)) {
    Object.defineProperty(self, key, {
      enumerable: true,
      get() { return states[key].val; },
      set(v) { states[key].val = v; send(key, v); },
    });
  }
  return self;
}

export { van };
