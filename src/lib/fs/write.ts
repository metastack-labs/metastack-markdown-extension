import { detectLineEnding, type LineEnding, sameText } from './eol.ts';
import type { FileNode } from './nodes.ts';
import { candidatePathsWithinRoot, splitPath } from './paths.ts';

export type AccessMode = 'read' | 'readwrite';

/** Current permission without prompting. Non-FS-Access browsers report `denied`. */
export async function queryAccess(handle: FileSystemHandle, mode: AccessMode): Promise<PermissionState> {
	if (!handle.queryPermission) return 'granted';
	try {
		return await handle.queryPermission({ mode });
	} catch {
		return 'denied';
	}
}

/** Ask for permission if needed. Must run during a user gesture (click or key press). */
export async function requestAccess(handle: FileSystemHandle, mode: AccessMode): Promise<boolean> {
	if ((await queryAccess(handle, mode)) === 'granted') return true;
	if (!handle.requestPermission) return false;
	try {
		return (await handle.requestPermission({ mode })) === 'granted';
	} catch {
		return false;
	}
}

export class SaveConflictError extends Error {
	constructor() {
		super('This file changed on disk after you opened it.');
		this.name = 'SaveConflictError';
	}
}

export interface WriteResult {
	readonly lastModified: number | null;
}

/**
 * Write text to a file handle. When `expectedLastModified` is given and the file on disk is
 * newer, throws SaveConflictError instead of overwriting someone else's change.
 */
export async function writeHandle(
	handle: FileSystemFileHandle,
	text: string,
	expectedLastModified: number | null = null
): Promise<WriteResult> {
	if (!(await requestAccess(handle, 'readwrite'))) {
		throw new Error('The browser did not grant permission to save this file.');
	}
	if (expectedLastModified !== null) {
		const current = await handle.getFile();
		if (current.lastModified > expectedLastModified) throw new SaveConflictError();
	}
	const writable = await handle.createWritable();
	try {
		await writable.write(text);
		await writable.close();
	} catch (error) {
		await writable.abort().catch(() => undefined);
		throw error;
	}
	const saved = await handle.getFile();
	return { lastModified: saved.lastModified };
}

export class FileExistsError extends Error {
	constructor(name: string) {
		super(`“${name}” already exists in this folder.`);
		this.name = 'FileExistsError';
	}
}

/** Create a new file (never overwrites). */
export async function createFile(
	directory: FileSystemDirectoryHandle,
	name: string,
	text: string
): Promise<FileSystemFileHandle> {
	if (!(await requestAccess(directory, 'readwrite'))) {
		throw new Error('The browser did not grant permission to add files to this folder.');
	}
	try {
		await directory.getFileHandle(name);
		throw new FileExistsError(name);
	} catch (error) {
		if (error instanceof FileExistsError) throw error;
		if (!(error instanceof DOMException) || error.name !== 'NotFoundError') throw error;
	}
	const handle = await directory.getFileHandle(name, { create: true });
	await writeHandle(handle, text);
	return handle;
}

/**
 * Find the file at an absolute path inside a granted folder. A folder handle only knows its
 * own name, so each place that name appears in the path is tried, and a candidate only counts
 * when its contents match what we loaded (so a same-named folder elsewhere can't be overwritten).
 */
export async function locateInFolder(
	folder: FileSystemDirectoryHandle,
	absolutePath: string,
	expectedText: string
): Promise<{ readonly handle: FileSystemFileHandle; readonly eol: LineEnding } | null> {
	for (const candidate of candidatePathsWithinRoot(absolutePath, folder.name)) {
		const segments = splitPath(candidate);
		const name = segments.pop();
		if (!name) continue;
		try {
			let directory = folder;
			for (const segment of segments) directory = await directory.getDirectoryHandle(segment);
			const handle = await directory.getFileHandle(name);
			const text = await (await handle.getFile()).text();
			// The browser's text view normalises CRLF, so compare ignoring line endings.
			if (sameText(text, expectedText)) return { handle, eol: detectLineEnding(text) };
		} catch {
			// Not this candidate.
		}
	}
	return null;
}

/* ── Saving without a writable handle ── */

const MARKDOWN_TYPES: FilePickerAcceptType[] = [
	{ description: 'Markdown', accept: { 'text/markdown': ['.md', '.markdown'] } },
];

/** "Save as…" with the native picker (Chrome/Edge). Returns null when the user cancels. */
export async function saveAsWithPicker(suggestedName: string, text: string): Promise<FileSystemFileHandle | null> {
	if (!window.showSaveFilePicker) return null;
	let handle: FileSystemFileHandle;
	try {
		handle = await window.showSaveFilePicker({ suggestedName, types: MARKDOWN_TYPES, id: 'metastack-markdown-save' });
	} catch (error) {
		if (error instanceof DOMException && error.name === 'AbortError') return null;
		throw error;
	}
	await writeHandle(handle, text);
	return handle;
}

/** Download a copy (works everywhere, including Firefox). */
export function downloadText(name: string, text: string): void {
	const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }));
	const link = document.createElement('a');
	link.href = url;
	link.download = name;
	link.rel = 'noopener';
	document.body.append(link);
	link.click();
	link.remove();
	setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function isWritable(node: FileNode | null): node is FileNode & { backend: { type: 'handle' } } {
	return node?.backend.type === 'handle';
}
