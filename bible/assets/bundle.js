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

    /* src/Keypad.svelte generated by Svelte v3.20.1 */

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
    	let dispose;

    	return {
    		c() {
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
    			attr(button0, "class", "btn btn-primary svelte-1bz6mfx");
    			attr(button1, "class", "btn btn-primary svelte-1bz6mfx");
    			attr(button2, "class", "btn btn-primary svelte-1bz6mfx");
    			attr(button3, "class", "btn btn-primary svelte-1bz6mfx");
    			attr(button4, "class", "btn btn-primary svelte-1bz6mfx");
    			attr(button5, "class", "btn btn-primary svelte-1bz6mfx");
    			attr(button6, "class", "btn btn-primary svelte-1bz6mfx");
    			attr(button7, "class", "btn btn-primary svelte-1bz6mfx");
    			attr(button8, "class", "btn btn-primary svelte-1bz6mfx");
    			attr(button9, "class", "btn btn-primary svelte-1bz6mfx");
    			button9.disabled = button9_disabled_value = !/*value*/ ctx[0];
    			attr(button10, "class", "btn btn-primary svelte-1bz6mfx");
    			attr(button11, "class", "btn btn-primary svelte-1bz6mfx");
    			button11.disabled = button11_disabled_value = !/*value*/ ctx[0];
    			attr(button12, "class", "btn btn-primary svelte-1bz6mfx");
    			button12.disabled = button12_disabled_value = /*value*/ ctx[0] <= 1;
    			attr(button13, "class", "btn btn-primary svelte-1bz6mfx");
    			button13.disabled = button13_disabled_value = /*value*/ ctx[0] == /*max*/ ctx[1];
    			attr(div, "class", "keypad svelte-1bz6mfx");
    		},
    		m(target, anchor, remount) {
    			insert(target, div, anchor);
    			append(div, button0);
    			append(div, t1);
    			append(div, button1);
    			append(div, t3);
    			append(div, button2);
    			append(div, t5);
    			append(div, button3);
    			append(div, t7);
    			append(div, button4);
    			append(div, t9);
    			append(div, button5);
    			append(div, t11);
    			append(div, button6);
    			append(div, t13);
    			append(div, button7);
    			append(div, t15);
    			append(div, button8);
    			append(div, t17);
    			append(div, button9);
    			append(button9, t18);
    			append(div, t19);
    			append(div, button10);
    			append(div, t21);
    			append(div, button11);
    			append(button11, t22);
    			append(div, t23);
    			append(div, button12);
    			append(button12, t24);
    			append(div, t25);
    			append(div, button13);
    			append(button13, t26);
    			if (remount) run_all(dispose);

    			dispose = [
    				listen(button0, "click", /*select*/ ctx[2](1)),
    				listen(button1, "click", /*select*/ ctx[2](2)),
    				listen(button2, "click", /*select*/ ctx[2](3)),
    				listen(button3, "click", /*select*/ ctx[2](4)),
    				listen(button4, "click", /*select*/ ctx[2](5)),
    				listen(button5, "click", /*select*/ ctx[2](6)),
    				listen(button6, "click", /*select*/ ctx[2](7)),
    				listen(button7, "click", /*select*/ ctx[2](8)),
    				listen(button8, "click", /*select*/ ctx[2](9)),
    				listen(button9, "click", /*backspace*/ ctx[6]),
    				listen(button10, "click", /*select*/ ctx[2](0)),
    				listen(button11, "click", /*clear*/ ctx[5]),
    				listen(button12, "click", /*decrement*/ ctx[3]),
    				listen(button13, "click", /*increment*/ ctx[4])
    			];
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*value*/ 1 && button9_disabled_value !== (button9_disabled_value = !/*value*/ ctx[0])) {
    				button9.disabled = button9_disabled_value;
    			}

    			if (dirty & /*value*/ 1 && button11_disabled_value !== (button11_disabled_value = !/*value*/ ctx[0])) {
    				button11.disabled = button11_disabled_value;
    			}

    			if (dirty & /*value*/ 1 && button12_disabled_value !== (button12_disabled_value = /*value*/ ctx[0] <= 1)) {
    				button12.disabled = button12_disabled_value;
    			}

    			if (dirty & /*value, max*/ 3 && button13_disabled_value !== (button13_disabled_value = /*value*/ ctx[0] == /*max*/ ctx[1])) {
    				button13.disabled = button13_disabled_value;
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div);
    			run_all(dispose);
    		}
    	};
    }

    function instance($$self, $$props, $$invalidate) {
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

    	$$self.$set = $$props => {
    		if ("value" in $$props) $$invalidate(0, value = $$props.value);
    		if ("max" in $$props) $$invalidate(1, max = $$props.max);
    	};

    	return [value, max, select, decrement, increment, clear, backspace];
    }

    class Keypad extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance, create_fragment, safe_not_equal, { value: 0, max: 1 });
    	}
    }

    /* src/App.svelte generated by Svelte v3.20.1 */

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[42] = list[i];
    	child_ctx[44] = i;
    	return child_ctx;
    }

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[45] = list[i];
    	return child_ctx;
    }

    // (210:2) {#each filteredBooks as book}
    function create_each_block_1(ctx) {
    	let button;
    	let t_value = /*book*/ ctx[45].name + "";
    	let t;
    	let dispose;

    	return {
    		c() {
    			button = element("button");
    			t = text(t_value);
    			attr(button, "class", "book-item btn svelte-18toi3t");
    			toggle_class(button, "btn-primary", /*book*/ ctx[45].abbreviation == /*shownAddress*/ ctx[9].book);
    		},
    		m(target, anchor, remount) {
    			insert(target, button, anchor);
    			append(button, t);
    			if (remount) dispose();

    			dispose = listen(button, "click", function () {
    				if (is_function(/*addressSelector*/ ctx[16]({ book: /*book*/ ctx[45].abbreviation }))) /*addressSelector*/ ctx[16]({ book: /*book*/ ctx[45].abbreviation }).apply(this, arguments);
    			});
    		},
    		p(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty[0] & /*filteredBooks*/ 2048 && t_value !== (t_value = /*book*/ ctx[45].name + "")) set_data(t, t_value);

    			if (dirty[0] & /*filteredBooks, shownAddress*/ 2560) {
    				toggle_class(button, "btn-primary", /*book*/ ctx[45].abbreviation == /*shownAddress*/ ctx[9].book);
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(button);
    			dispose();
    		}
    	};
    }

    // (215:2) {#each lastAddresses as address, i}
    function create_each_block(ctx) {
    	let div;
    	let button0;
    	let t0_value = (/*addressAsString*/ ctx[15](/*address*/ ctx[42]) || /*address*/ ctx[42].book + " " + /*address*/ ctx[42].chapter + "," + /*address*/ ctx[42].verse) + "";
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
    			attr(button0, "class", "address-set btn svelte-18toi3t");
    			toggle_class(button0, "btn-primary", equalAddresses(/*address*/ ctx[42], /*shownAddress*/ ctx[9]));
    			attr(button1, "class", "btn address-remove svelte-18toi3t");
    			attr(div, "class", "address-item btn-group svelte-18toi3t");
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
    				listen(button0, "click", function () {
    					if (is_function(/*addressSelector*/ ctx[16](/*address*/ ctx[42]))) /*addressSelector*/ ctx[16](/*address*/ ctx[42]).apply(this, arguments);
    				}),
    				listen(button1, "click", /*removeLastAddress*/ ctx[17](/*i*/ ctx[44]))
    			];
    		},
    		p(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty[0] & /*lastAddresses*/ 1024 && t0_value !== (t0_value = (/*addressAsString*/ ctx[15](/*address*/ ctx[42]) || /*address*/ ctx[42].book + " " + /*address*/ ctx[42].chapter + "," + /*address*/ ctx[42].verse) + "")) set_data(t0, t0_value);

    			if (dirty[0] & /*lastAddresses, shownAddress*/ 1536) {
    				toggle_class(button0, "btn-primary", equalAddresses(/*address*/ ctx[42], /*shownAddress*/ ctx[9]));
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    			run_all(dispose);
    		}
    	};
    }

    // (227:20) {:else}
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

    // (227:4) {#if shown}
    function create_if_block_2(ctx) {
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

    // (231:25) {#if selected.count>1}
    function create_if_block_1(ctx) {
    	let t0;
    	let t1_value = /*selected*/ ctx[8].verse + /*selected*/ ctx[8].count - 1 + "";
    	let t1;

    	return {
    		c() {
    			t0 = text("- ");
    			t1 = text(t1_value);
    		},
    		m(target, anchor) {
    			insert(target, t0, anchor);
    			insert(target, t1, anchor);
    		},
    		p(ctx, dirty) {
    			if (dirty[0] & /*selected*/ 256 && t1_value !== (t1_value = /*selected*/ ctx[8].verse + /*selected*/ ctx[8].count - 1 + "")) set_data(t1, t1_value);
    		},
    		d(detaching) {
    			if (detaching) detach(t0);
    			if (detaching) detach(t1);
    		}
    	};
    }

    // (262:2) {#if loadingBible}
    function create_if_block(ctx) {
    	let t0;
    	let t1;
    	let t2;

    	return {
    		c() {
    			t0 = text("Načítava sa biblia ");
    			t1 = text(/*bibleid*/ ctx[4]);
    			t2 = text(".");
    		},
    		m(target, anchor) {
    			insert(target, t0, anchor);
    			insert(target, t1, anchor);
    			insert(target, t2, anchor);
    		},
    		p(ctx, dirty) {
    			if (dirty[0] & /*bibleid*/ 16) set_data(t1, /*bibleid*/ ctx[4]);
    		},
    		d(detaching) {
    			if (detaching) detach(t0);
    			if (detaching) detach(t1);
    			if (detaching) detach(t2);
    		}
    	};
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
    	let t6_value = /*selected*/ ctx[8].chapter + "";
    	let t6;
    	let t7;
    	let updating_value;
    	let t8;
    	let button1;
    	let t9;
    	let div4;
    	let t10;
    	let t11_value = /*selected*/ ctx[8].verse + "";
    	let t11;
    	let t12;
    	let t13;
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
    	let dispose;
    	let each_value_1 = /*filteredBooks*/ ctx[11];
    	let each_blocks_1 = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks_1[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
    	}

    	let each_value = /*lastAddresses*/ ctx[10];
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	function keypad0_value_binding(value) {
    		/*keypad0_value_binding*/ ctx[32].call(null, value);
    	}

    	let keypad0_props = {
    		max: Object.keys(/*shownBook*/ ctx[7].chapters).length
    	};

    	if (/*selected*/ ctx[8].chapter !== void 0) {
    		keypad0_props.value = /*selected*/ ctx[8].chapter;
    	}

    	const keypad0 = new Keypad({ props: keypad0_props });
    	binding_callbacks.push(() => bind(keypad0, "value", keypad0_value_binding));

    	function select_block_type(ctx, dirty) {
    		if (/*shown*/ ctx[0]) return create_if_block_2;
    		return create_else_block;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block0 = current_block_type(ctx);
    	let if_block1 = /*selected*/ ctx[8].count > 1 && create_if_block_1(ctx);

    	function keypad1_value_binding(value) {
    		/*keypad1_value_binding*/ ctx[33].call(null, value);
    	}

    	let keypad1_props = { max: /*bookLength*/ ctx[12] };

    	if (/*selected*/ ctx[8].verse !== void 0) {
    		keypad1_props.value = /*selected*/ ctx[8].verse;
    	}

    	const keypad1 = new Keypad({ props: keypad1_props });
    	binding_callbacks.push(() => bind(keypad1, "value", keypad1_value_binding));
    	let if_block2 = /*loadingBible*/ ctx[5] && create_if_block(ctx);

    	return {
    		c() {
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
    			t24 = text(/*line1*/ ctx[1]);
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
    			t33 = text("Preklad:\n  ");
    			select1 = element("select");
    			option3 = element("option");
    			option3.textContent = "Roháčkov";
    			option4 = element("option");
    			option4.textContent = "Ekumenický";
    			t36 = space();
    			if (if_block2) if_block2.c();
    			attr(input, "class", "form-control");
    			attr(input, "type", "text");
    			attr(input, "placeholder", "filter");
    			attr(button0, "type", "button");
    			attr(button0, "class", "form-control btn btn-secondary svelte-18toi3t");
    			set_style(button0, "max-width", "2rem");
    			attr(div0, "class", "input-group");
    			set_style(div0, "width", "100%");
    			set_style(div0, "display", "flex");
    			attr(div1, "class", "books-filter svelte-18toi3t");
    			attr(div2, "class", "address-filter svelte-18toi3t");
    			attr(button1, "class", "control-button btn svelte-18toi3t");
    			toggle_class(button1, "btn-danger", /*shown*/ ctx[0]);
    			toggle_class(button1, "btn-success", !/*shown*/ ctx[0]);
    			set_style(div3, "display", "inline-block");
    			set_style(div3, "margin", "0 .5rem 0 0");
    			set_style(div3, "vertical-align", "top");
    			attr(button2, "class", "btn btn-primary svelte-18toi3t");
    			button2.disabled = button2_disabled_value = /*selected*/ ctx[8].count <= 1;
    			attr(button3, "class", "btn btn-primary svelte-18toi3t");
    			button3.disabled = button3_disabled_value = /*selected*/ ctx[8].verse + /*selected*/ ctx[8].count > /*bookLength*/ ctx[12];
    			attr(button4, "class", "btn btn-primary svelte-18toi3t");
    			button4.disabled = button4_disabled_value = /*selected*/ ctx[8].verse <= 1;
    			attr(button5, "class", "btn btn-primary svelte-18toi3t");
    			button5.disabled = button5_disabled_value = /*selected*/ ctx[8].verse + /*selected*/ ctx[8].count > /*bookLength*/ ctx[12];
    			set_style(div4, "display", "inline-block");
    			attr(div5, "class", "address svelte-18toi3t");
    			attr(span, "class", "vers svelte-18toi3t");
    			option0.__value = "";
    			option0.value = option0.__value;
    			option0.selected = true;
    			option1.__value = "simple-with-shadow";
    			option1.value = option1.__value;
    			option1.selected = true;
    			option2.__value = "fullscreen-white-bg";
    			option2.value = option2.__value;
    			if (/*bodyclass*/ ctx[3] === void 0) add_render_callback(() => /*select0_change_handler*/ ctx[38].call(select0));
    			attr(div6, "class", "bodyclass");
    			option3.__value = "roh";
    			option3.value = option3.__value;
    			option4.__value = "seb";
    			option4.value = option4.__value;
    			if (/*bibleid*/ ctx[4] === void 0) add_render_callback(() => /*select1_change_handler*/ ctx[40].call(select1));
    			attr(div7, "class", "bible");
    		},
    		m(target, anchor, remount) {
    			insert(target, div0, anchor);
    			append(div0, input);
    			set_input_value(input, /*bookFilter*/ ctx[6]);
    			append(div0, t0);
    			append(div0, button0);
    			insert(target, t2, anchor);
    			insert(target, div1, anchor);

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].m(div1, null);
    			}

    			insert(target, t3, anchor);
    			insert(target, div2, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div2, null);
    			}

    			insert(target, t4, anchor);
    			insert(target, div3, anchor);
    			append(div3, t5);
    			append(div3, t6);
    			append(div3, t7);
    			mount_component(keypad0, div3, null);
    			append(div3, t8);
    			append(div3, button1);
    			if_block0.m(button1, null);
    			insert(target, t9, anchor);
    			insert(target, div4, anchor);
    			append(div4, t10);
    			append(div4, t11);
    			append(div4, t12);
    			if (if_block1) if_block1.m(div4, null);
    			append(div4, t13);
    			mount_component(keypad1, div4, null);
    			append(div4, t14);
    			append(div4, button2);
    			append(button2, t15);
    			append(div4, t16);
    			append(div4, button3);
    			append(button3, t17);
    			append(div4, t18);
    			append(div4, br0);
    			append(div4, t19);
    			append(div4, button4);
    			append(button4, t20);
    			append(div4, t21);
    			append(div4, button5);
    			append(button5, t22);
    			insert(target, t23, anchor);
    			insert(target, div5, anchor);
    			append(div5, t24);
    			insert(target, t25, anchor);
    			insert(target, span, anchor);
    			span.innerHTML = /*line2*/ ctx[2];
    			insert(target, t26, anchor);
    			insert(target, br1, anchor);
    			insert(target, t27, anchor);
    			insert(target, div6, anchor);
    			append(div6, t28);
    			append(div6, select0);
    			append(select0, option0);
    			append(select0, option1);
    			append(select0, option2);
    			select_option(select0, /*bodyclass*/ ctx[3]);
    			insert(target, t32, anchor);
    			insert(target, div7, anchor);
    			append(div7, t33);
    			append(div7, select1);
    			append(select1, option3);
    			append(select1, option4);
    			select_option(select1, /*bibleid*/ ctx[4]);
    			append(div7, t36);
    			if (if_block2) if_block2.m(div7, null);
    			current = true;
    			if (remount) run_all(dispose);

    			dispose = [
    				listen(input, "input", /*input_input_handler*/ ctx[30]),
    				listen(button0, "click", /*click_handler*/ ctx[31]),
    				listen(button1, "click", /*toggleLine*/ ctx[18]),
    				listen(button2, "click", /*click_handler_1*/ ctx[34]),
    				listen(button3, "click", /*click_handler_2*/ ctx[35]),
    				listen(button4, "click", /*click_handler_3*/ ctx[36]),
    				listen(button5, "click", /*click_handler_4*/ ctx[37]),
    				listen(select0, "change", /*select0_change_handler*/ ctx[38]),
    				listen(select0, "change", /*change_handler*/ ctx[39]),
    				listen(select1, "change", /*select1_change_handler*/ ctx[40]),
    				listen(select1, "change", /*change_handler_1*/ ctx[41])
    			];
    		},
    		p(ctx, dirty) {
    			if (dirty[0] & /*bookFilter*/ 64 && input.value !== /*bookFilter*/ ctx[6]) {
    				set_input_value(input, /*bookFilter*/ ctx[6]);
    			}

    			if (dirty[0] & /*filteredBooks, shownAddress, addressSelector*/ 68096) {
    				each_value_1 = /*filteredBooks*/ ctx[11];
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

    			if (dirty[0] & /*removeLastAddress, lastAddresses, shownAddress, addressSelector, addressAsString*/ 230912) {
    				each_value = /*lastAddresses*/ ctx[10];
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

    			if ((!current || dirty[0] & /*selected*/ 256) && t6_value !== (t6_value = /*selected*/ ctx[8].chapter + "")) set_data(t6, t6_value);
    			const keypad0_changes = {};
    			if (dirty[0] & /*shownBook*/ 128) keypad0_changes.max = Object.keys(/*shownBook*/ ctx[7].chapters).length;

    			if (!updating_value && dirty[0] & /*selected*/ 256) {
    				updating_value = true;
    				keypad0_changes.value = /*selected*/ ctx[8].chapter;
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

    			if (dirty[0] & /*shown*/ 1) {
    				toggle_class(button1, "btn-danger", /*shown*/ ctx[0]);
    			}

    			if (dirty[0] & /*shown*/ 1) {
    				toggle_class(button1, "btn-success", !/*shown*/ ctx[0]);
    			}

    			if ((!current || dirty[0] & /*selected*/ 256) && t11_value !== (t11_value = /*selected*/ ctx[8].verse + "")) set_data(t11, t11_value);

    			if (/*selected*/ ctx[8].count > 1) {
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
    			if (dirty[0] & /*bookLength*/ 4096) keypad1_changes.max = /*bookLength*/ ctx[12];

    			if (!updating_value_1 && dirty[0] & /*selected*/ 256) {
    				updating_value_1 = true;
    				keypad1_changes.value = /*selected*/ ctx[8].verse;
    				add_flush_callback(() => updating_value_1 = false);
    			}

    			keypad1.$set(keypad1_changes);

    			if (!current || dirty[0] & /*selected*/ 256 && button2_disabled_value !== (button2_disabled_value = /*selected*/ ctx[8].count <= 1)) {
    				button2.disabled = button2_disabled_value;
    			}

    			if (!current || dirty[0] & /*selected, bookLength*/ 4352 && button3_disabled_value !== (button3_disabled_value = /*selected*/ ctx[8].verse + /*selected*/ ctx[8].count > /*bookLength*/ ctx[12])) {
    				button3.disabled = button3_disabled_value;
    			}

    			if (!current || dirty[0] & /*selected*/ 256 && button4_disabled_value !== (button4_disabled_value = /*selected*/ ctx[8].verse <= 1)) {
    				button4.disabled = button4_disabled_value;
    			}

    			if (!current || dirty[0] & /*selected, bookLength*/ 4352 && button5_disabled_value !== (button5_disabled_value = /*selected*/ ctx[8].verse + /*selected*/ ctx[8].count > /*bookLength*/ ctx[12])) {
    				button5.disabled = button5_disabled_value;
    			}

    			if (!current || dirty[0] & /*line1*/ 2) set_data(t24, /*line1*/ ctx[1]);
    			if (!current || dirty[0] & /*line2*/ 4) span.innerHTML = /*line2*/ ctx[2];
    			if (dirty[0] & /*bodyclass*/ 8) {
    				select_option(select0, /*bodyclass*/ ctx[3]);
    			}

    			if (dirty[0] & /*bibleid*/ 16) {
    				select_option(select1, /*bibleid*/ ctx[4]);
    			}

    			if (/*loadingBible*/ ctx[5]) {
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
    		i(local) {
    			if (current) return;
    			transition_in(keypad0.$$.fragment, local);
    			transition_in(keypad1.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(keypad0.$$.fragment, local);
    			transition_out(keypad1.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div0);
    			if (detaching) detach(t2);
    			if (detaching) detach(div1);
    			destroy_each(each_blocks_1, detaching);
    			if (detaching) detach(t3);
    			if (detaching) detach(div2);
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach(t4);
    			if (detaching) detach(div3);
    			destroy_component(keypad0);
    			if_block0.d();
    			if (detaching) detach(t9);
    			if (detaching) detach(div4);
    			if (if_block1) if_block1.d();
    			destroy_component(keypad1);
    			if (detaching) detach(t23);
    			if (detaching) detach(div5);
    			if (detaching) detach(t25);
    			if (detaching) detach(span);
    			if (detaching) detach(t26);
    			if (detaching) detach(br1);
    			if (detaching) detach(t27);
    			if (detaching) detach(div6);
    			if (detaching) detach(t32);
    			if (detaching) detach(div7);
    			if (if_block2) if_block2.d();
    			run_all(dispose);
    		}
    	};
    }

    function equalAddresses(a, b) {
    	return a.book == b.book && a.chapter == b.chapter && a.verse == b.verse && a.count == b.count;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let shown = false;
    	let line1 = "";
    	let line2 = "";
    	let bodyclass = "";
    	let bibleid = "roh";
    	let loadingBible;
    	let books = [];
    	let booksByAbbr = new Map();
    	let bookFilter = "";
    	let shownBook;

    	let selected = {
    		book: "gn",
    		chapter: 1,
    		verse: 1,
    		count: 1
    	};

    	let shownAddress = selected;

    	let lastAddresses = [
    		{
    			book: "gn",
    			chapter: 1,
    			verse: 1,
    			count: 1
    		}
    	];

    	GUN_SUPER_PEERS = GUN_SUPER_PEERS || ["http://127.0.0.1/gun"];
    	let gun = Gun(GUN_SUPER_PEERS);
    	let overlay = gun.get("bible").get(window.location.hash || "demo");

    	overlay.get("show").on(function (data, key) {
    		$$invalidate(0, shown = data);
    	});

    	let overlayAddress = overlay.get("address");

    	overlayAddress.map().on(function (data, key) {
    		$$invalidate(9, shownAddress[key] = data, shownAddress);
    	});

    	let overlayLine1 = overlay.get("line1");

    	overlayLine1.on(function (data) {
    		$$invalidate(1, line1 = data);
    	});

    	let overlayLine2 = overlay.get("line2");

    	overlayLine2.on(function (data) {
    		$$invalidate(2, line2 = data);
    	});

    	let overlayBodyClass = overlay.get("bodyclass");

    	overlayBodyClass.on(function (data) {
    		$$invalidate(3, bodyclass = data);
    	});

    	let overlayBibleid = overlay.get("bibleid");

    	overlayBibleid.on(function (data) {
    		$$invalidate(4, bibleid = data);
    	});

    	/* Disabled last address filtering
    $: filteredLastAddresses = bookFilter
      ? lastAddresses.filter(h => matchesBook(booksByAbbr[h.book]))
      : lastAddresses;
    */
    	function loadBible(path) {
    		$$invalidate(5, loadingBible = true);
    		console.log("Loading Bible", path);
    		let request = new XMLHttpRequest();
    		request.open("GET", path);
    		request.responseType = "json";
    		request.send();

    		request.onload = function () {
    			$$invalidate(19, books = request.response.books);

    			books.forEach(book => {
    				$$invalidate(20, booksByAbbr[book.abbreviation] = book, booksByAbbr);
    			});

    			/* Redraw */
    			$$invalidate(10, lastAddresses);

    			$$invalidate(8, selected);
    			$$invalidate(5, loadingBible = false);
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

    		$$invalidate(10, lastAddresses = lastAddresses.filter((h, i) => i === 0 || !equalAddresses(h, address)));
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

    	function addressContent(address) {
    		var book = booksByAbbr[shownAddress.book];
    		var content = "";

    		if (book && selected.verse && book.chapters[selected.chapter]) {
    			for (var i = selected.verse; i < selected.verse + selected.count; i++) {
    				content += "\n" + (book.chapters[selected.chapter][i - 1] || "");
    			}
    		}

    		return content;
    	}

    	

    	function addressSelector(address) {
    		address.chapter = address.chapter || "";
    		address.verse = address.verse || "";
    		address.count = address.count || 1;

    		return function () {
    			$$invalidate(8, selected = address);
    		};
    	}

    	function removeLastAddress(j) {
    		return function () {
    			$$invalidate(10, lastAddresses = lastAddresses.filter((h, i) => i !== j));
    		};
    	}

    	function toggleLine() {
    		$$invalidate(0, shown = !shown);
    		overlay.get("show").put(shown);

    		if (shown) {
    			addToLastAddresses(selected);
    		}
    	}

    	function input_input_handler() {
    		bookFilter = this.value;
    		$$invalidate(6, bookFilter);
    	}

    	const click_handler = () => {
    		$$invalidate(6, bookFilter = "");
    	};

    	function keypad0_value_binding(value) {
    		selected.chapter = value;
    		$$invalidate(8, selected);
    	}

    	function keypad1_value_binding(value) {
    		selected.verse = value;
    		$$invalidate(8, selected);
    	}

    	const click_handler_1 = function () {
    		$$invalidate(8, selected.count -= 1, selected);
    	};

    	const click_handler_2 = function () {
    		$$invalidate(8, selected.count += 1, selected);
    	};

    	const click_handler_3 = function () {
    		$$invalidate(8, selected.verse = Math.max(1, selected.verse - selected.count), selected);
    	};

    	const click_handler_4 = function () {
    		$$invalidate(8, selected.verse = Math.min(selected.verse + selected.count, bookLength - 1), selected);
    	};

    	function select0_change_handler() {
    		bodyclass = select_value(this);
    		$$invalidate(3, bodyclass);
    	}

    	const change_handler = () => overlayBodyClass.put(bodyclass);

    	function select1_change_handler() {
    		bibleid = select_value(this);
    		$$invalidate(4, bibleid);
    	}

    	const change_handler_1 = () => overlayBibleid.put(bibleid);
    	let filteredBooks;
    	let bookLength;

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty[0] & /*bibleid*/ 16) {
    			 loadBible(bibleid + ".json");
    		}

    		if ($$self.$$.dirty[0] & /*booksByAbbr, shownAddress*/ 1049088) {
    			 $$invalidate(7, shownBook = booksByAbbr[shownAddress.book] || { chapters: [], name: "" });
    		}

    		if ($$self.$$.dirty[0] & /*selected*/ 256) {
    			 $$invalidate(8, selected.count = selected.verse ? selected.count : 1, selected);
    		}

    		if ($$self.$$.dirty[0] & /*selected*/ 256) {
    			 overlayAddress.put(selected);
    		}

    		if ($$self.$$.dirty[0] & /*selected*/ 256) {
    			 overlayLine1.put(addressAsString(selected));
    		}

    		if ($$self.$$.dirty[0] & /*selected*/ 256) {
    			 overlayLine2.put(addressContent());
    		}

    		if ($$self.$$.dirty[0] & /*bookFilter, books*/ 524352) {
    			 $$invalidate(11, filteredBooks = bookFilter ? books.filter(matchesBook) : books);
    		}

    		if ($$self.$$.dirty[0] & /*shownBook, selected*/ 384) {
    			 $$invalidate(12, bookLength = (shownBook.chapters[selected.chapter] || []).length);
    		}
    	};

    	return [
    		shown,
    		line1,
    		line2,
    		bodyclass,
    		bibleid,
    		loadingBible,
    		bookFilter,
    		shownBook,
    		selected,
    		shownAddress,
    		lastAddresses,
    		filteredBooks,
    		bookLength,
    		overlayBodyClass,
    		overlayBibleid,
    		addressAsString,
    		addressSelector,
    		removeLastAddress,
    		toggleLine,
    		books,
    		booksByAbbr,
    		gun,
    		overlay,
    		overlayAddress,
    		overlayLine1,
    		overlayLine2,
    		loadBible,
    		matchesBook,
    		addToLastAddresses,
    		addressContent,
    		input_input_handler,
    		click_handler,
    		keypad0_value_binding,
    		keypad1_value_binding,
    		click_handler_1,
    		click_handler_2,
    		click_handler_3,
    		click_handler_4,
    		select0_change_handler,
    		change_handler,
    		select1_change_handler,
    		change_handler_1
    	];
    }

    class App extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {}, [-1, -1]);
    	}
    }

    var app = new App({
    	target: document.body
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
