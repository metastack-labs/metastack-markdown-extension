import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { browser } from 'wxt/browser';
import { applyLineEnding, type LineEnding, normaliseLineEndings } from '../lib/fs/eol.ts';
import { documentKind, languageForName, normaliseNewFileName } from '../lib/fs/file-types.ts';
import { readFileUrlBlob, readFileUrlText } from '../lib/fs/file-url-read.ts';
import { type IntakeItem, pickDirectory, pickFiles, pickWithInput } from '../lib/fs/intake.ts';
import { forgetFolder, listSavedFolders, saveFolder, touchFolder } from '../lib/fs/library.ts';
import {
	type DirectoryNode,
	type FileNode,
	findDirectory,
	findFile,
	getFile,
	looseFileNode,
	newRootId,
	nodeKey,
	nodesFromFileUrlEntries,
	readFileNode,
	rootFromEntry,
	rootFromFileList,
	rootFromHandle,
} from '../lib/fs/nodes.ts';
import {
	assetPathCandidates,
	assetUrlCandidates,
	basename,
	candidatePathsWithinRoot,
	containingDirectoryUrl,
	dirname,
	fileUrlCrumbs,
	fileUrlToPath,
	joinPath,
	parentDirectoryUrl,
	resolveReference,
	safeDecode,
	splitPath,
} from '../lib/fs/paths.ts';
import {
	createFile,
	downloadText,
	FileExistsError,
	locateInFolder,
	queryAccess,
	requestAccess,
	SaveConflictError,
	saveAsWithPicker,
	writeHandle,
} from '../lib/fs/write.ts';
import { handoffKey, normaliseFileUrl, parseStoredHandoff } from '../lib/handoff.ts';
import { toggleTask } from '../lib/markdown/tasks.ts';
import { supportsFileSystemAccess } from '../lib/platform.ts';
import type {
	Crumb,
	DocOrigin,
	FileUrlFolder,
	FolderAccess,
	FolderRoot,
	Notice,
	OpenDocument,
	ViewMode,
} from './types.ts';

const FILE_URL_ROOT = 'file-url';
const README_NAMES = /^(readme|index)\.(md|markdown|mdx)$/i;
const HANDOFF_FRESH_MS = 15_000;
const DISK_POLL_MS = 2000;

export interface ConfirmAction {
	readonly value: string;
	readonly label: string;
	readonly variant: 'primary' | 'secondary' | 'ghost' | 'danger';
}

export interface ConfirmRequest {
	readonly title: string;
	readonly message: string;
	readonly actions: readonly ConfirmAction[];
	readonly resolve: (value: string) => void;
}

export interface NewDocumentTarget {
	readonly folderId: string;
	readonly directoryPath: string;
	readonly label: string;
}

let documentSequence = 0;
function documentId(): string {
	documentSequence += 1;
	return `doc-${documentSequence}`;
}

function makeDocument(input: {
	name: string;
	node: FileNode | null;
	origin: DocOrigin;
	text: string;
	lastModified: number | null;
	crumbs: readonly Crumb[];
	pendingHash?: string | null;
	/** The file's line ending when already known (else detected from `text`). */
	eol?: LineEnding;
}): OpenDocument {
	const normalised = normaliseLineEndings(input.text);
	return {
		id: documentId(),
		name: input.name,
		kind: documentKind(input.name) ?? 'text',
		language: languageForName(input.name),
		node: input.node,
		origin: input.origin,
		baseline: normalised.text,
		eol: input.eol ?? normalised.eol,
		lastModified: input.lastModified,
		crumbs: input.crumbs,
		pendingHash: input.pendingHash ?? null,
	};
}

const fetchFileUrl = readFileUrlText;

function fragmentOf(url: string): string | null {
	return safeDecode(new URL(url).hash.slice(1)) || null;
}

/** After saving a file:// document, keep its stored hand-off current so a reload shows the saved text. */
async function rememberHandoffText(url: string, text: string): Promise<void> {
	const key = handoffKey(url);
	const stored = parseStoredHandoff((await browser.storage.local.get(key))[key]);
	if (stored) await browser.storage.local.set({ [key]: { ...stored, text } });
}

function folderNameFromUrl(url: string): string {
	return basename(fileUrlToPath(url)) || '/';
}

function errorMessage(error: unknown, fallback: string): string {
	return error instanceof Error && error.message ? error.message : fallback;
}

