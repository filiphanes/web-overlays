// Expose the Svelte controller at /bible/svelte.html (a real .html file, not a
// directory). `trailingSlash = 'never'` makes the static adapter emit a single
// `build/bible/svelte.html` file; the default index page (/bible/) is the
// build-free vanilla version in static/bible/index.html.
export const prerender = true;
export const trailingSlash = 'never';
