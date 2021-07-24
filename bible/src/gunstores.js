import { writable } from 'svelte/store'

function writableGun(gunData, value) {
    if (value === undefined) value = null;
	let store = writable(value);
    store.subscribe(data => {
        value = {data};
    });
    gunData.once(data => {
        if (data === null && value != null) {
            console.debug('putting default value', value);
            gunData.put(value);
        }
        gunData.on((data, key) => {
            console.debug('gun.on', key, data);
            store.set(data);
        });
    });

    function set(newval) {
        console.debug('gun.put', newval);
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

export { writableGun };