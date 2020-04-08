var app = (function () {
    'use strict';

    function noop() { }
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
    function set_data(text, data) {
        data = '' + data;
        if (text.data !== data)
            text.data = data;
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

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[34] = list[i];
    	child_ctx[36] = i;
    	return child_ctx;
    }

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[37] = list[i];
    	child_ctx[36] = i;
    	return child_ctx;
    }

    function get_each_context_2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[37] = list[i];
    	return child_ctx;
    }

    // (226:2) {#each filteredSongs as song}
    function create_each_block_2(ctx) {
    	let button;
    	let t_value = /*song*/ ctx[37].name + "";
    	let t;
    	let dispose;

    	function click_handler_1(...args) {
    		return /*click_handler_1*/ ctx[29](/*song*/ ctx[37], ...args);
    	}

    	return {
    		c() {
    			button = element("button");
    			t = text(t_value);
    			attr(button, "class", "song-item btn svelte-10vkr3u");
    			toggle_class(button, "btn-primary", /*song*/ ctx[37] == /*curSong*/ ctx[5]);
    		},
    		m(target, anchor, remount) {
    			insert(target, button, anchor);
    			append(button, t);
    			if (remount) dispose();
    			dispose = listen(button, "click", click_handler_1);
    		},
    		p(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty[0] & /*filteredSongs*/ 2 && t_value !== (t_value = /*song*/ ctx[37].name + "")) set_data(t, t_value);

    			if (dirty[0] & /*filteredSongs, curSong*/ 34) {
    				toggle_class(button, "btn-primary", /*song*/ ctx[37] == /*curSong*/ ctx[5]);
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(button);
    			dispose();
    		}
    	};
    }

    // (236:2) {#each playlist as song, i}
    function create_each_block_1(ctx) {
    	let div;
    	let button0;
    	let t0_value = (/*song*/ ctx[37].name || "--") + "";
    	let t0;
    	let t1;
    	let button1;
    	let t3;
    	let dispose;

    	return {
    		c() {
    			div = element("div");
    			button0 = element("button");
    			t0 = text(t0_value);
    			t1 = space();
    			button1 = element("button");
    			button1.textContent = "×";
    			t3 = space();
    			attr(button0, "class", "song-set btn svelte-10vkr3u");
    			toggle_class(button0, "btn-primary", /*$curSongIndex*/ ctx[8] == /*i*/ ctx[36]);
    			attr(button1, "class", "btn btn-secondary song-remove svelte-10vkr3u");
    			attr(div, "class", "song-item btn-group svelte-10vkr3u");
    		},
    		m(target, anchor, remount) {
    			insert(target, div, anchor);
    			append(div, button0);
    			append(button0, t0);
    			append(div, t1);
    			append(div, button1);
    			append(div, t3);
    			if (remount) run_all(dispose);

    			dispose = [
    				listen(button0, "click", /*songSelector*/ ctx[16](/*i*/ ctx[36])),
    				listen(button1, "click", /*playlistRemover*/ ctx[15](/*i*/ ctx[36]))
    			];
    		},
    		p(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty[0] & /*playlist*/ 16 && t0_value !== (t0_value = (/*song*/ ctx[37].name || "--") + "")) set_data(t0, t0_value);

    			if (dirty[0] & /*$curSongIndex*/ 256) {
    				toggle_class(button0, "btn-primary", /*$curSongIndex*/ ctx[8] == /*i*/ ctx[36]);
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    			run_all(dispose);
    		}
    	};
    }

    // (249:2) {#each curVerses as verse, i}
    function create_each_block(ctx) {
    	let p;
    	let html_tag;
    	let raw_value = /*verse*/ ctx[34].replace(/\n/g, "<br>") + "";
    	let t;
    	let dispose;

    	return {
    		c() {
    			p = element("p");
    			t = space();
    			html_tag = new HtmlTag(raw_value, t);
    			attr(p, "class", "verse-item svelte-10vkr3u");
    			toggle_class(p, "active", /*$curVerseIndex*/ ctx[7] == /*i*/ ctx[36]);
    		},
    		m(target, anchor, remount) {
    			insert(target, p, anchor);
    			html_tag.m(p);
    			append(p, t);
    			if (remount) dispose();
    			dispose = listen(p, "click", /*verseSelector*/ ctx[17](/*i*/ ctx[36]));
    		},
    		p(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty[0] & /*curVerses*/ 64 && raw_value !== (raw_value = /*verse*/ ctx[34].replace(/\n/g, "<br>") + "")) html_tag.p(raw_value);

    			if (dirty[0] & /*$curVerseIndex*/ 128) {
    				toggle_class(p, "active", /*$curVerseIndex*/ ctx[7] == /*i*/ ctx[36]);
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(p);
    			dispose();
    		}
    	};
    }

    // (265:20) {:else}
    function create_else_block(ctx) {
    	let t;

    	return {
    		c() {
    			t = text("Zobraziť");
    		},
    		m(target, anchor) {
    			insert(target, t, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    // (265:4) {#if shown}
    function create_if_block(ctx) {
    	let t;

    	return {
    		c() {
    			t = text("Skryť");
    		},
    		m(target, anchor) {
    			insert(target, t, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
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
    	let t10;
    	let t11;
    	let div4;
    	let button1;
    	let t12;
    	let button1_disabled_value;
    	let t13;
    	let button2;
    	let t14;
    	let button2_disabled_value;
    	let t15;
    	let button3;
    	let t16;
    	let button4;
    	let t17;
    	let button4_disabled_value;
    	let t18;
    	let button5;
    	let t19;
    	let button5_disabled_value;
    	let dispose;
    	let each_value_2 = /*filteredSongs*/ ctx[1];
    	let each_blocks_2 = [];

    	for (let i = 0; i < each_value_2.length; i += 1) {
    		each_blocks_2[i] = create_each_block_2(get_each_context_2(ctx, each_value_2, i));
    	}

    	let each_value_1 = /*playlist*/ ctx[4];
    	let each_blocks_1 = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks_1[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
    	}

    	let each_value = /*curVerses*/ ctx[6];
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	function select_block_type(ctx, dirty) {
    		if (/*shown*/ ctx[3]) return create_if_block;
    		return create_else_block;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	return {
    		c() {
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

    			for (let i = 0; i < each_blocks_2.length; i += 1) {
    				each_blocks_2[i].c();
    			}

    			t7 = space();
    			div2 = element("div");
    			t8 = text("Playlist:\n  ");

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].c();
    			}

    			t9 = space();
    			div3 = element("div");
    			t10 = text("Verše:\n  ");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t11 = space();
    			div4 = element("div");
    			button1 = element("button");
    			t12 = text("↑ Pieseň");
    			t13 = space();
    			button2 = element("button");
    			t14 = text("Pieseň ↓");
    			t15 = space();
    			button3 = element("button");
    			if_block.c();
    			t16 = space();
    			button4 = element("button");
    			t17 = text("↑ Verš");
    			t18 = space();
    			button5 = element("button");
    			t19 = text("Verš ↓");
    			option0.__value = "";
    			option0.value = option0.__value;
    			option0.selected = true;
    			option1.__value = "simple-with-shadow";
    			option1.value = option1.__value;
    			if (/*$bodyclass*/ ctx[9] === void 0) add_render_callback(() => /*select_change_handler*/ ctx[25].call(select));
    			attr(p, "class", "bodyclass");
    			attr(input, "class", "form-control");
    			attr(input, "type", "text");
    			attr(input, "placeholder", "filter");
    			attr(button0, "type", "button");
    			attr(button0, "class", "form-control btn btn-secondary svelte-10vkr3u");
    			set_style(button0, "max-width", "2rem");
    			set_style(button0, "padding", ".25rem");
    			attr(div0, "class", "input-group");
    			set_style(div0, "width", "100%");
    			set_style(div0, "display", "flex");
    			attr(div1, "class", "songs-filter svelte-10vkr3u");
    			toggle_class(div1, "show", /*filterFocused*/ ctx[2]);
    			attr(div2, "class", "playlist svelte-10vkr3u");
    			attr(div3, "class", "verses svelte-10vkr3u");
    			attr(button1, "class", "btn btn-primary svelte-10vkr3u");
    			button1.disabled = button1_disabled_value = /*$curSongIndex*/ ctx[8] <= 0;
    			attr(button2, "class", "btn btn-primary svelte-10vkr3u");
    			button2.disabled = button2_disabled_value = /*$curSongIndex*/ ctx[8] >= /*playlist*/ ctx[4].length - 1;
    			attr(button3, "class", "control-button btn svelte-10vkr3u");
    			toggle_class(button3, "btn-danger", /*shown*/ ctx[3]);
    			toggle_class(button3, "btn-success", !/*shown*/ ctx[3]);
    			attr(button4, "class", "btn btn-primary svelte-10vkr3u");
    			button4.disabled = button4_disabled_value = /*$curVerseIndex*/ ctx[7] <= 0;
    			attr(button5, "class", "btn btn-primary svelte-10vkr3u");
    			button5.disabled = button5_disabled_value = /*$curVerseIndex*/ ctx[7] >= /*curVerses*/ ctx[6].length - 1;
    			attr(div4, "class", "bottom-buttons btn-group svelte-10vkr3u");
    		},
    		m(target, anchor, remount) {
    			insert(target, p, anchor);
    			append(p, t0);
    			append(p, select);
    			append(select, option0);
    			append(select, option1);
    			select_option(select, /*$bodyclass*/ ctx[9]);
    			insert(target, t3, anchor);
    			insert(target, div0, anchor);
    			append(div0, input);
    			set_input_value(input, /*songFilter*/ ctx[0]);
    			append(div0, t4);
    			append(div0, button0);
    			insert(target, t6, anchor);
    			insert(target, div1, anchor);

    			for (let i = 0; i < each_blocks_2.length; i += 1) {
    				each_blocks_2[i].m(div1, null);
    			}

    			insert(target, t7, anchor);
    			insert(target, div2, anchor);
    			append(div2, t8);

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].m(div2, null);
    			}

    			insert(target, t9, anchor);
    			insert(target, div3, anchor);
    			append(div3, t10);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div3, null);
    			}

    			insert(target, t11, anchor);
    			insert(target, div4, anchor);
    			append(div4, button1);
    			append(button1, t12);
    			append(div4, t13);
    			append(div4, button2);
    			append(button2, t14);
    			append(div4, t15);
    			append(div4, button3);
    			if_block.m(button3, null);
    			append(div4, t16);
    			append(div4, button4);
    			append(button4, t17);
    			append(div4, t18);
    			append(div4, button5);
    			append(button5, t19);
    			if (remount) run_all(dispose);

    			dispose = [
    				listen(select, "change", /*select_change_handler*/ ctx[25]),
    				listen(input, "input", /*input_input_handler*/ ctx[26]),
    				listen(input, "focus", /*focus_handler*/ ctx[27]),
    				listen(button0, "click", /*click_handler*/ ctx[28]),
    				listen(button1, "click", /*click_handler_2*/ ctx[30]),
    				listen(button2, "click", /*click_handler_3*/ ctx[31]),
    				listen(button3, "click", /*toggleShow*/ ctx[18]),
    				listen(button4, "click", /*click_handler_4*/ ctx[32]),
    				listen(button5, "click", /*click_handler_5*/ ctx[33])
    			];
    		},
    		p(ctx, dirty) {
    			if (dirty[0] & /*$bodyclass*/ 512) {
    				select_option(select, /*$bodyclass*/ ctx[9]);
    			}

    			if (dirty[0] & /*songFilter*/ 1 && input.value !== /*songFilter*/ ctx[0]) {
    				set_input_value(input, /*songFilter*/ ctx[0]);
    			}

    			if (dirty[0] & /*filteredSongs, curSong, addToPlaylist, filterFocused*/ 16422) {
    				each_value_2 = /*filteredSongs*/ ctx[1];
    				let i;

    				for (i = 0; i < each_value_2.length; i += 1) {
    					const child_ctx = get_each_context_2(ctx, each_value_2, i);

    					if (each_blocks_2[i]) {
    						each_blocks_2[i].p(child_ctx, dirty);
    					} else {
    						each_blocks_2[i] = create_each_block_2(child_ctx);
    						each_blocks_2[i].c();
    						each_blocks_2[i].m(div1, null);
    					}
    				}

    				for (; i < each_blocks_2.length; i += 1) {
    					each_blocks_2[i].d(1);
    				}

    				each_blocks_2.length = each_value_2.length;
    			}

    			if (dirty[0] & /*filterFocused*/ 4) {
    				toggle_class(div1, "show", /*filterFocused*/ ctx[2]);
    			}

    			if (dirty[0] & /*playlistRemover, $curSongIndex, songSelector, playlist*/ 98576) {
    				each_value_1 = /*playlist*/ ctx[4];
    				let i;

    				for (i = 0; i < each_value_1.length; i += 1) {
    					const child_ctx = get_each_context_1(ctx, each_value_1, i);

    					if (each_blocks_1[i]) {
    						each_blocks_1[i].p(child_ctx, dirty);
    					} else {
    						each_blocks_1[i] = create_each_block_1(child_ctx);
    						each_blocks_1[i].c();
    						each_blocks_1[i].m(div2, null);
    					}
    				}

    				for (; i < each_blocks_1.length; i += 1) {
    					each_blocks_1[i].d(1);
    				}

    				each_blocks_1.length = each_value_1.length;
    			}

    			if (dirty[0] & /*$curVerseIndex, verseSelector, curVerses*/ 131264) {
    				each_value = /*curVerses*/ ctx[6];
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div3, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}

    			if (dirty[0] & /*$curSongIndex*/ 256 && button1_disabled_value !== (button1_disabled_value = /*$curSongIndex*/ ctx[8] <= 0)) {
    				button1.disabled = button1_disabled_value;
    			}

    			if (dirty[0] & /*$curSongIndex, playlist*/ 272 && button2_disabled_value !== (button2_disabled_value = /*$curSongIndex*/ ctx[8] >= /*playlist*/ ctx[4].length - 1)) {
    				button2.disabled = button2_disabled_value;
    			}

    			if (current_block_type !== (current_block_type = select_block_type(ctx))) {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(button3, null);
    				}
    			}

    			if (dirty[0] & /*shown*/ 8) {
    				toggle_class(button3, "btn-danger", /*shown*/ ctx[3]);
    			}

    			if (dirty[0] & /*shown*/ 8) {
    				toggle_class(button3, "btn-success", !/*shown*/ ctx[3]);
    			}

    			if (dirty[0] & /*$curVerseIndex*/ 128 && button4_disabled_value !== (button4_disabled_value = /*$curVerseIndex*/ ctx[7] <= 0)) {
    				button4.disabled = button4_disabled_value;
    			}

    			if (dirty[0] & /*$curVerseIndex, curVerses*/ 192 && button5_disabled_value !== (button5_disabled_value = /*$curVerseIndex*/ ctx[7] >= /*curVerses*/ ctx[6].length - 1)) {
    				button5.disabled = button5_disabled_value;
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(p);
    			if (detaching) detach(t3);
    			if (detaching) detach(div0);
    			if (detaching) detach(t6);
    			if (detaching) detach(div1);
    			destroy_each(each_blocks_2, detaching);
    			if (detaching) detach(t7);
    			if (detaching) detach(div2);
    			destroy_each(each_blocks_1, detaching);
    			if (detaching) detach(t9);
    			if (detaching) detach(div3);
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach(t11);
    			if (detaching) detach(div4);
    			if_block.d();
    			run_all(dispose);
    		}
    	};
    }

    function getSongVerses(song) {
    	let verses = [];

    	song && song.order.split(" ").forEach(id => {
    		if (song.verses[id]) {
    			verses.push(song.verses[id]);
    		}
    	});

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
    	GUN_SUPER_PEERS = GUN_SUPER_PEERS || ["http://127.0.0.1/gun"];
    	let gun = Gun(GUN_SUPER_PEERS);
    	let overlay = gun.get("songs").get(window.location.hash || "demo");

    	/* Synced variables */
    	let shown = writableGun(overlay.get("show"), false);

    	let line1 = writableGun(overlay.get("line1"), "");
    	component_subscribe($$self, line1, value => $$invalidate(19, $line1 = value));
    	let bodyclass = writableGun(overlay.get("bodyclass"), "");
    	component_subscribe($$self, bodyclass, value => $$invalidate(9, $bodyclass = value));
    	let curSongIndex = writableGun(overlay.get("curSongIndex"), 0);
    	component_subscribe($$self, curSongIndex, value => $$invalidate(8, $curSongIndex = value));
    	let curVerseIndex = writableGun(overlay.get("curVerseIndex"), 0);
    	component_subscribe($$self, curVerseIndex, value => $$invalidate(7, $curVerseIndex = value));
    	let playlist = [songs[0]];
    	let curSong = playlist[0];
    	let curVerses = curSong.verses || [];

    	function matchesSong(song) {
    		const prefix = songFilter.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    		const nameLower = song.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    		return nameLower.startsWith(prefix) || prefix.length >= 2 && nameLower.includes(" " + prefix);
    	}

    	function addToPlaylist(song) {
    		playlist.push(song);
    		$$invalidate(4, playlist);
    	}

    	function playlistRemover(songIndex) {
    		return function () {
    			$$invalidate(4, playlist = playlist.filter((h, j) => songIndex !== j));
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

    	function toggleShow() {
    		$$invalidate(3, shown = !shown);
    		overlay.get("show").put(shown);
    	}

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

    	const click_handler_2 = function () {
    		set_store_value(curSongIndex, $curSongIndex -= 1);
    	};

    	const click_handler_3 = function () {
    		set_store_value(curSongIndex, $curSongIndex += 1);
    	};

    	const click_handler_4 = function () {
    		set_store_value(curVerseIndex, $curVerseIndex -= 1);
    		scrollToVerse($curVerseIndex);
    	};

    	const click_handler_5 = function () {
    		set_store_value(curVerseIndex, $curVerseIndex += 1);
    		scrollToVerse($curVerseIndex);
    	};

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty[0] & /*playlist, $curSongIndex*/ 272) {
    			 $$invalidate(5, curSong = playlist[$curSongIndex || 0]);
    		}

    		if ($$self.$$.dirty[0] & /*curSong*/ 32) {
    			 $$invalidate(6, curVerses = getSongVerses(curSong));
    		}

    		if ($$self.$$.dirty[0] & /*curVerses, $curVerseIndex*/ 192) {
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
    		shown,
    		playlist,
    		curSong,
    		curVerses,
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
    		click_handler_3,
    		click_handler_4,
    		click_handler_5
    	];
    }

    class App extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance, create_fragment, safe_not_equal, {}, [-1, -1]);
    	}
    }

    var app = new App({
    	target: document.body
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
