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
    function empty() {
        return text('');
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
        if (value != null || input.value) {
            input.value = value;
        }
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
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error(`Function called outside component initialization`);
        return current_component;
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }
    function onDestroy(fn) {
        get_current_component().$$.on_destroy.push(fn);
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
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }

    const globals = (typeof window !== 'undefined' ? window : global);
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
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
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const prop_values = options.props || {};
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
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if ($$.bound[i])
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
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
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
        $set() {
            // overridden by instance, if it has props
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.20.1' }, detail)));
    }
    function append_dev(target, node) {
        dispatch_dev("SvelteDOMInsert", { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev("SvelteDOMInsert", { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev("SvelteDOMRemove", { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ["capture"] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev("SvelteDOMAddEventListener", { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev("SvelteDOMRemoveEventListener", { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev("SvelteDOMRemoveAttribute", { node, attribute });
        else
            dispatch_dev("SvelteDOMSetAttribute", { node, attribute, value });
    }
    function prop_dev(node, property, value) {
        node[property] = value;
        dispatch_dev("SvelteDOMSetProperty", { node, property, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.data === data)
            return;
        dispatch_dev("SvelteDOMSetData", { node: text, data });
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
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error(`'target' is a required option`);
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn(`Component was already destroyed`); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    const subscriber_queue = [];
    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=}start start and stop notifications for subscriptions
     */
    function writable(value, start = noop) {
        let stop;
        const subscribers = [];
        function set(new_value) {
            if (safe_not_equal(value, new_value)) {
                value = new_value;
                if (stop) { // store is ready
                    const run_queue = !subscriber_queue.length;
                    for (let i = 0; i < subscribers.length; i += 1) {
                        const s = subscribers[i];
                        s[1]();
                        subscriber_queue.push(s, value);
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
            subscribers.push(subscriber);
            if (subscribers.length === 1) {
                stop = start(set) || noop;
            }
            run(value);
            return () => {
                const index = subscribers.indexOf(subscriber);
                if (index !== -1) {
                    subscribers.splice(index, 1);
                }
                if (subscribers.length === 0) {
                    stop();
                    stop = null;
                }
            };
        }
        return { set, update, subscribe };
    }

    function writableGun(gunData, value) {
        value = value === undefined ? null : value;
    	let store = writable(value);
        store.subscribe(data => {
            value = data;
        });
        gunData.once(data => {
            if (data === null && value != null) {
                console.debug('putting default value', value);
                gunData.put(value);
            }
            gunData.on((data, key) => {
                // console.debug(key, data);
                store.set(data);
            });
        });

        function set(value) {
            gunData.put(value);
        }
        function update(fn) {
            set(fn(value));
        }
        function subscribe(run) {
            return store.subscribe(run);
        }
        return { set, update, subscribe };
    }

    /* src/App.svelte generated by Svelte v3.20.1 */

    const { Object: Object_1, console: console_1 } = globals;
    const file = "src/App.svelte";

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[66] = list[i];
    	child_ctx[70] = i;
    	return child_ctx;
    }

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[65] = list[i][0];
    	child_ctx[66] = list[i][1];
    	return child_ctx;
    }

    function get_each_context_2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[71] = list[i];
    	child_ctx[70] = i;
    	return child_ctx;
    }

    function get_each_context_3(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[71] = list[i];
    	return child_ctx;
    }

    // (395:2) {#each songsFiltered as song}
    function create_each_block_3(ctx) {
    	let div;
    	let button0;
    	let t0_value = /*song*/ ctx[71].title + "";
    	let t0;
    	let t1;
    	let button1;
    	let t3;
    	let button2;
    	let t5;
    	let button3;
    	let t7;
    	let dispose;

    	function click_handler_2(...args) {
    		return /*click_handler_2*/ ctx[44](/*song*/ ctx[71], ...args);
    	}

    	function click_handler_3(...args) {
    		return /*click_handler_3*/ ctx[45](/*song*/ ctx[71], ...args);
    	}

    	function click_handler_4(...args) {
    		return /*click_handler_4*/ ctx[46](/*song*/ ctx[71], ...args);
    	}

    	function click_handler_5(...args) {
    		return /*click_handler_5*/ ctx[47](/*song*/ ctx[71], ...args);
    	}

    	const block = {
    		c: function create() {
    			div = element("div");
    			button0 = element("button");
    			t0 = text(t0_value);
    			t1 = space();
    			button1 = element("button");
    			button1.textContent = "+";
    			t3 = space();
    			button2 = element("button");
    			button2.textContent = "✎";
    			t5 = space();
    			button3 = element("button");
    			button3.textContent = "🗑";
    			t7 = space();
    			attr_dev(button0, "class", "song-set btn svelte-11j4n0s");
    			toggle_class(button0, "btn-primary", /*song*/ ctx[71] == /*curSong*/ ctx[6]);
    			add_location(button0, file, 396, 4, 10650);
    			attr_dev(button1, "class", "song-add btn btn-success svelte-11j4n0s");
    			add_location(button1, file, 400, 4, 10811);
    			attr_dev(button2, "class", "song-edit btn btn-secondary svelte-11j4n0s");
    			add_location(button2, file, 401, 4, 10902);
    			attr_dev(button3, "class", "song-remove btn btn-secondary svelte-11j4n0s");
    			add_location(button3, file, 402, 4, 11013);
    			attr_dev(div, "class", "song-item btn-group svelte-11j4n0s");
    			add_location(div, file, 395, 2, 10612);
    		},
    		m: function mount(target, anchor, remount) {
    			insert_dev(target, div, anchor);
    			append_dev(div, button0);
    			append_dev(button0, t0);
    			append_dev(div, t1);
    			append_dev(div, button1);
    			append_dev(div, t3);
    			append_dev(div, button2);
    			append_dev(div, t5);
    			append_dev(div, button3);
    			append_dev(div, t7);
    			if (remount) run_all(dispose);

    			dispose = [
    				listen_dev(button0, "click", click_handler_2, false, false, false),
    				listen_dev(button1, "click", click_handler_3, false, false, false),
    				listen_dev(button2, "click", click_handler_4, false, false, false),
    				listen_dev(button3, "click", click_handler_5, false, false, false)
    			];
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty[0] & /*songsFiltered*/ 2 && t0_value !== (t0_value = /*song*/ ctx[71].title + "")) set_data_dev(t0, t0_value);

    			if (dirty[0] & /*songsFiltered, curSong*/ 66) {
    				toggle_class(button0, "btn-primary", /*song*/ ctx[71] == /*curSong*/ ctx[6]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_3.name,
    		type: "each",
    		source: "(395:2) {#each songsFiltered as song}",
    		ctx
    	});

    	return block;
    }

    // (410:2) {#each playlist as song, i}
    function create_each_block_2(ctx) {
    	let div;
    	let button0;
    	let t0_value = /*i*/ ctx[70] + 1 + "";
    	let t0;
    	let t1;
    	let t2_value = /*song*/ ctx[71].title + "";
    	let t2;
    	let t3;
    	let button1;
    	let t5;
    	let dispose;

    	function click_handler_6(...args) {
    		return /*click_handler_6*/ ctx[48](/*i*/ ctx[70], ...args);
    	}

    	function click_handler_7(...args) {
    		return /*click_handler_7*/ ctx[49](/*i*/ ctx[70], ...args);
    	}

    	const block = {
    		c: function create() {
    			div = element("div");
    			button0 = element("button");
    			t0 = text(t0_value);
    			t1 = text(". ");
    			t2 = text(t2_value);
    			t3 = space();
    			button1 = element("button");
    			button1.textContent = "×";
    			t5 = space();
    			attr_dev(button0, "class", "song-set btn svelte-11j4n0s");
    			toggle_class(button0, "btn-primary", /*$curSongIndex*/ ctx[11] == /*i*/ ctx[70]);
    			add_location(button0, file, 411, 4, 11235);
    			attr_dev(button1, "class", "song-remove btn btn-secondary svelte-11j4n0s");
    			add_location(button1, file, 415, 4, 11386);
    			attr_dev(div, "class", "song-item btn-group svelte-11j4n0s");
    			add_location(div, file, 410, 2, 11197);
    		},
    		m: function mount(target, anchor, remount) {
    			insert_dev(target, div, anchor);
    			append_dev(div, button0);
    			append_dev(button0, t0);
    			append_dev(button0, t1);
    			append_dev(button0, t2);
    			append_dev(div, t3);
    			append_dev(div, button1);
    			append_dev(div, t5);
    			if (remount) run_all(dispose);

    			dispose = [
    				listen_dev(button0, "click", click_handler_6, false, false, false),
    				listen_dev(button1, "click", click_handler_7, false, false, false)
    			];
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty[0] & /*playlist*/ 32 && t2_value !== (t2_value = /*song*/ ctx[71].title + "")) set_data_dev(t2, t2_value);

    			if (dirty[0] & /*$curSongIndex*/ 2048) {
    				toggle_class(button0, "btn-primary", /*$curSongIndex*/ ctx[11] == /*i*/ ctx[70]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_2.name,
    		type: "each",
    		source: "(410:2) {#each playlist as song, i}",
    		ctx
    	});

    	return block;
    }

    // (423:5) {#if editing}
    function create_if_block_4(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Uložiť");
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
    		id: create_if_block_4.name,
    		type: "if",
    		source: "(423:5) {#if editing}",
    		ctx
    	});

    	return block;
    }

    // (432:2) {:else}
    function create_else_block_2(ctx) {
    	let span0;
    	let t0_value = /*curSong*/ ctx[6].title + "";
    	let t0;
    	let t1;
    	let span1;
    	let t2_value = /*curSong*/ ctx[6].author + "";
    	let t2;

    	const block = {
    		c: function create() {
    			span0 = element("span");
    			t0 = text(t0_value);
    			t1 = text(" - ");
    			span1 = element("span");
    			t2 = text(t2_value);
    			add_location(span0, file, 432, 4, 12286);
    			add_location(span1, file, 432, 35, 12317);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, span0, anchor);
    			append_dev(span0, t0);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, span1, anchor);
    			append_dev(span1, t2);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*curSong*/ 64 && t0_value !== (t0_value = /*curSong*/ ctx[6].title + "")) set_data_dev(t0, t0_value);
    			if (dirty[0] & /*curSong*/ 64 && t2_value !== (t2_value = /*curSong*/ ctx[6].author + "")) set_data_dev(t2, t2_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(span0);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(span1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_2.name,
    		type: "else",
    		source: "(432:2) {:else}",
    		ctx
    	});

    	return block;
    }

    // (426:2) {#if editing}
    function create_if_block_3(ctx) {
    	let button0;
    	let t1;
    	let button1;
    	let t3;
    	let input0;
    	let t4;
    	let input1;
    	let t5;
    	let input2;
    	let dispose;

    	const block = {
    		c: function create() {
    			button0 = element("button");
    			button0.textContent = "× Zrušiť";
    			t1 = space();
    			button1 = element("button");
    			button1.textContent = "🗑 Odstrániť";
    			t3 = space();
    			input0 = element("input");
    			t4 = space();
    			input1 = element("input");
    			t5 = space();
    			input2 = element("input");
    			attr_dev(button0, "class", "song-cancel btn btn-secondary");
    			add_location(button0, file, 426, 4, 11756);
    			attr_dev(button1, "class", "song-remove btn btn-danger");
    			add_location(button1, file, 427, 4, 11855);
    			attr_dev(input0, "class", "form-control");
    			attr_dev(input0, "type", "text");
    			attr_dev(input0, "placeholder", "title");
    			add_location(input0, file, 428, 4, 11980);
    			attr_dev(input1, "class", "form-control");
    			attr_dev(input1, "type", "text");
    			attr_dev(input1, "placeholder", "author");
    			add_location(input1, file, 429, 4, 12078);
    			attr_dev(input2, "class", "form-control");
    			attr_dev(input2, "type", "text");
    			attr_dev(input2, "placeholder", "order");
    			add_location(input2, file, 430, 4, 12178);
    		},
    		m: function mount(target, anchor, remount) {
    			insert_dev(target, button0, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, button1, anchor);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, input0, anchor);
    			set_input_value(input0, /*editingSong*/ ctx[4].title);
    			insert_dev(target, t4, anchor);
    			insert_dev(target, input1, anchor);
    			set_input_value(input1, /*editingSong*/ ctx[4].author);
    			insert_dev(target, t5, anchor);
    			insert_dev(target, input2, anchor);
    			set_input_value(input2, /*editingSong*/ ctx[4].order);
    			if (remount) run_all(dispose);

    			dispose = [
    				listen_dev(button0, "click", /*click_handler_9*/ ctx[51], false, false, false),
    				listen_dev(button1, "click", /*click_handler_10*/ ctx[52], false, false, false),
    				listen_dev(input0, "input", /*input0_input_handler*/ ctx[53]),
    				listen_dev(input1, "input", /*input1_input_handler_1*/ ctx[54]),
    				listen_dev(input2, "input", /*input2_input_handler*/ ctx[55])
    			];
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*editingSong*/ 16 && input0.value !== /*editingSong*/ ctx[4].title) {
    				set_input_value(input0, /*editingSong*/ ctx[4].title);
    			}

    			if (dirty[0] & /*editingSong*/ 16 && input1.value !== /*editingSong*/ ctx[4].author) {
    				set_input_value(input1, /*editingSong*/ ctx[4].author);
    			}

    			if (dirty[0] & /*editingSong*/ 16 && input2.value !== /*editingSong*/ ctx[4].order) {
    				set_input_value(input2, /*editingSong*/ ctx[4].order);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button0);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(button1);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(input0);
    			if (detaching) detach_dev(t4);
    			if (detaching) detach_dev(input1);
    			if (detaching) detach_dev(t5);
    			if (detaching) detach_dev(input2);
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3.name,
    		type: "if",
    		source: "(426:2) {#if editing}",
    		ctx
    	});

    	return block;
    }

    // (443:2) {:else}
    function create_else_block_1(ctx) {
    	let each_1_anchor;
    	let each_value_1 = /*curVerses*/ ctx[7];
    	validate_each_argument(each_value_1);
    	let each_blocks = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
    	}

    	const block = {
    		c: function create() {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert_dev(target, each_1_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*$curVerseIndex, curVerses*/ 1152) {
    				each_value_1 = /*curVerses*/ ctx[7];
    				validate_each_argument(each_value_1);
    				let i;

    				for (i = 0; i < each_value_1.length; i += 1) {
    					const child_ctx = get_each_context_1(ctx, each_value_1, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block_1(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value_1.length;
    			}
    		},
    		d: function destroy(detaching) {
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach_dev(each_1_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_1.name,
    		type: "else",
    		source: "(443:2) {:else}",
    		ctx
    	});

    	return block;
    }

    // (437:2) {#if editing}
    function create_if_block_2(ctx) {
    	let each_1_anchor;
    	let each_value = Object.entries(/*editingSong*/ ctx[4].verses || {}).filter(func);
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert_dev(target, each_1_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*editingSong, removeVerse*/ 16777232) {
    				each_value = Object.entries(/*editingSong*/ ctx[4].verses || {}).filter(func);
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		d: function destroy(detaching) {
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach_dev(each_1_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(437:2) {#if editing}",
    		ctx
    	});

    	return block;
    }

    // (444:4) {#each curVerses as verse, i}
    function create_each_block_1(ctx) {
    	let p;
    	let t0_value = /*verse*/ ctx[66] + "";
    	let t0;
    	let t1;
    	let dispose;

    	function click_handler_12(...args) {
    		return /*click_handler_12*/ ctx[58](/*i*/ ctx[70], ...args);
    	}

    	const block = {
    		c: function create() {
    			p = element("p");
    			t0 = text(t0_value);
    			t1 = space();
    			attr_dev(p, "class", "verse-item svelte-11j4n0s");
    			toggle_class(p, "active", /*$curVerseIndex*/ ctx[10] == /*i*/ ctx[70]);
    			add_location(p, file, 444, 4, 12802);
    		},
    		m: function mount(target, anchor, remount) {
    			insert_dev(target, p, anchor);
    			append_dev(p, t0);
    			append_dev(p, t1);
    			if (remount) dispose();
    			dispose = listen_dev(p, "click", click_handler_12, false, false, false);
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty[0] & /*curVerses*/ 128 && t0_value !== (t0_value = /*verse*/ ctx[66] + "")) set_data_dev(t0, t0_value);

    			if (dirty[0] & /*$curVerseIndex*/ 1024) {
    				toggle_class(p, "active", /*$curVerseIndex*/ ctx[10] == /*i*/ ctx[70]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_1.name,
    		type: "each",
    		source: "(444:4) {#each curVerses as verse, i}",
    		ctx
    	});

    	return block;
    }

    // (438:4) {#each Object.entries(editingSong.verses||{}).filter(e=>typeof e[1] != 'object' && e[1] != null) as [id, verse]}
    function create_each_block(ctx) {
    	let button;
    	let t1;
    	let span;
    	let t2_value = /*id*/ ctx[65] + "";
    	let t2;
    	let t3;
    	let p;
    	let dispose;

    	function click_handler_11(...args) {
    		return /*click_handler_11*/ ctx[56](/*id*/ ctx[65], ...args);
    	}

    	function p_input_handler() {
    		/*p_input_handler*/ ctx[57].call(p, /*id*/ ctx[65]);
    	}

    	const block = {
    		c: function create() {
    			button = element("button");
    			button.textContent = "×";
    			t1 = space();
    			span = element("span");
    			t2 = text(t2_value);
    			t3 = space();
    			p = element("p");
    			attr_dev(button, "class", "verse-remove btn btn-secondary svelte-11j4n0s");
    			add_location(button, file, 438, 4, 12520);
    			attr_dev(span, "class", "verse-id svelte-11j4n0s");
    			add_location(span, file, 439, 4, 12613);
    			attr_dev(p, "class", "verse-item svelte-11j4n0s");
    			attr_dev(p, "contenteditable", "true");
    			if (/*editingSong*/ ctx[4].verses[/*id*/ ctx[65]] === void 0) add_render_callback(p_input_handler);
    			add_location(p, file, 440, 4, 12652);
    		},
    		m: function mount(target, anchor, remount) {
    			insert_dev(target, button, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, span, anchor);
    			append_dev(span, t2);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, p, anchor);

    			if (/*editingSong*/ ctx[4].verses[/*id*/ ctx[65]] !== void 0) {
    				p.innerHTML = /*editingSong*/ ctx[4].verses[/*id*/ ctx[65]];
    			}

    			if (remount) run_all(dispose);

    			dispose = [
    				listen_dev(button, "click", click_handler_11, false, false, false),
    				listen_dev(p, "input", p_input_handler)
    			];
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty[0] & /*editingSong*/ 16 && t2_value !== (t2_value = /*id*/ ctx[65] + "")) set_data_dev(t2, t2_value);

    			if (dirty[0] & /*editingSong*/ 16 && /*editingSong*/ ctx[4].verses[/*id*/ ctx[65]] !== p.innerHTML) {
    				p.innerHTML = /*editingSong*/ ctx[4].verses[/*id*/ ctx[65]];
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(span);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(p);
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(438:4) {#each Object.entries(editingSong.verses||{}).filter(e=>typeof e[1] != 'object' && e[1] != null) as [id, verse]}",
    		ctx
    	});

    	return block;
    }

    // (450:2) {#if editing}
    function create_if_block_1(ctx) {
    	let button;
    	let t1;
    	let input;
    	let t2;
    	let p;
    	let dispose;

    	const block = {
    		c: function create() {
    			button = element("button");
    			button.textContent = "+";
    			t1 = space();
    			input = element("input");
    			t2 = space();
    			p = element("p");
    			attr_dev(button, "class", "verse-add btn btn-success svelte-11j4n0s");
    			add_location(button, file, 450, 4, 12957);
    			attr_dev(input, "class", "form-control verse-new-id svelte-11j4n0s");
    			attr_dev(input, "type", "text");
    			attr_dev(input, "placeholder", "id");
    			add_location(input, file, 451, 4, 13037);
    			attr_dev(p, "class", "verse-new-item svelte-11j4n0s");
    			attr_dev(p, "contenteditable", "true");
    			if (/*newVerse*/ ctx[9] === void 0) add_render_callback(() => /*p_input_handler_1*/ ctx[60].call(p));
    			add_location(p, file, 452, 4, 13133);
    		},
    		m: function mount(target, anchor, remount) {
    			insert_dev(target, button, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, input, anchor);
    			set_input_value(input, /*newId*/ ctx[8]);
    			insert_dev(target, t2, anchor);
    			insert_dev(target, p, anchor);

    			if (/*newVerse*/ ctx[9] !== void 0) {
    				p.innerHTML = /*newVerse*/ ctx[9];
    			}

    			if (remount) run_all(dispose);

    			dispose = [
    				listen_dev(button, "click", /*addNewVerse*/ ctx[25], false, false, false),
    				listen_dev(input, "input", /*input_input_handler*/ ctx[59]),
    				listen_dev(p, "input", /*p_input_handler_1*/ ctx[60])
    			];
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*newId*/ 256 && input.value !== /*newId*/ ctx[8]) {
    				set_input_value(input, /*newId*/ ctx[8]);
    			}

    			if (dirty[0] & /*newVerse*/ 512 && /*newVerse*/ ctx[9] !== p.innerHTML) {
    				p.innerHTML = /*newVerse*/ ctx[9];
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(input);
    			if (detaching) detach_dev(t2);
    			if (detaching) detach_dev(p);
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(450:2) {#if editing}",
    		ctx
    	});

    	return block;
    }

    // (466:20) {:else}
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
    		source: "(466:20) {:else}",
    		ctx
    	});

    	return block;
    }

    // (466:4) {#if $show}
    function create_if_block(ctx) {
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
    		id: create_if_block.name,
    		type: "if",
    		source: "(466:4) {#if $show}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let p;
    	let t0;
    	let select;
    	let option0;
    	let option1;
    	let t3;
    	let input0;
    	let t4;
    	let div0;
    	let input1;
    	let t5;
    	let button0;
    	let t7;
    	let div1;
    	let t8;
    	let div2;
    	let t9;
    	let t10;
    	let div3;
    	let button1;
    	let t11;
    	let t12;
    	let button2;
    	let t14;
    	let t15;
    	let div4;
    	let t16;
    	let t17;
    	let div5;
    	let button3;
    	let t18;
    	let button3_disabled_value;
    	let t19;
    	let button4;
    	let t20;
    	let button4_disabled_value;
    	let t21;
    	let button5;
    	let t22;
    	let button6;
    	let t23;
    	let button6_disabled_value;
    	let t24;
    	let button7;
    	let t25;
    	let button7_disabled_value;
    	let dispose;
    	let each_value_3 = /*songsFiltered*/ ctx[1];
    	validate_each_argument(each_value_3);
    	let each_blocks_1 = [];

    	for (let i = 0; i < each_value_3.length; i += 1) {
    		each_blocks_1[i] = create_each_block_3(get_each_context_3(ctx, each_value_3, i));
    	}

    	let each_value_2 = /*playlist*/ ctx[5];
    	validate_each_argument(each_value_2);
    	let each_blocks = [];

    	for (let i = 0; i < each_value_2.length; i += 1) {
    		each_blocks[i] = create_each_block_2(get_each_context_2(ctx, each_value_2, i));
    	}

    	let if_block0 = /*editing*/ ctx[3] && create_if_block_4(ctx);

    	function select_block_type(ctx, dirty) {
    		if (/*editing*/ ctx[3]) return create_if_block_3;
    		return create_else_block_2;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block1 = current_block_type(ctx);

    	function select_block_type_1(ctx, dirty) {
    		if (/*editing*/ ctx[3]) return create_if_block_2;
    		return create_else_block_1;
    	}

    	let current_block_type_1 = select_block_type_1(ctx);
    	let if_block2 = current_block_type_1(ctx);
    	let if_block3 = /*editing*/ ctx[3] && create_if_block_1(ctx);

    	function select_block_type_2(ctx, dirty) {
    		if (/*$show*/ ctx[12]) return create_if_block;
    		return create_else_block;
    	}

    	let current_block_type_2 = select_block_type_2(ctx);
    	let if_block4 = current_block_type_2(ctx);

    	const block = {
    		c: function create() {
    			p = element("p");
    			t0 = text("Téma:\n  ");
    			select = element("select");
    			option0 = element("option");
    			option0.textContent = "Predvolené";
    			option1 = element("option");
    			option1.textContent = "Jednoduché s tieňom";
    			t3 = text("\n  Import: ");
    			input0 = element("input");
    			t4 = space();
    			div0 = element("div");
    			input1 = element("input");
    			t5 = space();
    			button0 = element("button");
    			button0.textContent = "×";
    			t7 = space();
    			div1 = element("div");

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].c();
    			}

    			t8 = space();
    			div2 = element("div");
    			t9 = text("Playlist:\n  ");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t10 = space();
    			div3 = element("div");
    			button1 = element("button");
    			t11 = text("✎");
    			if (if_block0) if_block0.c();
    			t12 = space();
    			button2 = element("button");
    			button2.textContent = "+";
    			t14 = space();
    			if_block1.c();
    			t15 = space();
    			div4 = element("div");
    			if_block2.c();
    			t16 = space();
    			if (if_block3) if_block3.c();
    			t17 = space();
    			div5 = element("div");
    			button3 = element("button");
    			t18 = text("↑ Pieseň");
    			t19 = space();
    			button4 = element("button");
    			t20 = text("Pieseň ↓");
    			t21 = space();
    			button5 = element("button");
    			if_block4.c();
    			t22 = space();
    			button6 = element("button");
    			t23 = text("↑ Verš");
    			t24 = space();
    			button7 = element("button");
    			t25 = text("Verš ↓");
    			option0.__value = "";
    			option0.value = option0.__value;
    			option0.selected = true;
    			add_location(option0, file, 375, 4, 9887);
    			option1.__value = "simple-with-shadow";
    			option1.value = option1.__value;
    			add_location(option1, file, 376, 4, 9937);
    			if (/*$bodyclass*/ ctx[13] === void 0) add_render_callback(() => /*select_change_handler*/ ctx[39].call(select));
    			add_location(select, file, 374, 2, 9850);
    			attr_dev(input0, "id", "songsUpload");
    			attr_dev(input0, "type", "file");
    			attr_dev(input0, "name", "files");
    			input0.multiple = true;
    			add_location(input0, file, 378, 10, 10023);
    			attr_dev(p, "class", "bodyclass");
    			add_location(p, file, 372, 0, 9818);
    			attr_dev(input1, "class", "form-control");
    			attr_dev(input1, "type", "text");
    			attr_dev(input1, "placeholder", "filter");
    			add_location(input1, file, 382, 2, 10176);
    			attr_dev(button0, "type", "button");
    			attr_dev(button0, "class", "form-control btn btn-secondary");
    			set_style(button0, "max-width", "2rem");
    			set_style(button0, "padding", ".25rem");
    			add_location(button0, file, 387, 2, 10361);
    			attr_dev(div0, "class", "input-group");
    			set_style(div0, "width", "100%");
    			set_style(div0, "display", "flex");
    			add_location(div0, file, 381, 0, 10112);
    			attr_dev(div1, "class", "songs-filter svelte-11j4n0s");
    			toggle_class(div1, "show", /*filterOpen*/ ctx[2]);
    			add_location(div1, file, 393, 0, 10527);
    			attr_dev(div2, "class", "playlist svelte-11j4n0s");
    			add_location(div2, file, 407, 0, 11130);
    			attr_dev(button1, "class", "song-edit btn");
    			toggle_class(button1, "btn-success", /*editing*/ ctx[3]);
    			add_location(button1, file, 421, 2, 11532);
    			attr_dev(button2, "class", "song-create btn svelte-11j4n0s");
    			add_location(button2, file, 424, 2, 11671);
    			attr_dev(div3, "class", "info-bar");
    			add_location(div3, file, 420, 0, 11507);
    			attr_dev(div4, "class", "verses svelte-11j4n0s");
    			add_location(div4, file, 435, 0, 12362);
    			attr_dev(button3, "class", "btn btn-primary svelte-11j4n0s");
    			button3.disabled = button3_disabled_value = /*$curSongIndex*/ ctx[11] <= 0;
    			add_location(button3, file, 457, 2, 13270);
    			attr_dev(button4, "class", "btn btn-primary svelte-11j4n0s");
    			button4.disabled = button4_disabled_value = /*$curSongIndex*/ ctx[11] >= /*playlist*/ ctx[5].length - 1;
    			add_location(button4, file, 460, 2, 13414);
    			attr_dev(button5, "class", "control-button btn svelte-11j4n0s");
    			toggle_class(button5, "btn-danger", /*$show*/ ctx[12]);
    			toggle_class(button5, "btn-success", !/*$show*/ ctx[12]);
    			add_location(button5, file, 464, 2, 13575);
    			attr_dev(button6, "class", "btn btn-primary svelte-11j4n0s");
    			button6.disabled = button6_disabled_value = /*$curVerseIndex*/ ctx[10] <= 0;
    			add_location(button6, file, 468, 2, 13741);
    			attr_dev(button7, "class", "btn btn-primary svelte-11j4n0s");
    			button7.disabled = button7_disabled_value = /*$curVerseIndex*/ ctx[10] >= /*curVerses*/ ctx[7].length - 1;
    			add_location(button7, file, 471, 2, 13910);
    			attr_dev(div5, "class", "bottom-buttons btn-group svelte-11j4n0s");
    			add_location(div5, file, 456, 0, 13229);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor, remount) {
    			insert_dev(target, p, anchor);
    			append_dev(p, t0);
    			append_dev(p, select);
    			append_dev(select, option0);
    			append_dev(select, option1);
    			select_option(select, /*$bodyclass*/ ctx[13]);
    			append_dev(p, t3);
    			append_dev(p, input0);
    			insert_dev(target, t4, anchor);
    			insert_dev(target, div0, anchor);
    			append_dev(div0, input1);
    			set_input_value(input1, /*songFilter*/ ctx[0]);
    			append_dev(div0, t5);
    			append_dev(div0, button0);
    			insert_dev(target, t7, anchor);
    			insert_dev(target, div1, anchor);

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].m(div1, null);
    			}

    			insert_dev(target, t8, anchor);
    			insert_dev(target, div2, anchor);
    			append_dev(div2, t9);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div2, null);
    			}

    			insert_dev(target, t10, anchor);
    			insert_dev(target, div3, anchor);
    			append_dev(div3, button1);
    			append_dev(button1, t11);
    			if (if_block0) if_block0.m(button1, null);
    			append_dev(div3, t12);
    			append_dev(div3, button2);
    			append_dev(div3, t14);
    			if_block1.m(div3, null);
    			insert_dev(target, t15, anchor);
    			insert_dev(target, div4, anchor);
    			if_block2.m(div4, null);
    			append_dev(div4, t16);
    			if (if_block3) if_block3.m(div4, null);
    			insert_dev(target, t17, anchor);
    			insert_dev(target, div5, anchor);
    			append_dev(div5, button3);
    			append_dev(button3, t18);
    			append_dev(div5, t19);
    			append_dev(div5, button4);
    			append_dev(button4, t20);
    			append_dev(div5, t21);
    			append_dev(div5, button5);
    			if_block4.m(button5, null);
    			append_dev(div5, t22);
    			append_dev(div5, button6);
    			append_dev(button6, t23);
    			append_dev(div5, t24);
    			append_dev(div5, button7);
    			append_dev(button7, t25);
    			if (remount) run_all(dispose);

    			dispose = [
    				listen_dev(select, "change", /*select_change_handler*/ ctx[39]),
    				listen_dev(input0, "change", /*importSongs*/ ctx[27], false, false, false),
    				listen_dev(input1, "input", /*input1_input_handler*/ ctx[40]),
    				listen_dev(input1, "input", /*input_handler*/ ctx[41], false, false, false),
    				listen_dev(input1, "click", /*click_handler*/ ctx[42], false, false, false),
    				listen_dev(button0, "click", /*click_handler_1*/ ctx[43], false, false, false),
    				listen_dev(button1, "click", /*click_handler_8*/ ctx[50], false, false, false),
    				listen_dev(button2, "click", /*addNewSong*/ ctx[21], false, false, false),
    				listen_dev(button3, "click", /*click_handler_13*/ ctx[61], false, false, false),
    				listen_dev(button4, "click", /*click_handler_14*/ ctx[62], false, false, false),
    				listen_dev(button5, "click", /*toggleShow*/ ctx[26], false, false, false),
    				listen_dev(button6, "click", /*click_handler_15*/ ctx[63], false, false, false),
    				listen_dev(button7, "click", /*click_handler_16*/ ctx[64], false, false, false)
    			];
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*$bodyclass*/ 8192) {
    				select_option(select, /*$bodyclass*/ ctx[13]);
    			}

    			if (dirty[0] & /*songFilter*/ 1 && input1.value !== /*songFilter*/ ctx[0]) {
    				set_input_value(input1, /*songFilter*/ ctx[0]);
    			}

    			if (dirty[0] & /*removeSong, songsFiltered, toggleEdit, filterOpen, addToPlaylist, curSong*/ 13107270) {
    				each_value_3 = /*songsFiltered*/ ctx[1];
    				validate_each_argument(each_value_3);
    				let i;

    				for (i = 0; i < each_value_3.length; i += 1) {
    					const child_ctx = get_each_context_3(ctx, each_value_3, i);

    					if (each_blocks_1[i]) {
    						each_blocks_1[i].p(child_ctx, dirty);
    					} else {
    						each_blocks_1[i] = create_each_block_3(child_ctx);
    						each_blocks_1[i].c();
    						each_blocks_1[i].m(div1, null);
    					}
    				}

    				for (; i < each_blocks_1.length; i += 1) {
    					each_blocks_1[i].d(1);
    				}

    				each_blocks_1.length = each_value_3.length;
    			}

    			if (dirty[0] & /*filterOpen*/ 4) {
    				toggle_class(div1, "show", /*filterOpen*/ ctx[2]);
    			}

    			if (dirty[0] & /*removePlaylistItem, $curSongIndex, playlist*/ 1050656) {
    				each_value_2 = /*playlist*/ ctx[5];
    				validate_each_argument(each_value_2);
    				let i;

    				for (i = 0; i < each_value_2.length; i += 1) {
    					const child_ctx = get_each_context_2(ctx, each_value_2, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block_2(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div2, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value_2.length;
    			}

    			if (/*editing*/ ctx[3]) {
    				if (!if_block0) {
    					if_block0 = create_if_block_4(ctx);
    					if_block0.c();
    					if_block0.m(button1, null);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (dirty[0] & /*editing*/ 8) {
    				toggle_class(button1, "btn-success", /*editing*/ ctx[3]);
    			}

    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block1) {
    				if_block1.p(ctx, dirty);
    			} else {
    				if_block1.d(1);
    				if_block1 = current_block_type(ctx);

    				if (if_block1) {
    					if_block1.c();
    					if_block1.m(div3, null);
    				}
    			}

    			if (current_block_type_1 === (current_block_type_1 = select_block_type_1(ctx)) && if_block2) {
    				if_block2.p(ctx, dirty);
    			} else {
    				if_block2.d(1);
    				if_block2 = current_block_type_1(ctx);

    				if (if_block2) {
    					if_block2.c();
    					if_block2.m(div4, t16);
    				}
    			}

    			if (/*editing*/ ctx[3]) {
    				if (if_block3) {
    					if_block3.p(ctx, dirty);
    				} else {
    					if_block3 = create_if_block_1(ctx);
    					if_block3.c();
    					if_block3.m(div4, null);
    				}
    			} else if (if_block3) {
    				if_block3.d(1);
    				if_block3 = null;
    			}

    			if (dirty[0] & /*$curSongIndex*/ 2048 && button3_disabled_value !== (button3_disabled_value = /*$curSongIndex*/ ctx[11] <= 0)) {
    				prop_dev(button3, "disabled", button3_disabled_value);
    			}

    			if (dirty[0] & /*$curSongIndex, playlist*/ 2080 && button4_disabled_value !== (button4_disabled_value = /*$curSongIndex*/ ctx[11] >= /*playlist*/ ctx[5].length - 1)) {
    				prop_dev(button4, "disabled", button4_disabled_value);
    			}

    			if (current_block_type_2 !== (current_block_type_2 = select_block_type_2(ctx))) {
    				if_block4.d(1);
    				if_block4 = current_block_type_2(ctx);

    				if (if_block4) {
    					if_block4.c();
    					if_block4.m(button5, null);
    				}
    			}

    			if (dirty[0] & /*$show*/ 4096) {
    				toggle_class(button5, "btn-danger", /*$show*/ ctx[12]);
    			}

    			if (dirty[0] & /*$show*/ 4096) {
    				toggle_class(button5, "btn-success", !/*$show*/ ctx[12]);
    			}

    			if (dirty[0] & /*$curVerseIndex*/ 1024 && button6_disabled_value !== (button6_disabled_value = /*$curVerseIndex*/ ctx[10] <= 0)) {
    				prop_dev(button6, "disabled", button6_disabled_value);
    			}

    			if (dirty[0] & /*$curVerseIndex, curVerses*/ 1152 && button7_disabled_value !== (button7_disabled_value = /*$curVerseIndex*/ ctx[10] >= /*curVerses*/ ctx[7].length - 1)) {
    				prop_dev(button7, "disabled", button7_disabled_value);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    			if (detaching) detach_dev(t4);
    			if (detaching) detach_dev(div0);
    			if (detaching) detach_dev(t7);
    			if (detaching) detach_dev(div1);
    			destroy_each(each_blocks_1, detaching);
    			if (detaching) detach_dev(t8);
    			if (detaching) detach_dev(div2);
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach_dev(t10);
    			if (detaching) detach_dev(div3);
    			if (if_block0) if_block0.d();
    			if_block1.d();
    			if (detaching) detach_dev(t15);
    			if (detaching) detach_dev(div4);
    			if_block2.d();
    			if (if_block3) if_block3.d();
    			if (detaching) detach_dev(t17);
    			if (detaching) detach_dev(div5);
    			if_block4.d();
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

    function scrollToVerse(i) {
    	let e = document.querySelector(".verse-item:nth-child(" + i + ")");
    	e && e.scrollIntoView();
    }

    const func = e => typeof e[1] != "object" && e[1] != null;

    function instance($$self, $$props, $$invalidate) {
    	let $curVerseIndex;
    	let $curSongIndex;
    	let $show;
    	let $line1;
    	let $bodyclass;

    	onMount(function () {
    		document.addEventListener("keydown", function (event) {
    			if (editingSong) {
    				if (event.code == "Enter" && event.getModifierState("Control")) {
    					addNewVerse();
    				}

    				return;
    			}

    			

    			if (event.code == "ArrowDown") {
    				set_store_value(curVerseIndex, $curVerseIndex = Math.min($curVerseIndex + 1, curVerses.length - 1));
    			} else if (event.code == "ArrowUp") {
    				set_store_value(curVerseIndex, $curVerseIndex = Math.max($curVerseIndex - 1, 0));
    			} else if (event.code == "ArrowLeft") {
    				set_store_value(curSongIndex, $curSongIndex = Math.max($curSongIndex - 1, 0));
    				set_store_value(curVerseIndex, $curVerseIndex = 0);
    			} else if (event.code == "ArrowRight") {
    				set_store_value(curSongIndex, $curSongIndex = Math.min($curSongIndex + 1, playlist.length - 1));
    				set_store_value(curVerseIndex, $curVerseIndex = 0);
    			} else if (event.code == "Enter") {
    				set_store_value(show, $show = !$show);
    			}

    			if (event.code == "ArrowDown" || event.code == "ArrowUp" || event.code == "ArrowLeft" || event.code == "ArrowRight") {
    				event.preventDefault();
    				scrollToVerse($curVerseIndex);
    			}
    		});
    	});

    	let songs = {};
    	let songsSorted = [];
    	let songFilter = "";
    	let songsFiltered = songsSorted;
    	let filterOpen = false;
    	let editing = false;
    	let editingSong;
    	let playlist = [];
    	GUN_SUPER_PEERS = GUN_SUPER_PEERS || ["http://127.0.0.1/gun"];
    	let gun = Gun(GUN_SUPER_PEERS);
    	let overlay = gun.get("songs").get(window.location.hash || "demo");

    	/* Synced variables */
    	let show = writableGun(overlay.get("show"), false);

    	validate_store(show, "show");
    	component_subscribe($$self, show, value => $$invalidate(12, $show = value));
    	let line1 = writableGun(overlay.get("line1"), "");
    	validate_store(line1, "line1");
    	component_subscribe($$self, line1, value => $$invalidate(30, $line1 = value));
    	let bodyclass = writableGun(overlay.get("bodyclass"), "");
    	validate_store(bodyclass, "bodyclass");
    	component_subscribe($$self, bodyclass, value => $$invalidate(13, $bodyclass = value));
    	let curSongIndex = writableGun(overlay.get("curSongIndex"), 0);
    	validate_store(curSongIndex, "curSongIndex");
    	component_subscribe($$self, curSongIndex, value => $$invalidate(11, $curSongIndex = value));
    	let curVerseIndex = writableGun(overlay.get("curVerseIndex"), 0);
    	validate_store(curVerseIndex, "curVerseIndex");
    	component_subscribe($$self, curVerseIndex, value => $$invalidate(10, $curVerseIndex = value));
    	let songsGun = overlay.get("songs");

    	function refreshSongsDb() {
    		songsGun.map().once(function (data, key) {
    			// console.log('songs', key, data);
    			// data && songsGun.get(key).put(null); // clear songs
    			if (data === null) delete songs[key]; else $$invalidate(28, songs[key] = data, songs);
    		});
    	}

    	
    	refreshSongsDb();
    	let playlistGun = overlay.get("playlist");

    	playlistGun.once(function (data) {
    		// console.log('once playlist', data);
    		// Cleanup playlist, remove holes
    		if (data) {
    			let pl = Object.entries(data).filter(a => a[1] && a[0] !== "_").sort((a, b) => a[0] - b[0]).map(a => a[1]);

    			// console.log('once pl', pl);
    			for (let i = 0; data[i] !== undefined; i++) {
    				if (data[i] != pl[i]) {
    					// console.log('putting to', i, pl[i]);
    					playlistGun.get(i).put(pl[i] || null);
    				}
    			}
    		}

    		// Subscribe to updates
    		playlistGun.map().on(function (data, key) {
    			// console.log('on playlist', key, data);
    			// data && playlistGun.get(key).put(null); // clear playlist
    			if (data === null) $$invalidate(5, playlist = playlist.filter((song, i) => i != key)); else $$invalidate(5, playlist[key] = data, playlist);
    		});
    	});

    	let curSong = {
    		title: "",
    		author: "",
    		order: "",
    		verses: {}
    	};

    	let curVerses = [];
    	let newId = "s1";
    	let newVerse = "";

    	function setCurVerses(song) {
    		if (song) {
    			songsGun.get(Gun.node.soul(song)).get("verses").once(function (songVerses) {
    				if (!songVerses) {
    					$$invalidate(7, curVerses = []);
    				} else if (song.order.trim()) {
    					let verses = [];

    					song.order.split(" ").forEach(id => {
    						if (songVerses[id]) verses.push(songVerses[id]);
    					});

    					$$invalidate(7, curVerses = verses);
    				} else {
    					$$invalidate(7, curVerses = Object.values(songVerses).filter(v => v !== null && typeof v !== "object"));
    				}
    			});
    		}
    	}

    	function matchesSong(song) {
    		const prefix = songFilter.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    		const titleLower = song.title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    		return titleLower.startsWith(prefix) || prefix.length >= 2 && titleLower.includes(" " + prefix);
    	}

    	function addToPlaylist(song) {
    		console.log("adding to playlist", playlist.length, song);
    		playlistGun.get(playlist.length).put(song);
    	}

    	function removePlaylistItem(i) {
    		if (i < $curSongIndex) set_store_value(curSongIndex, $curSongIndex -= 1);

    		/* Keep playlist clean */
    		while (playlist[++i]) {
    			playlistGun.get(i - 1).put(playlist[i]);
    		}

    		playlistGun.get(i - 1).put(null);
    	}

    	function addNewSong() {
    		$$invalidate(4, editingSong = {
    			title: "",
    			author: "",
    			order: "",
    			verses: {}
    		});

    		$$invalidate(8, newId = "v1");
    		$$invalidate(3, editing = true);
    	}

    	function removeSong(song) {
    		songsGun.get(Gun.node.soul(song)).put(null);
    		refreshSongsDb();
    	}

    	function toggleEdit(song) {
    		if (editing) {
    			$$invalidate(3, editing = false);
    			let soul = Gun.node.soul(editingSong);

    			if (soul) {
    				songsGun.get(soul).put(editingSong);
    			} else {
    				console.log("New song", editingSong);
    				songsGun.set(editingSong);
    				refreshSongsDb();
    			}
    		} else {
    			$$invalidate(4, editingSong = song);

    			songsGun.get(Gun.node.soul(song)).get("verses").once(verses => {
    				$$invalidate(4, editingSong.verses = verses, editingSong);
    				generateNewId();
    				$$invalidate(3, editing = true);
    			});
    		}
    	}

    	function removeVerse(id) {
    		if (!newVerse) $$invalidate(8, newId = id);
    		$$invalidate(4, editingSong.verses[id] = null, editingSong);
    	}

    	function addNewVerse() {
    		if (!editingSong.verses) $$invalidate(4, editingSong.verses = {}, editingSong);
    		if (newId && !editingSong.verses[newId]) $$invalidate(4, editingSong.verses[newId] = newVerse, editingSong);

    		/* Clean new verse */
    		$$invalidate(9, newVerse = "");

    		generateNewId();
    	}

    	function generateNewId() {
    		if (editingSong.verses) {
    			while (editingSong.verses[newId]) {
    				let newId2 = newId.replace(/\d+/, n => parseInt(n) + 1);
    				if (newId === newId2) $$invalidate(8, newId += "1"); else $$invalidate(8, newId = newId2);
    			}
    		}
    	}

    	function toggleShow() {
    		set_store_value(show, $show = !$show);
    	}

    	function importSongs() {
    		let files = document.getElementById("songsUpload").files;

    		for (let i = 0; i < files.length; i++) {
    			const reader = new FileReader();

    			reader.onload = function (e) {
    				let parser = new DOMParser();
    				let dom = parser.parseFromString(e.target.result, "application/xml");

    				if (dom.documentElement.nodeName == "parsererror") {
    					console.log(dom);
    					return;
    				}

    				let title = dom.querySelector("song properties title");
    				let author = dom.querySelector("song properties author");
    				let verseOrder = dom.querySelector("song properties verseOrder");

    				let song = {
    					title: title ? title.innerHTML : "",
    					author: author ? author.innerHTML : "",
    					order: verseOrder ? verseOrder.innerHTML : "",
    					verses: {}
    				};

    				dom.querySelectorAll("song lyrics verse").forEach(function (verse) {
    					song.verses[verse.getAttribute("name")] = verse.querySelector("lines").innerHTML.replace(/<br[^>]*>/g, "\n");
    				});

    				songsGun.set(song);
    			};

    			reader.readAsText(files[i]);
    		}
    	}

    	const writable_props = [];

    	Object_1.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("App", $$slots, []);

    	function select_change_handler() {
    		$bodyclass = select_value(this);
    		bodyclass.set($bodyclass);
    	}

    	function input1_input_handler() {
    		songFilter = this.value;
    		$$invalidate(0, songFilter);
    	}

    	const input_handler = () => {
    		$$invalidate(2, filterOpen = true);
    	};

    	const click_handler = () => {
    		$$invalidate(2, filterOpen = !filterOpen);
    	};

    	const click_handler_1 = () => {
    		$$invalidate(0, songFilter = "");
    	};

    	const click_handler_2 = song => {
    		addToPlaylist(song);
    		$$invalidate(2, filterOpen = false);
    	};

    	const click_handler_3 = song => addToPlaylist(song);

    	const click_handler_4 = song => {
    		toggleEdit(song);
    		$$invalidate(2, filterOpen = false);
    	};

    	const click_handler_5 = song => removeSong(song);

    	const click_handler_6 = i => {
    		set_store_value(curSongIndex, $curSongIndex = i);
    	};

    	const click_handler_7 = i => removePlaylistItem(i);
    	const click_handler_8 = () => toggleEdit(curSong);

    	const click_handler_9 = () => {
    		$$invalidate(3, editing = false);
    	};

    	const click_handler_10 = () => {
    		$$invalidate(3, editing = false);
    		removeSong(editingSong);
    	};

    	function input0_input_handler() {
    		editingSong.title = this.value;
    		$$invalidate(4, editingSong);
    	}

    	function input1_input_handler_1() {
    		editingSong.author = this.value;
    		$$invalidate(4, editingSong);
    	}

    	function input2_input_handler() {
    		editingSong.order = this.value;
    		$$invalidate(4, editingSong);
    	}

    	const click_handler_11 = id => removeVerse(id);

    	function p_input_handler(id) {
    		editingSong.verses[id] = this.innerHTML;
    		$$invalidate(4, editingSong);
    	}

    	const click_handler_12 = i => {
    		set_store_value(curVerseIndex, $curVerseIndex = i);
    	};

    	function input_input_handler() {
    		newId = this.value;
    		$$invalidate(8, newId);
    	}

    	function p_input_handler_1() {
    		newVerse = this.innerHTML;
    		$$invalidate(9, newVerse);
    	}

    	const click_handler_13 = function () {
    		set_store_value(curSongIndex, $curSongIndex -= 1);
    	};

    	const click_handler_14 = function () {
    		set_store_value(curSongIndex, $curSongIndex += 1);
    	};

    	const click_handler_15 = () => {
    		set_store_value(curVerseIndex, $curVerseIndex -= 1);
    		scrollToVerse($curVerseIndex);
    	};

    	const click_handler_16 = () => {
    		set_store_value(curVerseIndex, $curVerseIndex += 1);
    		scrollToVerse($curVerseIndex);
    	};

    	$$self.$capture_state = () => ({
    		onMount,
    		onDestroy,
    		writable,
    		writableGun,
    		songs,
    		songsSorted,
    		songFilter,
    		songsFiltered,
    		filterOpen,
    		editing,
    		editingSong,
    		playlist,
    		gun,
    		overlay,
    		show,
    		line1,
    		bodyclass,
    		curSongIndex,
    		curVerseIndex,
    		songsGun,
    		refreshSongsDb,
    		playlistGun,
    		curSong,
    		curVerses,
    		newId,
    		newVerse,
    		setCurVerses,
    		matchesSong,
    		addToPlaylist,
    		removePlaylistItem,
    		addNewSong,
    		removeSong,
    		toggleEdit,
    		removeVerse,
    		addNewVerse,
    		generateNewId,
    		scrollToVerse,
    		toggleShow,
    		importSongs,
    		$curVerseIndex,
    		$curSongIndex,
    		$show,
    		$line1,
    		$bodyclass
    	});

    	$$self.$inject_state = $$props => {
    		if ("songs" in $$props) $$invalidate(28, songs = $$props.songs);
    		if ("songsSorted" in $$props) $$invalidate(29, songsSorted = $$props.songsSorted);
    		if ("songFilter" in $$props) $$invalidate(0, songFilter = $$props.songFilter);
    		if ("songsFiltered" in $$props) $$invalidate(1, songsFiltered = $$props.songsFiltered);
    		if ("filterOpen" in $$props) $$invalidate(2, filterOpen = $$props.filterOpen);
    		if ("editing" in $$props) $$invalidate(3, editing = $$props.editing);
    		if ("editingSong" in $$props) $$invalidate(4, editingSong = $$props.editingSong);
    		if ("playlist" in $$props) $$invalidate(5, playlist = $$props.playlist);
    		if ("gun" in $$props) gun = $$props.gun;
    		if ("overlay" in $$props) overlay = $$props.overlay;
    		if ("show" in $$props) $$invalidate(14, show = $$props.show);
    		if ("line1" in $$props) $$invalidate(15, line1 = $$props.line1);
    		if ("bodyclass" in $$props) $$invalidate(16, bodyclass = $$props.bodyclass);
    		if ("curSongIndex" in $$props) $$invalidate(17, curSongIndex = $$props.curSongIndex);
    		if ("curVerseIndex" in $$props) $$invalidate(18, curVerseIndex = $$props.curVerseIndex);
    		if ("songsGun" in $$props) songsGun = $$props.songsGun;
    		if ("playlistGun" in $$props) playlistGun = $$props.playlistGun;
    		if ("curSong" in $$props) $$invalidate(6, curSong = $$props.curSong);
    		if ("curVerses" in $$props) $$invalidate(7, curVerses = $$props.curVerses);
    		if ("newId" in $$props) $$invalidate(8, newId = $$props.newId);
    		if ("newVerse" in $$props) $$invalidate(9, newVerse = $$props.newVerse);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty[0] & /*playlist, $curSongIndex*/ 2080) {
    			 $$invalidate(6, curSong = playlist[$curSongIndex] || {
    				title: "",
    				author: "",
    				order: "",
    				verses: {}
    			});
    		}

    		if ($$self.$$.dirty[0] & /*curSong*/ 64) {
    			 setCurVerses(curSong);
    		}

    		if ($$self.$$.dirty[0] & /*curVerses, $curVerseIndex*/ 1152) {
    			 set_store_value(line1, $line1 = curVerses[$curVerseIndex] || "");
    		}

    		if ($$self.$$.dirty[0] & /*songs*/ 268435456) {
    			 $$invalidate(29, songsSorted = Object.values(songs).sort((a, b) => a.title.toLowerCase() > b.title.toLowerCase()));
    		}

    		if ($$self.$$.dirty[0] & /*songFilter, songsSorted*/ 536870913) {
    			 $$invalidate(1, songsFiltered = songFilter
    			? songsSorted.filter(matchesSong)
    			: songsSorted);
    		}
    	};

    	return [
    		songFilter,
    		songsFiltered,
    		filterOpen,
    		editing,
    		editingSong,
    		playlist,
    		curSong,
    		curVerses,
    		newId,
    		newVerse,
    		$curVerseIndex,
    		$curSongIndex,
    		$show,
    		$bodyclass,
    		show,
    		line1,
    		bodyclass,
    		curSongIndex,
    		curVerseIndex,
    		addToPlaylist,
    		removePlaylistItem,
    		addNewSong,
    		removeSong,
    		toggleEdit,
    		removeVerse,
    		addNewVerse,
    		toggleShow,
    		importSongs,
    		songs,
    		songsSorted,
    		$line1,
    		gun,
    		overlay,
    		songsGun,
    		refreshSongsDb,
    		playlistGun,
    		setCurVerses,
    		matchesSong,
    		generateNewId,
    		select_change_handler,
    		input1_input_handler,
    		input_handler,
    		click_handler,
    		click_handler_1,
    		click_handler_2,
    		click_handler_3,
    		click_handler_4,
    		click_handler_5,
    		click_handler_6,
    		click_handler_7,
    		click_handler_8,
    		click_handler_9,
    		click_handler_10,
    		input0_input_handler,
    		input1_input_handler_1,
    		input2_input_handler,
    		click_handler_11,
    		p_input_handler,
    		click_handler_12,
    		input_input_handler,
    		p_input_handler_1,
    		click_handler_13,
    		click_handler_14,
    		click_handler_15,
    		click_handler_16
    	];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {}, [-1, -1, -1]);

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
