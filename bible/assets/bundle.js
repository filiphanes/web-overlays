
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function validate_store(store, name) {
        if (store != null && typeof store.subscribe !== 'function') {
            throw new Error(`'${name}' is not a store with a 'subscribe' method`);
        }
    }
    function subscribe(store, ...callbacks) {
        if (store == null) {
            return noop;
        }
        const unsub = store.subscribe(...callbacks);
        return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
    }
    function component_subscribe(component, store, callback) {
        component.$$.on_destroy.push(subscribe(store, callback));
    }
    function set_store_value(store, ret, value = ret) {
        store.set(value);
        return ret;
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function set_style(node, key, value, important) {
        node.style.setProperty(key, value, important ? 'important' : '');
    }
    function select_option(select, value) {
        for (let i = 0; i < select.options.length; i += 1) {
            const option = select.options[i];
            if (option.__value === value) {
                option.selected = true;
                return;
            }
        }
    }
    function select_value(select) {
        const selected_option = select.querySelector(':checked') || select.options[0];
        return selected_option && selected_option.__value;
    }
    function toggle_class(element, name, toggle) {
        element.classList[toggle ? 'add' : 'remove'](name);
    }
    function custom_event(type, detail, bubbles = false) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }
    function onDestroy(fn) {
        get_current_component().$$.on_destroy.push(fn);
    }
    function createEventDispatcher() {
        const component = get_current_component();
        return (type, detail) => {
            const callbacks = component.$$.callbacks[type];
            if (callbacks) {
                // TODO are there situations where events could be dispatched
                // in a server (non-DOM) environment?
                const event = custom_event(type, detail);
                callbacks.slice().forEach(fn => {
                    fn.call(component, event);
                });
            }
        };
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    function add_flush_callback(fn) {
        flush_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);

    function bind(component, name, callback) {
        const index = component.$$.props[name];
        if (index !== undefined) {
            component.$$.bound[index] = callback;
            callback(component.$$.ctx[index]);
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : options.context || []),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.40.1' }, detail), true));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function prop_dev(node, property, value) {
        node[property] = value;
        dispatch_dev('SvelteDOMSetProperty', { node, property, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /* src/Keypad.svelte generated by Svelte v3.40.1 */
    const file$1 = "src/Keypad.svelte";

    function create_fragment$1(ctx) {
    	let div;
    	let button0;
    	let t1;
    	let button1;
    	let t3;
    	let button2;
    	let t5;
    	let button3;
    	let t7;
    	let button4;
    	let t9;
    	let button5;
    	let t11;
    	let button6;
    	let t13;
    	let button7;
    	let t15;
    	let button8;
    	let t17;
    	let button9;
    	let t18;
    	let button9_disabled_value;
    	let t19;
    	let button10;
    	let t21;
    	let button11;
    	let t22;
    	let button11_disabled_value;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div = element("div");
    			button0 = element("button");
    			button0.textContent = "1";
    			t1 = space();
    			button1 = element("button");
    			button1.textContent = "2";
    			t3 = space();
    			button2 = element("button");
    			button2.textContent = "3";
    			t5 = space();
    			button3 = element("button");
    			button3.textContent = "4";
    			t7 = space();
    			button4 = element("button");
    			button4.textContent = "5";
    			t9 = space();
    			button5 = element("button");
    			button5.textContent = "6";
    			t11 = space();
    			button6 = element("button");
    			button6.textContent = "7";
    			t13 = space();
    			button7 = element("button");
    			button7.textContent = "8";
    			t15 = space();
    			button8 = element("button");
    			button8.textContent = "9";
    			t17 = space();
    			button9 = element("button");
    			t18 = text("←");
    			t19 = space();
    			button10 = element("button");
    			button10.textContent = "0";
    			t21 = space();
    			button11 = element("button");
    			t22 = text("C");
    			attr_dev(button0, "class", "btn btn-primary");
    			add_location(button0, file$1, 14, 2, 381);
    			attr_dev(button1, "class", "btn btn-primary");
    			add_location(button1, file$1, 15, 2, 447);
    			attr_dev(button2, "class", "btn btn-primary");
    			add_location(button2, file$1, 16, 2, 513);
    			attr_dev(button3, "class", "btn btn-primary");
    			add_location(button3, file$1, 18, 2, 580);
    			attr_dev(button4, "class", "btn btn-primary");
    			add_location(button4, file$1, 19, 2, 646);
    			attr_dev(button5, "class", "btn btn-primary");
    			add_location(button5, file$1, 20, 2, 712);
    			attr_dev(button6, "class", "btn btn-primary");
    			add_location(button6, file$1, 22, 2, 779);
    			attr_dev(button7, "class", "btn btn-primary");
    			add_location(button7, file$1, 23, 2, 845);
    			attr_dev(button8, "class", "btn btn-primary");
    			add_location(button8, file$1, 24, 2, 911);
    			attr_dev(button9, "class", "btn btn-primary");
    			button9.disabled = button9_disabled_value = !/*value*/ ctx[0];
    			add_location(button9, file$1, 26, 2, 978);
    			attr_dev(button10, "class", "btn btn-primary");
    			add_location(button10, file$1, 27, 2, 1062);
    			attr_dev(button11, "class", "btn btn-primary");
    			button11.disabled = button11_disabled_value = !/*value*/ ctx[0];
    			add_location(button11, file$1, 28, 2, 1128);
    			attr_dev(div, "class", "keypad");
    			add_location(div, file$1, 13, 0, 358);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, button0);
    			append_dev(div, t1);
    			append_dev(div, button1);
    			append_dev(div, t3);
    			append_dev(div, button2);
    			append_dev(div, t5);
    			append_dev(div, button3);
    			append_dev(div, t7);
    			append_dev(div, button4);
    			append_dev(div, t9);
    			append_dev(div, button5);
    			append_dev(div, t11);
    			append_dev(div, button6);
    			append_dev(div, t13);
    			append_dev(div, button7);
    			append_dev(div, t15);
    			append_dev(div, button8);
    			append_dev(div, t17);
    			append_dev(div, button9);
    			append_dev(button9, t18);
    			append_dev(div, t19);
    			append_dev(div, button10);
    			append_dev(div, t21);
    			append_dev(div, button11);
    			append_dev(button11, t22);

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", /*select*/ ctx[1](1), false, false, false),
    					listen_dev(button1, "click", /*select*/ ctx[1](2), false, false, false),
    					listen_dev(button2, "click", /*select*/ ctx[1](3), false, false, false),
    					listen_dev(button3, "click", /*select*/ ctx[1](4), false, false, false),
    					listen_dev(button4, "click", /*select*/ ctx[1](5), false, false, false),
    					listen_dev(button5, "click", /*select*/ ctx[1](6), false, false, false),
    					listen_dev(button6, "click", /*select*/ ctx[1](7), false, false, false),
    					listen_dev(button7, "click", /*select*/ ctx[1](8), false, false, false),
    					listen_dev(button8, "click", /*select*/ ctx[1](9), false, false, false),
    					listen_dev(button9, "click", /*backspace*/ ctx[3], false, false, false),
    					listen_dev(button10, "click", /*select*/ ctx[1](0), false, false, false),
    					listen_dev(button11, "click", /*clear*/ ctx[2], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*value*/ 1 && button9_disabled_value !== (button9_disabled_value = !/*value*/ ctx[0])) {
    				prop_dev(button9, "disabled", button9_disabled_value);
    			}

    			if (dirty & /*value*/ 1 && button11_disabled_value !== (button11_disabled_value = !/*value*/ ctx[0])) {
    				prop_dev(button11, "disabled", button11_disabled_value);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Keypad', slots, []);
    	let { value = "" } = $$props;
    	let { max = 99999999 } = $$props;
    	const dispatch = createEventDispatcher();

    	const select = num => () => {
    		$$invalidate(0, value = Math.min(+value * 10 + num, max || 99999999));
    	};

    	const clear = () => {
    		$$invalidate(0, value = "");
    	};

    	const backspace = () => {
    		$$invalidate(0, value = Math.floor(+value / 10) || '');
    	};

    	const writable_props = ['value', 'max'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Keypad> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('value' in $$props) $$invalidate(0, value = $$props.value);
    		if ('max' in $$props) $$invalidate(4, max = $$props.max);
    	};

    	$$self.$capture_state = () => ({
    		createEventDispatcher,
    		value,
    		max,
    		dispatch,
    		select,
    		clear,
    		backspace
    	});

    	$$self.$inject_state = $$props => {
    		if ('value' in $$props) $$invalidate(0, value = $$props.value);
    		if ('max' in $$props) $$invalidate(4, max = $$props.max);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [value, select, clear, backspace, max];
    }

    class Keypad extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, { value: 0, max: 4 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Keypad",
    			options,
    			id: create_fragment$1.name
    		});
    	}

    	get value() {
    		throw new Error("<Keypad>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set value(value) {
    		throw new Error("<Keypad>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get max() {
    		throw new Error("<Keypad>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set max(value) {
    		throw new Error("<Keypad>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    const subscriber_queue = [];
    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=}start start and stop notifications for subscriptions
     */
    function writable(value, start = noop) {
        let stop;
        const subscribers = new Set();
        function set(new_value) {
            if (safe_not_equal(value, new_value)) {
                value = new_value;
                if (stop) { // store is ready
                    const run_queue = !subscriber_queue.length;
                    for (const subscriber of subscribers) {
                        subscriber[1]();
                        subscriber_queue.push(subscriber, value);
                    }
                    if (run_queue) {
                        for (let i = 0; i < subscriber_queue.length; i += 2) {
                            subscriber_queue[i][0](subscriber_queue[i + 1]);
                        }
                        subscriber_queue.length = 0;
                    }
                }
            }
        }
        function update(fn) {
            set(fn(value));
        }
        function subscribe(run, invalidate = noop) {
            const subscriber = [run, invalidate];
            subscribers.add(subscriber);
            if (subscribers.size === 1) {
                stop = start(set) || noop;
            }
            run(value);
            return () => {
                subscribers.delete(subscriber);
                if (subscribers.size === 0) {
                    stop();
                    stop = null;
                }
            };
        }
        return { set, update, subscribe };
    }

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

    /* src/App.svelte generated by Svelte v3.40.1 */

    const { Object: Object_1, console: console_1 } = globals;
    const file = "src/App.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[50] = list[i];
    	child_ctx[52] = i;
    	return child_ctx;
    }

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[53] = list[i];
    	return child_ctx;
    }

    // (209:2) {#each filteredBooks as book}
    function create_each_block_1(ctx) {
    	let button;
    	let t_value = /*book*/ ctx[53].name + "";
    	let t;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			button = element("button");
    			t = text(t_value);
    			attr_dev(button, "class", "book-item btn");
    			toggle_class(button, "btn-primary", /*book*/ ctx[53].abbreviation == /*$address*/ ctx[2].book);
    			add_location(button, file, 209, 2, 6467);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);
    			append_dev(button, t);

    			if (!mounted) {
    				dispose = listen_dev(
    					button,
    					"click",
    					function () {
    						if (is_function(/*addressSelector*/ ctx[19]({ book: /*book*/ ctx[53].abbreviation }))) /*addressSelector*/ ctx[19]({ book: /*book*/ ctx[53].abbreviation }).apply(this, arguments);
    					},
    					false,
    					false,
    					false
    				);

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty[0] & /*filteredBooks*/ 128 && t_value !== (t_value = /*book*/ ctx[53].name + "")) set_data_dev(t, t_value);

    			if (dirty[0] & /*filteredBooks, $address*/ 132) {
    				toggle_class(button, "btn-primary", /*book*/ ctx[53].abbreviation == /*$address*/ ctx[2].book);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_1.name,
    		type: "each",
    		source: "(209:2) {#each filteredBooks as book}",
    		ctx
    	});

    	return block;
    }

    // (213:2) {#each lastAddresses as addr, i}
    function create_each_block(ctx) {
    	let div;
    	let button0;
    	let t0_value = (/*addressAsString*/ ctx[18](/*addr*/ ctx[50]) || /*addr*/ ctx[50].book + ' ' + /*addr*/ ctx[50].chapter + ',' + /*addr*/ ctx[50].verse) + "";
    	let t0;
    	let t1;
    	let button1;
    	let t3;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div = element("div");
    			button0 = element("button");
    			t0 = text(t0_value);
    			t1 = space();
    			button1 = element("button");
    			button1.textContent = "×";
    			t3 = space();
    			attr_dev(button0, "class", "address-set btn");
    			toggle_class(button0, "btn-primary", equalAddresses(/*addr*/ ctx[50], /*$address*/ ctx[2]));
    			add_location(button0, file, 214, 4, 6747);
    			attr_dev(button1, "class", "btn btn-secondary address-remove");
    			add_location(button1, file, 215, 4, 6947);
    			attr_dev(div, "class", "address-item btn-group");
    			add_location(div, file, 213, 2, 6706);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, button0);
    			append_dev(button0, t0);
    			append_dev(div, t1);
    			append_dev(div, button1);
    			append_dev(div, t3);

    			if (!mounted) {
    				dispose = [
    					listen_dev(
    						button0,
    						"click",
    						function () {
    							if (is_function(/*addressSelector*/ ctx[19](/*addr*/ ctx[50]))) /*addressSelector*/ ctx[19](/*addr*/ ctx[50]).apply(this, arguments);
    						},
    						false,
    						false,
    						false
    					),
    					listen_dev(button1, "click", /*removeLastAddress*/ ctx[20](/*i*/ ctx[52]), false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty[0] & /*lastAddresses*/ 2 && t0_value !== (t0_value = (/*addressAsString*/ ctx[18](/*addr*/ ctx[50]) || /*addr*/ ctx[50].book + ' ' + /*addr*/ ctx[50].chapter + ',' + /*addr*/ ctx[50].verse) + "")) set_data_dev(t0, t0_value);

    			if (dirty[0] & /*lastAddresses, $address*/ 6) {
    				toggle_class(button0, "btn-primary", equalAddresses(/*addr*/ ctx[50], /*$address*/ ctx[2]));
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(213:2) {#each lastAddresses as addr, i}",
    		ctx
    	});

    	return block;
    }

    // (228:21) {:else}
    function create_else_block(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Zobraziť");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(228:21) {:else}",
    		ctx
    	});

    	return block;
    }

    // (228:4) {#if $shown}
    function create_if_block_2(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Skryť");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(228:4) {#if $shown}",
    		ctx
    	});

    	return block;
    }

    // (232:25) {#if $address.count>1}
    function create_if_block_1(ctx) {
    	let t0;
    	let t1_value = /*$address*/ ctx[2].verse + /*$address*/ ctx[2].count - 1 + "";
    	let t1;

    	const block = {
    		c: function create() {
    			t0 = text("- ");
    			t1 = text(t1_value);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t0, anchor);
    			insert_dev(target, t1, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*$address*/ 4 && t1_value !== (t1_value = /*$address*/ ctx[2].verse + /*$address*/ ctx[2].count - 1 + "")) set_data_dev(t1, t1_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(t1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(232:25) {#if $address.count>1}",
    		ctx
    	});

    	return block;
    }

    // (263:12) {#if loadingBible}
    function create_if_block(ctx) {
    	let t0;
    	let t1;
    	let t2;

    	const block = {
    		c: function create() {
    			t0 = text("Načítava sa biblia ");
    			t1 = text(/*$bibleid*/ ctx[3]);
    			t2 = text(".");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t0, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, t2, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*$bibleid*/ 8) set_data_dev(t1, /*$bibleid*/ ctx[3]);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(t2);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(263:12) {#if loadingBible}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let div0;
    	let input;
    	let t0;
    	let button0;
    	let t2;
    	let div1;
    	let t3;
    	let div2;
    	let t4;
    	let div3;
    	let t5;
    	let t6_value = /*$address*/ ctx[2].chapter + "";
    	let t6;
    	let t7;
    	let t8;
    	let t9;
    	let keypad0;
    	let updating_value;
    	let t10;
    	let button1;
    	let t12;
    	let button2;
    	let t14;
    	let br0;
    	let t15;
    	let button3;
    	let t16;
    	let div4;
    	let t17;
    	let t18_value = /*$address*/ ctx[2].verse + "";
    	let t18;
    	let t19;
    	let t20;
    	let t21;
    	let t22;
    	let keypad1;
    	let updating_value_1;
    	let t23;
    	let button4;
    	let t25;
    	let button5;
    	let t27;
    	let br1;
    	let t28;
    	let button6;
    	let t29;
    	let button6_disabled_value;
    	let t30;
    	let button7;
    	let t31;
    	let button7_disabled_value;
    	let t32;
    	let br2;
    	let t33;
    	let button8;
    	let t34;
    	let button8_disabled_value;
    	let t35;
    	let button9;
    	let t36;
    	let button9_disabled_value;
    	let t37;
    	let div5;
    	let t38;
    	let t39;
    	let p;
    	let t40;
    	let br3;
    	let t41;
    	let div6;
    	let t42;
    	let select0;
    	let option0;
    	let option1;
    	let option2;
    	let t46;
    	let div7;
    	let t47;
    	let select1;
    	let option3;
    	let option4;
    	let t50;
    	let current;
    	let mounted;
    	let dispose;
    	let each_value_1 = /*filteredBooks*/ ctx[7];
    	validate_each_argument(each_value_1);
    	let each_blocks_1 = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks_1[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
    	}

    	let each_value = /*lastAddresses*/ ctx[1];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	function keypad0_value_binding(value) {
    		/*keypad0_value_binding*/ ctx[31](value);
    	}

    	let keypad0_props = { max: /*bookLength*/ ctx[5] };

    	if (/*$address*/ ctx[2].chapter !== void 0) {
    		keypad0_props.value = /*$address*/ ctx[2].chapter;
    	}

    	keypad0 = new Keypad({ props: keypad0_props, $$inline: true });
    	binding_callbacks.push(() => bind(keypad0, 'value', keypad0_value_binding));

    	function select_block_type(ctx, dirty) {
    		if (/*$shown*/ ctx[8]) return create_if_block_2;
    		return create_else_block;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block0 = current_block_type(ctx);
    	let if_block1 = /*$address*/ ctx[2].count > 1 && create_if_block_1(ctx);

    	function keypad1_value_binding(value) {
    		/*keypad1_value_binding*/ ctx[32](value);
    	}

    	let keypad1_props = { max: /*chapterLength*/ ctx[6] };

    	if (/*$address*/ ctx[2].verse !== void 0) {
    		keypad1_props.value = /*$address*/ ctx[2].verse;
    	}

    	keypad1 = new Keypad({ props: keypad1_props, $$inline: true });
    	binding_callbacks.push(() => bind(keypad1, 'value', keypad1_value_binding));
    	let if_block2 = /*loadingBible*/ ctx[4] && create_if_block(ctx);

    	const block = {
    		c: function create() {
    			div0 = element("div");
    			input = element("input");
    			t0 = space();
    			button0 = element("button");
    			button0.textContent = "×";
    			t2 = space();
    			div1 = element("div");

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].c();
    			}

    			t3 = space();
    			div2 = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t4 = space();
    			div3 = element("div");
    			t5 = text("Kapitola: ");
    			t6 = text(t6_value);
    			t7 = text(" z ");
    			t8 = text(/*bookLength*/ ctx[5]);
    			t9 = space();
    			create_component(keypad0.$$.fragment);
    			t10 = space();
    			button1 = element("button");
    			button1.textContent = "-1";
    			t12 = space();
    			button2 = element("button");
    			button2.textContent = "+1";
    			t14 = space();
    			br0 = element("br");
    			t15 = space();
    			button3 = element("button");
    			if_block0.c();
    			t16 = space();
    			div4 = element("div");
    			t17 = text("Verš: ");
    			t18 = text(t18_value);
    			t19 = space();
    			if (if_block1) if_block1.c();
    			t20 = text(" z ");
    			t21 = text(/*chapterLength*/ ctx[6]);
    			t22 = space();
    			create_component(keypad1.$$.fragment);
    			t23 = space();
    			button4 = element("button");
    			button4.textContent = "-1";
    			t25 = space();
    			button5 = element("button");
    			button5.textContent = "+1";
    			t27 = space();
    			br1 = element("br");
    			t28 = space();
    			button6 = element("button");
    			t29 = text("-1");
    			t30 = space();
    			button7 = element("button");
    			t31 = text("+1");
    			t32 = space();
    			br2 = element("br");
    			t33 = space();
    			button8 = element("button");
    			t34 = text("⇐");
    			t35 = space();
    			button9 = element("button");
    			t36 = text("⇒");
    			t37 = space();
    			div5 = element("div");
    			t38 = text(/*$line1*/ ctx[10]);
    			t39 = space();
    			p = element("p");
    			t40 = space();
    			br3 = element("br");
    			t41 = space();
    			div6 = element("div");
    			t42 = text("Téma:\n  ");
    			select0 = element("select");
    			option0 = element("option");
    			option0.textContent = "Predvolené";
    			option1 = element("option");
    			option1.textContent = "Jednoduché s tieňom";
    			option2 = element("option");
    			option2.textContent = "Fullscreen biele pozadie";
    			t46 = space();
    			div7 = element("div");
    			t47 = text("Biblia:\n  ");
    			select1 = element("select");
    			option3 = element("option");
    			option3.textContent = "Roháčkov";
    			option4 = element("option");
    			option4.textContent = "Ekumenický";
    			t50 = space();
    			if (if_block2) if_block2.c();
    			attr_dev(input, "class", "form-control");
    			attr_dev(input, "type", "text");
    			attr_dev(input, "placeholder", "filter");
    			set_style(input, "flex-grow", "1");
    			add_location(input, file, 204, 2, 6160);
    			attr_dev(button0, "type", "button");
    			attr_dev(button0, "class", "form-control btn btn-secondary");
    			set_style(button0, "max-width", "2rem");
    			add_location(button0, file, 205, 2, 6271);
    			attr_dev(div0, "class", "input-group");
    			set_style(div0, "width", "100%");
    			set_style(div0, "display", "flex");
    			add_location(div0, file, 203, 0, 6096);
    			attr_dev(div1, "class", "books-filter");
    			add_location(div1, file, 207, 0, 6406);
    			attr_dev(div2, "class", "address-filter");
    			add_location(div2, file, 211, 0, 6640);
    			attr_dev(button1, "class", "btn btn-primary");
    			set_style(button1, "line-height", "2rem");
    			add_location(button1, file, 223, 2, 7247);
    			attr_dev(button2, "class", "btn btn-primary");
    			set_style(button2, "line-height", "2rem");
    			add_location(button2, file, 224, 2, 7348);
    			add_location(br0, file, 225, 2, 7449);
    			attr_dev(button3, "class", "control-button btn");
    			set_style(button3, "line-height", "2rem");
    			toggle_class(button3, "btn-danger", /*$shown*/ ctx[8]);
    			toggle_class(button3, "btn-success", !/*$shown*/ ctx[8]);
    			add_location(button3, file, 226, 2, 7458);
    			set_style(div3, "display", "inline-block");
    			set_style(div3, "margin", ".5rem");
    			set_style(div3, "vertical-align", "top");
    			add_location(div3, file, 220, 0, 7066);
    			attr_dev(button4, "class", "btn btn-primary");
    			set_style(button4, "line-height", "2rem");
    			add_location(button4, file, 233, 2, 7905);
    			attr_dev(button5, "class", "btn btn-primary");
    			set_style(button5, "line-height", "2rem");
    			add_location(button5, file, 234, 2, 8004);
    			add_location(br1, file, 235, 2, 8103);
    			attr_dev(button6, "class", "btn btn-primary");
    			set_style(button6, "line-height", "2rem");
    			button6.disabled = button6_disabled_value = /*$address*/ ctx[2].count <= 1;
    			add_location(button6, file, 236, 2, 8112);
    			attr_dev(button7, "class", "btn btn-primary");
    			set_style(button7, "line-height", "2rem");
    			button7.disabled = button7_disabled_value = /*$address*/ ctx[2].verse + /*$address*/ ctx[2].count > /*chapterLength*/ ctx[6];
    			add_location(button7, file, 237, 2, 8259);
    			add_location(br2, file, 238, 2, 8431);
    			attr_dev(button8, "class", "btn btn-primary");
    			set_style(button8, "line-height", "2rem");
    			button8.disabled = button8_disabled_value = /*$address*/ ctx[2].verse <= 1;
    			add_location(button8, file, 239, 2, 8440);
    			attr_dev(button9, "class", "btn btn-primary");
    			set_style(button9, "line-height", "2rem");
    			button9.disabled = button9_disabled_value = /*$address*/ ctx[2].verse + /*$address*/ ctx[2].count > /*chapterLength*/ ctx[6];
    			add_location(button9, file, 240, 2, 8623);
    			set_style(div4, "display", "inline-block");
    			set_style(div4, "margin", ".5rem");
    			set_style(div4, "vertical-align", "top");
    			add_location(div4, file, 230, 0, 7658);
    			attr_dev(div5, "class", "address");
    			add_location(div5, file, 243, 0, 8851);
    			attr_dev(p, "class", "vers");
    			set_style(p, "margin-bottom", "1rem");
    			set_style(p, "min-height", "5rem");
    			add_location(p, file, 244, 0, 8887);
    			add_location(br3, file, 247, 0, 8973);
    			option0.__value = "";
    			option0.value = option0.__value;
    			option0.selected = true;
    			add_location(option0, file, 251, 4, 9051);
    			option1.__value = "simple-with-shadow";
    			option1.value = option1.__value;
    			option1.selected = true;
    			add_location(option1, file, 252, 4, 9101);
    			option2.__value = "fullscreen-white-bg";
    			option2.value = option2.__value;
    			add_location(option2, file, 253, 4, 9178);
    			if (/*$bodyclass*/ ctx[11] === void 0) add_render_callback(() => /*select0_change_handler*/ ctx[37].call(select0));
    			add_location(select0, file, 250, 2, 9014);
    			attr_dev(div6, "class", "bodyclass");
    			add_location(div6, file, 248, 0, 8980);
    			option3.__value = "roh";
    			option3.value = option3.__value;
    			add_location(option3, file, 260, 4, 9335);
    			option4.__value = "seb";
    			option4.value = option4.__value;
    			add_location(option4, file, 261, 4, 9377);
    			if (/*$bibleid*/ ctx[3] === void 0) add_render_callback(() => /*select1_change_handler*/ ctx[38].call(select1));
    			add_location(select1, file, 259, 2, 9300);
    			attr_dev(div7, "class", "bible");
    			add_location(div7, file, 257, 0, 9268);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div0, anchor);
    			append_dev(div0, input);
    			set_input_value(input, /*bookFilter*/ ctx[0]);
    			append_dev(div0, t0);
    			append_dev(div0, button0);
    			insert_dev(target, t2, anchor);
    			insert_dev(target, div1, anchor);

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].m(div1, null);
    			}

    			insert_dev(target, t3, anchor);
    			insert_dev(target, div2, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div2, null);
    			}

    			insert_dev(target, t4, anchor);
    			insert_dev(target, div3, anchor);
    			append_dev(div3, t5);
    			append_dev(div3, t6);
    			append_dev(div3, t7);
    			append_dev(div3, t8);
    			append_dev(div3, t9);
    			mount_component(keypad0, div3, null);
    			append_dev(div3, t10);
    			append_dev(div3, button1);
    			append_dev(div3, t12);
    			append_dev(div3, button2);
    			append_dev(div3, t14);
    			append_dev(div3, br0);
    			append_dev(div3, t15);
    			append_dev(div3, button3);
    			if_block0.m(button3, null);
    			insert_dev(target, t16, anchor);
    			insert_dev(target, div4, anchor);
    			append_dev(div4, t17);
    			append_dev(div4, t18);
    			append_dev(div4, t19);
    			if (if_block1) if_block1.m(div4, null);
    			append_dev(div4, t20);
    			append_dev(div4, t21);
    			append_dev(div4, t22);
    			mount_component(keypad1, div4, null);
    			append_dev(div4, t23);
    			append_dev(div4, button4);
    			append_dev(div4, t25);
    			append_dev(div4, button5);
    			append_dev(div4, t27);
    			append_dev(div4, br1);
    			append_dev(div4, t28);
    			append_dev(div4, button6);
    			append_dev(button6, t29);
    			append_dev(div4, t30);
    			append_dev(div4, button7);
    			append_dev(button7, t31);
    			append_dev(div4, t32);
    			append_dev(div4, br2);
    			append_dev(div4, t33);
    			append_dev(div4, button8);
    			append_dev(button8, t34);
    			append_dev(div4, t35);
    			append_dev(div4, button9);
    			append_dev(button9, t36);
    			insert_dev(target, t37, anchor);
    			insert_dev(target, div5, anchor);
    			append_dev(div5, t38);
    			insert_dev(target, t39, anchor);
    			insert_dev(target, p, anchor);
    			p.innerHTML = /*$line2*/ ctx[9];
    			insert_dev(target, t40, anchor);
    			insert_dev(target, br3, anchor);
    			insert_dev(target, t41, anchor);
    			insert_dev(target, div6, anchor);
    			append_dev(div6, t42);
    			append_dev(div6, select0);
    			append_dev(select0, option0);
    			append_dev(select0, option1);
    			append_dev(select0, option2);
    			select_option(select0, /*$bodyclass*/ ctx[11]);
    			insert_dev(target, t46, anchor);
    			insert_dev(target, div7, anchor);
    			append_dev(div7, t47);
    			append_dev(div7, select1);
    			append_dev(select1, option3);
    			append_dev(select1, option4);
    			select_option(select1, /*$bibleid*/ ctx[3]);
    			append_dev(div7, t50);
    			if (if_block2) if_block2.m(div7, null);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(input, "input", /*input_input_handler*/ ctx[29]),
    					listen_dev(button0, "click", /*click_handler*/ ctx[30], false, false, false),
    					listen_dev(button1, "click", /*decrementChapter*/ ctx[24], false, false, false),
    					listen_dev(button2, "click", /*incrementChapter*/ ctx[25], false, false, false),
    					listen_dev(button3, "click", /*toggleLine*/ ctx[21], false, false, false),
    					listen_dev(button4, "click", /*decrementVerse*/ ctx[22], false, false, false),
    					listen_dev(button5, "click", /*incrementVerse*/ ctx[23], false, false, false),
    					listen_dev(button6, "click", /*click_handler_1*/ ctx[33], false, false, false),
    					listen_dev(button7, "click", /*click_handler_2*/ ctx[34], false, false, false),
    					listen_dev(button8, "click", /*click_handler_3*/ ctx[35], false, false, false),
    					listen_dev(button9, "click", /*click_handler_4*/ ctx[36], false, false, false),
    					listen_dev(select0, "change", /*select0_change_handler*/ ctx[37]),
    					listen_dev(select1, "change", /*select1_change_handler*/ ctx[38])
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*bookFilter*/ 1 && input.value !== /*bookFilter*/ ctx[0]) {
    				set_input_value(input, /*bookFilter*/ ctx[0]);
    			}

    			if (dirty[0] & /*filteredBooks, $address, addressSelector*/ 524420) {
    				each_value_1 = /*filteredBooks*/ ctx[7];
    				validate_each_argument(each_value_1);
    				let i;

    				for (i = 0; i < each_value_1.length; i += 1) {
    					const child_ctx = get_each_context_1(ctx, each_value_1, i);

    					if (each_blocks_1[i]) {
    						each_blocks_1[i].p(child_ctx, dirty);
    					} else {
    						each_blocks_1[i] = create_each_block_1(child_ctx);
    						each_blocks_1[i].c();
    						each_blocks_1[i].m(div1, null);
    					}
    				}

    				for (; i < each_blocks_1.length; i += 1) {
    					each_blocks_1[i].d(1);
    				}

    				each_blocks_1.length = each_value_1.length;
    			}

    			if (dirty[0] & /*removeLastAddress, lastAddresses, $address, addressSelector, addressAsString*/ 1835014) {
    				each_value = /*lastAddresses*/ ctx[1];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div2, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}

    			if ((!current || dirty[0] & /*$address*/ 4) && t6_value !== (t6_value = /*$address*/ ctx[2].chapter + "")) set_data_dev(t6, t6_value);
    			if (!current || dirty[0] & /*bookLength*/ 32) set_data_dev(t8, /*bookLength*/ ctx[5]);
    			const keypad0_changes = {};
    			if (dirty[0] & /*bookLength*/ 32) keypad0_changes.max = /*bookLength*/ ctx[5];

    			if (!updating_value && dirty[0] & /*$address*/ 4) {
    				updating_value = true;
    				keypad0_changes.value = /*$address*/ ctx[2].chapter;
    				add_flush_callback(() => updating_value = false);
    			}

    			keypad0.$set(keypad0_changes);

    			if (current_block_type !== (current_block_type = select_block_type(ctx))) {
    				if_block0.d(1);
    				if_block0 = current_block_type(ctx);

    				if (if_block0) {
    					if_block0.c();
    					if_block0.m(button3, null);
    				}
    			}

    			if (dirty[0] & /*$shown*/ 256) {
    				toggle_class(button3, "btn-danger", /*$shown*/ ctx[8]);
    			}

    			if (dirty[0] & /*$shown*/ 256) {
    				toggle_class(button3, "btn-success", !/*$shown*/ ctx[8]);
    			}

    			if ((!current || dirty[0] & /*$address*/ 4) && t18_value !== (t18_value = /*$address*/ ctx[2].verse + "")) set_data_dev(t18, t18_value);

    			if (/*$address*/ ctx[2].count > 1) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block_1(ctx);
    					if_block1.c();
    					if_block1.m(div4, t20);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if (!current || dirty[0] & /*chapterLength*/ 64) set_data_dev(t21, /*chapterLength*/ ctx[6]);
    			const keypad1_changes = {};
    			if (dirty[0] & /*chapterLength*/ 64) keypad1_changes.max = /*chapterLength*/ ctx[6];

    			if (!updating_value_1 && dirty[0] & /*$address*/ 4) {
    				updating_value_1 = true;
    				keypad1_changes.value = /*$address*/ ctx[2].verse;
    				add_flush_callback(() => updating_value_1 = false);
    			}

    			keypad1.$set(keypad1_changes);

    			if (!current || dirty[0] & /*$address*/ 4 && button6_disabled_value !== (button6_disabled_value = /*$address*/ ctx[2].count <= 1)) {
    				prop_dev(button6, "disabled", button6_disabled_value);
    			}

    			if (!current || dirty[0] & /*$address, chapterLength*/ 68 && button7_disabled_value !== (button7_disabled_value = /*$address*/ ctx[2].verse + /*$address*/ ctx[2].count > /*chapterLength*/ ctx[6])) {
    				prop_dev(button7, "disabled", button7_disabled_value);
    			}

    			if (!current || dirty[0] & /*$address*/ 4 && button8_disabled_value !== (button8_disabled_value = /*$address*/ ctx[2].verse <= 1)) {
    				prop_dev(button8, "disabled", button8_disabled_value);
    			}

    			if (!current || dirty[0] & /*$address, chapterLength*/ 68 && button9_disabled_value !== (button9_disabled_value = /*$address*/ ctx[2].verse + /*$address*/ ctx[2].count > /*chapterLength*/ ctx[6])) {
    				prop_dev(button9, "disabled", button9_disabled_value);
    			}

    			if (!current || dirty[0] & /*$line1*/ 1024) set_data_dev(t38, /*$line1*/ ctx[10]);
    			if (!current || dirty[0] & /*$line2*/ 512) p.innerHTML = /*$line2*/ ctx[9];
    			if (dirty[0] & /*$bodyclass*/ 2048) {
    				select_option(select0, /*$bodyclass*/ ctx[11]);
    			}

    			if (dirty[0] & /*$bibleid*/ 8) {
    				select_option(select1, /*$bibleid*/ ctx[3]);
    			}

    			if (/*loadingBible*/ ctx[4]) {
    				if (if_block2) {
    					if_block2.p(ctx, dirty);
    				} else {
    					if_block2 = create_if_block(ctx);
    					if_block2.c();
    					if_block2.m(div7, null);
    				}
    			} else if (if_block2) {
    				if_block2.d(1);
    				if_block2 = null;
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(keypad0.$$.fragment, local);
    			transition_in(keypad1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(keypad0.$$.fragment, local);
    			transition_out(keypad1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div0);
    			if (detaching) detach_dev(t2);
    			if (detaching) detach_dev(div1);
    			destroy_each(each_blocks_1, detaching);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(div2);
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach_dev(t4);
    			if (detaching) detach_dev(div3);
    			destroy_component(keypad0);
    			if_block0.d();
    			if (detaching) detach_dev(t16);
    			if (detaching) detach_dev(div4);
    			if (if_block1) if_block1.d();
    			destroy_component(keypad1);
    			if (detaching) detach_dev(t37);
    			if (detaching) detach_dev(div5);
    			if (detaching) detach_dev(t39);
    			if (detaching) detach_dev(p);
    			if (detaching) detach_dev(t40);
    			if (detaching) detach_dev(br3);
    			if (detaching) detach_dev(t41);
    			if (detaching) detach_dev(div6);
    			if (detaching) detach_dev(t46);
    			if (detaching) detach_dev(div7);
    			if (if_block2) if_block2.d();
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function equalAddresses(a, b) {
    	return a.book == b.book && a.chapter == b.chapter && a.verse == b.verse && a.count == b.count;
    }

    function instance($$self, $$props, $$invalidate) {
    	let filteredBooks;
    	let chapterLength;
    	let bookLength;
    	let $address;
    	let $shown;
    	let $bibleid;
    	let $line2;
    	let $line1;
    	let $bodyclass;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	let loadingBible;
    	let loadingBook;

    	let defaultAddress = {
    		book: "gn",
    		chapter: 1,
    		verse: 1,
    		count: 1
    	};

    	let books = [];
    	let booksByAbbr = new Map();
    	let bookFilter = "";
    	let shownBook;
    	let lastAddresses = JSON.parse(window.sessionStorage.getItem('lastAddresses') || "null") || [defaultAddress];
    	GUN_SUPER_PEERS = GUN_SUPER_PEERS || ['http://127.0.0.1/gun'];
    	let gun = Gun(GUN_SUPER_PEERS);
    	let overlay = gun.get('bible').get(window.location.hash || 'demo');

    	/* Synced variables */
    	let shown = writableGun(overlay.get('show'), false);

    	validate_store(shown, 'shown');
    	component_subscribe($$self, shown, value => $$invalidate(8, $shown = value));
    	let line1 = writableGun(overlay.get('line1'), '');
    	validate_store(line1, 'line1');
    	component_subscribe($$self, line1, value => $$invalidate(10, $line1 = value));
    	let line2 = writableGun(overlay.get('line2'), '');
    	validate_store(line2, 'line2');
    	component_subscribe($$self, line2, value => $$invalidate(9, $line2 = value));
    	let address = writableGun(overlay.get('address'), defaultAddress);
    	validate_store(address, 'address');
    	component_subscribe($$self, address, value => $$invalidate(2, $address = value));
    	let bodyclass = writableGun(overlay.get('bodyclass'), '');
    	validate_store(bodyclass, 'bodyclass');
    	component_subscribe($$self, bodyclass, value => $$invalidate(11, $bodyclass = value));
    	let bibleid = writableGun(overlay.get('bibleid'), 'roh');
    	validate_store(bibleid, 'bibleid');
    	component_subscribe($$self, bibleid, value => $$invalidate(3, $bibleid = value));

    	/* Disabled last address filtering
    $: filteredLastAddresses = bookFilter
      ? lastAddresses.filter(h => matchesBook(booksByAbbr[h.book]))
      : lastAddresses;
    */
    	function loadBible(path) {
    		$$invalidate(4, loadingBible = true);
    		console.log('Loading Bible', path);
    		let request = new XMLHttpRequest();
    		request.open('GET', path);
    		request.responseType = 'json';
    		request.send();

    		request.onload = function () {
    			$$invalidate(26, books = request.response.books || []);

    			for (let i = 0; i < books.length; i++) {
    				$$invalidate(26, books[i].index = i, books);
    				$$invalidate(27, booksByAbbr[books[i].abbreviation] = books[i], booksByAbbr);
    			}

    			/* Redraw */
    			$$invalidate(1, lastAddresses);

    			$$invalidate(4, loadingBible = false);
    		};
    	}

    	function loadBook(abbreviation) {
    		loadingBook = true;
    		console.log('Loading book', abbreviation);
    		let request = new XMLHttpRequest();
    		request.open('GET', $bibleid + '/' + abbreviation + '.json');
    		request.responseType = 'json';
    		request.send();

    		request.onload = function () {
    			$$invalidate(27, booksByAbbr[abbreviation].chapters = request.response, booksByAbbr);

    			/* Redraw */
    			address.set($address);

    			loadingBook = false;
    		};
    	}

    	function matchesBook(book) {
    		const prefix = bookFilter.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLowerCase();
    		const bookLower = book.name.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLowerCase();
    		return bookLower.startsWith(prefix) || book.abbreviation.startsWith(prefix) || book.aliases && book.aliases.some(a => a.toLowerCase().startsWith(prefix)) || prefix.length >= 2 && bookLower.includes(' ' + prefix);
    	}

    	function addToLastAddresses(address) {
    		lastAddresses.unshift({
    			book: address.book,
    			chapter: address.chapter,
    			verse: address.verse,
    			count: address.count
    		});

    		$$invalidate(1, lastAddresses = lastAddresses.filter((h, i) => i === 0 || !equalAddresses(h, address)));
    	}

    	function addressAsString(address) {
    		if (!booksByAbbr[address.book]) return '';
    		var s = booksByAbbr[address.book].name + ' ' + address.chapter;

    		if (address.verse) {
    			s += ',' + address.verse;

    			if (address.count > 1) {
    				s += '-' + (address.verse + address.count - 1);
    			}
    		}

    		return s;
    	}

    	function addressContent(a) {
    		var book = booksByAbbr[a.book];
    		var content = '';

    		if (book && $address.verse) {
    			if (!book.chapters) {
    				loadBook(a.book);
    				return content;
    			}

    			if (book.chapters[$address.chapter]) {
    				for (var i = $address.verse; i < $address.verse + $address.count; i++) {
    					content += '\n' + (book.chapters[$address.chapter][i - 1] || '');
    				}
    			}
    		}

    		return content;
    	}

    	

    	function addressSelector(a) {
    		a.chapter = a.chapter || '';
    		a.verse = a.verse || '';
    		a.count = a.count || 1;

    		return function () {
    			console.debug('addressSelector:');
    			set_store_value(address, $address = a, $address);
    		};
    	}

    	function removeLastAddress(j) {
    		return function () {
    			$$invalidate(1, lastAddresses = lastAddresses.filter((h, i) => i !== j));
    		};
    	}

    	function toggleLine() {
    		set_store_value(shown, $shown = !$shown, $shown);

    		if ($shown) {
    			addToLastAddresses($address);
    		}
    	}

    	function decrementVerse() {
    		set_store_value(address, $address.verse = +$address.verse - 1, $address);

    		if ($address.verse <= 0) {
    			decrementChapter();
    			$$invalidate(6, chapterLength = booksByAbbr[$address.book].chapters[$address.chapter].length);
    			set_store_value(address, $address.verse = chapterLength, $address);
    		}
    	}

    	

    	function incrementVerse() {
    		set_store_value(address, $address.verse = +$address.verse + 1, $address);

    		if ($address.verse > chapterLength) {
    			incrementChapter();
    			set_store_value(address, $address.verse = 1, $address);
    		}
    	}

    	

    	function decrementChapter() {
    		set_store_value(address, $address.chapter = +$address.chapter - 1, $address);

    		if ($address.chapter <= 0) {
    			decrementBook();
    			set_store_value(address, $address.chapter = Object.keys(booksByAbbr[$address.book].chapters || {}).length, $address);
    		}
    	}

    	

    	function incrementChapter() {
    		set_store_value(address, $address.chapter = +$address.chapter + 1, $address);

    		if ($address.chapter > bookLength) {
    			incrementBook();
    			set_store_value(address, $address.chapter = 1, $address);
    			set_store_value(address, $address.verse = 1, $address);
    		}
    	}

    	

    	function decrementBook() {
    		const newIndex = booksByAbbr[$address.book].index - 1 + books.length;
    		set_store_value(address, $address.book = books[newIndex % books.length].abbreviation, $address);
    		console.log('newIndex', newIndex, $address.book);
    	}

    	

    	function incrementBook() {
    		const newIndex = booksByAbbr[$address.book].index + 1;
    		set_store_value(address, $address.book = books[newIndex % books.length].abbreviation, $address);
    	}

    	
    	const writable_props = [];

    	Object_1.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	function input_input_handler() {
    		bookFilter = this.value;
    		$$invalidate(0, bookFilter);
    	}

    	const click_handler = () => {
    		$$invalidate(0, bookFilter = '');
    	};

    	function keypad0_value_binding(value) {
    		if ($$self.$$.not_equal($address.chapter, value)) {
    			$address.chapter = value;
    			address.set($address);
    		}
    	}

    	function keypad1_value_binding(value) {
    		if ($$self.$$.not_equal($address.verse, value)) {
    			$address.verse = value;
    			address.set($address);
    		}
    	}

    	const click_handler_1 = function () {
    		set_store_value(address, $address.count -= 1, $address);
    	};

    	const click_handler_2 = function () {
    		set_store_value(address, $address.count += 1, $address);
    	};

    	const click_handler_3 = function () {
    		set_store_value(address, $address.verse = Math.max(1, $address.verse - $address.count), $address);
    	};

    	const click_handler_4 = function () {
    		set_store_value(address, $address.verse = Math.min($address.verse + $address.count, chapterLength - 1), $address);
    	};

    	function select0_change_handler() {
    		$bodyclass = select_value(this);
    		bodyclass.set($bodyclass);
    	}

    	function select1_change_handler() {
    		$bibleid = select_value(this);
    		bibleid.set($bibleid);
    	}

    	$$self.$capture_state = () => ({
    		onMount,
    		onDestroy,
    		Keypad,
    		writableGun,
    		loadingBible,
    		loadingBook,
    		defaultAddress,
    		books,
    		booksByAbbr,
    		bookFilter,
    		shownBook,
    		lastAddresses,
    		gun,
    		overlay,
    		shown,
    		line1,
    		line2,
    		address,
    		bodyclass,
    		bibleid,
    		loadBible,
    		loadBook,
    		matchesBook,
    		addToLastAddresses,
    		addressAsString,
    		addressContent,
    		equalAddresses,
    		addressSelector,
    		removeLastAddress,
    		toggleLine,
    		decrementVerse,
    		incrementVerse,
    		decrementChapter,
    		incrementChapter,
    		decrementBook,
    		incrementBook,
    		bookLength,
    		chapterLength,
    		filteredBooks,
    		$address,
    		$shown,
    		$bibleid,
    		$line2,
    		$line1,
    		$bodyclass
    	});

    	$$self.$inject_state = $$props => {
    		if ('loadingBible' in $$props) $$invalidate(4, loadingBible = $$props.loadingBible);
    		if ('loadingBook' in $$props) loadingBook = $$props.loadingBook;
    		if ('defaultAddress' in $$props) defaultAddress = $$props.defaultAddress;
    		if ('books' in $$props) $$invalidate(26, books = $$props.books);
    		if ('booksByAbbr' in $$props) $$invalidate(27, booksByAbbr = $$props.booksByAbbr);
    		if ('bookFilter' in $$props) $$invalidate(0, bookFilter = $$props.bookFilter);
    		if ('shownBook' in $$props) $$invalidate(28, shownBook = $$props.shownBook);
    		if ('lastAddresses' in $$props) $$invalidate(1, lastAddresses = $$props.lastAddresses);
    		if ('gun' in $$props) gun = $$props.gun;
    		if ('overlay' in $$props) overlay = $$props.overlay;
    		if ('shown' in $$props) $$invalidate(12, shown = $$props.shown);
    		if ('line1' in $$props) $$invalidate(13, line1 = $$props.line1);
    		if ('line2' in $$props) $$invalidate(14, line2 = $$props.line2);
    		if ('address' in $$props) $$invalidate(15, address = $$props.address);
    		if ('bodyclass' in $$props) $$invalidate(16, bodyclass = $$props.bodyclass);
    		if ('bibleid' in $$props) $$invalidate(17, bibleid = $$props.bibleid);
    		if ('bookLength' in $$props) $$invalidate(5, bookLength = $$props.bookLength);
    		if ('chapterLength' in $$props) $$invalidate(6, chapterLength = $$props.chapterLength);
    		if ('filteredBooks' in $$props) $$invalidate(7, filteredBooks = $$props.filteredBooks);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty[0] & /*$bibleid*/ 8) {
    			loadBible($bibleid + '/index.json');
    		}

    		if ($$self.$$.dirty[0] & /*booksByAbbr, $address*/ 134217732) {
    			$$invalidate(28, shownBook = booksByAbbr[$address.book] || { chapters: [], name: "" });
    		}

    		if ($$self.$$.dirty[0] & /*$address*/ 4) {
    			set_store_value(line1, $line1 = addressAsString($address), $line1);
    		}

    		if ($$self.$$.dirty[0] & /*$address*/ 4) {
    			set_store_value(line2, $line2 = addressContent($address), $line2);
    		}

    		if ($$self.$$.dirty[0] & /*bookFilter, books*/ 67108865) {
    			$$invalidate(7, filteredBooks = bookFilter ? books.filter(matchesBook) : books);
    		}

    		if ($$self.$$.dirty[0] & /*shownBook, $address*/ 268435460) {
    			$$invalidate(6, chapterLength = ((shownBook.chapters || {})[$address.chapter] || []).length);
    		}

    		if ($$self.$$.dirty[0] & /*shownBook*/ 268435456) {
    			$$invalidate(5, bookLength = Object.keys(shownBook.chapters || {}).length);
    		}

    		if ($$self.$$.dirty[0] & /*lastAddresses*/ 2) {
    			window.sessionStorage.setItem('lastAddresses', JSON.stringify(lastAddresses));
    		}
    	};

    	return [
    		bookFilter,
    		lastAddresses,
    		$address,
    		$bibleid,
    		loadingBible,
    		bookLength,
    		chapterLength,
    		filteredBooks,
    		$shown,
    		$line2,
    		$line1,
    		$bodyclass,
    		shown,
    		line1,
    		line2,
    		address,
    		bodyclass,
    		bibleid,
    		addressAsString,
    		addressSelector,
    		removeLastAddress,
    		toggleLine,
    		decrementVerse,
    		incrementVerse,
    		decrementChapter,
    		incrementChapter,
    		books,
    		booksByAbbr,
    		shownBook,
    		input_input_handler,
    		click_handler,
    		keypad0_value_binding,
    		keypad1_value_binding,
    		click_handler_1,
    		click_handler_2,
    		click_handler_3,
    		click_handler_4,
    		select0_change_handler,
    		select1_change_handler
    	];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {}, null, [-1, -1]);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    var app = new App({
    	target: document.body
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
