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
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
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
    function set_data(text, data) {
        data = '' + data;
        if (text.wholeText !== data)
            text.data = data;
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

    /* src/App.svelte generated by Svelte v3.24.1 */

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[68] = list[i];
    	child_ctx[72] = i;
    	return child_ctx;
    }

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[67] = list[i][0];
    	child_ctx[68] = list[i][1];
    	child_ctx[69] = list;
    	child_ctx[70] = i;
    	return child_ctx;
    }

    function get_each_context_2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[73] = list[i];
    	child_ctx[72] = i;
    	return child_ctx;
    }

    function get_each_context_3(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[73] = list[i];
    	return child_ctx;
    }

    // (473:2) {#each songsFiltered as song}
    function create_each_block_3(ctx) {
    	let div;
    	let button0;
    	let t0_value = /*song*/ ctx[73].title + "";
    	let t0;
    	let t1;
    	let button1;
    	let t3;
    	let button2;
    	let t5;
    	let button3;
    	let t7;
    	let mounted;
    	let dispose;

    	function click_handler_3(...args) {
    		return /*click_handler_3*/ ctx[35](/*song*/ ctx[73], ...args);
    	}

    	function click_handler_4(...args) {
    		return /*click_handler_4*/ ctx[36](/*song*/ ctx[73], ...args);
    	}

    	function click_handler_5(...args) {
    		return /*click_handler_5*/ ctx[37](/*song*/ ctx[73], ...args);
    	}

    	function click_handler_6(...args) {
    		return /*click_handler_6*/ ctx[38](/*song*/ ctx[73], ...args);
    	}

    	return {
    		c() {
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
    			attr(button0, "class", "song-set btn svelte-kw30b8");
    			toggle_class(button0, "btn-primary", /*song*/ ctx[73] == /*curSong*/ ctx[7]);
    			attr(button1, "class", "song-add btn btn-success svelte-kw30b8");
    			attr(button2, "class", "song-edit btn btn-secondary svelte-kw30b8");
    			attr(button3, "class", "song-remove btn btn-secondary svelte-kw30b8");
    			attr(div, "class", "song-item btn-group svelte-kw30b8");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			append(div, button0);
    			append(button0, t0);
    			append(div, t1);
    			append(div, button1);
    			append(div, t3);
    			append(div, button2);
    			append(div, t5);
    			append(div, button3);
    			append(div, t7);

    			if (!mounted) {
    				dispose = [
    					listen(button0, "click", click_handler_3),
    					listen(button1, "click", click_handler_4),
    					listen(button2, "click", click_handler_5),
    					listen(button3, "click", click_handler_6)
    				];

    				mounted = true;
    			}
    		},
    		p(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty[0] & /*songsFiltered*/ 2 && t0_value !== (t0_value = /*song*/ ctx[73].title + "")) set_data(t0, t0_value);

    			if (dirty[0] & /*songsFiltered, curSong*/ 130) {
    				toggle_class(button0, "btn-primary", /*song*/ ctx[73] == /*curSong*/ ctx[7]);
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    // (496:4) {:else}
    function create_else_block_3(ctx) {
    	let t;

    	return {
    		c() {
    			t = text("Playlist je prázdny, pridajte piesne z filtra.");
    		},
    		m(target, anchor) {
    			insert(target, t, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    // (488:4) {#each playlist as song, i}
    function create_each_block_2(ctx) {
    	let div;
    	let button0;
    	let t0_value = /*song*/ ctx[73].title + "";
    	let t0;
    	let t1;
    	let button1;
    	let t3;
    	let mounted;
    	let dispose;

    	function click_handler_7(...args) {
    		return /*click_handler_7*/ ctx[39](/*i*/ ctx[72], ...args);
    	}

    	function click_handler_8(...args) {
    		return /*click_handler_8*/ ctx[40](/*i*/ ctx[72], ...args);
    	}

    	return {
    		c() {
    			div = element("div");
    			button0 = element("button");
    			t0 = text(t0_value);
    			t1 = space();
    			button1 = element("button");
    			button1.textContent = "×";
    			t3 = space();
    			attr(button0, "class", "song-set btn svelte-kw30b8");
    			toggle_class(button0, "btn-primary", /*$curSongIndex*/ ctx[12] == /*i*/ ctx[72]);
    			attr(button1, "class", "song-remove btn btn-secondary svelte-kw30b8");
    			attr(div, "class", "song-item btn-group svelte-kw30b8");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			append(div, button0);
    			append(button0, t0);
    			append(div, t1);
    			append(div, button1);
    			append(div, t3);

    			if (!mounted) {
    				dispose = [
    					listen(button0, "click", click_handler_7),
    					listen(button1, "click", click_handler_8)
    				];

    				mounted = true;
    			}
    		},
    		p(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty[0] & /*playlist*/ 64 && t0_value !== (t0_value = /*song*/ ctx[73].title + "")) set_data(t0, t0_value);

    			if (dirty[0] & /*$curSongIndex*/ 4096) {
    				toggle_class(button0, "btn-primary", /*$curSongIndex*/ ctx[12] == /*i*/ ctx[72]);
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    // (505:8) {#if editing}
    function create_if_block_4(ctx) {
    	let t;

    	return {
    		c() {
    			t = text("Uložiť");
    		},
    		m(target, anchor) {
    			insert(target, t, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    // (514:4) {:else}
    function create_else_block_2(ctx) {
    	let span;
    	let t_value = /*curSong*/ ctx[7].title + "";
    	let t;

    	return {
    		c() {
    			span = element("span");
    			t = text(t_value);
    		},
    		m(target, anchor) {
    			insert(target, span, anchor);
    			append(span, t);
    		},
    		p(ctx, dirty) {
    			if (dirty[0] & /*curSong*/ 128 && t_value !== (t_value = /*curSong*/ ctx[7].title + "")) set_data(t, t_value);
    		},
    		d(detaching) {
    			if (detaching) detach(span);
    		}
    	};
    }

    // (508:4) {#if editing}
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
    	let mounted;
    	let dispose;

    	return {
    		c() {
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
    			attr(button0, "class", "song-cancel btn btn-secondary");
    			attr(button1, "class", "song-remove btn btn-danger");
    			attr(input0, "class", "form-control");
    			attr(input0, "type", "text");
    			attr(input0, "placeholder", "title");
    			attr(input1, "class", "form-control");
    			attr(input1, "type", "text");
    			attr(input1, "placeholder", "author");
    			attr(input2, "class", "form-control");
    			attr(input2, "type", "text");
    			attr(input2, "placeholder", "order");
    		},
    		m(target, anchor) {
    			insert(target, button0, anchor);
    			insert(target, t1, anchor);
    			insert(target, button1, anchor);
    			insert(target, t3, anchor);
    			insert(target, input0, anchor);
    			set_input_value(input0, /*editingSong*/ ctx[5].title);
    			insert(target, t4, anchor);
    			insert(target, input1, anchor);
    			set_input_value(input1, /*editingSong*/ ctx[5].author);
    			insert(target, t5, anchor);
    			insert(target, input2, anchor);
    			set_input_value(input2, /*editingSong*/ ctx[5].order);

    			if (!mounted) {
    				dispose = [
    					listen(button0, "click", /*click_handler_10*/ ctx[42]),
    					listen(button1, "click", /*click_handler_11*/ ctx[43]),
    					listen(input0, "input", /*input0_input_handler_1*/ ctx[44]),
    					listen(input1, "input", /*input1_input_handler*/ ctx[45]),
    					listen(input2, "input", /*input2_input_handler*/ ctx[46])
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, dirty) {
    			if (dirty[0] & /*editingSong*/ 32 && input0.value !== /*editingSong*/ ctx[5].title) {
    				set_input_value(input0, /*editingSong*/ ctx[5].title);
    			}

    			if (dirty[0] & /*editingSong*/ 32 && input1.value !== /*editingSong*/ ctx[5].author) {
    				set_input_value(input1, /*editingSong*/ ctx[5].author);
    			}

    			if (dirty[0] & /*editingSong*/ 32 && input2.value !== /*editingSong*/ ctx[5].order) {
    				set_input_value(input2, /*editingSong*/ ctx[5].order);
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(button0);
    			if (detaching) detach(t1);
    			if (detaching) detach(button1);
    			if (detaching) detach(t3);
    			if (detaching) detach(input0);
    			if (detaching) detach(t4);
    			if (detaching) detach(input1);
    			if (detaching) detach(t5);
    			if (detaching) detach(input2);
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    // (525:4) {:else}
    function create_else_block_1(ctx) {
    	let each_1_anchor;
    	let each_value_1 = /*curVerses*/ ctx[8];
    	let each_blocks = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
    	}

    	return {
    		c() {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty();
    		},
    		m(target, anchor) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert(target, each_1_anchor, anchor);
    		},
    		p(ctx, dirty) {
    			if (dirty[0] & /*$curVerseIndex, curVerses*/ 2304) {
    				each_value_1 = /*curVerses*/ ctx[8];
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
    		d(detaching) {
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach(each_1_anchor);
    		}
    	};
    }

    // (519:4) {#if editing}
    function create_if_block_2(ctx) {
    	let each_1_anchor;
    	let each_value = Object.entries(/*editingSong*/ ctx[5].verses || {}).filter(func);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	return {
    		c() {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty();
    		},
    		m(target, anchor) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert(target, each_1_anchor, anchor);
    		},
    		p(ctx, dirty) {
    			if (dirty[0] & /*editingSong, removeVerse*/ 33554464) {
    				each_value = Object.entries(/*editingSong*/ ctx[5].verses || {}).filter(func);
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
    		d(detaching) {
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach(each_1_anchor);
    		}
    	};
    }

    // (526:6) {#each curVerses as verse, i}
    function create_each_block_1(ctx) {
    	let p;
    	let t0_value = /*verse*/ ctx[68] + "";
    	let t0;
    	let t1;
    	let mounted;
    	let dispose;

    	function click_handler_13(...args) {
    		return /*click_handler_13*/ ctx[49](/*i*/ ctx[72], ...args);
    	}

    	return {
    		c() {
    			p = element("p");
    			t0 = text(t0_value);
    			t1 = space();
    			attr(p, "class", "verse-item svelte-kw30b8");
    			toggle_class(p, "active", /*$curVerseIndex*/ ctx[11] == /*i*/ ctx[72]);
    		},
    		m(target, anchor) {
    			insert(target, p, anchor);
    			append(p, t0);
    			append(p, t1);

    			if (!mounted) {
    				dispose = listen(p, "click", click_handler_13);
    				mounted = true;
    			}
    		},
    		p(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty[0] & /*curVerses*/ 256 && t0_value !== (t0_value = /*verse*/ ctx[68] + "")) set_data(t0, t0_value);

    			if (dirty[0] & /*$curVerseIndex*/ 2048) {
    				toggle_class(p, "active", /*$curVerseIndex*/ ctx[11] == /*i*/ ctx[72]);
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(p);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    // (520:6) {#each Object.entries(editingSong.verses||{}).filter(e=>typeof e[1] != 'object' && e[1] != null) as [id, verse]}
    function create_each_block(ctx) {
    	let button;
    	let t1;
    	let span;
    	let t2_value = /*id*/ ctx[67] + "";
    	let t2;
    	let t3;
    	let p;
    	let mounted;
    	let dispose;

    	function click_handler_12(...args) {
    		return /*click_handler_12*/ ctx[47](/*id*/ ctx[67], ...args);
    	}

    	function p_input_handler() {
    		/*p_input_handler*/ ctx[48].call(p, /*id*/ ctx[67]);
    	}

    	return {
    		c() {
    			button = element("button");
    			button.textContent = "×";
    			t1 = space();
    			span = element("span");
    			t2 = text(t2_value);
    			t3 = space();
    			p = element("p");
    			attr(button, "class", "verse-remove btn btn-secondary svelte-kw30b8");
    			attr(span, "class", "verse-id svelte-kw30b8");
    			attr(p, "class", "verse-item svelte-kw30b8");
    			attr(p, "contenteditable", "true");
    			if (/*editingSong*/ ctx[5].verses[/*id*/ ctx[67]] === void 0) add_render_callback(p_input_handler);
    		},
    		m(target, anchor) {
    			insert(target, button, anchor);
    			insert(target, t1, anchor);
    			insert(target, span, anchor);
    			append(span, t2);
    			insert(target, t3, anchor);
    			insert(target, p, anchor);

    			if (/*editingSong*/ ctx[5].verses[/*id*/ ctx[67]] !== void 0) {
    				p.innerHTML = /*editingSong*/ ctx[5].verses[/*id*/ ctx[67]];
    			}

    			if (!mounted) {
    				dispose = [
    					listen(button, "click", click_handler_12),
    					listen(p, "input", p_input_handler)
    				];

    				mounted = true;
    			}
    		},
    		p(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty[0] & /*editingSong*/ 32 && t2_value !== (t2_value = /*id*/ ctx[67] + "")) set_data(t2, t2_value);

    			if (dirty[0] & /*editingSong*/ 32 && /*editingSong*/ ctx[5].verses[/*id*/ ctx[67]] !== p.innerHTML) {
    				p.innerHTML = /*editingSong*/ ctx[5].verses[/*id*/ ctx[67]];
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(button);
    			if (detaching) detach(t1);
    			if (detaching) detach(span);
    			if (detaching) detach(t3);
    			if (detaching) detach(p);
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    // (532:4) {#if editing}
    function create_if_block_1(ctx) {
    	let button;
    	let t1;
    	let input;
    	let t2;
    	let p;
    	let mounted;
    	let dispose;

    	return {
    		c() {
    			button = element("button");
    			button.textContent = "+";
    			t1 = space();
    			input = element("input");
    			t2 = space();
    			p = element("p");
    			attr(button, "class", "verse-add btn btn-success svelte-kw30b8");
    			attr(button, "title", "Pridať nový verš");
    			attr(input, "class", "form-control verse-new-id svelte-kw30b8");
    			attr(input, "type", "text");
    			attr(input, "placeholder", "id");
    			attr(p, "class", "verse-new-item svelte-kw30b8");
    			attr(p, "contenteditable", "true");
    			if (/*newVerse*/ ctx[10] === void 0) add_render_callback(() => /*p_input_handler_1*/ ctx[51].call(p));
    		},
    		m(target, anchor) {
    			insert(target, button, anchor);
    			insert(target, t1, anchor);
    			insert(target, input, anchor);
    			set_input_value(input, /*newId*/ ctx[9]);
    			insert(target, t2, anchor);
    			insert(target, p, anchor);

    			if (/*newVerse*/ ctx[10] !== void 0) {
    				p.innerHTML = /*newVerse*/ ctx[10];
    			}

    			if (!mounted) {
    				dispose = [
    					listen(button, "click", /*addNewVerse*/ ctx[26]),
    					listen(input, "input", /*input_input_handler*/ ctx[50]),
    					listen(p, "input", /*p_input_handler_1*/ ctx[51])
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, dirty) {
    			if (dirty[0] & /*newId*/ 512 && input.value !== /*newId*/ ctx[9]) {
    				set_input_value(input, /*newId*/ ctx[9]);
    			}

    			if (dirty[0] & /*newVerse*/ 1024 && /*newVerse*/ ctx[10] !== p.innerHTML) {
    				p.innerHTML = /*newVerse*/ ctx[10];
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(button);
    			if (detaching) detach(t1);
    			if (detaching) detach(input);
    			if (detaching) detach(t2);
    			if (detaching) detach(p);
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    // (549:20) {:else}
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

    // (549:4) {#if $show}
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
    	let div0;
    	let input0;
    	let t0;
    	let button0;
    	let t2;
    	let button1;
    	let t4;
    	let div1;
    	let p0;
    	let t5;
    	let select;
    	let option0;
    	let option1;
    	let t8;
    	let p1;
    	let t9;
    	let input1;
    	let t10;
    	let p2;
    	let t24;
    	let div2;
    	let t25;
    	let div6;
    	let div3;
    	let t26;
    	let div4;
    	let button2;
    	let t27;
    	let t28;
    	let button3;
    	let t30;
    	let t31;
    	let div5;
    	let t32;
    	let t33;
    	let div7;
    	let button4;
    	let t34;
    	let button4_disabled_value;
    	let t35;
    	let button5;
    	let t36;
    	let button5_disabled_value;
    	let t37;
    	let button6;
    	let t38;
    	let button7;
    	let t39;
    	let button7_disabled_value;
    	let t40;
    	let button8;
    	let t41;
    	let button8_disabled_value;
    	let mounted;
    	let dispose;
    	let each_value_3 = /*songsFiltered*/ ctx[1];
    	let each_blocks_1 = [];

    	for (let i = 0; i < each_value_3.length; i += 1) {
    		each_blocks_1[i] = create_each_block_3(get_each_context_3(ctx, each_value_3, i));
    	}

    	let each_value_2 = /*playlist*/ ctx[6];
    	let each_blocks = [];

    	for (let i = 0; i < each_value_2.length; i += 1) {
    		each_blocks[i] = create_each_block_2(get_each_context_2(ctx, each_value_2, i));
    	}

    	let each1_else = null;

    	if (!each_value_2.length) {
    		each1_else = create_else_block_3();
    	}

    	let if_block0 = /*editing*/ ctx[4] && create_if_block_4();

    	function select_block_type(ctx, dirty) {
    		if (/*editing*/ ctx[4]) return create_if_block_3;
    		return create_else_block_2;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block1 = current_block_type(ctx);

    	function select_block_type_1(ctx, dirty) {
    		if (/*editing*/ ctx[4]) return create_if_block_2;
    		return create_else_block_1;
    	}

    	let current_block_type_1 = select_block_type_1(ctx);
    	let if_block2 = current_block_type_1(ctx);
    	let if_block3 = /*editing*/ ctx[4] && create_if_block_1(ctx);

    	function select_block_type_2(ctx, dirty) {
    		if (/*$show*/ ctx[13]) return create_if_block;
    		return create_else_block;
    	}

    	let current_block_type_2 = select_block_type_2(ctx);
    	let if_block4 = current_block_type_2(ctx);

    	return {
    		c() {
    			div0 = element("div");
    			input0 = element("input");
    			t0 = space();
    			button0 = element("button");
    			button0.textContent = "×";
    			t2 = space();
    			button1 = element("button");
    			button1.textContent = "⚙";
    			t4 = space();
    			div1 = element("div");
    			p0 = element("p");
    			t5 = text("Téma:\n    ");
    			select = element("select");
    			option0 = element("option");
    			option0.textContent = "Predvolené";
    			option1 = element("option");
    			option1.textContent = "Jednoduché s tieňom";
    			t8 = space();
    			p1 = element("p");
    			t9 = text("Import piesní vo formáte OpenLyrics (z OpenLP):\n    ");
    			input1 = element("input");
    			t10 = space();
    			p2 = element("p");

    			p2.innerHTML = `<strong>Klávesové skratky:</strong><br> 
    <strong>Šípky Hore - Dole:</strong>
    prepínanie medzi verša aktuálnej piesne.<br> 
    <strong>Šípky Vľavo - Vpravo:</strong>
    prepínanie medzi piesňami v playliste.<br> 
    <strong>Enter:</strong>
    Zobraziť/Skryť verš<br> 
    <strong>Ctrl+Enter:</strong>
    Pri úprave piesne vloží nový verš.<br>`;

    			t24 = space();
    			div2 = element("div");

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].c();
    			}

    			t25 = space();
    			div6 = element("div");
    			div3 = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			if (each1_else) {
    				each1_else.c();
    			}

    			t26 = space();
    			div4 = element("div");
    			button2 = element("button");
    			t27 = text("✎");
    			if (if_block0) if_block0.c();
    			t28 = space();
    			button3 = element("button");
    			button3.textContent = "+";
    			t30 = space();
    			if_block1.c();
    			t31 = space();
    			div5 = element("div");
    			if_block2.c();
    			t32 = space();
    			if (if_block3) if_block3.c();
    			t33 = space();
    			div7 = element("div");
    			button4 = element("button");
    			t34 = text("← Pieseň");
    			t35 = space();
    			button5 = element("button");
    			t36 = text("Pieseň →");
    			t37 = space();
    			button6 = element("button");
    			if_block4.c();
    			t38 = space();
    			button7 = element("button");
    			t39 = text("↑ Verš");
    			t40 = space();
    			button8 = element("button");
    			t41 = text("Verš ↓");
    			attr(input0, "class", "form-control");
    			attr(input0, "type", "text");
    			attr(input0, "placeholder", "filter piesní");
    			attr(button0, "type", "button");
    			attr(button0, "class", "form-control btn btn-secondary");
    			set_style(button0, "max-width", "2rem");
    			set_style(button0, "padding", ".25rem");
    			attr(button0, "title", "Zrušiť filter");
    			attr(button1, "type", "button");
    			attr(button1, "class", "form-control btn btn-secondary");
    			set_style(button1, "max-width", "2rem");
    			set_style(button1, "padding", ".25rem");
    			attr(button1, "title", "Nastavenia");
    			attr(div0, "class", "input-group");
    			set_style(div0, "width", "100%");
    			set_style(div0, "display", "flex");
    			option0.__value = "";
    			option0.value = option0.__value;
    			option0.selected = true;
    			option1.__value = "simple-with-shadow";
    			option1.value = option1.__value;
    			if (/*$bodyclass*/ ctx[14] === void 0) add_render_callback(() => /*select_change_handler*/ ctx[34].call(select));
    			attr(input1, "id", "songsUpload");
    			attr(input1, "type", "file");
    			attr(input1, "name", "files");
    			input1.multiple = true;
    			attr(div1, "class", "settings svelte-kw30b8");
    			toggle_class(div1, "show", /*settingsOpen*/ ctx[3]);
    			attr(div2, "class", "songs-filter svelte-kw30b8");
    			toggle_class(div2, "show", /*filterOpen*/ ctx[2]);
    			attr(div3, "class", "playlist svelte-kw30b8");
    			attr(button2, "class", "song-edit btn");
    			attr(button2, "title", "Upraviť");
    			toggle_class(button2, "btn-success", /*editing*/ ctx[4]);
    			attr(button3, "class", "song-create btn svelte-kw30b8");
    			attr(button3, "title", "Vytvoriť novú pieseň");
    			attr(div4, "class", "info-bar svelte-kw30b8");
    			attr(div5, "class", "verses svelte-kw30b8");
    			attr(div6, "class", "songs-control svelte-kw30b8");
    			toggle_class(div6, "show", !/*filterOpen*/ ctx[2] && !/*settingsOpen*/ ctx[3]);
    			attr(button4, "class", "btn btn-primary svelte-kw30b8");
    			button4.disabled = button4_disabled_value = /*$curSongIndex*/ ctx[12] <= 0;
    			attr(button5, "class", "btn btn-primary svelte-kw30b8");
    			button5.disabled = button5_disabled_value = /*$curSongIndex*/ ctx[12] >= /*playlist*/ ctx[6].length - 1;
    			attr(button6, "class", "control-button btn svelte-kw30b8");
    			toggle_class(button6, "btn-danger", /*$show*/ ctx[13]);
    			toggle_class(button6, "btn-success", !/*$show*/ ctx[13]);
    			attr(button7, "class", "btn btn-primary svelte-kw30b8");
    			button7.disabled = button7_disabled_value = /*$curVerseIndex*/ ctx[11] <= 0;
    			attr(button8, "class", "btn btn-primary svelte-kw30b8");
    			button8.disabled = button8_disabled_value = /*$curVerseIndex*/ ctx[11] >= /*curVerses*/ ctx[8].length - 1;
    			attr(div7, "class", "bottom-buttons btn-group svelte-kw30b8");
    		},
    		m(target, anchor) {
    			insert(target, div0, anchor);
    			append(div0, input0);
    			set_input_value(input0, /*songFilter*/ ctx[0]);
    			append(div0, t0);
    			append(div0, button0);
    			append(div0, t2);
    			append(div0, button1);
    			insert(target, t4, anchor);
    			insert(target, div1, anchor);
    			append(div1, p0);
    			append(p0, t5);
    			append(p0, select);
    			append(select, option0);
    			append(select, option1);
    			select_option(select, /*$bodyclass*/ ctx[14]);
    			append(div1, t8);
    			append(div1, p1);
    			append(p1, t9);
    			append(p1, input1);
    			append(div1, t10);
    			append(div1, p2);
    			insert(target, t24, anchor);
    			insert(target, div2, anchor);

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].m(div2, null);
    			}

    			insert(target, t25, anchor);
    			insert(target, div6, anchor);
    			append(div6, div3);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div3, null);
    			}

    			if (each1_else) {
    				each1_else.m(div3, null);
    			}

    			append(div6, t26);
    			append(div6, div4);
    			append(div4, button2);
    			append(button2, t27);
    			if (if_block0) if_block0.m(button2, null);
    			append(div4, t28);
    			append(div4, button3);
    			append(div4, t30);
    			if_block1.m(div4, null);
    			append(div6, t31);
    			append(div6, div5);
    			if_block2.m(div5, null);
    			append(div5, t32);
    			if (if_block3) if_block3.m(div5, null);
    			insert(target, t33, anchor);
    			insert(target, div7, anchor);
    			append(div7, button4);
    			append(button4, t34);
    			append(div7, t35);
    			append(div7, button5);
    			append(button5, t36);
    			append(div7, t37);
    			append(div7, button6);
    			if_block4.m(button6, null);
    			append(div7, t38);
    			append(div7, button7);
    			append(button7, t39);
    			append(div7, t40);
    			append(div7, button8);
    			append(button8, t41);

    			if (!mounted) {
    				dispose = [
    					listen(input0, "input", /*input0_input_handler*/ ctx[29]),
    					listen(input0, "input", /*input_handler*/ ctx[30]),
    					listen(input0, "click", /*click_handler*/ ctx[31]),
    					listen(button0, "click", /*click_handler_1*/ ctx[32]),
    					listen(button1, "click", /*click_handler_2*/ ctx[33]),
    					listen(select, "change", /*select_change_handler*/ ctx[34]),
    					listen(input1, "change", /*importSongs*/ ctx[28]),
    					listen(button2, "click", /*click_handler_9*/ ctx[41]),
    					listen(button3, "click", /*addNewSong*/ ctx[22]),
    					listen(button4, "click", /*click_handler_14*/ ctx[52]),
    					listen(button5, "click", /*click_handler_15*/ ctx[53]),
    					listen(button6, "click", /*toggleShow*/ ctx[27]),
    					listen(button7, "click", /*click_handler_16*/ ctx[54]),
    					listen(button8, "click", /*click_handler_17*/ ctx[55])
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, dirty) {
    			if (dirty[0] & /*songFilter*/ 1 && input0.value !== /*songFilter*/ ctx[0]) {
    				set_input_value(input0, /*songFilter*/ ctx[0]);
    			}

    			if (dirty[0] & /*$bodyclass*/ 16384) {
    				select_option(select, /*$bodyclass*/ ctx[14]);
    			}

    			if (dirty[0] & /*settingsOpen*/ 8) {
    				toggle_class(div1, "show", /*settingsOpen*/ ctx[3]);
    			}

    			if (dirty[0] & /*removeSong, songsFiltered, toggleEdit, filterOpen, addToPlaylist, curSong*/ 26214534) {
    				each_value_3 = /*songsFiltered*/ ctx[1];
    				let i;

    				for (i = 0; i < each_value_3.length; i += 1) {
    					const child_ctx = get_each_context_3(ctx, each_value_3, i);

    					if (each_blocks_1[i]) {
    						each_blocks_1[i].p(child_ctx, dirty);
    					} else {
    						each_blocks_1[i] = create_each_block_3(child_ctx);
    						each_blocks_1[i].c();
    						each_blocks_1[i].m(div2, null);
    					}
    				}

    				for (; i < each_blocks_1.length; i += 1) {
    					each_blocks_1[i].d(1);
    				}

    				each_blocks_1.length = each_value_3.length;
    			}

    			if (dirty[0] & /*filterOpen*/ 4) {
    				toggle_class(div2, "show", /*filterOpen*/ ctx[2]);
    			}

    			if (dirty[0] & /*removePlaylistItem, $curSongIndex, playlist*/ 2101312) {
    				each_value_2 = /*playlist*/ ctx[6];
    				let i;

    				for (i = 0; i < each_value_2.length; i += 1) {
    					const child_ctx = get_each_context_2(ctx, each_value_2, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block_2(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div3, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value_2.length;

    				if (each_value_2.length) {
    					if (each1_else) {
    						each1_else.d(1);
    						each1_else = null;
    					}
    				} else if (!each1_else) {
    					each1_else = create_else_block_3();
    					each1_else.c();
    					each1_else.m(div3, null);
    				}
    			}

    			if (/*editing*/ ctx[4]) {
    				if (if_block0) ; else {
    					if_block0 = create_if_block_4();
    					if_block0.c();
    					if_block0.m(button2, null);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (dirty[0] & /*editing*/ 16) {
    				toggle_class(button2, "btn-success", /*editing*/ ctx[4]);
    			}

    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block1) {
    				if_block1.p(ctx, dirty);
    			} else {
    				if_block1.d(1);
    				if_block1 = current_block_type(ctx);

    				if (if_block1) {
    					if_block1.c();
    					if_block1.m(div4, null);
    				}
    			}

    			if (current_block_type_1 === (current_block_type_1 = select_block_type_1(ctx)) && if_block2) {
    				if_block2.p(ctx, dirty);
    			} else {
    				if_block2.d(1);
    				if_block2 = current_block_type_1(ctx);

    				if (if_block2) {
    					if_block2.c();
    					if_block2.m(div5, t32);
    				}
    			}

    			if (/*editing*/ ctx[4]) {
    				if (if_block3) {
    					if_block3.p(ctx, dirty);
    				} else {
    					if_block3 = create_if_block_1(ctx);
    					if_block3.c();
    					if_block3.m(div5, null);
    				}
    			} else if (if_block3) {
    				if_block3.d(1);
    				if_block3 = null;
    			}

    			if (dirty[0] & /*filterOpen, settingsOpen*/ 12) {
    				toggle_class(div6, "show", !/*filterOpen*/ ctx[2] && !/*settingsOpen*/ ctx[3]);
    			}

    			if (dirty[0] & /*$curSongIndex*/ 4096 && button4_disabled_value !== (button4_disabled_value = /*$curSongIndex*/ ctx[12] <= 0)) {
    				button4.disabled = button4_disabled_value;
    			}

    			if (dirty[0] & /*$curSongIndex, playlist*/ 4160 && button5_disabled_value !== (button5_disabled_value = /*$curSongIndex*/ ctx[12] >= /*playlist*/ ctx[6].length - 1)) {
    				button5.disabled = button5_disabled_value;
    			}

    			if (current_block_type_2 !== (current_block_type_2 = select_block_type_2(ctx))) {
    				if_block4.d(1);
    				if_block4 = current_block_type_2(ctx);

    				if (if_block4) {
    					if_block4.c();
    					if_block4.m(button6, null);
    				}
    			}

    			if (dirty[0] & /*$show*/ 8192) {
    				toggle_class(button6, "btn-danger", /*$show*/ ctx[13]);
    			}

    			if (dirty[0] & /*$show*/ 8192) {
    				toggle_class(button6, "btn-success", !/*$show*/ ctx[13]);
    			}

    			if (dirty[0] & /*$curVerseIndex*/ 2048 && button7_disabled_value !== (button7_disabled_value = /*$curVerseIndex*/ ctx[11] <= 0)) {
    				button7.disabled = button7_disabled_value;
    			}

    			if (dirty[0] & /*$curVerseIndex, curVerses*/ 2304 && button8_disabled_value !== (button8_disabled_value = /*$curVerseIndex*/ ctx[11] >= /*curVerses*/ ctx[8].length - 1)) {
    				button8.disabled = button8_disabled_value;
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div0);
    			if (detaching) detach(t4);
    			if (detaching) detach(div1);
    			if (detaching) detach(t24);
    			if (detaching) detach(div2);
    			destroy_each(each_blocks_1, detaching);
    			if (detaching) detach(t25);
    			if (detaching) detach(div6);
    			destroy_each(each_blocks, detaching);
    			if (each1_else) each1_else.d();
    			if (if_block0) if_block0.d();
    			if_block1.d();
    			if_block2.d();
    			if (if_block3) if_block3.d();
    			if (detaching) detach(t33);
    			if (detaching) detach(div7);
    			if_block4.d();
    			mounted = false;
    			run_all(dispose);
    		}
    	};
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
    	let settingsOpen = false;
    	let editing = false;
    	let editingSong;
    	let playlist = [];
    	GUN_SUPER_PEERS = GUN_SUPER_PEERS || ["http://127.0.0.1/gun"];
    	let gun = Gun(GUN_SUPER_PEERS);
    	let overlay = gun.get("songs").get(window.location.hash || "demo");

    	/* Synced variables */
    	let show = writableGun(overlay.get("show"), false);

    	component_subscribe($$self, show, value => $$invalidate(13, $show = value));
    	let line1 = writableGun(overlay.get("line1"), "");
    	component_subscribe($$self, line1, value => $$invalidate(58, $line1 = value));
    	let bodyclass = writableGun(overlay.get("bodyclass"), "");
    	component_subscribe($$self, bodyclass, value => $$invalidate(14, $bodyclass = value));
    	let curSongIndex = writableGun(overlay.get("curSongIndex"), 0);
    	component_subscribe($$self, curSongIndex, value => $$invalidate(12, $curSongIndex = value));
    	let curVerseIndex = writableGun(overlay.get("curVerseIndex"), 0);
    	component_subscribe($$self, curVerseIndex, value => $$invalidate(11, $curVerseIndex = value));
    	let songsGun = overlay.get("songs");

    	function refreshSongsDb() {
    		songsGun.map().once(function (data, key) {
    			// console.log('songs', key, data);
    			// data && songsGun.get(key).put(null); // clear songs
    			if (data === null) {
    				delete songs[key];
    				return;
    			} else $$invalidate(56, songs[key] = data, songs);
    		}); /* Retreive verses immediately
    songsGun
      .get(Gun.node.soul(data))
      .get('verses')
      .once(function(songVerses){songs[key].verses = songVerses})
    */
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
    			if (data === null) $$invalidate(6, playlist = playlist.filter((song, i) => i != key)); else $$invalidate(6, playlist[key] = data, playlist);
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
    					$$invalidate(8, curVerses = []);
    				} else if (song.order.trim()) {
    					let verses = [];

    					song.order.split(" ").forEach(id => {
    						if (songVerses[id]) verses.push(songVerses[id]);
    					});

    					$$invalidate(8, curVerses = verses);
    				} else {
    					$$invalidate(8, curVerses = Object.values(songVerses).filter(v => v !== null && typeof v !== "object"));
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
    		$$invalidate(5, editingSong = {
    			title: "",
    			author: "",
    			order: "",
    			verses: {}
    		});

    		$$invalidate(9, newId = "v1");
    		$$invalidate(4, editing = true);
    	}

    	function removeSong(song) {
    		songsGun.get(Gun.node.soul(song)).put(null);
    		refreshSongsDb();
    	}

    	function toggleEdit(song) {
    		if (editing) {
    			$$invalidate(4, editing = false);
    			let soul = Gun.node.soul(editingSong);

    			if (soul) {
    				songsGun.get(soul).put(editingSong);
    			} else {
    				console.log("New song", editingSong);
    				songsGun.set(editingSong);
    				refreshSongsDb();
    			}
    		} else {
    			$$invalidate(5, editingSong = song);

    			songsGun.get(Gun.node.soul(song)).get("verses").once(verses => {
    				$$invalidate(5, editingSong.verses = verses, editingSong);
    				generateNewId();
    				$$invalidate(4, editing = true);
    			});
    		}
    	}

    	function removeVerse(id) {
    		if (!newVerse) $$invalidate(9, newId = id);
    		$$invalidate(5, editingSong.verses[id] = null, editingSong);
    	}

    	function addNewVerse() {
    		if (!editingSong.verses) $$invalidate(5, editingSong.verses = {}, editingSong);
    		if (newId && !editingSong.verses[newId]) $$invalidate(5, editingSong.verses[newId] = newVerse, editingSong);

    		/* Clean new verse */
    		$$invalidate(10, newVerse = "");

    		generateNewId();
    	}

    	function generateNewId() {
    		if (editingSong.verses) {
    			while (editingSong.verses[newId]) {
    				let newId2 = newId.replace(/\d+/, n => parseInt(n) + 1);
    				if (newId === newId2) $$invalidate(9, newId += "1"); else $$invalidate(9, newId = newId2);
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

    	function input0_input_handler() {
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
    		$$invalidate(2, filterOpen = !!songFilter);
    		$$invalidate(0, songFilter = "");
    	};

    	const click_handler_2 = () => {
    		$$invalidate(3, settingsOpen = !settingsOpen);
    	};

    	function select_change_handler() {
    		$bodyclass = select_value(this);
    		bodyclass.set($bodyclass);
    	}

    	const click_handler_3 = song => {
    		addToPlaylist(song);
    		$$invalidate(2, filterOpen = false);
    	};

    	const click_handler_4 = song => addToPlaylist(song);

    	const click_handler_5 = song => {
    		toggleEdit(song);
    		$$invalidate(2, filterOpen = false);
    	};

    	const click_handler_6 = song => removeSong(song);

    	const click_handler_7 = i => {
    		set_store_value(curSongIndex, $curSongIndex = i);
    	};

    	const click_handler_8 = i => removePlaylistItem(i);
    	const click_handler_9 = () => toggleEdit(curSong);

    	const click_handler_10 = () => {
    		$$invalidate(4, editing = false);
    	};

    	const click_handler_11 = () => {
    		$$invalidate(4, editing = false);
    		removeSong(editingSong);
    	};

    	function input0_input_handler_1() {
    		editingSong.title = this.value;
    		$$invalidate(5, editingSong);
    	}

    	function input1_input_handler() {
    		editingSong.author = this.value;
    		$$invalidate(5, editingSong);
    	}

    	function input2_input_handler() {
    		editingSong.order = this.value;
    		$$invalidate(5, editingSong);
    	}

    	const click_handler_12 = id => removeVerse(id);

    	function p_input_handler(id) {
    		editingSong.verses[id] = this.innerHTML;
    		$$invalidate(5, editingSong);
    	}

    	const click_handler_13 = i => {
    		set_store_value(curVerseIndex, $curVerseIndex = i);
    	};

    	function input_input_handler() {
    		newId = this.value;
    		$$invalidate(9, newId);
    	}

    	function p_input_handler_1() {
    		newVerse = this.innerHTML;
    		$$invalidate(10, newVerse);
    	}

    	const click_handler_14 = function () {
    		set_store_value(curSongIndex, $curSongIndex -= 1);
    	};

    	const click_handler_15 = function () {
    		set_store_value(curSongIndex, $curSongIndex += 1);
    	};

    	const click_handler_16 = () => {
    		set_store_value(curVerseIndex, $curVerseIndex -= 1);
    		scrollToVerse($curVerseIndex);
    	};

    	const click_handler_17 = () => {
    		set_store_value(curVerseIndex, $curVerseIndex += 1);
    		scrollToVerse($curVerseIndex);
    	};

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty[0] & /*playlist, $curSongIndex*/ 4160) {
    			 $$invalidate(7, curSong = playlist[$curSongIndex] || {
    				title: "",
    				author: "",
    				order: "",
    				verses: {}
    			});
    		}

    		if ($$self.$$.dirty[0] & /*curSong*/ 128) {
    			 setCurVerses(curSong);
    		}

    		if ($$self.$$.dirty[0] & /*curVerses, $curVerseIndex*/ 2304) {
    			 set_store_value(line1, $line1 = curVerses[$curVerseIndex] || "");
    		}

    		if ($$self.$$.dirty[1] & /*songs*/ 33554432) {
    			 $$invalidate(57, songsSorted = Object.values(songs).sort((a, b) => (a.title || "").replace(/\d+/g, s => ("0000" + parseInt(s)).slice(-4)).toLowerCase() > (b.title || "").replace(/\d+/g, s => ("0000" + parseInt(s)).slice(-4)).toLowerCase()));
    		}

    		if ($$self.$$.dirty[0] & /*songFilter*/ 1 | $$self.$$.dirty[1] & /*songsSorted*/ 67108864) {
    			 $$invalidate(1, songsFiltered = songFilter
    			? songsSorted.filter(matchesSong)
    			: songsSorted);
    		}
    	};

    	return [
    		songFilter,
    		songsFiltered,
    		filterOpen,
    		settingsOpen,
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
    		input0_input_handler,
    		input_handler,
    		click_handler,
    		click_handler_1,
    		click_handler_2,
    		select_change_handler,
    		click_handler_3,
    		click_handler_4,
    		click_handler_5,
    		click_handler_6,
    		click_handler_7,
    		click_handler_8,
    		click_handler_9,
    		click_handler_10,
    		click_handler_11,
    		input0_input_handler_1,
    		input1_input_handler,
    		input2_input_handler,
    		click_handler_12,
    		p_input_handler,
    		click_handler_13,
    		input_input_handler,
    		p_input_handler_1,
    		click_handler_14,
    		click_handler_15,
    		click_handler_16,
    		click_handler_17
    	];
    }

    class App extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance, create_fragment, safe_not_equal, {}, [-1, -1, -1]);
    	}
    }

    var app = new App({
    	target: document.body
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
