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

    /* src/App.svelte generated by Svelte v3.20.1 */

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[36] = list[i];
    	child_ctx[38] = i;
    	return child_ctx;
    }

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[39] = list[i];
    	child_ctx[38] = i;
    	return child_ctx;
    }

    function get_each_context_2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[39] = list[i];
    	return child_ctx;
    }

    // (203:2) {#each filteredSongs as song}
    function create_each_block_2(ctx) {
    	let button;
    	let t_value = /*song*/ ctx[39].name + "";
    	let t;
    	let dispose;

    	function click_handler_1(...args) {
    		return /*click_handler_1*/ ctx[29](/*song*/ ctx[39], ...args);
    	}

    	return {
    		c() {
    			button = element("button");
    			t = text(t_value);
    			attr(button, "class", "song-item btn svelte-n67qo3");
    			toggle_class(button, "btn-primary", /*song*/ ctx[39] == /*curSong*/ ctx[6]);
    		},
    		m(target, anchor, remount) {
    			insert(target, button, anchor);
    			append(button, t);
    			if (remount) dispose();
    			dispose = listen(button, "click", click_handler_1);
    		},
    		p(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty[0] & /*filteredSongs*/ 8 && t_value !== (t_value = /*song*/ ctx[39].name + "")) set_data(t, t_value);

    			if (dirty[0] & /*filteredSongs, curSong*/ 72) {
    				toggle_class(button, "btn-primary", /*song*/ ctx[39] == /*curSong*/ ctx[6]);
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(button);
    			dispose();
    		}
    	};
    }

    // (210:2) {#each playlist as song, i}
    function create_each_block_1(ctx) {
    	let div;
    	let button0;
    	let t0_value = (/*song*/ ctx[39].name || "--") + "";
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
    			attr(button0, "class", "song-set btn svelte-n67qo3");
    			toggle_class(button0, "btn-primary", /*curSongIndex*/ ctx[5] == /*i*/ ctx[38]);
    			attr(button1, "class", "btn song-remove svelte-n67qo3");
    			attr(div, "class", "song-item btn-group svelte-n67qo3");
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
    				listen(button0, "click", /*songSelector*/ ctx[12](/*i*/ ctx[38])),
    				listen(button1, "click", /*playlistRemover*/ ctx[11](/*i*/ ctx[38]))
    			];
    		},
    		p(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty[0] & /*playlist*/ 16 && t0_value !== (t0_value = (/*song*/ ctx[39].name || "--") + "")) set_data(t0, t0_value);

    			if (dirty[0] & /*curSongIndex*/ 32) {
    				toggle_class(button0, "btn-primary", /*curSongIndex*/ ctx[5] == /*i*/ ctx[38]);
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    			run_all(dispose);
    		}
    	};
    }

    // (219:2) {#each curVerses as verse, i}
    function create_each_block(ctx) {
    	let p;
    	let html_tag;
    	let raw_value = /*verse*/ ctx[36].replace(/\n/g, "<br>") + "";
    	let t;
    	let dispose;

    	return {
    		c() {
    			p = element("p");
    			t = space();
    			html_tag = new HtmlTag(raw_value, t);
    			attr(p, "class", "verse-item svelte-n67qo3");
    			toggle_class(p, "btn-primary", /*curVerseIndex*/ ctx[8] == /*i*/ ctx[38]);
    		},
    		m(target, anchor, remount) {
    			insert(target, p, anchor);
    			html_tag.m(p);
    			append(p, t);
    			if (remount) dispose();
    			dispose = listen(p, "click", /*verseSelector*/ ctx[13](/*i*/ ctx[38]));
    		},
    		p(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty[0] & /*curVerses*/ 128 && raw_value !== (raw_value = /*verse*/ ctx[36].replace(/\n/g, "<br>") + "")) html_tag.p(raw_value);

    			if (dirty[0] & /*curVerseIndex*/ 256) {
    				toggle_class(p, "btn-primary", /*curVerseIndex*/ ctx[8] == /*i*/ ctx[38]);
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(p);
    			dispose();
    		}
    	};
    }

    // (228:20) {:else}
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

    // (228:4) {#if shown}
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
    	let input;
    	let t0;
    	let button0;
    	let t2;
    	let div1;
    	let t3;
    	let div2;
    	let t4;
    	let br;
    	let t5;
    	let t6;
    	let div3;
    	let t7;
    	let div4;
    	let button1;
    	let t8;
    	let div5;
    	let button2;
    	let t9;
    	let button2_disabled_value;
    	let t10;
    	let button3;
    	let t11;
    	let button3_disabled_value;
    	let t12;
    	let button4;
    	let t13;
    	let button4_disabled_value;
    	let t14;
    	let button5;
    	let t15;
    	let button5_disabled_value;
    	let t16;
    	let p;
    	let t17;
    	let select;
    	let option0;
    	let option1;
    	let option2;
    	let dispose;
    	let each_value_2 = /*filteredSongs*/ ctx[3];
    	let each_blocks_2 = [];

    	for (let i = 0; i < each_value_2.length; i += 1) {
    		each_blocks_2[i] = create_each_block_2(get_each_context_2(ctx, each_value_2, i));
    	}

    	let each_value_1 = /*playlist*/ ctx[4];
    	let each_blocks_1 = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks_1[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
    	}

    	let each_value = /*curVerses*/ ctx[7];
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	function select_block_type(ctx, dirty) {
    		if (/*shown*/ ctx[0]) return create_if_block;
    		return create_else_block;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	return {
    		c() {
    			div0 = element("div");
    			input = element("input");
    			t0 = space();
    			button0 = element("button");
    			button0.textContent = "×";
    			t2 = space();
    			div1 = element("div");

    			for (let i = 0; i < each_blocks_2.length; i += 1) {
    				each_blocks_2[i].c();
    			}

    			t3 = space();
    			div2 = element("div");
    			t4 = text("Playlist:");
    			br = element("br");
    			t5 = space();

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].c();
    			}

    			t6 = space();
    			div3 = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t7 = space();
    			div4 = element("div");
    			button1 = element("button");
    			if_block.c();
    			t8 = space();
    			div5 = element("div");
    			button2 = element("button");
    			t9 = text("Predošlá pieseň");
    			t10 = space();
    			button3 = element("button");
    			t11 = text("Ďalšia pieseň");
    			t12 = space();
    			button4 = element("button");
    			t13 = text("Predošlý verš");
    			t14 = space();
    			button5 = element("button");
    			t15 = text("Ďalší verš");
    			t16 = space();
    			p = element("p");
    			t17 = text("Téma:\n  ");
    			select = element("select");
    			option0 = element("option");
    			option0.textContent = "Predvolené";
    			option1 = element("option");
    			option1.textContent = "Jednoduché s tieňom";
    			option2 = element("option");
    			option2.textContent = "Fullscreen biele pozadie";
    			attr(input, "class", "form-control");
    			attr(input, "type", "text");
    			attr(input, "placeholder", "filter");
    			attr(button0, "type", "button");
    			attr(button0, "class", "form-control btn btn-secondary svelte-n67qo3");
    			set_style(button0, "max-width", "2rem");
    			attr(div0, "class", "input-group");
    			set_style(div0, "width", "100%");
    			set_style(div0, "display", "flex");
    			attr(div1, "class", "songs-filter svelte-n67qo3");
    			attr(div2, "class", "playlist");
    			attr(div3, "class", "verses");
    			attr(button1, "class", "control-button btn svelte-n67qo3");
    			toggle_class(button1, "btn-danger", /*shown*/ ctx[0]);
    			toggle_class(button1, "btn-success", !/*shown*/ ctx[0]);
    			set_style(div4, "display", "inline-block");
    			set_style(div4, "margin", "0 .5rem 0 0");
    			set_style(div4, "vertical-align", "top");
    			attr(button2, "class", "btn btn-primary svelte-n67qo3");
    			button2.disabled = button2_disabled_value = /*curSongIndex*/ ctx[5] <= 0;
    			attr(button3, "class", "btn btn-primary svelte-n67qo3");
    			button3.disabled = button3_disabled_value = /*curSongIndex*/ ctx[5] >= /*playlist*/ ctx[4].length - 1;
    			attr(button4, "class", "btn btn-primary svelte-n67qo3");
    			button4.disabled = button4_disabled_value = /*curVerseIndex*/ ctx[8] <= 0;
    			attr(button5, "class", "btn btn-primary svelte-n67qo3");
    			button5.disabled = button5_disabled_value = /*curVerseIndex*/ ctx[8] >= /*curVerses*/ ctx[7].length - 1;
    			set_style(div5, "display", "inline-block");
    			option0.__value = "";
    			option0.value = option0.__value;
    			option0.selected = true;
    			option1.__value = "simple-with-shadow";
    			option1.value = option1.__value;
    			option2.__value = "fullscreen-white-bg";
    			option2.value = option2.__value;
    			if (/*bodyclass*/ ctx[1] === void 0) add_render_callback(() => /*select_change_handler*/ ctx[34].call(select));
    			attr(p, "class", "bodyclass");
    		},
    		m(target, anchor, remount) {
    			insert(target, div0, anchor);
    			append(div0, input);
    			set_input_value(input, /*songFilter*/ ctx[2]);
    			append(div0, t0);
    			append(div0, button0);
    			insert(target, t2, anchor);
    			insert(target, div1, anchor);

    			for (let i = 0; i < each_blocks_2.length; i += 1) {
    				each_blocks_2[i].m(div1, null);
    			}

    			insert(target, t3, anchor);
    			insert(target, div2, anchor);
    			append(div2, t4);
    			append(div2, br);
    			append(div2, t5);

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].m(div2, null);
    			}

    			insert(target, t6, anchor);
    			insert(target, div3, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div3, null);
    			}

    			insert(target, t7, anchor);
    			insert(target, div4, anchor);
    			append(div4, button1);
    			if_block.m(button1, null);
    			insert(target, t8, anchor);
    			insert(target, div5, anchor);
    			append(div5, button2);
    			append(button2, t9);
    			append(div5, t10);
    			append(div5, button3);
    			append(button3, t11);
    			append(div5, t12);
    			append(div5, button4);
    			append(button4, t13);
    			append(div5, t14);
    			append(div5, button5);
    			append(button5, t15);
    			insert(target, t16, anchor);
    			insert(target, p, anchor);
    			append(p, t17);
    			append(p, select);
    			append(select, option0);
    			append(select, option1);
    			append(select, option2);
    			select_option(select, /*bodyclass*/ ctx[1]);
    			if (remount) run_all(dispose);

    			dispose = [
    				listen(input, "input", /*input_input_handler*/ ctx[27]),
    				listen(button0, "click", /*click_handler*/ ctx[28]),
    				listen(button1, "click", /*toggleShow*/ ctx[14]),
    				listen(button2, "click", /*click_handler_2*/ ctx[30]),
    				listen(button3, "click", /*click_handler_3*/ ctx[31]),
    				listen(button4, "click", /*click_handler_4*/ ctx[32]),
    				listen(button5, "click", /*click_handler_5*/ ctx[33]),
    				listen(select, "change", /*select_change_handler*/ ctx[34]),
    				listen(select, "change", /*change_handler*/ ctx[35])
    			];
    		},
    		p(ctx, dirty) {
    			if (dirty[0] & /*songFilter*/ 4 && input.value !== /*songFilter*/ ctx[2]) {
    				set_input_value(input, /*songFilter*/ ctx[2]);
    			}

    			if (dirty[0] & /*filteredSongs, curSong, addToPlaylist*/ 1096) {
    				each_value_2 = /*filteredSongs*/ ctx[3];
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

    			if (dirty[0] & /*playlistRemover, curSongIndex, songSelector, playlist*/ 6192) {
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

    			if (dirty[0] & /*curVerseIndex, verseSelector, curVerses*/ 8576) {
    				each_value = /*curVerses*/ ctx[7];
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

    			if (current_block_type !== (current_block_type = select_block_type(ctx))) {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(button1, null);
    				}
    			}

    			if (dirty[0] & /*shown*/ 1) {
    				toggle_class(button1, "btn-danger", /*shown*/ ctx[0]);
    			}

    			if (dirty[0] & /*shown*/ 1) {
    				toggle_class(button1, "btn-success", !/*shown*/ ctx[0]);
    			}

    			if (dirty[0] & /*curSongIndex*/ 32 && button2_disabled_value !== (button2_disabled_value = /*curSongIndex*/ ctx[5] <= 0)) {
    				button2.disabled = button2_disabled_value;
    			}

    			if (dirty[0] & /*curSongIndex, playlist*/ 48 && button3_disabled_value !== (button3_disabled_value = /*curSongIndex*/ ctx[5] >= /*playlist*/ ctx[4].length - 1)) {
    				button3.disabled = button3_disabled_value;
    			}

    			if (dirty[0] & /*curVerseIndex*/ 256 && button4_disabled_value !== (button4_disabled_value = /*curVerseIndex*/ ctx[8] <= 0)) {
    				button4.disabled = button4_disabled_value;
    			}

    			if (dirty[0] & /*curVerseIndex, curVerses*/ 384 && button5_disabled_value !== (button5_disabled_value = /*curVerseIndex*/ ctx[8] >= /*curVerses*/ ctx[7].length - 1)) {
    				button5.disabled = button5_disabled_value;
    			}

    			if (dirty[0] & /*bodyclass*/ 2) {
    				select_option(select, /*bodyclass*/ ctx[1]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div0);
    			if (detaching) detach(t2);
    			if (detaching) detach(div1);
    			destroy_each(each_blocks_2, detaching);
    			if (detaching) detach(t3);
    			if (detaching) detach(div2);
    			destroy_each(each_blocks_1, detaching);
    			if (detaching) detach(t6);
    			if (detaching) detach(div3);
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach(t7);
    			if (detaching) detach(div4);
    			if_block.d();
    			if (detaching) detach(t8);
    			if (detaching) detach(div5);
    			if (detaching) detach(t16);
    			if (detaching) detach(p);
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

    function instance($$self, $$props, $$invalidate) {
    	onMount(function () {
    		document.addEventListener("keydown", function (event) {
    			if (event.code == "ArrowDown" || event.code == "ArrowUp" || event.code == "ArrowLeft" || event.code == "ArrowRight") event.preventDefault();

    			if (event.code == "ArrowDown") {
    				$$invalidate(8, curVerseIndex = Math.min(curVerseIndex + 1, curVerses.length - 1));
    				scrollToCurrentVerse();
    			} else if (event.code == "ArrowUp") {
    				$$invalidate(8, curVerseIndex = Math.max(curVerseIndex - 1, 0));
    				scrollToCurrentVerse();
    			} else if (event.code == "ArrowLeft") {
    				$$invalidate(5, curSongIndex = Math.max(curSongIndex - 1, 0));
    			} else if (event.code == "ArrowRight") {
    				$$invalidate(5, curSongIndex = Math.min(curSongIndex + 1, playlist.length - 1));
    			}
    		});
    	});

    	/* Synced variables */
    	let shown = false;

    	let line1 = "";
    	let line2 = "";
    	let bodyclass = "";

    	let songs = [
    		{
    			name: "A Safe Stronghold Our God is Still",
    			author: "Martin Luther",
    			order: "s1 s2 s3 s1 s1 s2 s3 s3 s3",
    			verses: {
    				s1: `As safe a stronghold our God is still,
A trusty shield and weapon;
He’ll help us clear from all the ill
That hath us now o’ertaken.
The ancient prince of hell
Hath risen with purpose fell;
Strong mail of craft and power
He weareth in this hour;
On earth is not His fellow.`,
    				s2: `With force of arms we nothing can,
Full soon were we down-ridden;
But for us fights the proper Man,
Whom God Himself hath bidden.
Ask ye: Who is this same?
Christ Jesus is His name,
The Lord Sabaoth’s Son;
He, and no other one,
Shall conquer in the battle.`,
    				s3: `And were this world all devils o’er,
And watching to devour us,
We lay it not to heart so sore;
Not they can overpower us.
And let the prince of ill
Look grim as e’er he will,
He harms us not a whit;
For why? his doom is writ;
A word shall quickly slay him.`
    			}
    		}
    	];

    	let songsByName = new Map();
    	let songFilter = "";
    	let filteredSongs = songs;
    	let playlist = [songs[0]];
    	let curSongIndex = 0;
    	let curSong = playlist[curSongIndex];
    	let curVerses = curSong.verses || [];
    	let curVerseIndex = 0;
    	let curVerse;
    	GUN_SUPER_PEERS = GUN_SUPER_PEERS || ["http://127.0.0.1/gun"];
    	let gun = Gun(GUN_SUPER_PEERS);
    	let overlay = gun.get("songs").get(window.location.hash || "demo");

    	overlay.get("show").on(function (data, key) {
    		$$invalidate(0, shown = data);
    	});

    	let overlaySong = overlay.get("song");

    	overlaySong.on(function (data, key) {
    		$$invalidate(6, curSong[key] = data, curSong);
    	});

    	let overlayLine1 = overlay.get("line1");

    	overlayLine1.on(function (data) {
    		line1 = data;
    	});

    	let overlayLine2 = overlay.get("line2");

    	overlayLine2.on(function (data) {
    		line2 = data;
    	});

    	let overlayBodyClass = overlay.get("bodyclass");

    	overlayBodyClass.on(function (data) {
    		$$invalidate(1, bodyclass = data);
    	});

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
    			$$invalidate(5, curSongIndex = i);
    		};
    	}

    	function verseSelector(i) {
    		return function () {
    			$$invalidate(8, curVerseIndex = i);
    		};
    	}

    	function scrollToCurrentVerse() {
    		document.querySelector(".verse-item:nth-child(" + curVerseIndex + ")").scrollIntoView();
    	}

    	function toggleShow() {
    		$$invalidate(0, shown = !shown);
    		overlay.get("show").put(shown);
    	}

    	function input_input_handler() {
    		songFilter = this.value;
    		$$invalidate(2, songFilter);
    	}

    	const click_handler = () => {
    		$$invalidate(2, songFilter = "");
    	};

    	const click_handler_1 = song => addToPlaylist(song);

    	const click_handler_2 = function () {
    		$$invalidate(5, curSongIndex -= 1);
    	};

    	const click_handler_3 = function () {
    		$$invalidate(5, curSongIndex += 1);
    	};

    	const click_handler_4 = function () {
    		$$invalidate(8, curVerseIndex -= 1);
    	};

    	const click_handler_5 = function () {
    		$$invalidate(8, curVerseIndex += 1);
    	};

    	function select_change_handler() {
    		bodyclass = select_value(this);
    		$$invalidate(1, bodyclass);
    	}

    	const change_handler = () => overlayBodyClass.put(bodyclass);

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty[0] & /*playlist, curSongIndex*/ 48) {
    			 $$invalidate(6, curSong = playlist[curSongIndex]);
    		}

    		if ($$self.$$.dirty[0] & /*curSong*/ 64) {
    			 $$invalidate(7, curVerses = getSongVerses(curSong));
    		}

    		if ($$self.$$.dirty[0] & /*curVerses, curVerseIndex*/ 384) {
    			 $$invalidate(17, curVerse = curVerses[curVerseIndex]);
    		}

    		if ($$self.$$.dirty[0] & /*curSongIndex*/ 32) {
    			 overlaySong.put(curSongIndex);
    		}

    		if ($$self.$$.dirty[0] & /*curVerse*/ 131072) {
    			 overlayLine1.put(curVerse);
    		}

    		if ($$self.$$.dirty[0] & /*songFilter*/ 4) {
    			// $: overlayLine2.put(addressContent(curSongIndex));
    			 $$invalidate(3, filteredSongs = songFilter ? songs.filter(matchesSong) : songs);
    		}
    	};

    	return [
    		shown,
    		bodyclass,
    		songFilter,
    		filteredSongs,
    		playlist,
    		curSongIndex,
    		curSong,
    		curVerses,
    		curVerseIndex,
    		overlayBodyClass,
    		addToPlaylist,
    		playlistRemover,
    		songSelector,
    		verseSelector,
    		toggleShow,
    		line1,
    		line2,
    		curVerse,
    		songs,
    		songsByName,
    		gun,
    		overlay,
    		overlaySong,
    		overlayLine1,
    		overlayLine2,
    		matchesSong,
    		scrollToCurrentVerse,
    		input_input_handler,
    		click_handler,
    		click_handler_1,
    		click_handler_2,
    		click_handler_3,
    		click_handler_4,
    		click_handler_5,
    		select_change_handler,
    		change_handler
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
