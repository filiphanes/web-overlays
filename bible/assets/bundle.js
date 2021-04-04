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
            dirty,
            skip_bound: false
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, ...rest) => {
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
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.29.0' }, detail)));
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
        if (text.wholeText === data)
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

    /* src/Keypad.svelte generated by Svelte v3.29.0 */
    const file = "src/Keypad.svelte";

    function create_fragment(ctx) {
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
    	let t23;
    	let button12;
    	let t24;
    	let button12_disabled_value;
    	let t25;
    	let button13;
    	let t26;
    	let button13_disabled_value;
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
    			t23 = space();
    			button12 = element("button");
    			t24 = text("-1");
    			t25 = space();
    			button13 = element("button");
    			t26 = text("+1");
    			attr_dev(button0, "class", "btn btn-primary svelte-1bz6mfx");
    			add_location(button0, file, 32, 2, 778);
    			attr_dev(button1, "class", "btn btn-primary svelte-1bz6mfx");
    			add_location(button1, file, 33, 2, 844);
    			attr_dev(button2, "class", "btn btn-primary svelte-1bz6mfx");
    			add_location(button2, file, 34, 2, 910);
    			attr_dev(button3, "class", "btn btn-primary svelte-1bz6mfx");
    			add_location(button3, file, 36, 2, 977);
    			attr_dev(button4, "class", "btn btn-primary svelte-1bz6mfx");
    			add_location(button4, file, 37, 2, 1043);
    			attr_dev(button5, "class", "btn btn-primary svelte-1bz6mfx");
    			add_location(button5, file, 38, 2, 1109);
    			attr_dev(button6, "class", "btn btn-primary svelte-1bz6mfx");
    			add_location(button6, file, 40, 2, 1176);
    			attr_dev(button7, "class", "btn btn-primary svelte-1bz6mfx");
    			add_location(button7, file, 41, 2, 1242);
    			attr_dev(button8, "class", "btn btn-primary svelte-1bz6mfx");
    			add_location(button8, file, 42, 2, 1308);
    			attr_dev(button9, "class", "btn btn-primary svelte-1bz6mfx");
    			button9.disabled = button9_disabled_value = !/*value*/ ctx[0];
    			add_location(button9, file, 44, 2, 1375);
    			attr_dev(button10, "class", "btn btn-primary svelte-1bz6mfx");
    			add_location(button10, file, 45, 2, 1459);
    			attr_dev(button11, "class", "btn btn-primary svelte-1bz6mfx");
    			button11.disabled = button11_disabled_value = !/*value*/ ctx[0];
    			add_location(button11, file, 46, 2, 1525);
    			attr_dev(button12, "class", "btn btn-primary svelte-1bz6mfx");
    			button12.disabled = button12_disabled_value = /*value*/ ctx[0] <= 1;
    			add_location(button12, file, 48, 2, 1607);
    			attr_dev(button13, "class", "btn btn-primary svelte-1bz6mfx");
    			button13.disabled = button13_disabled_value = /*value*/ ctx[0] == /*max*/ ctx[1];
    			add_location(button13, file, 49, 2, 1696);
    			attr_dev(div, "class", "keypad svelte-1bz6mfx");
    			add_location(div, file, 31, 0, 755);
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
    			append_dev(div, t23);
    			append_dev(div, button12);
    			append_dev(button12, t24);
    			append_dev(div, t25);
    			append_dev(div, button13);
    			append_dev(button13, t26);

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", /*select*/ ctx[2](1), false, false, false),
    					listen_dev(button1, "click", /*select*/ ctx[2](2), false, false, false),
    					listen_dev(button2, "click", /*select*/ ctx[2](3), false, false, false),
    					listen_dev(button3, "click", /*select*/ ctx[2](4), false, false, false),
    					listen_dev(button4, "click", /*select*/ ctx[2](5), false, false, false),
    					listen_dev(button5, "click", /*select*/ ctx[2](6), false, false, false),
    					listen_dev(button6, "click", /*select*/ ctx[2](7), false, false, false),
    					listen_dev(button7, "click", /*select*/ ctx[2](8), false, false, false),
    					listen_dev(button8, "click", /*select*/ ctx[2](9), false, false, false),
    					listen_dev(button9, "click", /*backspace*/ ctx[6], false, false, false),
    					listen_dev(button10, "click", /*select*/ ctx[2](0), false, false, false),
    					listen_dev(button11, "click", /*clear*/ ctx[5], false, false, false),
    					listen_dev(button12, "click", /*decrement*/ ctx[3], false, false, false),
    					listen_dev(button13, "click", /*increment*/ ctx[4], false, false, false)
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

    			if (dirty & /*value*/ 1 && button12_disabled_value !== (button12_disabled_value = /*value*/ ctx[0] <= 1)) {
    				prop_dev(button12, "disabled", button12_disabled_value);
    			}

    			if (dirty & /*value, max*/ 3 && button13_disabled_value !== (button13_disabled_value = /*value*/ ctx[0] == /*max*/ ctx[1])) {
    				prop_dev(button13, "disabled", button13_disabled_value);
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
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Keypad", slots, []);
    	let { value = "" } = $$props;
    	let { max = 99999999 } = $$props;
    	const dispatch = createEventDispatcher();

    	const select = num => () => {
    		$$invalidate(0, value = Math.min(+value * 10 + num, max || 99999999));
    	};

    	const decrement = () => {
    		$$invalidate(0, value = Math.max(1, +value - 1));
    	};

    	const increment = () => {
    		$$invalidate(0, value = Math.min(+value + 1, max || 99999999));
    	};

    	const clear = () => {
    		$$invalidate(0, value = "");
    	};

    	const backspace = () => {
    		$$invalidate(0, value = Math.floor(+value / 10) || "");
    	};

    	const writable_props = ["value", "max"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Keypad> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("value" in $$props) $$invalidate(0, value = $$props.value);
    		if ("max" in $$props) $$invalidate(1, max = $$props.max);
    	};

    	$$self.$capture_state = () => ({
    		createEventDispatcher,
    		value,
    		max,
    		dispatch,
    		select,
    		decrement,
    		increment,
    		clear,
    		backspace
    	});

    	$$self.$inject_state = $$props => {
    		if ("value" in $$props) $$invalidate(0, value = $$props.value);
    		if ("max" in $$props) $$invalidate(1, max = $$props.max);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [value, max, select, decrement, increment, clear, backspace];
    }

    class Keypad extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, { value: 0, max: 1 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Keypad",
    			options,
    			id: create_fragment.name
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
        if (value === undefined) value = null;
        console.debug('create store:');
    	let store = writable(value);
        store.subscribe(data => {
            console.debug('subscription', data);
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
            console.log('set(newval)', newval);
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

    /* src/App.svelte generated by Svelte v3.29.0 */

    const { Object: Object_1, console: console_1 } = globals;
    const file$1 = "src/App.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[41] = list[i];
    	child_ctx[43] = i;
    	return child_ctx;
    }

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[44] = list[i];
    	return child_ctx;
    }

    // (194:2) {#each filteredBooks as book}
    function create_each_block_1(ctx) {
    	let button;
    	let t_value = /*book*/ ctx[44].name + "";
    	let t;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			button = element("button");
    			t = text(t_value);
    			attr_dev(button, "class", "book-item btn svelte-1gs9le7");
    			toggle_class(button, "btn-primary", /*book*/ ctx[44].abbreviation == /*$address*/ ctx[5].book);
    			add_location(button, file$1, 194, 2, 5189);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);
    			append_dev(button, t);

    			if (!mounted) {
    				dispose = listen_dev(
    					button,
    					"click",
    					function () {
    						if (is_function(/*addressSelector*/ ctx[19]({ book: /*book*/ ctx[44].abbreviation }))) /*addressSelector*/ ctx[19]({ book: /*book*/ ctx[44].abbreviation }).apply(this, arguments);
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
    			if (dirty[0] & /*filteredBooks*/ 256 && t_value !== (t_value = /*book*/ ctx[44].name + "")) set_data_dev(t, t_value);

    			if (dirty[0] & /*filteredBooks, $address*/ 288) {
    				toggle_class(button, "btn-primary", /*book*/ ctx[44].abbreviation == /*$address*/ ctx[5].book);
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
    		source: "(194:2) {#each filteredBooks as book}",
    		ctx
    	});

    	return block;
    }

    // (199:2) {#each lastAddresses as addr, i}
    function create_each_block(ctx) {
    	let div;
    	let button0;
    	let t0_value = (/*addressAsString*/ ctx[18](/*addr*/ ctx[41]) || /*addr*/ ctx[41].book + " " + /*addr*/ ctx[41].chapter + "," + /*addr*/ ctx[41].verse) + "";
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
    			attr_dev(button0, "class", "address-set btn svelte-1gs9le7");
    			toggle_class(button0, "btn-primary", equalAddresses(/*addr*/ ctx[41], /*$address*/ ctx[5]));
    			add_location(button0, file$1, 200, 4, 5471);
    			attr_dev(button1, "class", "btn btn-secondary address-remove svelte-1gs9le7");
    			add_location(button1, file$1, 201, 4, 5671);
    			attr_dev(div, "class", "address-item btn-group svelte-1gs9le7");
    			add_location(div, file$1, 199, 2, 5430);
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
    							if (is_function(/*addressSelector*/ ctx[19](/*addr*/ ctx[41]))) /*addressSelector*/ ctx[19](/*addr*/ ctx[41]).apply(this, arguments);
    						},
    						false,
    						false,
    						false
    					),
    					listen_dev(button1, "click", /*removeLastAddress*/ ctx[20](/*i*/ ctx[43]), false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty[0] & /*lastAddresses*/ 8 && t0_value !== (t0_value = (/*addressAsString*/ ctx[18](/*addr*/ ctx[41]) || /*addr*/ ctx[41].book + " " + /*addr*/ ctx[41].chapter + "," + /*addr*/ ctx[41].verse) + "")) set_data_dev(t0, t0_value);

    			if (dirty[0] & /*lastAddresses, $address*/ 40) {
    				toggle_class(button0, "btn-primary", equalAddresses(/*addr*/ ctx[41], /*$address*/ ctx[5]));
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
    		source: "(199:2) {#each lastAddresses as addr, i}",
    		ctx
    	});

    	return block;
    }

    // (213:21) {:else}
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
    		source: "(213:21) {:else}",
    		ctx
    	});

    	return block;
    }

    // (213:4) {#if $shown}
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
    		source: "(213:4) {#if $shown}",
    		ctx
    	});

    	return block;
    }

    // (217:25) {#if $address.count>1}
    function create_if_block_1(ctx) {
    	let t0;
    	let t1_value = /*$address*/ ctx[5].verse + /*$address*/ ctx[5].count - 1 + "";
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
    			if (dirty[0] & /*$address*/ 32 && t1_value !== (t1_value = /*$address*/ ctx[5].verse + /*$address*/ ctx[5].count - 1 + "")) set_data_dev(t1, t1_value);
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
    		source: "(217:25) {#if $address.count>1}",
    		ctx
    	});

    	return block;
    }

    // (255:2) {#if loadingBible}
    function create_if_block(ctx) {
    	let t0;
    	let t1;
    	let t2;

    	const block = {
    		c: function create() {
    			t0 = text("Načítava sa biblia ");
    			t1 = text(/*$bibleid*/ ctx[4]);
    			t2 = text(".");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t0, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, t2, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*$bibleid*/ 16) set_data_dev(t1, /*$bibleid*/ ctx[4]);
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
    		source: "(255:2) {#if loadingBible}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
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
    	let t6_value = /*$address*/ ctx[5].chapter + "";
    	let t6;
    	let t7;
    	let keypad0;
    	let updating_value;
    	let t8;
    	let button1;
    	let t9;
    	let div4;
    	let t10;
    	let t11_value = /*$address*/ ctx[5].verse + "";
    	let t11;
    	let t12;
    	let t13;
    	let keypad1;
    	let updating_value_1;
    	let t14;
    	let button2;
    	let t15;
    	let button2_disabled_value;
    	let t16;
    	let button3;
    	let t17;
    	let button3_disabled_value;
    	let t18;
    	let br0;
    	let t19;
    	let button4;
    	let t20;
    	let button4_disabled_value;
    	let t21;
    	let button5;
    	let t22;
    	let button5_disabled_value;
    	let t23;
    	let div5;
    	let t24;
    	let t25;
    	let span;
    	let t26;
    	let br1;
    	let t27;
    	let div6;
    	let t28;
    	let select0;
    	let option0;
    	let option1;
    	let option2;
    	let t32;
    	let div7;
    	let t33;
    	let select1;
    	let option3;
    	let option4;
    	let t36;
    	let current;
    	let mounted;
    	let dispose;
    	let each_value_1 = /*filteredBooks*/ ctx[8];
    	validate_each_argument(each_value_1);
    	let each_blocks_1 = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks_1[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
    	}

    	let each_value = /*lastAddresses*/ ctx[3];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	function keypad0_value_binding(value) {
    		/*keypad0_value_binding*/ ctx[24].call(null, value);
    	}

    	let keypad0_props = {
    		max: Object.keys(/*shownBook*/ ctx[2].chapters).length
    	};

    	if (/*$address*/ ctx[5].chapter !== void 0) {
    		keypad0_props.value = /*$address*/ ctx[5].chapter;
    	}

    	keypad0 = new Keypad({ props: keypad0_props, $$inline: true });
    	binding_callbacks.push(() => bind(keypad0, "value", keypad0_value_binding));

    	function select_block_type(ctx, dirty) {
    		if (/*$shown*/ ctx[10]) return create_if_block_2;
    		return create_else_block;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block0 = current_block_type(ctx);
    	let if_block1 = /*$address*/ ctx[5].count > 1 && create_if_block_1(ctx);

    	function keypad1_value_binding(value) {
    		/*keypad1_value_binding*/ ctx[25].call(null, value);
    	}

    	let keypad1_props = { max: /*bookLength*/ ctx[9] };

    	if (/*$address*/ ctx[5].verse !== void 0) {
    		keypad1_props.value = /*$address*/ ctx[5].verse;
    	}

    	keypad1 = new Keypad({ props: keypad1_props, $$inline: true });
    	binding_callbacks.push(() => bind(keypad1, "value", keypad1_value_binding));
    	let if_block2 = /*loadingBible*/ ctx[0] && create_if_block(ctx);

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
    			t7 = space();
    			create_component(keypad0.$$.fragment);
    			t8 = space();
    			button1 = element("button");
    			if_block0.c();
    			t9 = space();
    			div4 = element("div");
    			t10 = text("Verš: ");
    			t11 = text(t11_value);
    			t12 = space();
    			if (if_block1) if_block1.c();
    			t13 = space();
    			create_component(keypad1.$$.fragment);
    			t14 = space();
    			button2 = element("button");
    			t15 = text("-1");
    			t16 = space();
    			button3 = element("button");
    			t17 = text("+1");
    			t18 = space();
    			br0 = element("br");
    			t19 = space();
    			button4 = element("button");
    			t20 = text("⇐");
    			t21 = space();
    			button5 = element("button");
    			t22 = text("⇒");
    			t23 = space();
    			div5 = element("div");
    			t24 = text(/*$line1*/ ctx[6]);
    			t25 = space();
    			span = element("span");
    			t26 = space();
    			br1 = element("br");
    			t27 = space();
    			div6 = element("div");
    			t28 = text("Téma:\n  ");
    			select0 = element("select");
    			option0 = element("option");
    			option0.textContent = "Predvolené";
    			option1 = element("option");
    			option1.textContent = "Jednoduché s tieňom";
    			option2 = element("option");
    			option2.textContent = "Fullscreen biele pozadie";
    			t32 = space();
    			div7 = element("div");
    			t33 = text("Biblia:\n  ");
    			select1 = element("select");
    			option3 = element("option");
    			option3.textContent = "Roháčkov";
    			option4 = element("option");
    			option4.textContent = "Ekumenický";
    			t36 = space();
    			if (if_block2) if_block2.c();
    			attr_dev(input, "class", "form-control");
    			attr_dev(input, "type", "text");
    			attr_dev(input, "placeholder", "filter");
    			add_location(input, file$1, 189, 2, 4903);
    			attr_dev(button0, "type", "button");
    			attr_dev(button0, "class", "form-control btn btn-secondary svelte-1gs9le7");
    			set_style(button0, "max-width", "2rem");
    			add_location(button0, file$1, 190, 2, 4993);
    			attr_dev(div0, "class", "input-group");
    			set_style(div0, "width", "100%");
    			set_style(div0, "display", "flex");
    			add_location(div0, file$1, 188, 0, 4839);
    			attr_dev(div1, "class", "books-filter svelte-1gs9le7");
    			add_location(div1, file$1, 192, 0, 5128);
    			attr_dev(div2, "class", "address-filter svelte-1gs9le7");
    			add_location(div2, file$1, 197, 0, 5364);
    			attr_dev(button1, "class", "control-button btn svelte-1gs9le7");
    			set_style(button1, "line-height", "2rem");
    			toggle_class(button1, "btn-danger", /*$shown*/ ctx[10]);
    			toggle_class(button1, "btn-success", !/*$shown*/ ctx[10]);
    			add_location(button1, file$1, 209, 2, 5990);
    			set_style(div3, "display", "inline-block");
    			set_style(div3, "margin", "0 .5rem 0 0");
    			set_style(div3, "vertical-align", "top");
    			add_location(div3, file$1, 206, 0, 5790);
    			attr_dev(button2, "class", "btn btn-primary svelte-1gs9le7");
    			set_style(button2, "line-height", "2rem");
    			button2.disabled = button2_disabled_value = /*$address*/ ctx[5].count <= 1;
    			add_location(button2, file$1, 218, 2, 6400);
    			attr_dev(button3, "class", "btn btn-primary svelte-1gs9le7");
    			set_style(button3, "line-height", "2rem");
    			button3.disabled = button3_disabled_value = /*$address*/ ctx[5].verse + /*$address*/ ctx[5].count > /*bookLength*/ ctx[9];
    			add_location(button3, file$1, 221, 2, 6567);
    			add_location(br0, file$1, 224, 2, 6757);
    			attr_dev(button4, "class", "btn btn-primary svelte-1gs9le7");
    			set_style(button4, "line-height", "2rem");
    			button4.disabled = button4_disabled_value = /*$address*/ ctx[5].verse <= 1;
    			add_location(button4, file$1, 225, 2, 6765);
    			attr_dev(button5, "class", "btn btn-primary svelte-1gs9le7");
    			set_style(button5, "line-height", "2rem");
    			button5.disabled = button5_disabled_value = /*$address*/ ctx[5].verse + /*$address*/ ctx[5].count > /*bookLength*/ ctx[9];
    			add_location(button5, file$1, 229, 2, 6978);
    			set_style(div4, "display", "inline-block");
    			add_location(div4, file$1, 215, 0, 6210);
    			attr_dev(div5, "class", "address svelte-1gs9le7");
    			add_location(div5, file$1, 235, 0, 7231);
    			attr_dev(span, "class", "vers svelte-1gs9le7");
    			set_style(span, "margin-bottom", "1rem");
    			add_location(span, file$1, 236, 0, 7267);
    			add_location(br1, file$1, 238, 0, 7338);
    			option0.__value = "";
    			option0.value = option0.__value;
    			option0.selected = true;
    			add_location(option0, file$1, 242, 4, 7415);
    			option1.__value = "simple-with-shadow";
    			option1.value = option1.__value;
    			option1.selected = true;
    			add_location(option1, file$1, 243, 4, 7465);
    			option2.__value = "fullscreen-white-bg";
    			option2.value = option2.__value;
    			add_location(option2, file$1, 244, 4, 7542);
    			if (/*$bodyclass*/ ctx[11] === void 0) add_render_callback(() => /*select0_change_handler*/ ctx[30].call(select0));
    			add_location(select0, file$1, 241, 2, 7378);
    			attr_dev(div6, "class", "bodyclass");
    			add_location(div6, file$1, 239, 0, 7344);
    			option3.__value = "roh";
    			option3.value = option3.__value;
    			add_location(option3, file$1, 251, 4, 7699);
    			option4.__value = "seb";
    			option4.value = option4.__value;
    			add_location(option4, file$1, 252, 4, 7741);
    			if (/*$bibleid*/ ctx[4] === void 0) add_render_callback(() => /*select1_change_handler*/ ctx[31].call(select1));
    			add_location(select1, file$1, 250, 2, 7664);
    			attr_dev(div7, "class", "bible");
    			add_location(div7, file$1, 248, 0, 7632);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div0, anchor);
    			append_dev(div0, input);
    			set_input_value(input, /*bookFilter*/ ctx[1]);
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
    			mount_component(keypad0, div3, null);
    			append_dev(div3, t8);
    			append_dev(div3, button1);
    			if_block0.m(button1, null);
    			insert_dev(target, t9, anchor);
    			insert_dev(target, div4, anchor);
    			append_dev(div4, t10);
    			append_dev(div4, t11);
    			append_dev(div4, t12);
    			if (if_block1) if_block1.m(div4, null);
    			append_dev(div4, t13);
    			mount_component(keypad1, div4, null);
    			append_dev(div4, t14);
    			append_dev(div4, button2);
    			append_dev(button2, t15);
    			append_dev(div4, t16);
    			append_dev(div4, button3);
    			append_dev(button3, t17);
    			append_dev(div4, t18);
    			append_dev(div4, br0);
    			append_dev(div4, t19);
    			append_dev(div4, button4);
    			append_dev(button4, t20);
    			append_dev(div4, t21);
    			append_dev(div4, button5);
    			append_dev(button5, t22);
    			insert_dev(target, t23, anchor);
    			insert_dev(target, div5, anchor);
    			append_dev(div5, t24);
    			insert_dev(target, t25, anchor);
    			insert_dev(target, span, anchor);
    			span.innerHTML = /*$line2*/ ctx[7];
    			insert_dev(target, t26, anchor);
    			insert_dev(target, br1, anchor);
    			insert_dev(target, t27, anchor);
    			insert_dev(target, div6, anchor);
    			append_dev(div6, t28);
    			append_dev(div6, select0);
    			append_dev(select0, option0);
    			append_dev(select0, option1);
    			append_dev(select0, option2);
    			select_option(select0, /*$bodyclass*/ ctx[11]);
    			insert_dev(target, t32, anchor);
    			insert_dev(target, div7, anchor);
    			append_dev(div7, t33);
    			append_dev(div7, select1);
    			append_dev(select1, option3);
    			append_dev(select1, option4);
    			select_option(select1, /*$bibleid*/ ctx[4]);
    			append_dev(div7, t36);
    			if (if_block2) if_block2.m(div7, null);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(input, "input", /*input_input_handler*/ ctx[22]),
    					listen_dev(button0, "click", /*click_handler*/ ctx[23], false, false, false),
    					listen_dev(button1, "click", /*toggleLine*/ ctx[21], false, false, false),
    					listen_dev(button2, "click", /*click_handler_1*/ ctx[26], false, false, false),
    					listen_dev(button3, "click", /*click_handler_2*/ ctx[27], false, false, false),
    					listen_dev(button4, "click", /*click_handler_3*/ ctx[28], false, false, false),
    					listen_dev(button5, "click", /*click_handler_4*/ ctx[29], false, false, false),
    					listen_dev(select0, "change", /*select0_change_handler*/ ctx[30]),
    					listen_dev(select1, "change", /*select1_change_handler*/ ctx[31])
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*bookFilter*/ 2 && input.value !== /*bookFilter*/ ctx[1]) {
    				set_input_value(input, /*bookFilter*/ ctx[1]);
    			}

    			if (dirty[0] & /*filteredBooks, $address, addressSelector*/ 524576) {
    				each_value_1 = /*filteredBooks*/ ctx[8];
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

    			if (dirty[0] & /*removeLastAddress, lastAddresses, $address, addressSelector, addressAsString*/ 1835048) {
    				each_value = /*lastAddresses*/ ctx[3];
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

    			if ((!current || dirty[0] & /*$address*/ 32) && t6_value !== (t6_value = /*$address*/ ctx[5].chapter + "")) set_data_dev(t6, t6_value);
    			const keypad0_changes = {};
    			if (dirty[0] & /*shownBook*/ 4) keypad0_changes.max = Object.keys(/*shownBook*/ ctx[2].chapters).length;

    			if (!updating_value && dirty[0] & /*$address*/ 32) {
    				updating_value = true;
    				keypad0_changes.value = /*$address*/ ctx[5].chapter;
    				add_flush_callback(() => updating_value = false);
    			}

    			keypad0.$set(keypad0_changes);

    			if (current_block_type !== (current_block_type = select_block_type(ctx))) {
    				if_block0.d(1);
    				if_block0 = current_block_type(ctx);

    				if (if_block0) {
    					if_block0.c();
    					if_block0.m(button1, null);
    				}
    			}

    			if (dirty[0] & /*$shown*/ 1024) {
    				toggle_class(button1, "btn-danger", /*$shown*/ ctx[10]);
    			}

    			if (dirty[0] & /*$shown*/ 1024) {
    				toggle_class(button1, "btn-success", !/*$shown*/ ctx[10]);
    			}

    			if ((!current || dirty[0] & /*$address*/ 32) && t11_value !== (t11_value = /*$address*/ ctx[5].verse + "")) set_data_dev(t11, t11_value);

    			if (/*$address*/ ctx[5].count > 1) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block_1(ctx);
    					if_block1.c();
    					if_block1.m(div4, t13);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			const keypad1_changes = {};
    			if (dirty[0] & /*bookLength*/ 512) keypad1_changes.max = /*bookLength*/ ctx[9];

    			if (!updating_value_1 && dirty[0] & /*$address*/ 32) {
    				updating_value_1 = true;
    				keypad1_changes.value = /*$address*/ ctx[5].verse;
    				add_flush_callback(() => updating_value_1 = false);
    			}

    			keypad1.$set(keypad1_changes);

    			if (!current || dirty[0] & /*$address*/ 32 && button2_disabled_value !== (button2_disabled_value = /*$address*/ ctx[5].count <= 1)) {
    				prop_dev(button2, "disabled", button2_disabled_value);
    			}

    			if (!current || dirty[0] & /*$address, bookLength*/ 544 && button3_disabled_value !== (button3_disabled_value = /*$address*/ ctx[5].verse + /*$address*/ ctx[5].count > /*bookLength*/ ctx[9])) {
    				prop_dev(button3, "disabled", button3_disabled_value);
    			}

    			if (!current || dirty[0] & /*$address*/ 32 && button4_disabled_value !== (button4_disabled_value = /*$address*/ ctx[5].verse <= 1)) {
    				prop_dev(button4, "disabled", button4_disabled_value);
    			}

    			if (!current || dirty[0] & /*$address, bookLength*/ 544 && button5_disabled_value !== (button5_disabled_value = /*$address*/ ctx[5].verse + /*$address*/ ctx[5].count > /*bookLength*/ ctx[9])) {
    				prop_dev(button5, "disabled", button5_disabled_value);
    			}

    			if (!current || dirty[0] & /*$line1*/ 64) set_data_dev(t24, /*$line1*/ ctx[6]);
    			if (!current || dirty[0] & /*$line2*/ 128) span.innerHTML = /*$line2*/ ctx[7];
    			if (dirty[0] & /*$bodyclass*/ 2048) {
    				select_option(select0, /*$bodyclass*/ ctx[11]);
    			}

    			if (dirty[0] & /*$bibleid*/ 16) {
    				select_option(select1, /*$bibleid*/ ctx[4]);
    			}

    			if (/*loadingBible*/ ctx[0]) {
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
    			if (detaching) detach_dev(t9);
    			if (detaching) detach_dev(div4);
    			if (if_block1) if_block1.d();
    			destroy_component(keypad1);
    			if (detaching) detach_dev(t23);
    			if (detaching) detach_dev(div5);
    			if (detaching) detach_dev(t25);
    			if (detaching) detach_dev(span);
    			if (detaching) detach_dev(t26);
    			if (detaching) detach_dev(br1);
    			if (detaching) detach_dev(t27);
    			if (detaching) detach_dev(div6);
    			if (detaching) detach_dev(t32);
    			if (detaching) detach_dev(div7);
    			if (if_block2) if_block2.d();
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

    function equalAddresses(a, b) {
    	return a.book == b.book && a.chapter == b.chapter && a.verse == b.verse && a.count == b.count;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let $bibleid;
    	let $address;
    	let $line1;
    	let $line2;
    	let $shown;
    	let $bodyclass;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("App", slots, []);
    	let loadingBible;

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
    	let lastAddresses = [defaultAddress];
    	GUN_SUPER_PEERS = GUN_SUPER_PEERS || ["http://127.0.0.1/gun"];
    	let gun = Gun(GUN_SUPER_PEERS);
    	let overlay = gun.get("bible").get(window.location.hash || "demo");

    	/* Synced variables */
    	let shown = writableGun(overlay.get("show"), false);

    	validate_store(shown, "shown");
    	component_subscribe($$self, shown, value => $$invalidate(10, $shown = value));
    	let line1 = writableGun(overlay.get("line1"), "");
    	validate_store(line1, "line1");
    	component_subscribe($$self, line1, value => $$invalidate(6, $line1 = value));
    	let line2 = writableGun(overlay.get("line2"), "");
    	validate_store(line2, "line2");
    	component_subscribe($$self, line2, value => $$invalidate(7, $line2 = value));
    	let address = writableGun(overlay.get("address"), defaultAddress);
    	validate_store(address, "address");
    	component_subscribe($$self, address, value => $$invalidate(5, $address = value));
    	let bodyclass = writableGun(overlay.get("bodyclass"), "");
    	validate_store(bodyclass, "bodyclass");
    	component_subscribe($$self, bodyclass, value => $$invalidate(11, $bodyclass = value));
    	let bibleid = writableGun(overlay.get("bibleid"), "roh");
    	validate_store(bibleid, "bibleid");
    	component_subscribe($$self, bibleid, value => $$invalidate(4, $bibleid = value));

    	/* Disabled last address filtering
    $: filteredLastAddresses = bookFilter
      ? lastAddresses.filter(h => matchesBook(booksByAbbr[h.book]))
      : lastAddresses;
    */
    	function loadBible(path) {
    		$$invalidate(0, loadingBible = true);
    		console.log("Loading Bible", path);
    		let request = new XMLHttpRequest();
    		request.open("GET", path);
    		request.responseType = "json";
    		request.send();

    		request.onload = function () {
    			$$invalidate(32, books = request.response.books);

    			books && books.forEach(book => {
    				$$invalidate(33, booksByAbbr[book.abbreviation] = book, booksByAbbr);
    			});

    			/* Redraw */
    			$$invalidate(3, lastAddresses);

    			// $address = $address;
    			$$invalidate(0, loadingBible = false);
    		};
    	}

    	function matchesBook(book) {
    		const prefix = bookFilter.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    		const bookLower = book.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    		return bookLower.startsWith(prefix) || book.abbreviation.startsWith(prefix) || book.aliases && book.aliases.some(a => a.toLowerCase().startsWith(prefix)) || prefix.length >= 2 && bookLower.includes(" " + prefix);
    	}

    	function addToLastAddresses(address) {
    		lastAddresses.unshift({
    			book: address.book,
    			chapter: address.chapter,
    			verse: address.verse,
    			count: address.count
    		});

    		$$invalidate(3, lastAddresses = lastAddresses.filter((h, i) => i === 0 || !equalAddresses(h, address)));
    	}

    	function addressAsString(address) {
    		if (!booksByAbbr[address.book]) return "";
    		var s = booksByAbbr[address.book].name + " " + address.chapter;

    		if (address.verse) {
    			s += "," + address.verse;

    			if (address.count > 1) {
    				s += "-" + (address.verse + address.count - 1);
    			}
    		}

    		return s;
    	}

    	function addressContent(a) {
    		var book = booksByAbbr[a.book];
    		var content = "";

    		if (book && $address.verse && book.chapters[$address.chapter]) {
    			for (var i = $address.verse; i < $address.verse + $address.count; i++) {
    				content += "\n" + (book.chapters[$address.chapter][i - 1] || "");
    			}
    		}

    		return content;
    	}

    	

    	function addressSelector(a) {
    		a.chapter = a.chapter || "";
    		a.verse = a.verse || "";
    		a.count = a.count || 1;

    		return function () {
    			console.debug("addressSelector:");
    			set_store_value(address, $address = a, $address);
    		};
    	}

    	function removeLastAddress(j) {
    		return function () {
    			$$invalidate(3, lastAddresses = lastAddresses.filter((h, i) => i !== j));
    		};
    	}

    	function toggleLine() {
    		set_store_value(shown, $shown = !$shown, $shown);

    		if ($shown) {
    			addToLastAddresses($address);
    		}
    	}

    	const writable_props = [];

    	Object_1.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	function input_input_handler() {
    		bookFilter = this.value;
    		$$invalidate(1, bookFilter);
    	}

    	const click_handler = () => {
    		$$invalidate(1, bookFilter = "");
    	};

    	function keypad0_value_binding(value) {
    		$address.chapter = value;
    		address.set($address);
    	}

    	function keypad1_value_binding(value) {
    		$address.verse = value;
    		address.set($address);
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
    		set_store_value(address, $address.verse = Math.min($address.verse + $address.count, bookLength - 1), $address);
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
    		matchesBook,
    		addToLastAddresses,
    		addressAsString,
    		addressContent,
    		equalAddresses,
    		addressSelector,
    		removeLastAddress,
    		toggleLine,
    		$bibleid,
    		$address,
    		$line1,
    		$line2,
    		filteredBooks,
    		bookLength,
    		$shown,
    		$bodyclass
    	});

    	$$self.$inject_state = $$props => {
    		if ("loadingBible" in $$props) $$invalidate(0, loadingBible = $$props.loadingBible);
    		if ("defaultAddress" in $$props) defaultAddress = $$props.defaultAddress;
    		if ("books" in $$props) $$invalidate(32, books = $$props.books);
    		if ("booksByAbbr" in $$props) $$invalidate(33, booksByAbbr = $$props.booksByAbbr);
    		if ("bookFilter" in $$props) $$invalidate(1, bookFilter = $$props.bookFilter);
    		if ("shownBook" in $$props) $$invalidate(2, shownBook = $$props.shownBook);
    		if ("lastAddresses" in $$props) $$invalidate(3, lastAddresses = $$props.lastAddresses);
    		if ("gun" in $$props) gun = $$props.gun;
    		if ("overlay" in $$props) overlay = $$props.overlay;
    		if ("shown" in $$props) $$invalidate(12, shown = $$props.shown);
    		if ("line1" in $$props) $$invalidate(13, line1 = $$props.line1);
    		if ("line2" in $$props) $$invalidate(14, line2 = $$props.line2);
    		if ("address" in $$props) $$invalidate(15, address = $$props.address);
    		if ("bodyclass" in $$props) $$invalidate(16, bodyclass = $$props.bodyclass);
    		if ("bibleid" in $$props) $$invalidate(17, bibleid = $$props.bibleid);
    		if ("filteredBooks" in $$props) $$invalidate(8, filteredBooks = $$props.filteredBooks);
    		if ("bookLength" in $$props) $$invalidate(9, bookLength = $$props.bookLength);
    	};

    	let filteredBooks;
    	let bookLength;

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty[0] & /*$bibleid*/ 16) {
    			 loadBible($bibleid + ".json");
    		}

    		if ($$self.$$.dirty[0] & /*$address*/ 32 | $$self.$$.dirty[1] & /*booksByAbbr*/ 4) {
    			 $$invalidate(2, shownBook = booksByAbbr[$address.book] || { chapters: [], name: "" });
    		}

    		if ($$self.$$.dirty[0] & /*$address*/ 32) {
    			 set_store_value(line1, $line1 = addressAsString($address), $line1);
    		}

    		if ($$self.$$.dirty[0] & /*$address*/ 32) {
    			 set_store_value(line2, $line2 = addressContent($address), $line2);
    		}

    		if ($$self.$$.dirty[0] & /*bookFilter*/ 2 | $$self.$$.dirty[1] & /*books*/ 2) {
    			 $$invalidate(8, filteredBooks = bookFilter ? books.filter(matchesBook) : books);
    		}

    		if ($$self.$$.dirty[0] & /*shownBook, $address*/ 36) {
    			 $$invalidate(9, bookLength = (shownBook.chapters[$address.chapter] || []).length);
    		}
    	};

    	return [
    		loadingBible,
    		bookFilter,
    		shownBook,
    		lastAddresses,
    		$bibleid,
    		$address,
    		$line1,
    		$line2,
    		filteredBooks,
    		bookLength,
    		$shown,
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
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {}, [-1, -1]);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment$1.name
    		});
    	}
    }

    var app = new App({
    	target: document.body
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
