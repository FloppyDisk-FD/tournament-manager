import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({
			// Pages 项目名，部署前在 CF dashboard 创建或用 wrangler pages 创建
			// routes 保留默认即可：/api/* 优先匹配 functions/ 目录，其余走 SvelteKit
		}),
	},
};

export default config;
