/** Turning drops and pickers into handles, entries or plain files. */

export type IntakeItem =
	| { readonly type: 'directory-handle'; readonly handle: FileSystemDirectoryHandle }
	| { readonly type: 'file-handle'; readonly handle: FileSystemFileHandle }
	| { readonly type: 'directory-entry'; readonly entry: FileSystemDirectoryEntry }
	| { readonly type: 'file'; readonly file: File };

/**
 * Read a drop. Every DataTransferItem accessor must be called synchronously inside the drop
 * event (the data is gone once the handler returns), so collect first and await afterwards.
 * Prefers writable File System Access handles (Chrome/Edge), then entries, then plain files.
 */
export function readDrop(dataTransfer: DataTransfer): Promise<IntakeItem[]> {
	const pending: Array<Promise<IntakeItem | null>> = [];
	for (const item of Array.from(dataTransfer.items)) {
		if (item.kind !== 'file') continue;
		const handlePromise = item.getAsFileSystemHandle?.() ?? null;
		const entry = item.webkitGetAsEntry?.() ?? null;
		const file = item.getAsFile();
		pending.push(
			(async (): Promise<IntakeItem | null> => {
				if (handlePromise) {
					try {
						const handle = await handlePromise;
						if (handle?.kind === 'directory') {
							return { type: 'directory-handle', handle: handle as FileSystemDirectoryHandle };
						}
						if (handle?.kind === 'file') return { type: 'file-handle', handle: handle as FileSystemFileHandle };
					} catch {
						// Fall through to the entry or file.
					}
				}
				if (entry?.isDirectory) return { type: 'directory-entry', entry: entry as FileSystemDirectoryEntry };
				return file ? { type: 'file', file } : null;
			})()
		);
	}
	return Promise.all(pending).then((items) => items.filter((item): item is IntakeItem => item !== null));
}

export function dragHasFiles(event: DragEvent): boolean {
	return Array.from(event.dataTransfer?.types ?? []).includes('Files');
}

function isAbort(error: unknown): boolean {
	return error instanceof DOMException && error.name === 'AbortError';
}

/** Native folder picker (Chrome/Edge). `null` when cancelled or unsupported. */
export async function pickDirectory(
	mode: 'read' | 'readwrite' = 'readwrite'
): Promise<FileSystemDirectoryHandle | null> {
	if (!window.showDirectoryPicker) return null;
	try {
		return await window.showDirectoryPicker({ id: 'metastack-markdown-folder', mode });
	} catch (error) {
		if (isAbort(error)) return null;
		throw error;
	}
}

/** Native file picker (Chrome/Edge). Empty when cancelled or unsupported. */
export async function pickFiles(): Promise<FileSystemFileHandle[]> {
	if (!window.showOpenFilePicker) return [];
	try {
		return await window.showOpenFilePicker({
			id: 'metastack-markdown-file',
			multiple: true,
			types: [
				{
					description: 'Markdown and text',
					accept: { 'text/markdown': ['.md', '.markdown', '.mdx'], 'text/plain': ['.txt'] },
				},
			],
		});
	} catch (error) {
		if (isAbort(error)) return [];
		throw error;
	}
}

/** `<input type=file>` fallback used where the native pickers don't exist (Firefox). */
export function pickWithInput(options: { directory: boolean }): Promise<File[]> {
	return new Promise((resolve) => {
		const input = document.createElement('input');
		input.type = 'file';
		input.multiple = !options.directory;
		if (options.directory) input.webkitdirectory = true;
		else input.accept = '.md,.markdown,.mdx,.txt,text/markdown,text/plain';
		input.style.display = 'none';
		const finish = () => {
			resolve(Array.from(input.files ?? []));
			input.remove();
		};
		input.addEventListener('change', finish, { once: true });
		input.addEventListener('cancel', finish, { once: true });
		document.body.append(input);
		input.click();
	});
}
