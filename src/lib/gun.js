import Gun from "gun"

function gunWrapper(options) {
  const gun = Gun([options.gun])
  let root = gun;
  for (const s of options.path.split('/')) {
    if (s) root = root.get(s);
  }

  return function(key, writableStore) {
    const { set, subscribe } = writableStore;
    const ref = root.get(key);
    ref.on(function(data, key){
      // console.log('on', key, data);
      set(data)
    });
    return {
      set: function(value) {ref.put(value)},
      subscribe,
    }
  }
}

Gun.chain.subscribe = function (publish) {
	var gun = this
	var at = gun._
	var isMap = !!at && !!at.back && !!at.back.each

	if (isMap) {
		var store = new Map()
		publish(Array.from(store))
		gun = gun.on((data, _key, as) => {
			var key = _key || ((data || {})._ || {})['#'] || as.via.soul
			if (data === null) {
				store.delete(key)
			} else {
				store.set(key, data)
			}
			publish(Array.from(store))
		})
	} else {
		gun = gun.on(data => publish(data))
	}

	return gun.off
}

function createMapStore(ref) {
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

export {
	Gun,
	gunWrapper,
	createMapStore,
}