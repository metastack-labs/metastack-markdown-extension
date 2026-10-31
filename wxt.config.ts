import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

// https://wxt.dev/api/config.html
export default defineConfig({
	srcDir: 'src',
	modules: ['@wxt-dev/module-react', '@wxt-dev/auto-icons'],
	imports: false,
	manifest: ({ browser }) => ({
		name: '__MSG_extensionName__',
		description: '__MSG_extensionDescription__',
		default_locale: 'en',
		permissions: ['storage'],
		action: { default_title: '__MSG_actionTitle__' },
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
							id: 'metastack-markdown@metastack-labs',
							strict_min_version: '140.0',
							data_collection_permissions: { required: ['none'] },
						},
						gecko_android: { strict_min_version: '142.0' },
					},
				}
			: {}),
	}),
	vite: () => ({
		plugins: [tailwindcss()],
	}),
});
