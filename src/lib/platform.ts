import { browser } from 'wxt/browser';

export const IS_FIREFOX = import.meta.env.FIREFOX;

/** Chrome/Edge expose the File System Access API; Firefox does not. */
export function supportsFileSystemAccess(): boolean {
	return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';
}

/** Whether the user enabled "Allow access to file URLs" (Chrome). Firefox needs no toggle. */
export async function hasFileUrlAccess(): Promise<boolean> {
	if (IS_FIREFOX) return true;
	try {
		return await browser.extension.isAllowedFileSchemeAccess();
	} catch {
		return false;
	}
}

/** Opens this extension's details page, where "Allow access to file URLs" lives (Chrome). */
export async function openExtensionDetails(): Promise<void> {
	await browser.tabs.create({ url: `chrome://extensions/?id=${browser.runtime.id}` });
}

export const MOD_KEY_LABEL =
	typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl';
