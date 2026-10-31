import type { FileUrlEntry } from '../handoff.ts';
import { type LineEnding, normaliseLineEndings } from './eol.ts';
import { readFileUrlBlob } from './file-url-read.ts';
import { createIgnoreMatcher, type IgnoreMatcher, isAlwaysIgnored } from './gitignore.ts';
import { basename, joinPath, splitPath } from './paths.ts';

/**
 * One file-tree model over the four ways a browser can hand us local files:
 *  - `handle`: File System Access handles (Chrome/Edge) — readable and writable.
 *  - `entry`:  drag-and-drop FileSystemEntry objects (all browsers) — read-only.
 *  - `memory`: File objects from <input type=file webkitdirectory> (all browsers) — read-only.
 *  - `url`:    file:// URLs handed off from the browser's own file view — read-only here.
 */
export type DirectoryBackend =
	| { readonly type: 'handle'; readonly handle: FileSystemDirectoryHandle }
	| { readonly type: 'entry'; readonly entry: FileSystemDirectoryEntry }
	| { readonly type: 'memory'; readonly children: readonly TreeNode[] }
	| { readonly type: 'url'; readonly url: string };

export type FileBackend =
	| { readonly type: 'handle'; readonly handle: FileSystemFileHandle }
	| { readonly type: 'entry'; readonly entry: FileSystemFileEntry }
	| { readonly type: 'memory'; readonly file: File }
	| { readonly type: 'url'; readonly url: string };

export interface DirectoryNode {
	readonly kind: 'directory';
	/** Unique key: `${rootId}:${path}`. */
	readonly key: string;
	readonly rootId: string;
	readonly name: string;
	/** Root-relative path; '' for the root itself. */
	readonly path: string;
	readonly backend: DirectoryBackend;
}

export interface FileNode {
	readonly kind: 'file';
	readonly key: string;
	readonly rootId: string;
	readonly name: string;
	readonly path: string;
	readonly backend: FileBackend;
}

export type TreeNode = DirectoryNode | FileNode;

export function nodeKey(rootId: string, path: string): string {
	return `${rootId}:${path}`;
}

export function sortNodes<T extends TreeNode>(nodes: T[]): T[] {
	return nodes.sort((a, b) => {
		if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1;
		return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
	});
}

/* ── Reading ── */

export interface FileSnapshot {
	/** Contents with LF line endings. */
	readonly text: string;
	/** The file's own line ending, restored on save. */
	readonly eol: LineEnding;
	readonly lastModified: number | null;
}

function entryFile(entry: FileSystemFileEntry): Promise<File> {
	return new Promise((resolve, reject) => entry.file(resolve, reject));
}

export async function getFile(node: FileNode): Promise<File> {
	const { backend } = node;
	switch (backend.type) {
		case 'handle':
			return backend.handle.getFile();
		case 'entry':
			return entryFile(backend.entry);
		case 'memory':
			return backend.file;
		case 'url': {
			const blob = await readFileUrlBlob(backend.url);
			if (!blob) throw new Error(`The browser didn't allow reading “${node.name}” directly.`);
			return new File([blob], node.name);
		}
	}
}

export async function readFileNode(node: FileNode): Promise<FileSnapshot> {
	const file = await getFile(node);
	const { text, eol } = normaliseLineEndings(await file.text());
	return { text, eol, lastModified: node.backend.type === 'url' ? null : file.lastModified };
}

