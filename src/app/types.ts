import type { LineEnding } from '../lib/fs/eol.ts';
import type { DocumentKind } from '../lib/fs/file-types.ts';
import type { DirectoryNode, FileNode, TreeNode } from '../lib/fs/nodes.ts';

export type ViewMode = 'read' | 'edit' | 'split';

export type FolderAccess = 'granted' | 'prompt' | 'denied';

/** A folder shown in the sidebar: saved (persisted handle) or opened for this session only. */
export interface FolderRoot {
	readonly id: string;
	readonly name: string;
	readonly node: DirectoryNode;
	/** Persisted in the library (Chrome/Edge directory handles). */
	readonly saved: boolean;
	readonly access: FolderAccess;
}

/** The folder around a file:// document, as listed by the browser. */
export interface FileUrlFolder {
	readonly url: string;
	readonly name: string;
	readonly parentUrl: string | null;
	/** `null` when the browser didn't provide a listing. */
	readonly entries: readonly TreeNode[] | null;
}

export type DocOrigin =
	| { readonly type: 'folder'; readonly folderId: string }
	| { readonly type: 'loose' }
	| { readonly type: 'file-url'; readonly url: string }
	| { readonly type: 'untitled' };

export interface OpenDocument {
	/** Changes on every open/reload, so the editor remounts with fresh content. */
	readonly id: string;
	readonly name: string;
	readonly kind: DocumentKind;
	readonly language: string;
	readonly node: FileNode | null;
	readonly origin: DocOrigin;
	/** Text as last read from or written to disk, with LF line endings. */
	readonly baseline: string;
	/** The file's line ending, restored when saving. */
	readonly eol: LineEnding;
	readonly lastModified: number | null;
	/** Folder segments shown in the breadcrumb (file name excluded). */
	readonly crumbs: readonly Crumb[];
	/** Heading to scroll to once rendered. */
	readonly pendingHash: string | null;
}

export interface Crumb {
	readonly name: string;
	/** file:// directory URL for crumbs that can be navigated. */
	readonly url?: string;
}

export interface Notice {
	readonly id: number;
	readonly tone: 'info' | 'success' | 'error';
	readonly message: string;
	readonly action?: { readonly label: string; readonly run: () => void };
}
