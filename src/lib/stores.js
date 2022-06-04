import { writable } from 'svelte/store'

function writableSession(key, initialValue) {
  const sessionValue = JSON.parse(sessionStorage.getItem(key));
  if (!sessionValue) sessionStorage.setItem(key, JSON.stringify(initialValue));

  const store = writable(sessionValue || initialValue);
  store.subscribe(value => sessionStorage.setItem(key, JSON.stringify(value)));
  return store;
}

function writableGun(gunData, value) {
    if (value === undefined) value = null;
	let store = writable(value);
    store.subscribe(data => {
        value = {data};
    });
    gunData.once(data => {
        if (data === null && value != null) {
            // console.debug('putting default value', value);
            gunData.put(value);
        }
        gunData.on((data, key) => {
            // console.debug('gun.on', key, data);
            store.set(data);
        });
    });

    function set(newval) {
        // console.debug('gun.put', newval);
        gunData.put(newval);
    }
    function update(fn) {
        set(fn(value));
    }
    function subscribe(run) {
        return store.subscribe(run);
    }
    return { set, update, subscribe };
}

function readableGun(ref) {
	return readable(null, function start(set) {
		ref.on(data => set(data))
		return function stop() {
			// Avoid calling off() if you initialize the store locally in the component
			// since future calls to on() by new component instances might fail
			ref.off() 
		}
	})
}

export {
    writableSession,
    writableGun,
    readableGun,
};