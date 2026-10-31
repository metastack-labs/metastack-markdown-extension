import { browser } from 'wxt/browser';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { isMarkdownName } from '../lib/fs/file-types.ts';
import { containingDirectoryUrl } from '../lib/fs/paths.ts';
import type { FileUrlEntry, OpenFileUrlMessage, OpenFileUrlResponse } from '../lib/handoff.ts';
import { normaliseSettings, SETTINGS_KEY } from '../lib/settings.ts';

/**
 * Runs on file:// pages. When the browser opens a local Markdown file (or a folder listing),
 * read what the browser already loaded and hand it to the workspace page, which replaces
 * this tab. Inside a hidden iframe, it instead reports that folder's listing to the parent.
 */
export default defineContentScript({
	matches: ['file:///*'],
	runAt: 'document_start',
	allFrames: true,
	main() {
		if (window !== window.top) void reportListingToParent();
		else void handOff();
	},
});

const LISTING_MESSAGE = 'metastack-markdown:listing';
const LISTING_TIMEOUT_MS = 2500;
const REVEAL_FAILSAFE_MS = 5000;

function domReady(): Promise<void> {
	if (document.readyState !== 'loading') return Promise.resolve();
	return new Promise((resolve) => document.addEventListener('DOMContentLoaded', () => resolve(), { once: true }));
}

/** Hide the browser's raw view while we decide, so the hand-off doesn't flash. */
function hidePage(): () => void {
	const style = document.createElement('style');
	style.textContent = 'html { visibility: hidden !important; }';
	(document.head ?? document.documentElement).append(style);
	const reveal = () => style.remove();
	setTimeout(reveal, REVEAL_FAILSAFE_MS);
	return reveal;
}

/* ── Folder listings (Chrome and Firefox both render file:// folders as HTML tables) ── */

function isDirectoryListing(doc: Document): boolean {
	return Boolean(
		doc.getElementById('parentDirLinkBox') || // Chrome
			doc.getElementById('UI_goUp') || // Firefox
			doc.querySelector('link[href*="dirListing"]') || // Firefox
			/^Index of\s/i.test(doc.title)
	);
}

function extractListing(doc: Document): FileUrlEntry[] {
	const here = new URL(doc.location.href);
	here.hash = '';
	here.search = '';
	const seen = new Set<string>();
	const entries: FileUrlEntry[] = [];
	for (const link of doc.querySelectorAll<HTMLAnchorElement>('table tbody a[href]')) {
		const href = link.getAttribute('href');
		if (!href) continue;
		const url = new URL(href, here).href;
		const name = (link.textContent ?? '').trim().replace(/\/$/, '');
		if (!url.startsWith('file://') || !name || name === '..' || seen.has(url)) continue;
		// Skip links that point back up (the "parent directory" row).
		if (here.href.startsWith(url)) continue;
		seen.add(url);
		entries.push({ name, url, isDirectory: url.endsWith('/') || link.classList.contains('dir') });
	}
	return entries;
}

async function reportListingToParent(): Promise<void> {
	await domReady();
	if (!isDirectoryListing(document)) return;
	let entries = extractListing(document);
	if (entries.length === 0) {
		// Chrome fills the table from inline scripts; give them until load to finish.
		await new Promise((resolve) => window.addEventListener('load', resolve, { once: true }));
		entries = extractListing(document);
	}
	window.parent.postMessage({ type: LISTING_MESSAGE, url: location.href, entries }, '*');
}

/** Load a folder listing in a hidden iframe and collect what its content script reports. */
function listingViaIframe(directoryUrl: string): Promise<FileUrlEntry[] | undefined> {
	return new Promise((resolve) => {
		const frame = document.createElement('iframe');
		frame.setAttribute('aria-hidden', 'true');
		frame.tabIndex = -1;
		frame.style.cssText = 'position:fixed;width:0;height:0;border:0;opacity:0;pointer-events:none;';
		const finish = (entries: FileUrlEntry[] | undefined) => {
			clearTimeout(timer);
			window.removeEventListener('message', onMessage);
			frame.remove();
			resolve(entries);
		};
		const onMessage = (event: MessageEvent) => {
			const data = event.data as { type?: unknown; entries?: unknown } | null;
			if (event.source !== frame.contentWindow || data?.type !== LISTING_MESSAGE) return;
			finish(Array.isArray(data.entries) ? (data.entries as FileUrlEntry[]) : undefined);
		};
		const timer = setTimeout(() => finish(undefined), LISTING_TIMEOUT_MS);
		window.addEventListener('message', onMessage);
		frame.src = directoryUrl;
		document.documentElement.append(frame);
	});
}

/* ── Hand-off ── */

function rawText(): string | null {
	if (document.contentType.includes('html')) return null;
	const pre = document.body?.querySelector(':scope > pre');
	return pre?.textContent ?? null;
}

async function handOff(): Promise<void> {
	const url = new URL(location.href);
	const path = decodeURIComponent(url.pathname);
	const isMarkdown = isMarkdownName(path);
	const maybeDirectory = path.endsWith('/');
	if (!isMarkdown && !maybeDirectory) return;

	const reveal = hidePage();
	try {
		const stored = await browser.storage.local.get(SETTINGS_KEY);
		const settings = normaliseSettings(stored[SETTINGS_KEY]);
		if (isMarkdown ? !settings.openLocalMarkdown : !settings.openLocalFolders) return reveal();

		await domReady();
		let message: OpenFileUrlMessage;
		if (isMarkdown) {
			const text = rawText();
			if (text === null) return reveal();
			const entries = await listingViaIframe(containingDirectoryUrl(url.href));
			message = { type: 'open-file-url', handoff: { url: url.href, kind: 'markdown', text, entries } };
		} else {
			if (!isDirectoryListing(document)) return reveal();
			message = {
				type: 'open-file-url',
				handoff: { url: url.href, kind: 'directory', entries: extractListing(document) },
			};
		}

		const response = (await browser.runtime.sendMessage(message)) as OpenFileUrlResponse | undefined;
		if (response?.ok && response.workspaceUrl) {
			// Replace (not push) so Back doesn't bounce through this page again.
			location.replace(`${response.workspaceUrl}${url.hash}`);
			return;
		}
		reveal();
	} catch {
		reveal();
	}
}
