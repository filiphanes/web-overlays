import Gun from "gun"


export class GunBroker {
	constructor(options) {
		this.gun = Gun([options.gun])
		this.root = this.gun;
		for (const s of options.path.split('/')) {
			if (s) this.root = this.root.get(s);
		}
		if (options.update) this.root.map(options.update);
	}

	send(key, value) {
		this.root.get(key).put(value)
	}
}


export function gunState(initObject) {
  const state = $state(initObject);
  const nodes = {};
  let root;

  function mount(opts) {
    const options = {
      space: 'demo',
      password: 'demo',
      path: undefined,
    };
    Object.assign(options, opts);
    options.path = options.path || `${options.space}/${options.password}`;
    root = Gun([options.gun]);
    for (const s of options.path.split('/')) {
      if (s) root = root.get(s);
    }
    for (const [k, v] of Object.entries(initObject)) {
      nodes[k] = root.get(k);
      nodes[k].on((data) => {
        state[k] = data;
      })
    }
  }

  const o = { mount };
  /* Build getters/setters */
  for (const [key, value] of Object.entries(initObject)) {
    Object.defineProperty(o, key, {
      enumerable: true,
      get() { return state[key] },
      set(v) { nodes[key]?.put(v) },
    })
  }
  return o;
}


export function gunWrapper(options) {
	const gun = Gun([options.gun])
	let root = gun;
	for (const s of options.path.split('/')) {
		if (s) root = root.get(s);
	}
	options.root = root;

	return function (key, writableStore) {
		const { set, subscribe } = writableStore;
		const ref = root.get(key);
		ref.on(function (data, key) {
			// console.log('on', key, data);
			set(data)
		});
		return {
			set: function (value) { ref.put(value) },
			subscribe,
		}
	}
}


export function createMapStore(ref) {
	const { update, subscribe } = writable({})
	ref.on(function (data, key) {
		if (data) {
			update(store => ({ ...store, [key]: data }))
		} else {
			update(store => {
				delete store[key]
				return store
			})
		}
	})

	return {
		subscribe,
		update: (key, value) => ref.get(key).put(value)
	}
}
