import { defineConfig } from 'vite';
import devtoolsJson from 'vite-plugin-devtools-json';
import basicSsl from '@vitejs/plugin-basic-ssl';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';

const env = process.env;

const plugins = [
	devtoolsJson({ uuid: '612d0dc7-ecc1-4ebd-8daf-7201d2a8a133' }),

	tailwindcss(),
	sveltekit()
];

if (env.USE_LOCALHOST_SSL) {
	plugins.push(
		// following is not recommended, see:
		// - https://v4.vitejs.dev/config/server-options.html#server-https
		// - https://github.com/vitejs/vite-plugin-basic-ssl
		basicSsl({
			/** name of certification */
			name: 'test',
			/** custom trust domains */
			domains: ['*.custom.com'],
			/** custom certification directory */
			certDir: `${env.HOME}/.devServer/cert`
		})
	);
}

export default defineConfig({
	plugins,
	build: {
		emptyOutDir: true,
		minify: false,
		sourcemap: true
	}
});
