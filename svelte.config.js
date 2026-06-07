import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	kit: {
		// Explicit Node.js adapter for self-hosted deployment
		adapter: adapter(),
		// SvelteKit's csrf.trustedOrigins uses Array.includes() — exact string match only,
		// wildcards like 'http://10.*:*' are never expanded and have no effect.
		// We disable the built-in check via '*' and implement proper origin validation in
		// hooks.server.ts using isLocalNetworkOrigin + BETTER_AUTH_TRUSTED_ORIGINS.
		csrf: {
			trustedOrigins: ['*']
		}
	},

	vitePlugin: {
		// Externalize native modules from Vite's SSR bundling
		inspector: false
	}
};

export default config;
