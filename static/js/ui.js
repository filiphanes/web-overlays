// Shared VanJS DOM helpers for the static (build-free) controllers.
// Re-exported `van` so controllers import everything UI-related from one place.

import { van } from "./van.js";

// Append a render result (node | string | array | null/false) to a parent.
export function appendAll(el, out) {
  if (out == null || out === false) return;
  if (Array.isArray(out)) for (const c of out) appendAll(el, c);
  else el.append(out);
}

// A container whose children are rebuilt from `render()` whenever any van state
// read inside it changes. Use for list regions driven by collections, and for
// any block that returns DOM nodes conditionally — VanJS stringifies arrays of
// nodes returned from a plain function child, so wrap them in live().
export function live(tag, props, render) {
  const el = tag(props);
  van.derive(() => { el.replaceChildren(); appendAll(el, render()); });
  return el;
}

// A <div> whose innerHTML follows an HTML-string state/derive.
export function htmlDiv(className, html$) {
  const el = van.tags.div({ class: className });
  van.derive(() => { el.innerHTML = html$.val ?? ""; });
  return el;
}

// A <select> kept in sync with a reactive getter. `optionSpecs` are plain
// { value, label } objects so each select builds its own fresh <option> nodes
// (sharing DOM <option> nodes between selects would empty the first one).
export function boundSelect(getValue, onchange, optionSpecs) {
  const { select, option } = van.tags;
  const el = select({ onchange }, optionSpecs.map(o => option({ value: o.value }, o.label)));
  van.derive(() => { el.value = String(getValue() ?? ""); });
  return el;
}

export { van };
