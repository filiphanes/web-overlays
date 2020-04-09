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
    class HtmlTag {
        constructor(html, anchor = null) {
            this.e = element('div');
            this.a = anchor;
            this.u(html);
        }
        m(target, anchor = null) {
            for (let i = 0; i < this.n.length; i += 1) {
                insert(target, this.n[i], anchor);
            }
            this.t = target;
        }
        u(html) {
            this.e.innerHTML = html;
            this.n = Array.from(this.e.childNodes);
        }
        p(html) {
            this.d();
            this.u(html);
            this.m(this.t, this.a);
        }
        d() {
            this.n.forEach(detach);
        }
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
                console.debug(key, data);
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

    const { Object: Object_1 } = globals;
    const file = "src/App.svelte";

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[50] = list[i];
    	child_ctx[54] = i;
    	return child_ctx;
    }

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[49] = list[i][0];
    	child_ctx[50] = list[i][1];
    	return child_ctx;
    }

    function get_each_context_2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[55] = list[i];
    	child_ctx[54] = i;
    	return child_ctx;
    }

    function get_each_context_3(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[55] = list[i];
    	return child_ctx;
    }

    // (306:2) {#each filteredSongs as song}
    function create_each_block_3(ctx) {
    	let button;
    	let t_value = /*song*/ ctx[55].name + "";
    	let t;
    	let dispose;

    	function click_handler_1(...args) {
    		return /*click_handler_1*/ ctx[36](/*song*/ ctx[55], ...args);
    	}

    	const block = {
    		c: function create() {
    			button = element("button");
    			t = text(t_value);
    			attr_dev(button, "class", "song-item btn svelte-2l650d");
    			toggle_class(button, "btn-primary", /*song*/ ctx[55] == /*curSong*/ ctx[6]);
    			add_location(button, file, 306, 4, 7341);
    		},
    		m: function mount(target, anchor, remount) {
    			insert_dev(target, button, anchor);
    			append_dev(button, t);
    			if (remount) dispose();
    			dispose = listen_dev(button, "click", click_handler_1, false, false, false);
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty[0] & /*filteredSongs*/ 2 && t_value !== (t_value = /*song*/ ctx[55].name + "")) set_data_dev(t, t_value);

    			if (dirty[0] & /*filteredSongs, curSong*/ 66) {
    				toggle_class(button, "btn-primary", /*song*/ ctx[55] == /*curSong*/ ctx[6]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_3.name,
    		type: "each",
    		source: "(306:2) {#each filteredSongs as song}",
    		ctx
    	});

    	return block;
    }

    // (316:2) {#each playlist as song, i}
    function create_each_block_2(ctx) {
    	let div;
    	let button0;
    	let t0_value = (/*song*/ ctx[55].name || "---") + "";
    	let t0;
    	let t1;
    	let button1;
    	let t3;
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
    			attr_dev(button0, "class", "song-set btn svelte-2l650d");
    			toggle_class(button0, "btn-primary", /*$curSongIndex*/ ctx[11] == /*i*/ ctx[54]);
    			add_location(button0, file, 317, 4, 7624);
    			attr_dev(button1, "class", "btn btn-secondary song-remove svelte-2l650d");
    			add_location(button1, file, 321, 4, 7766);
    			attr_dev(div, "class", "song-item btn-group svelte-2l650d");
    			add_location(div, file, 316, 2, 7586);
    		},
    		m: function mount(target, anchor, remount) {
    			insert_dev(target, div, anchor);
    			append_dev(div, button0);
    			append_dev(button0, t0);
    			append_dev(div, t1);
    			append_dev(div, button1);
    			append_dev(div, t3);
    			if (remount) run_all(dispose);

    			dispose = [
    				listen_dev(button0, "click", /*songSelector*/ ctx[19](/*i*/ ctx[54]), false, false, false),
    				listen_dev(button1, "click", /*playlistRemover*/ ctx[18](/*i*/ ctx[54]), false, false, false)
    			];
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty[0] & /*playlist*/ 32 && t0_value !== (t0_value = (/*song*/ ctx[55].name || "---") + "")) set_data_dev(t0, t0_value);

    			if (dirty[0] & /*$curSongIndex*/ 2048) {
    				toggle_class(button0, "btn-primary", /*$curSongIndex*/ ctx[11] == /*i*/ ctx[54]);
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
    		source: "(316:2) {#each playlist as song, i}",
    		ctx
    	});

    	return block;
    }

    // (345:2) {:else}
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
    			if (dirty[0] & /*$curVerseIndex, verseSelector, curVerses*/ 1049728) {
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
    		source: "(345:2) {:else}",
    		ctx
    	});

    	return block;
    }

    // (333:2) {#if editingSong}
    function create_if_block_1(ctx) {
    	let input0;
    	let t0;
    	let input1;
    	let t1;
    	let input2;
    	let t2;
    	let t3;
    	let button;
    	let t5;
    	let input3;
    	let t6;
    	let p;
    	let dispose;
    	let each_value = Object.entries(/*curSong*/ ctx[6].verses);
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			input0 = element("input");
    			t0 = space();
    			input1 = element("input");
    			t1 = space();
    			input2 = element("input");
    			t2 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t3 = space();
    			button = element("button");
    			button.textContent = "+";
    			t5 = space();
    			input3 = element("input");
    			t6 = space();
    			p = element("p");
    			attr_dev(input0, "class", "form-control");
    			attr_dev(input0, "type", "text");
    			attr_dev(input0, "placeholder", "name");
    			add_location(input0, file, 333, 4, 8195);
    			attr_dev(input1, "class", "form-control");
    			attr_dev(input1, "type", "text");
    			attr_dev(input1, "placeholder", "author");
    			add_location(input1, file, 334, 4, 8287);
    			attr_dev(input2, "class", "form-control");
    			attr_dev(input2, "type", "text");
    			attr_dev(input2, "placeholder", "order");
    			add_location(input2, file, 335, 4, 8383);
    			attr_dev(button, "class", "verse-add btn btn-success svelte-2l650d");
    			add_location(button, file, 341, 4, 8772);
    			attr_dev(input3, "class", "form-control verse-new-id svelte-2l650d");
    			attr_dev(input3, "type", "text");
    			attr_dev(input3, "placeholder", "id");
    			add_location(input3, file, 342, 4, 8852);
    			attr_dev(p, "class", "verse-new-item svelte-2l650d");
    			attr_dev(p, "contenteditable", "true");
    			if (/*newVerse*/ ctx[9] === void 0) add_render_callback(() => /*p_input_handler_1*/ ctx[44].call(p));
    			add_location(p, file, 343, 4, 8948);
    		},
    		m: function mount(target, anchor, remount) {
    			insert_dev(target, input0, anchor);
    			set_input_value(input0, /*curSong*/ ctx[6].name);
    			insert_dev(target, t0, anchor);
    			insert_dev(target, input1, anchor);
    			set_input_value(input1, /*curSong*/ ctx[6].author);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, input2, anchor);
    			set_input_value(input2, /*curSong*/ ctx[6].order);
    			insert_dev(target, t2, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert_dev(target, t3, anchor);
    			insert_dev(target, button, anchor);
    			insert_dev(target, t5, anchor);
    			insert_dev(target, input3, anchor);
    			set_input_value(input3, /*newId*/ ctx[8]);
    			insert_dev(target, t6, anchor);
    			insert_dev(target, p, anchor);

    			if (/*newVerse*/ ctx[9] !== void 0) {
    				p.innerHTML = /*newVerse*/ ctx[9];
    			}

    			if (remount) run_all(dispose);

    			dispose = [
    				listen_dev(input0, "input", /*input0_input_handler*/ ctx[38]),
    				listen_dev(input1, "input", /*input1_input_handler*/ ctx[39]),
    				listen_dev(input2, "input", /*input2_input_handler*/ ctx[40]),
    				listen_dev(button, "click", /*addNewVerse*/ ctx[22], false, false, false),
    				listen_dev(input3, "input", /*input3_input_handler*/ ctx[43]),
    				listen_dev(p, "input", /*p_input_handler_1*/ ctx[44])
    			];
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*curSong*/ 64 && input0.value !== /*curSong*/ ctx[6].name) {
    				set_input_value(input0, /*curSong*/ ctx[6].name);
    			}

    			if (dirty[0] & /*curSong*/ 64 && input1.value !== /*curSong*/ ctx[6].author) {
    				set_input_value(input1, /*curSong*/ ctx[6].author);
    			}

    			if (dirty[0] & /*curSong*/ 64 && input2.value !== /*curSong*/ ctx[6].order) {
    				set_input_value(input2, /*curSong*/ ctx[6].order);
    			}

    			if (dirty[0] & /*curSong, verseRemover*/ 2097216) {
    				each_value = Object.entries(/*curSong*/ ctx[6].verses);
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(t3.parentNode, t3);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}

    			if (dirty[0] & /*newId*/ 256 && input3.value !== /*newId*/ ctx[8]) {
    				set_input_value(input3, /*newId*/ ctx[8]);
    			}

    			if (dirty[0] & /*newVerse*/ 512 && /*newVerse*/ ctx[9] !== p.innerHTML) {
    				p.innerHTML = /*newVerse*/ ctx[9];
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(input0);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(input1);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(input2);
    			if (detaching) detach_dev(t2);
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(button);
    			if (detaching) detach_dev(t5);
    			if (detaching) detach_dev(input3);
    			if (detaching) detach_dev(t6);
    			if (detaching) detach_dev(p);
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(333:2) {#if editingSong}",
    		ctx
    	});

    	return block;
    }

    // (346:4) {#each curVerses as verse, i}
    function create_each_block_1(ctx) {
    	let p;
    	let html_tag;
    	let raw_value = /*verse*/ ctx[50].replace(/\n/g, "<br>") + "";
    	let t;
    	let dispose;

    	const block = {
    		c: function create() {
    			p = element("p");
    			t = space();
    			html_tag = new HtmlTag(raw_value, t);
    			attr_dev(p, "class", "verse-item svelte-2l650d");
    			toggle_class(p, "active", /*$curVerseIndex*/ ctx[10] == /*i*/ ctx[54]);
    			add_location(p, file, 346, 4, 9076);
    		},
    		m: function mount(target, anchor, remount) {
    			insert_dev(target, p, anchor);
    			html_tag.m(p);
    			append_dev(p, t);
    			if (remount) dispose();
    			dispose = listen_dev(p, "click", /*verseSelector*/ ctx[20](/*i*/ ctx[54]), false, false, false);
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty[0] & /*curVerses*/ 128 && raw_value !== (raw_value = /*verse*/ ctx[50].replace(/\n/g, "<br>") + "")) html_tag.p(raw_value);

    			if (dirty[0] & /*$curVerseIndex*/ 1024) {
    				toggle_class(p, "active", /*$curVerseIndex*/ ctx[10] == /*i*/ ctx[54]);
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
    		source: "(346:4) {#each curVerses as verse, i}",
    		ctx
    	});

    	return block;
    }

    // (337:4) {#each Object.entries(curSong.verses) as [id, verse]}
    function create_each_block(ctx) {
    	let button;
    	let t1;
    	let span;
    	let t2_value = /*id*/ ctx[49] + "";
    	let t2;
    	let t3;
    	let p;
    	let dispose;

    	function click_handler_3(...args) {
    		return /*click_handler_3*/ ctx[41](/*id*/ ctx[49], ...args);
    	}

    	function p_input_handler() {
    		/*p_input_handler*/ ctx[42].call(p, /*id*/ ctx[49]);
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
    			attr_dev(button, "class", "verse-remove btn btn-secondary svelte-2l650d");
    			add_location(button, file, 337, 4, 8535);
    			attr_dev(span, "class", "verse-id svelte-2l650d");
    			add_location(span, file, 338, 4, 8631);
    			attr_dev(p, "class", "verse-item svelte-2l650d");
    			attr_dev(p, "contenteditable", "true");
    			if (/*curSong*/ ctx[6].verses[/*id*/ ctx[49]] === void 0) add_render_callback(p_input_handler);
    			add_location(p, file, 339, 4, 8670);
    		},
    		m: function mount(target, anchor, remount) {
    			insert_dev(target, button, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, span, anchor);
    			append_dev(span, t2);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, p, anchor);

    			if (/*curSong*/ ctx[6].verses[/*id*/ ctx[49]] !== void 0) {
    				p.innerHTML = /*curSong*/ ctx[6].verses[/*id*/ ctx[49]];
    			}

    			if (remount) run_all(dispose);

    			dispose = [
    				listen_dev(button, "click", click_handler_3, false, false, false),
    				listen_dev(p, "input", p_input_handler)
    			];
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty[0] & /*curSong*/ 64 && t2_value !== (t2_value = /*id*/ ctx[49] + "")) set_data_dev(t2, t2_value);

    			if (dirty[0] & /*curSong*/ 64 && /*curSong*/ ctx[6].verses[/*id*/ ctx[49]] !== p.innerHTML) {
    				p.innerHTML = /*curSong*/ ctx[6].verses[/*id*/ ctx[49]];
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
    		source: "(337:4) {#each Object.entries(curSong.verses) as [id, verse]}",
    		ctx
    	});

    	return block;
    }

    // (363:20) {:else}
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
    		source: "(363:20) {:else}",
    		ctx
    	});

    	return block;
    }

    // (363:4) {#if shown}
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
    		source: "(363:4) {#if shown}",
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
    	let div0;
    	let input;
    	let t4;
    	let button0;
    	let t6;
    	let div1;
    	let t7;
    	let div2;
    	let t8;
    	let t9;
    	let div3;
    	let span0;
    	let t10_value = /*curSong*/ ctx[6].name + "";
    	let t10;
    	let t11;
    	let span1;
    	let t12_value = /*curSong*/ ctx[6].author + "";
    	let t12;
    	let t13;
    	let button1;
    	let t15;
    	let button2;
    	let t17;
    	let t18;
    	let div4;
    	let button3;
    	let t19;
    	let button3_disabled_value;
    	let t20;
    	let button4;
    	let t21;
    	let button4_disabled_value;
    	let t22;
    	let button5;
    	let t23;
    	let button6;
    	let t24;
    	let button6_disabled_value;
    	let t25;
    	let button7;
    	let t26;
    	let button7_disabled_value;
    	let dispose;
    	let each_value_3 = /*filteredSongs*/ ctx[1];
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

    	function select_block_type(ctx, dirty) {
    		if (/*editingSong*/ ctx[3]) return create_if_block_1;
    		return create_else_block_1;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block0 = current_block_type(ctx);

    	function select_block_type_1(ctx, dirty) {
    		if (/*shown*/ ctx[4]) return create_if_block;
    		return create_else_block;
    	}

    	let current_block_type_1 = select_block_type_1(ctx);
    	let if_block1 = current_block_type_1(ctx);

    	const block = {
    		c: function create() {
    			p = element("p");
    			t0 = text("Téma:\n  ");
    			select = element("select");
    			option0 = element("option");
    			option0.textContent = "Predvolené";
    			option1 = element("option");
    			option1.textContent = "Jednoduché s tieňom";
    			t3 = space();
    			div0 = element("div");
    			input = element("input");
    			t4 = space();
    			button0 = element("button");
    			button0.textContent = "×";
    			t6 = space();
    			div1 = element("div");

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].c();
    			}

    			t7 = space();
    			div2 = element("div");
    			t8 = text("Playlist:\n  ");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t9 = space();
    			div3 = element("div");
    			span0 = element("span");
    			t10 = text(t10_value);
    			t11 = text(" - ");
    			span1 = element("span");
    			t12 = text(t12_value);
    			t13 = space();
    			button1 = element("button");
    			button1.textContent = "✎";
    			t15 = space();
    			button2 = element("button");
    			button2.textContent = "+";
    			t17 = space();
    			if_block0.c();
    			t18 = space();
    			div4 = element("div");
    			button3 = element("button");
    			t19 = text("↑ Pieseň");
    			t20 = space();
    			button4 = element("button");
    			t21 = text("Pieseň ↓");
    			t22 = space();
    			button5 = element("button");
    			if_block1.c();
    			t23 = space();
    			button6 = element("button");
    			t24 = text("↑ Verš");
    			t25 = space();
    			button7 = element("button");
    			t26 = text("Verš ↓");
    			option0.__value = "";
    			option0.value = option0.__value;
    			option0.selected = true;
    			add_location(option0, file, 288, 4, 6751);
    			option1.__value = "simple-with-shadow";
    			option1.value = option1.__value;
    			add_location(option1, file, 289, 4, 6801);
    			if (/*$bodyclass*/ ctx[12] === void 0) add_render_callback(() => /*select_change_handler*/ ctx[32].call(select));
    			add_location(select, file, 287, 2, 6714);
    			attr_dev(p, "class", "bodyclass");
    			add_location(p, file, 285, 0, 6682);
    			attr_dev(input, "class", "form-control");
    			attr_dev(input, "type", "text");
    			attr_dev(input, "placeholder", "filter");
    			add_location(input, file, 294, 2, 6947);
    			attr_dev(button0, "type", "button");
    			attr_dev(button0, "class", "form-control btn btn-secondary");
    			set_style(button0, "max-width", "2rem");
    			set_style(button0, "padding", ".25rem");
    			add_location(button0, file, 298, 2, 7085);
    			attr_dev(div0, "class", "input-group");
    			set_style(div0, "width", "100%");
    			set_style(div0, "display", "flex");
    			add_location(div0, file, 293, 0, 6883);
    			attr_dev(div1, "class", "songs-filter svelte-2l650d");
    			toggle_class(div1, "show", /*filterFocused*/ ctx[2]);
    			add_location(div1, file, 304, 0, 7251);
    			attr_dev(div2, "class", "playlist svelte-2l650d");
    			add_location(div2, file, 313, 0, 7519);
    			add_location(span0, file, 327, 2, 7903);
    			add_location(span1, file, 327, 32, 7933);
    			attr_dev(button1, "class", "song-edit btn");
    			toggle_class(button1, "btn-danger", /*editingSong*/ ctx[3]);
    			add_location(button1, file, 328, 2, 7965);
    			attr_dev(button2, "class", "song-add btn svelte-2l650d");
    			add_location(button2, file, 330, 2, 8111);
    			attr_dev(div3, "class", "verses svelte-2l650d");
    			add_location(div3, file, 326, 0, 7880);
    			attr_dev(button3, "class", "btn btn-primary svelte-2l650d");
    			button3.disabled = button3_disabled_value = /*$curSongIndex*/ ctx[11] <= 0;
    			add_location(button3, file, 354, 2, 9280);
    			attr_dev(button4, "class", "btn btn-primary svelte-2l650d");
    			button4.disabled = button4_disabled_value = /*$curSongIndex*/ ctx[11] >= /*playlist*/ ctx[5].length - 1;
    			add_location(button4, file, 357, 2, 9424);
    			attr_dev(button5, "class", "control-button btn svelte-2l650d");
    			toggle_class(button5, "btn-danger", /*shown*/ ctx[4]);
    			toggle_class(button5, "btn-success", !/*shown*/ ctx[4]);
    			add_location(button5, file, 361, 2, 9585);
    			attr_dev(button6, "class", "btn btn-primary svelte-2l650d");
    			button6.disabled = button6_disabled_value = /*$curVerseIndex*/ ctx[10] <= 0;
    			add_location(button6, file, 365, 2, 9751);
    			attr_dev(button7, "class", "btn btn-primary svelte-2l650d");
    			button7.disabled = button7_disabled_value = /*$curVerseIndex*/ ctx[10] >= /*curVerses*/ ctx[7].length - 1;
    			add_location(button7, file, 368, 2, 9926);
    			attr_dev(div4, "class", "bottom-buttons btn-group svelte-2l650d");
    			add_location(div4, file, 353, 0, 9239);
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
    			select_option(select, /*$bodyclass*/ ctx[12]);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, div0, anchor);
    			append_dev(div0, input);
    			set_input_value(input, /*songFilter*/ ctx[0]);
    			append_dev(div0, t4);
    			append_dev(div0, button0);
    			insert_dev(target, t6, anchor);
    			insert_dev(target, div1, anchor);

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].m(div1, null);
    			}

    			insert_dev(target, t7, anchor);
    			insert_dev(target, div2, anchor);
    			append_dev(div2, t8);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div2, null);
    			}

    			insert_dev(target, t9, anchor);
    			insert_dev(target, div3, anchor);
    			append_dev(div3, span0);
    			append_dev(span0, t10);
    			append_dev(div3, t11);
    			append_dev(div3, span1);
    			append_dev(span1, t12);
    			append_dev(div3, t13);
    			append_dev(div3, button1);
    			append_dev(div3, t15);
    			append_dev(div3, button2);
    			append_dev(div3, t17);
    			if_block0.m(div3, null);
    			insert_dev(target, t18, anchor);
    			insert_dev(target, div4, anchor);
    			append_dev(div4, button3);
    			append_dev(button3, t19);
    			append_dev(div4, t20);
    			append_dev(div4, button4);
    			append_dev(button4, t21);
    			append_dev(div4, t22);
    			append_dev(div4, button5);
    			if_block1.m(button5, null);
    			append_dev(div4, t23);
    			append_dev(div4, button6);
    			append_dev(button6, t24);
    			append_dev(div4, t25);
    			append_dev(div4, button7);
    			append_dev(button7, t26);
    			if (remount) run_all(dispose);

    			dispose = [
    				listen_dev(select, "change", /*select_change_handler*/ ctx[32]),
    				listen_dev(input, "input", /*input_input_handler*/ ctx[33]),
    				listen_dev(input, "focus", /*focus_handler*/ ctx[34], false, false, false),
    				listen_dev(button0, "click", /*click_handler*/ ctx[35], false, false, false),
    				listen_dev(button1, "click", /*click_handler_2*/ ctx[37], false, false, false),
    				listen_dev(button2, "click", /*addSong*/ ctx[24], false, false, false),
    				listen_dev(button3, "click", /*click_handler_4*/ ctx[45], false, false, false),
    				listen_dev(button4, "click", /*click_handler_5*/ ctx[46], false, false, false),
    				listen_dev(button5, "click", /*toggleShow*/ ctx[25], false, false, false),
    				listen_dev(button6, "click", /*click_handler_6*/ ctx[47], false, false, false),
    				listen_dev(button7, "click", /*click_handler_7*/ ctx[48], false, false, false)
    			];
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*$bodyclass*/ 4096) {
    				select_option(select, /*$bodyclass*/ ctx[12]);
    			}

    			if (dirty[0] & /*songFilter*/ 1 && input.value !== /*songFilter*/ ctx[0]) {
    				set_input_value(input, /*songFilter*/ ctx[0]);
    			}

    			if (dirty[0] & /*filteredSongs, curSong, addToPlaylist, filterFocused*/ 131142) {
    				each_value_3 = /*filteredSongs*/ ctx[1];
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

    			if (dirty[0] & /*filterFocused*/ 4) {
    				toggle_class(div1, "show", /*filterFocused*/ ctx[2]);
    			}

    			if (dirty[0] & /*playlistRemover, $curSongIndex, songSelector, playlist*/ 788512) {
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

    			if (dirty[0] & /*curSong*/ 64 && t10_value !== (t10_value = /*curSong*/ ctx[6].name + "")) set_data_dev(t10, t10_value);
    			if (dirty[0] & /*curSong*/ 64 && t12_value !== (t12_value = /*curSong*/ ctx[6].author + "")) set_data_dev(t12, t12_value);

    			if (dirty[0] & /*editingSong*/ 8) {
    				toggle_class(button1, "btn-danger", /*editingSong*/ ctx[3]);
    			}

    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block0) {
    				if_block0.p(ctx, dirty);
    			} else {
    				if_block0.d(1);
    				if_block0 = current_block_type(ctx);

    				if (if_block0) {
    					if_block0.c();
    					if_block0.m(div3, null);
    				}
    			}

    			if (dirty[0] & /*$curSongIndex*/ 2048 && button3_disabled_value !== (button3_disabled_value = /*$curSongIndex*/ ctx[11] <= 0)) {
    				prop_dev(button3, "disabled", button3_disabled_value);
    			}

    			if (dirty[0] & /*$curSongIndex, playlist*/ 2080 && button4_disabled_value !== (button4_disabled_value = /*$curSongIndex*/ ctx[11] >= /*playlist*/ ctx[5].length - 1)) {
    				prop_dev(button4, "disabled", button4_disabled_value);
    			}

    			if (current_block_type_1 !== (current_block_type_1 = select_block_type_1(ctx))) {
    				if_block1.d(1);
    				if_block1 = current_block_type_1(ctx);

    				if (if_block1) {
    					if_block1.c();
    					if_block1.m(button5, null);
    				}
    			}

    			if (dirty[0] & /*shown*/ 16) {
    				toggle_class(button5, "btn-danger", /*shown*/ ctx[4]);
    			}

    			if (dirty[0] & /*shown*/ 16) {
    				toggle_class(button5, "btn-success", !/*shown*/ ctx[4]);
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
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(div0);
    			if (detaching) detach_dev(t6);
    			if (detaching) detach_dev(div1);
    			destroy_each(each_blocks_1, detaching);
    			if (detaching) detach_dev(t7);
    			if (detaching) detach_dev(div2);
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach_dev(t9);
    			if (detaching) detach_dev(div3);
    			if_block0.d();
    			if (detaching) detach_dev(t18);
    			if (detaching) detach_dev(div4);
    			if_block1.d();
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

    function getSongVerses(song) {
    	let verses = [];

    	if (song) {
    		if (song.order.trim()) {
    			song.order.split(" ").forEach(id => {
    				if (song.verses[id]) verses.push(song.verses[id]);
    			});
    		} else {
    			return Object.values(song.verses);
    		}
    	}

    	return verses;
    }

    function scrollToVerse(i) {
    	let e = document.querySelector(".verse-item:nth-child(" + i + ")");
    	e && e.scrollIntoView();
    }

    function instance($$self, $$props, $$invalidate) {
    	let $curVerseIndex;
    	let $curSongIndex;
    	let $line1;
    	let $bodyclass;

    	onMount(function () {
    		document.addEventListener("keydown", function (event) {
    			if (editingSong) {
    				if (event.code == "Enter" && event.getModifierState("Control") + event.getModifierState("Meta") > 1) {
    					addNewVerse();
    				}
    			}

    			
    			if (event.code == "ArrowDown" || event.code == "ArrowUp" || event.code == "ArrowLeft" || event.code == "ArrowRight") event.preventDefault();

    			if (event.code == "ArrowDown") {
    				set_store_value(curVerseIndex, $curVerseIndex = Math.min($curVerseIndex + 1, curVerses.length - 1));
    				scrollToVerse($curVerseIndex);
    			} else if (event.code == "ArrowUp") {
    				set_store_value(curVerseIndex, $curVerseIndex = Math.max($curVerseIndex - 1, 0));
    				scrollToVerse($curVerseIndex);
    			} else if (event.code == "ArrowLeft") {
    				set_store_value(curSongIndex, $curSongIndex = Math.max($curSongIndex - 1, 0));
    			} else if (event.code == "ArrowRight") {
    				set_store_value(curSongIndex, $curSongIndex = Math.min($curSongIndex + 1, playlist.length - 1));
    			}
    		});
    	});

    	let songs = [
    		{
    			name: "A Safe Stronghold Our God is Still",
    			author: "Martin Luther",
    			order: "s1 s2 s3 s1 s1 s2 s3 s3 s3",
    			verses: {
    				s1: `As safe a stronghold our God is still,
On earth is not His fellow.`,
    				s2: `With force of arms we nothing can,
Shall conquer in the battle.`,
    				s3: `And were this world all devils o’er,
A word shall quickly slay him.`
    			}
    		}
    	];

    	let songsByName = new Map();
    	let songFilter = "";
    	let filteredSongs = songs;
    	let filterFocused = false;
    	let editingSong = false;
    	GUN_SUPER_PEERS = GUN_SUPER_PEERS || ["http://127.0.0.1/gun"];
    	let gun = Gun(GUN_SUPER_PEERS);
    	let overlay = gun.get("songs").get(window.location.hash || "demo");

    	/* Synced variables */
    	let shown = writableGun(overlay.get("show"), false);

    	let line1 = writableGun(overlay.get("line1"), "");
    	validate_store(line1, "line1");
    	component_subscribe($$self, line1, value => $$invalidate(26, $line1 = value));
    	let bodyclass = writableGun(overlay.get("bodyclass"), "");
    	validate_store(bodyclass, "bodyclass");
    	component_subscribe($$self, bodyclass, value => $$invalidate(12, $bodyclass = value));
    	let curSongIndex = writableGun(overlay.get("curSongIndex"), 0);
    	validate_store(curSongIndex, "curSongIndex");
    	component_subscribe($$self, curSongIndex, value => $$invalidate(11, $curSongIndex = value));
    	let curVerseIndex = writableGun(overlay.get("curVerseIndex"), 0);
    	validate_store(curVerseIndex, "curVerseIndex");
    	component_subscribe($$self, curVerseIndex, value => $$invalidate(10, $curVerseIndex = value));
    	let playlist = [songs[0]];
    	let curSong = playlist[0];
    	let curVerses = curSong.verses || [];
    	let newId = "s1";
    	generateNewId();
    	let newVerse = "";

    	function matchesSong(song) {
    		const prefix = songFilter.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    		const nameLower = song.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    		return nameLower.startsWith(prefix) || prefix.length >= 2 && nameLower.includes(" " + prefix);
    	}

    	function addToPlaylist(song) {
    		playlist.push(song);
    		$$invalidate(5, playlist);
    	}

    	function playlistRemover(songIndex) {
    		return function () {
    			$$invalidate(5, playlist = playlist.filter((h, j) => songIndex !== j));
    		};
    	}

    	function songSelector(i) {
    		return function () {
    			set_store_value(curSongIndex, $curSongIndex = i);
    		};
    	}

    	function verseSelector(i) {
    		return function () {
    			set_store_value(curVerseIndex, $curVerseIndex = i);
    		};
    	}

    	function verseRemover(id) {
    		return function () {
    			if (!newVerse) $$invalidate(8, newId = id);
    			delete curSong.verses[id];
    		};
    	}

    	function addNewVerse() {
    		if (newId && !curSong.verses[newId]) $$invalidate(6, curSong.verses[newId] = newVerse, curSong);

    		/* Clean new verse */
    		$$invalidate(9, newVerse = "");

    		generateNewId();
    	}

    	function generateNewId() {
    		if (!curSong || !curSong.verses) return;

    		while (curSong.verses[newId]) {
    			$$invalidate(8, newId = newId.replace(/\d+/, n => parseInt(n) + 1));
    		}
    	}

    	function addSong() {
    		let newSong = {
    			name: "",
    			author: "",
    			order: "",
    			verses: {}
    		};

    		songs.push(newSong);
    		addToPlaylist(newSong);
    		set_store_value(curSongIndex, $curSongIndex = playlist.length - 1);
    		$$invalidate(3, editingSong = true);
    		$$invalidate(8, newId = "s1");
    	}

    	function toggleShow() {
    		$$invalidate(4, shown = !shown);
    		overlay.get("show").put(shown);
    	}

    	const writable_props = [];

    	Object_1.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("App", $$slots, []);

    	function select_change_handler() {
    		$bodyclass = select_value(this);
    		bodyclass.set($bodyclass);
    	}

    	function input_input_handler() {
    		songFilter = this.value;
    		$$invalidate(0, songFilter);
    	}

    	const focus_handler = () => {
    		$$invalidate(2, filterFocused = true);
    	};

    	const click_handler = () => {
    		$$invalidate(0, songFilter = "");
    	};

    	const click_handler_1 = song => {
    		addToPlaylist(song);
    		$$invalidate(2, filterFocused = false);
    	};

    	const click_handler_2 = () => {
    		$$invalidate(3, editingSong = !editingSong);
    		generateNewId();
    	};

    	function input0_input_handler() {
    		curSong.name = this.value;
    		(($$invalidate(6, curSong), $$invalidate(5, playlist)), $$invalidate(11, $curSongIndex));
    	}

    	function input1_input_handler() {
    		curSong.author = this.value;
    		(($$invalidate(6, curSong), $$invalidate(5, playlist)), $$invalidate(11, $curSongIndex));
    	}

    	function input2_input_handler() {
    		curSong.order = this.value;
    		(($$invalidate(6, curSong), $$invalidate(5, playlist)), $$invalidate(11, $curSongIndex));
    	}

    	const click_handler_3 = id => {
    	};

    	function p_input_handler(id) {
    		curSong.verses[id] = this.innerHTML;
    		(($$invalidate(6, curSong), $$invalidate(5, playlist)), $$invalidate(11, $curSongIndex));
    	}

    	function input3_input_handler() {
    		newId = this.value;
    		$$invalidate(8, newId);
    	}

    	function p_input_handler_1() {
    		newVerse = this.innerHTML;
    		$$invalidate(9, newVerse);
    	}

    	const click_handler_4 = function () {
    		set_store_value(curSongIndex, $curSongIndex -= 1);
    	};

    	const click_handler_5 = function () {
    		set_store_value(curSongIndex, $curSongIndex += 1);
    	};

    	const click_handler_6 = function () {
    		set_store_value(curVerseIndex, $curVerseIndex -= 1);
    		scrollToVerse($curVerseIndex);
    	};

    	const click_handler_7 = function () {
    		set_store_value(curVerseIndex, $curVerseIndex += 1);
    		scrollToVerse($curVerseIndex);
    	};

    	$$self.$capture_state = () => ({
    		onMount,
    		onDestroy,
    		writableGun,
    		songs,
    		songsByName,
    		songFilter,
    		filteredSongs,
    		filterFocused,
    		editingSong,
    		gun,
    		overlay,
    		shown,
    		line1,
    		bodyclass,
    		curSongIndex,
    		curVerseIndex,
    		playlist,
    		curSong,
    		curVerses,
    		newId,
    		newVerse,
    		getSongVerses,
    		matchesSong,
    		addToPlaylist,
    		playlistRemover,
    		songSelector,
    		verseSelector,
    		verseRemover,
    		addNewVerse,
    		generateNewId,
    		addSong,
    		scrollToVerse,
    		toggleShow,
    		$curVerseIndex,
    		$curSongIndex,
    		$line1,
    		$bodyclass
    	});

    	$$self.$inject_state = $$props => {
    		if ("songs" in $$props) $$invalidate(27, songs = $$props.songs);
    		if ("songsByName" in $$props) songsByName = $$props.songsByName;
    		if ("songFilter" in $$props) $$invalidate(0, songFilter = $$props.songFilter);
    		if ("filteredSongs" in $$props) $$invalidate(1, filteredSongs = $$props.filteredSongs);
    		if ("filterFocused" in $$props) $$invalidate(2, filterFocused = $$props.filterFocused);
    		if ("editingSong" in $$props) $$invalidate(3, editingSong = $$props.editingSong);
    		if ("gun" in $$props) gun = $$props.gun;
    		if ("overlay" in $$props) overlay = $$props.overlay;
    		if ("shown" in $$props) $$invalidate(4, shown = $$props.shown);
    		if ("line1" in $$props) $$invalidate(13, line1 = $$props.line1);
    		if ("bodyclass" in $$props) $$invalidate(14, bodyclass = $$props.bodyclass);
    		if ("curSongIndex" in $$props) $$invalidate(15, curSongIndex = $$props.curSongIndex);
    		if ("curVerseIndex" in $$props) $$invalidate(16, curVerseIndex = $$props.curVerseIndex);
    		if ("playlist" in $$props) $$invalidate(5, playlist = $$props.playlist);
    		if ("curSong" in $$props) $$invalidate(6, curSong = $$props.curSong);
    		if ("curVerses" in $$props) $$invalidate(7, curVerses = $$props.curVerses);
    		if ("newId" in $$props) $$invalidate(8, newId = $$props.newId);
    		if ("newVerse" in $$props) $$invalidate(9, newVerse = $$props.newVerse);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty[0] & /*$curSongIndex, playlist*/ 2080) {
    			 if ($curSongIndex >= playlist.length) set_store_value(curSongIndex, $curSongIndex = playlist.length - 1);
    		}

    		if ($$self.$$.dirty[0] & /*playlist, $curSongIndex*/ 2080) {
    			 $$invalidate(6, curSong = playlist[$curSongIndex]);
    		}

    		if ($$self.$$.dirty[0] & /*curSong*/ 64) {
    			 $$invalidate(7, curVerses = getSongVerses(curSong));
    		}

    		if ($$self.$$.dirty[0] & /*curVerses, $curVerseIndex*/ 1152) {
    			 set_store_value(line1, $line1 = curVerses[$curVerseIndex]);
    		}

    		if ($$self.$$.dirty[0] & /*songFilter*/ 1) {
    			 $$invalidate(1, filteredSongs = songFilter ? songs.filter(matchesSong) : songs);
    		}
    	};

    	return [
    		songFilter,
    		filteredSongs,
    		filterFocused,
    		editingSong,
    		shown,
    		playlist,
    		curSong,
    		curVerses,
    		newId,
    		newVerse,
    		$curVerseIndex,
    		$curSongIndex,
    		$bodyclass,
    		line1,
    		bodyclass,
    		curSongIndex,
    		curVerseIndex,
    		addToPlaylist,
    		playlistRemover,
    		songSelector,
    		verseSelector,
    		verseRemover,
    		addNewVerse,
    		generateNewId,
    		addSong,
    		toggleShow,
    		$line1,
    		songs,
    		songsByName,
    		gun,
    		overlay,
    		matchesSong,
    		select_change_handler,
    		input_input_handler,
    		focus_handler,
    		click_handler,
    		click_handler_1,
    		click_handler_2,
    		input0_input_handler,
    		input1_input_handler,
    		input2_input_handler,
    		click_handler_3,
    		p_input_handler,
    		input3_input_handler,
    		p_input_handler_1,
    		click_handler_4,
    		click_handler_5,
    		click_handler_6,
    		click_handler_7
    	];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {}, [-1, -1]);

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
