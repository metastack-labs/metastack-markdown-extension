import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

const REPOSITORY_URL = 'https://github.com/metastack-labs/metastack-markdown-extension';

/** Committed PNGs rendered from the MetaStack mark by `bun run brand`. */
const ICONS = { 16: 'icons/16.png', 32: 'icons/32.png', 48: 'icons/48.png', 128: 'icons/128.png' };

// https://wxt.dev/api/config.html
export default defineConfig({
	srcDir: 'src',
	modules: ['@wxt-dev/module-react'],
	imports: false,
	manifest: ({ browser }) => ({
		name: '__MSG_extensionName__',
		description: '__MSG_extensionDescription__',
		default_locale: 'en',
		homepage_url: REPOSITORY_URL,
		icons: ICONS,
		// Store reviews and the privacy policy describe exactly these; scripts/verify-build.ts enforces it.
		permissions: ['storage'],
		action: { default_title: '__MSG_actionTitle__', default_icon: { 16: ICONS[16], 32: ICONS[32] } },
		commands: {
			'open-workspace': {
				suggested_key: { default: 'Alt+Shift+M' },
				description: '__MSG_commandOpenWorkspace__',
			},
		},
		// Lets the file:// content script replace the browser's plain-text view with the workspace.
		web_accessible_resources: [{ resources: ['workspace.html'], matches: ['file:///*'] }],
		...(browser === 'firefox'
			? {
					browser_specific_settings: {
						gecko: {
							// Permanent once published on addons.mozilla.org.
							id: 'markdown@metastacklabs.com',
							// Firefox 140 is the first with built-in data collection consent.
							strict_min_version: '140.0',
							data_collection_permissions: { required: ['none'] },
						},
						// No `gecko_android`: AMO would list the add-on for Android, where it is untested.
					},
				}
			: {
					// Tailwind CSS 4 and Vite 8's default build target both need Chrome 111.
					minimum_chrome_version: '111',
				}),
	}),
	zip: {
		// AMO reviewers rebuild the add-on from the sources zip; ship what the build needs and the docs that explain it.
		excludeSources: ['assets/**', 'docs/**', 'examples/**', 'scripts/**'],
	},
	vite: () => ({
		plugins: [tailwindcss()],
	}),
});
