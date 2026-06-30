import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type Plugin } from 'vite';

// 强制浏览器不缓存任何资源，防止旧的模块缓存（如之前 resolveId 插件重定向的 client.js 内容
// 被缓存在 server.js URL 下）干扰新会话。
function noCachePlugin(): Plugin {
	return {
		name: 'force-no-cache',
		configureServer(server) {
			server.middlewares.use((_req, res, next) => {
				res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
				res.setHeader('Pragma', 'no-cache');
				res.setHeader('Expires', '0');
				next();
			});
		},
	};
}

export default defineConfig({
	plugins: [tailwindcss(), noCachePlugin(), sveltekit()],
	server: {
		port: 5174,
		strictPort: true,
		proxy: {
			'/api': {
				target: 'http://localhost:3001',
				changeOrigin: true,
			},
		},
	},
});