/** First Markdown heading (or front-matter title) from the start of a file, for the file list. */
export async function readTitle(node: FileNode): Promise<string | null> {
	const file = await getFile(node);
	const head = await file.slice(0, 4096).text();
	const frontMatterTitle = /^---\r?\n[\s\S]*?^title:[ \t]*['"]?(.+?)['"]?[ \t]*$[\s\S]*?^---/m.exec(head);
	if (frontMatterTitle?.[1]) return frontMatterTitle[1].trim();
	const withoutCode = head.replace(/^(`{3,}|~{3,})[\s\S]*?^\1/gm, '');
	const heading = /^#{1,6}[ \t]+(.+?)[ \t#]*$/m.exec(withoutCode);
	return heading?.[1]?.replace(/[*_`]/g, '').trim() || null;
}

/* ── Listing ── */

function readEntries(directory: FileSystemDirectoryEntry): Promise<FileSystemEntry[]> {
	const reader = directory.createReader();
	const all: FileSystemEntry[] = [];
	return new Promise((resolve, reject) => {
		const next = () =>
			reader.readEntries((batch) => {
				if (batch.length === 0) resolve(all);
				else {
					all.push(...batch);
					next();
				}
			}, reject);
		next();
	});
}

export interface ListOptions {
	readonly ignore?: IgnoreMatcher | null;
}

function keep(path: string, name: string, isDirectory: boolean, options: ListOptions): boolean {
	if (isAlwaysIgnored(name, isDirectory)) return false;
	return !options.ignore?.(path, isDirectory);
}

/** Children of a directory, sorted folders-first, with ignored entries removed. */
export async function listDirectory(directory: DirectoryNode, options: ListOptions = {}): Promise<TreeNode[]> {
	const { backend, rootId } = directory;
	const nodes: TreeNode[] = [];
	const at = (name: string) => joinPath(directory.path, name);

	if (backend.type === 'handle') {
		for await (const handle of backend.handle.values()) {
			const path = at(handle.name);
			const isDirectory = handle.kind === 'directory';
			if (!keep(path, handle.name, isDirectory, options)) continue;
			nodes.push(
				isDirectory
					? {
							kind: 'directory',
							key: nodeKey(rootId, path),
							rootId,
							name: handle.name,
							path,
							backend: { type: 'handle', handle: handle as FileSystemDirectoryHandle },
						}
					: {
							kind: 'file',
							key: nodeKey(rootId, path),
							rootId,
							name: handle.name,
							path,
							backend: { type: 'handle', handle: handle as FileSystemFileHandle },
						}
			);
		}
	} else if (backend.type === 'entry') {
		for (const entry of await readEntries(backend.entry)) {
			const path = at(entry.name);
			if (!keep(path, entry.name, entry.isDirectory, options)) continue;
			nodes.push(
				entry.isDirectory
					? {
							kind: 'directory',
							key: nodeKey(rootId, path),
							rootId,
							name: entry.name,
							path,
							backend: { type: 'entry', entry: entry as FileSystemDirectoryEntry },
						}
					: {
							kind: 'file',
							key: nodeKey(rootId, path),
							rootId,
							name: entry.name,
							path,
							backend: { type: 'entry', entry: entry as FileSystemFileEntry },
						}
			);
		}
	} else if (backend.type === 'memory') {
		for (const child of backend.children) {
			if (keep(child.path, child.name, child.kind === 'directory', options)) nodes.push(child);
		}
	}
	// `url` directories are listed by the handoff, not here.
	return sortNodes(nodes);
}

/** Root `.gitignore` → matcher, or `null` when there is none. */
export async function loadIgnoreMatcher(root: DirectoryNode): Promise<IgnoreMatcher | null> {
	try {
		const file = await findFile(root, '.gitignore');
		if (!file) return null;
		const { text } = await readFileNode(file);
		return createIgnoreMatcher(text);
	} catch {
		return null;
	}
}

/* ── Lookup by path ── */

function entryLookup(
	directory: FileSystemDirectoryEntry,
	path: string,
	kind: 'file' | 'directory'
): Promise<FileSystemEntry | null> {
	return new Promise((resolve) => {
		const options = { create: false };
		const ok = (entry: FileSystemEntry) => resolve(entry);
		const fail = () => resolve(null);
		if (kind === 'file') directory.getFile(path, options, ok, fail);
		else directory.getDirectory(path, options, ok, fail);
	});
}

async function directoryHandleAt(
	root: FileSystemDirectoryHandle,
	segments: string[]
): Promise<FileSystemDirectoryHandle | null> {
	let current = root;
	for (const segment of segments) {
		try {
			current = await current.getDirectoryHandle(segment);
		} catch {
			return null;
		}
	}
	return current;
}

/** Find a file by root-relative path. */
export async function findFile(root: DirectoryNode, path: string): Promise<FileNode | null> {
	const segments = splitPath(path);
	const name = segments.pop();
	if (!name) return null;
	const normalised = joinPath(path);
	const base = {
		kind: 'file' as const,
		key: nodeKey(root.rootId, normalised),
		rootId: root.rootId,
		name,
		path: normalised,
	};

	switch (root.backend.type) {
		case 'handle': {
			const parent = await directoryHandleAt(root.backend.handle, segments);
			if (!parent) return null;
			try {
				return { ...base, backend: { type: 'handle', handle: await parent.getFileHandle(name) } };
			} catch {
				return null;
			}
		}
		case 'entry': {
			const entry = await entryLookup(root.backend.entry, normalised, 'file');
			return entry?.isFile ? { ...base, backend: { type: 'entry', entry: entry as FileSystemFileEntry } } : null;
		}
		case 'memory': {
			let children = root.backend.children;
			for (const segment of segments) {
				const next = children.find((child) => child.kind === 'directory' && child.name === segment);
				if (next?.kind !== 'directory' || next.backend.type !== 'memory') return null;
				children = next.backend.children;
			}
			const found = children.find((child) => child.kind === 'file' && child.name === name);
			return found?.kind === 'file' ? found : null;
		}
		case 'url':
			return { ...base, backend: { type: 'url', url: new URL(normalised, root.backend.url).href } };
	}
}

/** Directory node for a root-relative path (handle, entry and memory backends). */
export async function findDirectory(root: DirectoryNode, path: string): Promise<DirectoryNode | null> {
	const normalised = joinPath(path);
	if (!normalised) return root;
	const segments = splitPath(normalised);
	const base = {
		kind: 'directory' as const,
		key: nodeKey(root.rootId, normalised),
		rootId: root.rootId,
		name: basename(normalised),
		path: normalised,
	};
	if (root.backend.type === 'handle') {
		const handle = await directoryHandleAt(root.backend.handle, segments);
		return handle ? { ...base, backend: { type: 'handle', handle } } : null;
	}
	if (root.backend.type === 'entry') {
		const entry = await entryLookup(root.backend.entry, normalised, 'directory');
		return entry?.isDirectory
			? { ...base, backend: { type: 'entry', entry: entry as FileSystemDirectoryEntry } }
			: null;
	}
	if (root.backend.type === 'memory') {
		let current: DirectoryNode = root;
		for (const segment of segments) {
			if (current.backend.type !== 'memory') return null;
			const next = current.backend.children.find((child) => child.kind === 'directory' && child.name === segment);
			if (next?.kind !== 'directory') return null;
			current = next;
		}
		return current;
	}
	return null;
}

/* ── Building roots ── */

let rootCounter = 0;
export function newRootId(prefix: string): string {
	rootCounter += 1;
	return `${prefix}-${Date.now().toString(36)}-${rootCounter}`;
}

export function rootFromHandle(handle: FileSystemDirectoryHandle, rootId: string): DirectoryNode {
	return {
		kind: 'directory',
		key: nodeKey(rootId, ''),
		rootId,
		name: handle.name,
		path: '',
		backend: { type: 'handle', handle },
	};
}

export function rootFromEntry(entry: FileSystemDirectoryEntry, rootId: string): DirectoryNode {
	return {
		kind: 'directory',
		key: nodeKey(rootId, ''),
		rootId,
		name: entry.name,
		path: '',
		backend: { type: 'entry', entry },
	};
}

/** Tree from an <input webkitdirectory> FileList (each File has a webkitRelativePath). */
export function rootFromFileList(files: readonly File[], rootId: string): DirectoryNode | null {
	if (files.length === 0) return null;
	const rootName = splitPath(files[0]?.webkitRelativePath ?? '')[0] ?? 'Folder';
	type Draft = { name: string; path: string; dirs: Map<string, Draft>; files: FileNode[] };
	const top: Draft = { name: rootName, path: '', dirs: new Map(), files: [] };
	for (const file of files) {
		const segments = splitPath(file.webkitRelativePath || file.name).slice(1);
		const name = segments.pop();
		if (!name) continue;
		let cursor = top;
		for (const segment of segments) {
			let next = cursor.dirs.get(segment);
			if (!next) {
				next = { name: segment, path: joinPath(cursor.path, segment), dirs: new Map(), files: [] };
				cursor.dirs.set(segment, next);
			}
			cursor = next;
		}
		const path = joinPath(cursor.path, name);
		cursor.files.push({
			kind: 'file',
			key: nodeKey(rootId, path),
			rootId,
			name,
			path,
			backend: { type: 'memory', file },
		});
	}
	const build = (draft: Draft): DirectoryNode => ({
		kind: 'directory',
		key: nodeKey(rootId, draft.path),
		rootId,
		name: draft.name,
		path: draft.path,
		backend: { type: 'memory', children: sortNodes([...[...draft.dirs.values()].map(build), ...draft.files]) },
	});
	return build(top);
}

/** Nodes for a file:// directory listing handed off by the content script. */
export function nodesFromFileUrlEntries(rootId: string, entries: readonly FileUrlEntry[]): TreeNode[] {
	return sortNodes(
		entries
			.filter((entry) => !isAlwaysIgnored(entry.name, entry.isDirectory))
			.map(
				(entry): TreeNode =>
					entry.isDirectory
						? {
								kind: 'directory',
								key: nodeKey(rootId, entry.url),
								rootId,
								name: entry.name,
								path: entry.url,
								backend: { type: 'url', url: entry.url },
							}
						: {
								kind: 'file',
								key: nodeKey(rootId, entry.url),
								rootId,
								name: entry.name,
								path: entry.url,
								backend: { type: 'url', url: entry.url },
							}
			)
	);
}

export function looseFileNode(name: string, backend: FileBackend): FileNode {
	const rootId = newRootId('file');
	return { kind: 'file', key: nodeKey(rootId, name), rootId, name, path: name, backend };
}
