import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { browser } from 'wxt/browser';
import { DEFAULT_SETTINGS, normaliseSettings, SETTINGS_KEY, type Settings } from '../lib/settings.ts';

const THEME_CACHE_KEY = 'metastack-markdown:theme';

/** Settings from extension storage, kept in sync across tabs. */
export function useSettings(): [Settings, (patch: Partial<Settings>) => void] {
	const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

	useEffect(() => {
		let cancelled = false;
		void browser.storage.local.get(SETTINGS_KEY).then((stored) => {
			if (!cancelled) setSettings(normaliseSettings(stored[SETTINGS_KEY]));
		});
		const onChanged = (changes: Record<string, { newValue?: unknown }>, area: string) => {
			if (area === 'local' && SETTINGS_KEY in changes) {
				setSettings(normaliseSettings(changes[SETTINGS_KEY]?.newValue));
			}
		};
		browser.storage.onChanged.addListener(onChanged);
		return () => {
			cancelled = true;
			browser.storage.onChanged.removeListener(onChanged);
		};
	}, []);

	const update = useCallback((patch: Partial<Settings>) => {
		setSettings((current) => {
			const next = normaliseSettings({ ...current, ...patch });
			void browser.storage.local.set({ [SETTINGS_KEY]: next });
			return next;
		});
	}, []);

	return [settings, update];
}

function subscribeToColorScheme(callback: () => void): () => void {
	const query = window.matchMedia('(prefers-color-scheme: dark)');
	query.addEventListener('change', callback);
	return () => query.removeEventListener('change', callback);
}

/** Resolve the theme preference and apply it to <html data-theme>. Returns true when dark. */
export function useAppliedTheme(preference: Settings['theme']): boolean {
	const systemDark = useSyncExternalStore(
		subscribeToColorScheme,
		() => window.matchMedia('(prefers-color-scheme: dark)').matches,
		() => true
	);
	const dark = preference === 'dark' || (preference === 'system' && systemDark);
	useEffect(() => {
		const theme = dark ? 'dark' : 'light';
		document.documentElement.dataset.theme = theme;
		try {
			localStorage.setItem(THEME_CACHE_KEY, theme);
		} catch {
			// Storage can be unavailable; the theme still applies for this session.
		}
	}, [dark]);
	return dark;
}

/** Apply the last theme synchronously before first paint to avoid a flash. */
export function applyCachedTheme(): void {
	let theme: string | null = null;
	try {
		theme = localStorage.getItem(THEME_CACHE_KEY);
	} catch {
		theme = null;
	}
	document.documentElement.dataset.theme =
		theme === 'light' || theme === 'dark'
			? theme
			: window.matchMedia('(prefers-color-scheme: dark)').matches
				? 'dark'
				: 'light';
}
