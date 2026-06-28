import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter(),
		prerender: {
			// The home page and most controllers (bible/, lowerthird/, scoreboard/,
			// clock/, editor/) are build-free static HTML files served straight from
			// static/. The remaining Svelte routes (songs/,
			// bible/svelte.html) are prerendered explicitly, without crawling links
			// — crawl: false keeps the crawler from following <a> tags into the
			// static files (which are not routes and would 404).
			entries: ['*'],
			crawl: false,
		}
	}
};

export default config;
