/**
 * Contract between the file:// content script, the background script and the workspace page.
 *
 * When the browser opens a local Markdown file or folder listing, the content script reads
 * what the browser already loaded (the raw text, or the listing's entries), the background
 * stores it as a handoff, and the tab is replaced with the workspace page, which reads it back.
 */

export interface FileUrlEntry {
	readonly name: string;
	readonly url: string;
	readonly isDirectory: boolean;
}

export type HandoffKind = 'markdown' | 'directory';

export interface Handoff {
	readonly url: string;
	readonly kind: HandoffKind;
	/** Raw Markdown for `markdown` handoffs. */
	readonly text?: string;
	/** Directory entries: the folder itself, or the folder containing the Markdown file. */
	readonly entries?: readonly FileUrlEntry[];
	readonly createdAt: number;
}

export const HANDOFF_KEY_PREFIX = 'handoff:';
export const HANDOFF_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export const HANDOFF_MAX_COUNT = 20;
export const MAX_HANDOFF_ENTRIES = 2000;

export function handoffKey(url: string): string {
	return `${HANDOFF_KEY_PREFIX}${normaliseFileUrl(url)}`;
}

/** Strip query and fragment so `a.md` and `a.md#intro` share one handoff. */
export function normaliseFileUrl(url: string): string {
	const parsed = new URL(url);
	parsed.search = '';
	parsed.hash = '';
	return parsed.href;
}

export interface OpenFileUrlMessage {
	readonly type: 'open-file-url';
	readonly handoff: Omit<Handoff, 'createdAt'>;
}

export interface OpenFileUrlResponse {
	readonly ok: boolean;
	readonly workspaceUrl?: string;
	readonly error?: string;
}

function isFileUrlString(value: unknown): value is string {
	return typeof value === 'string' && /^file:\/\//i.test(value);
}

function sanitiseEntries(value: unknown): FileUrlEntry[] | undefined {
	if (!Array.isArray(value)) return undefined;
	const entries: FileUrlEntry[] = [];
	for (const item of value.slice(0, MAX_HANDOFF_ENTRIES)) {
		if (!item || typeof item !== 'object') continue;
		const { name, url, isDirectory } = item as Record<string, unknown>;
		if (typeof name !== 'string' || !name || !isFileUrlString(url)) continue;
		entries.push({ name, url, isDirectory: isDirectory === true });
	}
	return entries;
}

/** Validates an untrusted message (it originates in a content script) into a handoff. */
export function parseOpenFileUrlMessage(message: unknown): OpenFileUrlMessage | null {
	if (!message || typeof message !== 'object') return null;
	const { type, handoff } = message as Record<string, unknown>;
	if (type !== 'open-file-url' || !handoff || typeof handoff !== 'object') return null;
	const { url, kind, text, entries } = handoff as Record<string, unknown>;
	if (!isFileUrlString(url)) return null;
	if (kind !== 'markdown' && kind !== 'directory') return null;
	if (kind === 'markdown' && typeof text !== 'string') return null;
	return {
		type: 'open-file-url',
		handoff: {
			url: normaliseFileUrl(url),
			kind,
			...(typeof text === 'string' ? { text } : {}),
			...(entries !== undefined ? { entries: sanitiseEntries(entries) ?? [] } : {}),
		},
	};
}

export function parseStoredHandoff(value: unknown): Handoff | null {
	if (!value || typeof value !== 'object') return null;
	const createdAt = (value as Record<string, unknown>).createdAt;
	const parsed = parseOpenFileUrlMessage({ type: 'open-file-url', handoff: value });
	if (!parsed || typeof createdAt !== 'number') return null;
	return { ...parsed.handoff, createdAt };
}

/** Keys to delete so at most `maxCount` handoffs younger than `maxAgeMs` remain. */
export function staleHandoffKeys(
	stored: Record<string, unknown>,
	now: number,
	maxAgeMs = HANDOFF_MAX_AGE_MS,
	maxCount = HANDOFF_MAX_COUNT
): string[] {
	const live: Array<{ key: string; createdAt: number }> = [];
	const stale: string[] = [];
	for (const [key, value] of Object.entries(stored)) {
		if (!key.startsWith(HANDOFF_KEY_PREFIX)) continue;
		const createdAt = (value as { createdAt?: unknown } | null)?.createdAt;
		if (typeof createdAt !== 'number' || now - createdAt > maxAgeMs) stale.push(key);
		else live.push({ key, createdAt });
	}
	live.sort((a, b) => b.createdAt - a.createdAt);
	for (const item of live.slice(maxCount)) stale.push(item.key);
	return stale;
}

/** Workspace page path, relative to the extension root. */
export const WORKSPACE_PATH = '/workspace.html';

export function workspaceQueryForFileUrl(url: string): string {
	return `?src=${encodeURIComponent(url)}`;
}