export function useWorkspace() {
	const [folders, setFolders] = useState<FolderRoot[]>([]);
	const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
	const [looseFiles, setLooseFiles] = useState<FileNode[]>([]);
	const [fileUrlFolder, setFileUrlFolder] = useState<FileUrlFolder | null>(null);
	const [doc, setDoc] = useState<OpenDocument | null>(null);
	const [draft, setDraft] = useState('');
	const [mode, setMode] = useState<ViewMode>('read');
	const [loading, setLoading] = useState(false);
	const [saving, setSaving] = useState(false);
	const [ready, setReady] = useState(false);
	const [diskChanged, setDiskChanged] = useState(false);
	const [treeVersion, setTreeVersion] = useState(0);
	const [notice, setNotice] = useState<Notice | null>(null);
	const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null);
	const [newDocumentTarget, setNewDocumentTarget] = useState<NewDocumentTarget | null>(null);
	const [grantSaveOpen, setGrantSaveOpen] = useState(false);
	const [loadError, setLoadError] = useState<string | null>(null);

	// Async actions read the latest state through this ref instead of stale closures.
	const latest = useRef({ folders, activeFolderId, doc, draft, saving, fileUrlFolder });
	latest.current = { folders, activeFolderId, doc, draft, saving, fileUrlFolder };

	const dirty = doc !== null && draft !== doc.baseline;
	const activeFolder = folders.find((folder) => folder.id === activeFolderId) ?? null;

	/* ── Notices & confirmation ── */

	const noticeCounter = useRef(0);
	const notify = useCallback((message: string, tone: Notice['tone'] = 'info', action?: Notice['action']) => {
		noticeCounter.current += 1;
		setNotice({ id: noticeCounter.current, tone, message, action });
	}, []);

	const confirm = useCallback(
		(request: Omit<ConfirmRequest, 'resolve'>) =>
			new Promise<string>((resolve) => {
				setConfirmRequest({
					...request,
					resolve: (value) => {
						setConfirmRequest(null);
						resolve(value);
					},
				});
			}),
		[]
	);

	/* ── Document state ── */

	// The URL we last wrote, so a cancelled Back can be undone.
	const lastUrl = useRef(`${location.pathname}${location.search}`);
	const syncLocation = useCallback((next: OpenDocument | null, push = false) => {
		let query = '';
		if (next?.origin.type === 'folder' && next.node) {
			query = `?folder=${encodeURIComponent(next.origin.folderId)}&path=${encodeURIComponent(next.node.path)}`;
		} else if (next?.origin.type === 'file-url') {
			query = `?src=${encodeURIComponent(next.origin.url)}`;
		} else if (!next && latest.current.fileUrlFolder) {
			query = `?src=${encodeURIComponent(latest.current.fileUrlFolder.url)}`;
		}
		const url = `${location.pathname}${query}`;
		lastUrl.current = url;
		if (url === `${location.pathname}${location.search}`) return;
		if (push) history.pushState(null, '', url);
		else history.replaceState(null, '', url);
	}, []);

	const applyDocument = useCallback(
		(next: OpenDocument | null, options: { push?: boolean } = {}) => {
			setDoc(next);
			setDraft(next?.baseline ?? '');
			setDiskChanged(false);
			setLoadError(null);
			latest.current = { ...latest.current, doc: next, draft: next?.baseline ?? '' };
			syncLocation(next, options.push);
		},
		[syncLocation]
	);

	const updateDraft = useCallback((text: string) => {
		latest.current = { ...latest.current, draft: text };
		setDraft(text);
	}, []);

	/* ── Saving ── */

	const markSaved = useCallback((saved: OpenDocument, text: string, patch: Partial<OpenDocument> = {}) => {
		// Update the ref synchronously too, so the disk poller never mistakes our own write for an outside change.
		const current = latest.current.doc;
		if (current?.id === saved.id) latest.current = { ...latest.current, doc: { ...current, ...patch, baseline: text } };
		setDoc((value) => (value?.id === saved.id ? { ...value, ...patch, baseline: text } : value));
		setDiskChanged(false);
	}, []);

	const writeToHandle = useCallback(
		async (target: OpenDocument, handle: FileSystemFileHandle, text: string): Promise<boolean> => {
			try {
				const result = await writeHandle(handle, applyLineEnding(text, target.eol), target.lastModified);
				markSaved(target, text, { lastModified: result.lastModified });
				notify(`Saved “${target.name}”`, 'success');
				return true;
			} catch (error) {
				if (!(error instanceof SaveConflictError)) throw error;
				const choice = await confirm({
					title: `“${target.name}” changed on disk`,
					message:
						'Another app saved this file after you opened it. Overwrite those changes with yours, or reload the version on disk?',
					actions: [
						{ value: 'cancel', label: 'Cancel', variant: 'ghost' },
						{ value: 'reload', label: 'Reload from disk', variant: 'secondary' },
						{ value: 'overwrite', label: 'Overwrite', variant: 'danger' },
					],
				});
				if (choice === 'overwrite') {
					const result = await writeHandle(handle, applyLineEnding(text, target.eol), null);
					markSaved(target, text, { lastModified: result.lastModified });
					notify(`Saved “${target.name}”`, 'success');
					return true;
				}
				if (choice === 'reload') {
					const file = await handle.getFile();
					const fresh = normaliseLineEndings(await file.text()).text;
					setDoc((current) =>
						current?.id === target.id ? { ...current, baseline: fresh, lastModified: file.lastModified } : current
					);
					updateDraft(fresh);
					setDiskChanged(false);
				}
				return false;
			}
		},
		[confirm, markSaved, notify, updateDraft]
	);

	/** Give a file:// document a writable handle, then save. */
	const upgradeAndSave = useCallback(
		async (
			target: OpenDocument,
			located: { readonly handle: FileSystemFileHandle; readonly eol: LineEnding },
			text: string
		): Promise<boolean> => {
			const node = looseFileNode(located.handle.name, { type: 'handle', handle: located.handle });
			const result = await writeHandle(located.handle, applyLineEnding(text, located.eol), null);
			markSaved(target, text, { node, eol: located.eol, lastModified: result.lastModified });
			if (target.origin.type === 'file-url') void rememberHandoffText(target.origin.url, text);
			notify(`Saved “${target.name}”`, 'success');
			return true;
		},
		[markSaved, notify]
	);

	/**
	 * Write the text to a new file the user picks (or download it where that isn't possible).
	 * `adopt` makes the new file the document's save target — used when the document has no
	 * writable file of its own. Otherwise this is "Save a copy" and the document is unchanged.
	 */
	const saveCopy = useCallback(
		async (target: OpenDocument, text: string, adopt: boolean): Promise<boolean> => {
			const contents = applyLineEnding(text, target.eol);
			if (!supportsFileSystemAccess()) {
				downloadText(target.name, contents);
				if (adopt) markSaved(target, text);
				notify(
					`Downloaded “${target.name}”. This browser can't write to the original file, so replace it with the download.`,
					'info'
				);
				return true;
			}
			const handle = await saveAsWithPicker(target.name, contents);
			if (!handle) return false;
			if (!adopt) {
				notify(`Saved a copy as “${handle.name}”`, 'success');
				return true;
			}
			const node = looseFileNode(handle.name, { type: 'handle', handle });
			const file = await handle.getFile();
			setLooseFiles((files) => [node, ...files].slice(0, 30));
			const current = latest.current.doc;
			if (current?.id === target.id) {
				const next: OpenDocument = {
					...current,
					node,
					name: handle.name,
					origin: { type: 'loose' },
					crumbs: [],
					baseline: text,
					lastModified: file.lastModified,
				};
				latest.current = { ...latest.current, doc: next };
				setDoc(next);
				setDiskChanged(false);
				syncLocation(next);
			}
			notify(`Saved “${handle.name}”`, 'success');
			return true;
		},
		[markSaved, notify, syncLocation]
	);

	const saveFileUrlDocument = useCallback(
		async (target: OpenDocument, text: string): Promise<boolean> => {
			if (target.origin.type !== 'file-url') return false;
			const absolutePath = fileUrlToPath(target.origin.url);
			for (const folder of latest.current.folders) {
				if (folder.node.backend.type !== 'handle') continue;
				if (candidatePathsWithinRoot(absolutePath, folder.name).length === 0) continue;
				const handle = folder.node.backend.handle;
				if (!(await requestAccess(handle, 'readwrite'))) continue;
				const located = await locateInFolder(handle, absolutePath, target.baseline);
				if (located) return upgradeAndSave(target, located, text);
			}
			setGrantSaveOpen(true);
			return false;
		},
		[upgradeAndSave]
	);

	const save = useCallback(async (): Promise<boolean> => {
		const { doc: target, draft: text, saving: busy } = latest.current;
		if (!target || busy) return false;
		setSaving(true);
		latest.current = { ...latest.current, saving: true };
		try {
			if (target.node?.backend.type === 'handle') return await writeToHandle(target, target.node.backend.handle, text);
			if (target.origin.type === 'file-url' && supportsFileSystemAccess())
				return await saveFileUrlDocument(target, text);
			return await saveCopy(target, text, true);
		} catch (error) {
			notify(errorMessage(error, `Couldn't save “${target.name}”.`), 'error');
			return false;
		} finally {
			setSaving(false);
			latest.current = { ...latest.current, saving: false };
		}
	}, [notify, saveCopy, saveFileUrlDocument, writeToHandle]);

	const saveAs = useCallback(async () => {
		const { doc: target, draft: text } = latest.current;
		if (!target) return;
		try {
			await saveCopy(target, text, target.node?.backend.type !== 'handle');
		} catch (error) {
			notify(errorMessage(error, `Couldn't save “${target.name}”.`), 'error');
		}
	}, [notify, saveCopy]);

	/** From the "Allow saving" dialog: pick the folder containing a file:// document, then save. */
	const grantFolderAndSave = useCallback(async () => {
		const { doc: target, draft: text } = latest.current;
		if (target?.origin.type !== 'file-url') return;
		try {
			const handle = await pickDirectory('readwrite');
			if (!handle) return;
			const located = await locateInFolder(handle, fileUrlToPath(target.origin.url), target.baseline);
			if (!located) {
				notify(
					`“${handle.name}” doesn't contain this version of “${target.name}”. Choose the folder it's in, or one above it.`,
					'error'
				);
				return;
			}
			setGrantSaveOpen(false);
			const saved = await saveFolder(handle);
			setFolders((current) => [
				{ id: saved.id, name: saved.name, node: rootFromHandle(handle, saved.id), saved: true, access: 'granted' },
				...current.filter((folder) => folder.id !== saved.id),
			]);
			await upgradeAndSave(target, located, text);
		} catch (error) {
			notify(errorMessage(error, `Couldn't save “${target.name}”.`), 'error');
		}
	}, [notify, upgradeAndSave]);

	/** Resolve unsaved changes before replacing the document. Returns false to stay put. */
	const guardUnsaved = useCallback(async (): Promise<boolean> => {
		const { doc: current, draft: text } = latest.current;
		if (!current || text === current.baseline) return true;
		const choice = await confirm({
			title: `Save changes to “${current.name}”?`,
			message: "Your changes will be lost if you don't save them.",
			actions: [
				{ value: 'discard', label: "Don't save", variant: 'ghost' },
				{ value: 'cancel', label: 'Cancel', variant: 'secondary' },
				{ value: 'save', label: 'Save', variant: 'primary' },
			],
		});
		if (choice === 'save') return save();
		return choice === 'discard';
	}, [confirm, save]);

	/* ── Opening documents ── */

	const openFile = useCallback(
		async (
			node: FileNode,
			origin: DocOrigin,
			options: { hash?: string | null; skipGuard?: boolean; push?: boolean } = {}
		): Promise<boolean> => {
			if (!documentKind(node.name)) {
				notify(`“${node.name}” isn't a Markdown or text file.`);
				return false;
			}
			if (!options.skipGuard && !(await guardUnsaved())) return false;
			setLoading(true);
			try {
				const snapshot = await readFileNode(node);
				let crumbs: Crumb[] = [];
				if (origin.type === 'folder') {
					const folder = latest.current.folders.find((item) => item.id === origin.folderId);
					crumbs = [{ name: folder?.name ?? 'Folder' }, ...splitPath(dirname(node.path)).map((name) => ({ name }))];
				} else if (origin.type === 'file-url') {
					crumbs = fileUrlCrumbs(origin.url);
				}
				applyDocument(
					makeDocument({
						name: node.name,
						node,
						origin,
						text: snapshot.text,
						eol: snapshot.eol,
						lastModified: snapshot.lastModified,
						crumbs,
						pendingHash: options.hash,
					}),
					{ push: options.push }
				);
				return true;
			} catch (error) {
				notify(errorMessage(error, `Couldn't open “${node.name}”.`), 'error');
				return false;
			} finally {
				setLoading(false);
			}
		},
		[applyDocument, guardUnsaved, notify]
	);

	const openReadme = useCallback(
		async (folder: FolderRoot) => {
			for (const name of ['README.md', 'readme.md', 'Readme.md', 'index.md', 'README.markdown']) {
				const node = await findFile(folder.node, name);
				if (node) {
					await openFile(node, { type: 'folder', folderId: folder.id });
					return;
				}
			}
		},
		[openFile]
	);

	/* ── Folders ── */

	const upsertFolder = useCallback((folder: FolderRoot) => {
		setFolders((current) => [folder, ...current.filter((item) => item.id !== folder.id)]);
		latest.current = {
			...latest.current,
			folders: [folder, ...latest.current.folders.filter((item) => item.id !== folder.id)],
		};
	}, []);

	const activateFolder = useCallback(
		async (id: string, options: { openReadme?: boolean } = {}) => {
			const folder = latest.current.folders.find((item) => item.id === id);
			if (!folder) return;
			let access: FolderAccess = folder.access;
			if (access !== 'granted' && folder.node.backend.type === 'handle') {
				const handle = folder.node.backend.handle;
				access = (await requestAccess(handle, 'readwrite')) ? 'granted' : await queryAccess(handle, 'read');
				upsertFolder({ ...folder, access });
				if (access !== 'granted') {
					notify(`Access to “${folder.name}” wasn't granted.`, 'error');
					return;
				}
			}
			setActiveFolderId(id);
			setFileUrlFolder(null);
			latest.current = { ...latest.current, activeFolderId: id, fileUrlFolder: null };
			if (folder.saved) void touchFolder(id);
			if (options.openReadme ?? !latest.current.doc) await openReadme({ ...folder, access });
		},
		[notify, openReadme, upsertFolder]
	);

	const addFolderHandle = useCallback(
		async (handle: FileSystemDirectoryHandle, activate = true): Promise<string> => {
			const saved = await saveFolder(handle);
			upsertFolder({
				id: saved.id,
				name: saved.name,
				node: rootFromHandle(handle, saved.id),
				saved: true,
				access: 'granted',
			});
			if (activate) await activateFolder(saved.id, { openReadme: true });
			return saved.id;
		},
		[activateFolder, upsertFolder]
	);

	const addSessionFolder = useCallback(
		(node: DirectoryNode): string => {
			upsertFolder({ id: node.rootId, name: node.name, node, saved: false, access: 'granted' });
			return node.rootId;
		},
		[upsertFolder]
	);

	const removeFolder = useCallback(
		async (id: string) => {
			const folder = latest.current.folders.find((item) => item.id === id);
			if (!folder) return;
			if (folder.saved) await forgetFolder(id);
			setFolders((current) => current.filter((item) => item.id !== id));
			if (latest.current.activeFolderId === id) setActiveFolderId(null);
			notify(`Removed “${folder.name}” from your folders. Nothing was deleted from disk.`);
		},
		[notify]
	);

	/* ── Intake: drops and pickers ── */

	const handleIntake = useCallback(
		async (items: readonly IntakeItem[]) => {
			const files: FileNode[] = [];
			let firstFolderId: string | null = null;
			for (const item of items) {
				if (item.type === 'directory-handle') {
					const id = await addFolderHandle(item.handle, false);
					firstFolderId ??= id;
				} else if (item.type === 'directory-entry') {
					const id = addSessionFolder(rootFromEntry(item.entry, newRootId('dropped')));
					firstFolderId ??= id;
				} else if (item.type === 'file-handle') {
					files.push(looseFileNode(item.handle.name, { type: 'handle', handle: item.handle }));
				} else {
					files.push(looseFileNode(item.file.name, { type: 'memory', file: item.file }));
				}
			}
			const openable = files.filter((file) => documentKind(file.name) !== null);
			const skipped = files.length - openable.length;
			if (openable.length > 0) {
				setLooseFiles((current) => [...openable, ...current].slice(0, 30));
				const [first] = openable;
				if (first) await openFile(first, { type: 'loose' });
			}
			if (firstFolderId) await activateFolder(firstFolderId, { openReadme: openable.length === 0 });
			if (skipped > 0) {
				notify(
					skipped === 1
						? 'Skipped 1 file that isn’t Markdown or text.'
						: `Skipped ${skipped} files that aren’t Markdown or text.`
				);
			} else if (items.length === 0) {
				notify('Nothing to open. Drop Markdown files or a folder.');
			}
		},
		[activateFolder, addFolderHandle, addSessionFolder, notify, openFile]
	);

	const openFolderPicker = useCallback(async () => {
		try {
			if (supportsFileSystemAccess()) {
				const handle = await pickDirectory('readwrite');
				if (handle) await addFolderHandle(handle);
				return;
			}
			const files = await pickWithInput({ directory: true });
			const root = rootFromFileList(files, newRootId('picked'));
			if (!root) return;
			addSessionFolder(root);
			await activateFolder(root.rootId, { openReadme: true });
		} catch (error) {
			notify(errorMessage(error, "Couldn't open that folder."), 'error');
		}
	}, [activateFolder, addFolderHandle, addSessionFolder, notify]);

	const openFilePicker = useCallback(async () => {
		try {
			if (supportsFileSystemAccess()) {
				const handles = await pickFiles();
				if (handles.length > 0) await handleIntake(handles.map((handle) => ({ type: 'file-handle', handle })));
				return;
			}
			const files = await pickWithInput({ directory: false });
			if (files.length > 0) await handleIntake(files.map((file) => ({ type: 'file', file })));
		} catch (error) {
			notify(errorMessage(error, "Couldn't open that file."), 'error');
		}
	}, [handleIntake, notify]);

	const closeLooseFile = useCallback((key: string) => {
		setLooseFiles((current) => current.filter((file) => file.key !== key));
	}, []);

	/* ── file:// documents ── */

	const openFileUrl = useCallback(
		async (rawUrl: string, options: { push?: boolean } = {}) => {
			const url = normaliseFileUrl(rawUrl);
			const hash = fragmentOf(rawUrl);
			setLoading(true);
			try {
				const stored = await browser.storage.local.get(handoffKey(url));
				const handoff = parseStoredHandoff(stored[handoffKey(url)]);
				const isDirectory = handoff?.kind === 'directory' || url.endsWith('/');
				const directoryUrl = containingDirectoryUrl(url);
				const previous = latest.current.fileUrlFolder;
				const entries = handoff?.entries
					? nodesFromFileUrlEntries(FILE_URL_ROOT, handoff.entries)
					: previous?.url === directoryUrl
						? previous.entries
						: null;
				const folder: FileUrlFolder = {
					url: directoryUrl,
					name: folderNameFromUrl(directoryUrl),
					parentUrl: parentDirectoryUrl(directoryUrl),
					entries,
				};
				setFileUrlFolder(folder);
				setActiveFolderId(null);
				latest.current = { ...latest.current, fileUrlFolder: folder, activeFolderId: null };

				if (isDirectory) {
					const readme = entries?.find((entry) => entry.kind === 'file' && README_NAMES.test(entry.name));
					const readmeUrl = readme?.kind === 'file' && readme.backend.type === 'url' ? readme.backend.url : null;
					const text = readmeUrl ? await fetchFileUrl(readmeUrl) : null;
					if (readme?.kind === 'file' && readmeUrl && text !== null) {
						applyDocument(
							makeDocument({
								name: readme.name,
								node: readme,
								origin: { type: 'file-url', url: readmeUrl },
								text,
								lastModified: null,
								crumbs: fileUrlCrumbs(readmeUrl),
							}),
							options
						);
					} else {
						applyDocument(null, options);
					}
					return;
				}

				const fresh = handoff && Date.now() - handoff.createdAt < HANDOFF_FRESH_MS;
				const fetched = fresh ? null : await fetchFileUrl(url);
				const text = fetched ?? handoff?.text ?? null;
				const name = basename(fileUrlToPath(url));
				if (text === null) {
					applyDocument(null, options);
					setLoadError(`Couldn't read “${name}”. Open it again from your file manager, or drop it here.`);
					return;
				}
				if (!fresh && fetched === null) {
					notify(
						`Showing “${name}” as it was when it was last opened here. Open it again from your file manager to see newer changes.`
					);
				}
				const node: FileNode = {
					kind: 'file',
					key: nodeKey(FILE_URL_ROOT, url),
					rootId: FILE_URL_ROOT,
					name,
					path: url,
					backend: { type: 'url', url },
				};
				applyDocument(
					makeDocument({
						name,
						node,
						origin: { type: 'file-url', url },
						text,
						lastModified: null,
						crumbs: fileUrlCrumbs(url),
						pendingHash: hash,
					}),
					options
				);
			} finally {
				setLoading(false);
			}
		},
		[applyDocument, notify]
	);

	/** Navigate this tab to another file:// location (the content script hands it back). */
	const navigateFileUrl = useCallback(
		async (rawUrl: string) => {
			if (!(await guardUnsaved())) return;
			const url = normaliseFileUrl(rawUrl);
			const hash = fragmentOf(rawUrl);
			// Markdown and text siblings can often be read directly (Chrome), skipping a round trip.
			if (!url.endsWith('/') && documentKind(fileUrlToPath(url))) {
				const text = await fetchFileUrl(url);
				if (text !== null) {
					const name = basename(fileUrlToPath(url));
					const node: FileNode = {
						kind: 'file',
						key: nodeKey(FILE_URL_ROOT, url),
						rootId: FILE_URL_ROOT,
						name,
						path: url,
						backend: { type: 'url', url },
					};
					applyDocument(
						makeDocument({
							name,
							node,
							origin: { type: 'file-url', url },
							text,
							lastModified: null,
							crumbs: fileUrlCrumbs(url),
							pendingHash: hash,
						}),
						{ push: true }
					);
					return;
				}
			}
			try {
				const tab = await browser.tabs.getCurrent();
				await browser.tabs.update(tab?.id, { url: rawUrl });
			} catch {
				notify(
					"This browser doesn't let extensions open local paths. Drop the folder onto this page to browse it.",
					'error'
				);
			}
		},
		[applyDocument, guardUnsaved, notify]
	);

	/* ── Links and images inside documents ── */

	const folderOf = useCallback((target: OpenDocument | null): FolderRoot | null => {
		if (target?.origin.type !== 'folder') return null;
		const { folderId } = target.origin;
		return latest.current.folders.find((folder) => folder.id === folderId) ?? null;
	}, []);

	const openReference = useCallback(
		async (href: string) => {
			const target = latest.current.doc;
			if (!target) return;
			if (target.origin.type === 'file-url') {
				const url = new URL(href, target.origin.url);
				if (url.protocol === 'file:') await navigateFileUrl(url.href);
				return;
			}
			const folder = folderOf(target);
			if (!folder || !target.node) {
				notify('Open the folder that contains this document to follow its links.');
				return;
			}
			const resolved = resolveReference(dirname(target.node.path), href);
			if (!resolved) {
				notify('That link points outside this folder.');
				return;
			}
			const file =
				(await findFile(folder.node, resolved.path)) ??
				(await findFile(folder.node, joinPath(resolved.path, 'README.md')));
			if (!file) {
				notify(`Couldn't find “${resolved.path || href}” in “${folder.name}”.`, 'error');
				return;
			}
			await openFile(file, { type: 'folder', folderId: folder.id }, { hash: resolved.hash });
		},
		[folderOf, navigateFileUrl, notify, openFile]
	);

	const resolveAsset = useCallback(
		async (reference: string): Promise<Blob | null> => {
			const target = latest.current.doc;
			if (!target) return null;
			try {
				if (target.origin.type === 'file-url') {
					for (const url of assetUrlCandidates(target.origin.url, reference)) {
						const blob = await readFileUrlBlob(url);
						if (blob) return blob;
					}
					return null;
				}
				const folder = folderOf(target);
				if (!folder || !target.node) return null;
				for (const path of assetPathCandidates(dirname(target.node.path), reference)) {
					const file = await findFile(folder.node, path);
					if (file) return await getFile(file);
				}
				return null;
			} catch {
				return null;
			}
		},
		[folderOf]
	);

	const toggleTaskAt = useCallback(
		async (index: number, checked: boolean) => {
			const { doc: target, draft: text } = latest.current;
			if (!target) return;
			const next = toggleTask(text, index, checked);
			if (next === null) return;
			const wasClean = text === target.baseline;
			updateDraft(next);
			// Checking off a task in a clean, writable document saves it, like GitHub.
			if (wasClean && target.node?.backend.type === 'handle') await save();
		},
		[save, updateDraft]
	);

	/* ── New documents ── */

	const requestNewDocument = useCallback(async () => {
		const { folders: currentFolders, activeFolderId: folderId, doc: current } = latest.current;
		const folder = currentFolders.find((item) => item.id === folderId);
		if (folder?.node.backend.type === 'handle' && folder.access === 'granted') {
			const inFolder = current?.origin.type === 'folder' && current.origin.folderId === folder.id && current.node;
			const directoryPath = inFolder && current.node ? dirname(current.node.path) : '';
			setNewDocumentTarget({
				folderId: folder.id,
				directoryPath,
				label: [folder.name, ...splitPath(directoryPath)].join(' / '),
			});
			return;
		}
		if (!(await guardUnsaved())) return;
		applyDocument(
			makeDocument({
				name: 'Untitled.md',
				node: null,
				origin: { type: 'untitled' },
				text: '',
				lastModified: null,
				crumbs: [],
			})
		);
		updateDraft('# Untitled\n\n');
		setMode((current) => (current === 'read' ? 'edit' : current));
	}, [applyDocument, guardUnsaved, updateDraft]);

	/** Returns an error message for the dialog, or null on success. */
	const createDocument = useCallback(
		async (rawName: string): Promise<string | null> => {
			const target = newDocumentTarget;
			if (!target) return null;
			const parsed = normaliseNewFileName(rawName);
			if ('error' in parsed) return parsed.error;
			const folder = latest.current.folders.find((item) => item.id === target.folderId);
			const directory = folder ? await findDirectory(folder.node, target.directoryPath) : null;
			if (!folder || directory?.backend.type !== 'handle') return 'That folder is no longer available.';
			if (!(await guardUnsaved())) return null;
			try {
				const title = parsed.name.replace(/\.[^.]+$/, '');
				const handle = await createFile(directory.backend.handle, parsed.name, `# ${title}\n\n`);
				const path = joinPath(target.directoryPath, parsed.name);
				const node: FileNode = {
					kind: 'file',
					key: nodeKey(folder.id, path),
					rootId: folder.id,
					name: parsed.name,
					path,
					backend: { type: 'handle', handle },
				};
				setNewDocumentTarget(null);
				setTreeVersion((version) => version + 1);
				await openFile(node, { type: 'folder', folderId: folder.id }, { skipGuard: true });
				setMode((current) => (current === 'read' ? 'edit' : current));
				return null;
			} catch (error) {
				if (error instanceof FileExistsError) return error.message;
				return errorMessage(error, "Couldn't create the document.");
			}
		},
		[guardUnsaved, newDocumentTarget, openFile]
	);

	/* ── Reload / external changes ── */

	const reloadFromDisk = useCallback(async () => {
		const target = latest.current.doc;
		if (!target?.node) return;
		try {
			let snapshot: { text: string; eol: LineEnding; lastModified: number | null };
			if (target.node.backend.type === 'url') {
				const raw = await fetchFileUrl(target.node.backend.url);
				if (raw === null) {
					notify(
						`This browser didn't allow reloading “${target.name}”. Open it again from your file manager.`,
						'error'
					);
					return;
				}
				snapshot = { ...normaliseLineEndings(raw), lastModified: null };
			} else {
				snapshot = await readFileNode(target.node);
			}
			const reloaded = snapshot;
			setDoc((current) =>
				current?.id === target.id
					? { ...current, baseline: reloaded.text, eol: reloaded.eol, lastModified: reloaded.lastModified }
					: current
			);
			updateDraft(snapshot.text);
			setDiskChanged(false);
		} catch (error) {
			notify(errorMessage(error, `Couldn't reload “${target.name}”.`), 'error');
		}
	}, [notify, updateDraft]);

	// Disk changes the user chose to ignore ("Keep my version"), per document.
	const pendingDiskChange = useRef<{ docId: string; modified: number } | null>(null);
	const ignoredDiskChange = useRef<{ docId: string; modified: number } | null>(null);
	const dismissDiskChange = useCallback(() => {
		ignoredDiskChange.current = pendingDiskChange.current;
		setDiskChanged(false);
	}, []);

	// Live reload: poll the open handle while visible; refresh silently when there are no edits.
	const pollNode = doc?.node?.backend.type === 'handle' ? doc.node : null;
	const pollDocId = doc?.id;
	useEffect(() => {
		if (pollNode?.backend.type !== 'handle') return;
		const handle = pollNode.backend.handle;
		let stopped = false;
		const tick = async () => {
			if (stopped || document.visibilityState !== 'visible' || latest.current.saving) return;
			try {
				const file = await handle.getFile();
				const current = latest.current.doc;
				if (stopped || !current || current.id !== pollDocId || current.lastModified === null) return;
				const ignored = ignoredDiskChange.current?.docId === current.id ? ignoredDiskChange.current.modified : 0;
				if (file.lastModified <= Math.max(current.lastModified, ignored)) return;
				const { text } = normaliseLineEndings(await file.text());
				if (text === current.baseline || latest.current.draft === current.baseline) {
					setDoc((value) =>
						value?.id === current.id ? { ...value, baseline: text, lastModified: file.lastModified } : value
					);
					if (text !== current.baseline) updateDraft(text);
				} else {
					pendingDiskChange.current = { docId: current.id, modified: file.lastModified };
					setDiskChanged(true);
				}
			} catch {
				// Deleted, moved, or permission lapsed — keep showing what we have.
			}
		};
		const interval = window.setInterval(() => void tick(), DISK_POLL_MS);
		const onFocus = () => void tick();
		window.addEventListener('focus', onFocus);
		return () => {
			stopped = true;
			window.clearInterval(interval);
			window.removeEventListener('focus', onFocus);
		};
	}, [pollDocId, pollNode, updateDraft]);

	/* ── Startup ── */

	const started = useRef(false);
	useEffect(() => {
		if (started.current) return;
		started.current = true;
		void (async () => {
			try {
				let saved: FolderRoot[] = [];
				if (supportsFileSystemAccess()) {
					const records = await listSavedFolders();
					saved = await Promise.all(
						records.map(
							async (record): Promise<FolderRoot> => ({
								id: record.id,
								name: record.name,
								node: rootFromHandle(record.handle, record.id),
								saved: true,
								access: (await queryAccess(record.handle, 'read')) === 'granted' ? 'granted' : 'prompt',
							})
						)
					);
					setFolders(saved);
					latest.current = { ...latest.current, folders: saved };
				}
				const params = new URLSearchParams(location.search);
				const src = params.get('src');
				if (src?.startsWith('file:')) {
					await openFileUrl(`${src}${location.hash}`);
					return;
				}
				const folderParam = params.get('folder');
				const restore = saved.find((folder) => folder.id === folderParam && folder.access === 'granted');
				if (restore) {
					setActiveFolderId(restore.id);
					latest.current = { ...latest.current, activeFolderId: restore.id };
					const path = params.get('path');
					const node = path ? await findFile(restore.node, path) : null;
					if (node)
						await openFile(
							node,
							{ type: 'folder', folderId: restore.id },
							{ skipGuard: true, hash: location.hash.slice(1) || null }
						);
					else await openReadme(restore);
					return;
				}
				const recent = saved.find((folder) => folder.access === 'granted');
				if (recent) await activateFolder(recent.id, { openReadme: true });
			} finally {
				setReady(true);
			}
		})();
	}, [activateFolder, openFile, openFileUrl, openReadme]);

	// Back/forward between documents opened in this tab. Unsaved edits are guarded like any other switch.
	useEffect(() => {
		const onPopState = () => {
			void (async () => {
				if (!(await guardUnsaved())) {
					history.pushState(null, '', lastUrl.current);
					return;
				}
				const params = new URLSearchParams(location.search);
				const src = params.get('src');
				if (src?.startsWith('file:')) {
					await openFileUrl(`${src}${location.hash}`);
					return;
				}
				const folder = latest.current.folders.find((item) => item.id === params.get('folder'));
				const path = params.get('path');
				const node = folder?.access === 'granted' && path ? await findFile(folder.node, path) : null;
				if (folder && node) await openFile(node, { type: 'folder', folderId: folder.id }, { skipGuard: true });
			})();
		};
		window.addEventListener('popstate', onPopState);
		return () => window.removeEventListener('popstate', onPopState);
	}, [guardUnsaved, openFile, openFileUrl]);

	// Warn before closing the tab with unsaved edits.
	useEffect(() => {
		if (!dirty) return;
		const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
		window.addEventListener('beforeunload', onBeforeUnload);
		return () => window.removeEventListener('beforeunload', onBeforeUnload);
	}, [dirty]);

	const clearPendingHash = useCallback(() => {
		setDoc((current) => (current?.pendingHash ? { ...current, pendingHash: null } : current));
	}, []);

	return useMemo(
		() => ({
			ready,
			folders,
			activeFolder,
			looseFiles,
			fileUrlFolder,
			doc,
			draft,
			dirty,
			mode,
			loading,
			saving,
			diskChanged,
			loadError,
			treeVersion,
			notice,
			confirmRequest,
			newDocumentTarget,
			grantSaveOpen,
			setMode,
			updateDraft,
			save,
			saveAs,
			grantFolderAndSave,
			closeGrantSave: () => setGrantSaveOpen(false),
			openFile,
			openFolderPicker,
			openFilePicker,
			handleIntake,
			activateFolder,
			removeFolder,
			closeLooseFile,
			navigateFileUrl,
			openReference,
			resolveAsset,
			toggleTaskAt,
			requestNewDocument,
			createDocument,
			closeNewDocument: () => setNewDocumentTarget(null),
			reloadFromDisk,
			dismissDiskChange,
			refreshTree: () => setTreeVersion((version) => version + 1),
			dismissNotice: () => setNotice(null),
			notify,
			clearPendingHash,
		}),
		[
			ready,
			folders,
			activeFolder,
			looseFiles,
			fileUrlFolder,
			doc,
			draft,
			dirty,
			mode,
			loading,
			saving,
			diskChanged,
			loadError,
			treeVersion,
			notice,
			confirmRequest,
			newDocumentTarget,
			grantSaveOpen,
			updateDraft,
			save,
			saveAs,
			grantFolderAndSave,
			openFile,
			openFolderPicker,
			openFilePicker,
			handleIntake,
			activateFolder,
			removeFolder,
			closeLooseFile,
			navigateFileUrl,
			openReference,
			resolveAsset,
			toggleTaskAt,
			requestNewDocument,
			createDocument,
			reloadFromDisk,
			dismissDiskChange,
			notify,
			clearPendingHash,
		]
	);
}

export type Workspace = ReturnType<typeof useWorkspace>;
