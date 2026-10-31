/** Root-relative paths use `/` separators and never start or end with `/`. */

export function splitPath(path: string): string[] {
	return path.split('/').filter((part) => part.length > 0);
}

export function joinPath(...parts: string[]): string {
	return splitPath(parts.join('/')).join('/');
}

export function dirname(path: string): string {
	const parts = splitPath(path);
	parts.pop();
	return parts.join('/');
}

export function basename(path: string): string {
	return splitPath(path).pop() ?? '';
}

export function extname(name: string): string {
	const base = basename(name);
	const dot = base.lastIndexOf('.');
	return dot <= 0 ? '' : base.slice(dot).toLowerCase();
}

export interface ResolvedReference {
	/** Root-relative path of the target. */
	readonly path: string;
	/** Fragment without `#`, or `null`. */
	readonly hash: string | null;
}

/** decodeURIComponent that leaves malformed sequences (like a bare `%`) as they are. */
export function safeDecode(value: string): string {
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
}

/**
 * Resolve a relative link or image reference (`../img/a.png`, `./b.md#intro`, `/docs/c.md`)
 * against the directory of the current document. A leading `/` means the folder root.
 * Returns `null` when the reference climbs above the root.
 */
export function resolveReference(fromDir: string, reference: string): ResolvedReference | null {
	const hashIndex = reference.indexOf('#');
	const rawHash = hashIndex >= 0 ? reference.slice(hashIndex + 1) : null;
	const withoutHash = hashIndex >= 0 ? reference.slice(0, hashIndex) : reference;
	const queryIndex = withoutHash.indexOf('?');
	const pathPart = safeDecode(queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash);

	const stack = pathPart.startsWith('/') ? [] : splitPath(fromDir);
	for (const segment of splitPath(pathPart)) {
		if (segment === '.') continue;
		if (segment === '..') {
			if (stack.length === 0) return null;
			stack.pop();
			continue;
		}
		stack.push(segment);
	}
	return { path: stack.join('/'), hash: rawHash ? safeDecode(rawHash) : null };
}

/* ── file:// URLs ── */

export function isFileUrl(url: string): boolean {
	return /^file:\/\//i.test(url);
}

/** Absolute filesystem path (POSIX style, decoded) for a file:// URL. */
export function fileUrlToPath(url: string): string {
	return safeDecode(new URL(url).pathname);
}

/** Directory URL (with trailing slash) that contains the given file or directory URL. */
export function parentDirectoryUrl(url: string): string | null {
	const parsed = new URL(url);
	const trimmed = parsed.pathname.endsWith('/') ? parsed.pathname.slice(0, -1) : parsed.pathname;
	const slash = trimmed.lastIndexOf('/');
	if (slash < 0 || trimmed === '') return null;
	parsed.pathname = trimmed.slice(0, slash + 1);
	parsed.search = '';
	parsed.hash = '';
	return parsed.href;
}

/** URL of the directory a file URL lives in (or the URL itself if it is a directory). */
export function containingDirectoryUrl(url: string): string {
	const parsed = new URL(url);
	parsed.search = '';
	parsed.hash = '';
	if (parsed.pathname.endsWith('/')) return parsed.href;
	parsed.pathname = parsed.pathname.slice(0, parsed.pathname.lastIndexOf('/') + 1);
	return parsed.href;
}

export interface Crumb {
	readonly name: string;
	readonly url: string;
}

/** One crumb per directory segment of a file:// URL, each linking to its directory listing. */
export function fileUrlCrumbs(url: string): Crumb[] {
	const parsed = new URL(url);
	const segments = parsed.pathname.split('/').filter(Boolean);
	const isDirectory = parsed.pathname.endsWith('/');
	const dirSegments = isDirectory ? segments : segments.slice(0, -1);
	const crumbs: Crumb[] = [];
	let acc = '';
	for (const segment of dirSegments) {
		acc += `/${segment}`;
		crumbs.push({ name: safeDecode(segment), url: `file://${acc}/` });
	}
	return crumbs;
}

/**
 * Relative paths a granted folder named `rootName` could use to reach `absolutePath`,
 * one per occurrence of that name among the path's parent directories (shallowest first).
 * The caller confirms which candidate is real by reading the file.
 */
export function candidatePathsWithinRoot(absolutePath: string, rootName: string): string[] {
	const segments = splitPath(absolutePath);
	const candidates: string[] = [];
	for (let i = 0; i < segments.length - 1; i++) {
		if (segments[i] === rootName) candidates.push(segments.slice(i + 1).join('/'));
	}
	return candidates;
}
