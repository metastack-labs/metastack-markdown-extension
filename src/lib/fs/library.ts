/**
 * Saved folders: directory handles persisted in the extension's IndexedDB so a folder
 * survives reloads and restarts (Chrome/Edge). The browser may still ask the user to
 * re-confirm access after a restart; that needs a click, so the UI offers "Reconnect".
 */

export interface SavedFolder {
	readonly id: string;
	readonly name: string;
	readonly handle: FileSystemDirectoryHandle;
	readonly addedAt: number;
	readonly lastOpenedAt: number;
}

const DB_NAME = 'metastack-markdown';
const DB_VERSION = 1;
const FOLDERS = 'folders';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
	dbPromise ??= new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);
		request.onupgradeneeded = () => {
			if (!request.result.objectStoreNames.contains(FOLDERS)) {
				request.result.createObjectStore(FOLDERS, { keyPath: 'id' });
			}
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => {
			dbPromise = null;
			reject(request.error);
		};
	});
	return dbPromise;
}

function promisify<T>(request: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

async function store(mode: IDBTransactionMode): Promise<IDBObjectStore> {
	const db = await openDb();
	return db.transaction(FOLDERS, mode).objectStore(FOLDERS);
}

export async function listSavedFolders(): Promise<SavedFolder[]> {
	try {
		const folders = await promisify((await store('readonly')).getAll() as IDBRequest<SavedFolder[]>);
		return folders.sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);
	} catch {
		return [];
	}
}

/** Save a folder, reusing the existing record when the same directory is already saved. */
export async function saveFolder(handle: FileSystemDirectoryHandle): Promise<SavedFolder> {
	const existing = await listSavedFolders();
	for (const folder of existing) {
		if (await folder.handle.isSameEntry(handle)) {
			const updated: SavedFolder = { ...folder, handle, lastOpenedAt: Date.now() };
			await promisify((await store('readwrite')).put(updated));
			return updated;
		}
	}
	const now = Date.now();
	const folder: SavedFolder = {
		id: `folder-${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
		name: handle.name,
		handle,
		addedAt: now,
		lastOpenedAt: now,
	};
	await promisify((await store('readwrite')).put(folder));
	return folder;
}

export async function touchFolder(id: string): Promise<void> {
	const objectStore = await store('readwrite');
	const folder = (await promisify(objectStore.get(id))) as SavedFolder | undefined;
	if (folder) await promisify(objectStore.put({ ...folder, lastOpenedAt: Date.now() }));
}

export async function forgetFolder(id: string): Promise<void> {
	await promisify((await store('readwrite')).delete(id));
}
