import { clsx } from 'clsx';
import { ChevronRight, File, FileText, Folder, FolderOpen, LoaderCircle } from 'lucide-react';
import { type KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { documentKind, isMarkdownName } from '../../lib/fs/file-types.ts';
import type { IgnoreMatcher } from '../../lib/fs/gitignore.ts';
import {
	type DirectoryNode,
	type FileNode,
	findDirectory,
	listDirectory,
	loadIgnoreMatcher,
	readTitle,
	type TreeNode,
} from '../../lib/fs/nodes.ts';
import { dirname, splitPath } from '../../lib/fs/paths.ts';

/* ── Titles: first heading of Markdown files, read a few at a time ── */

const titleCache = new Map<string, Promise<string | null>>();
const queue: Array<() => void> = [];
let active = 0;
const MAX_CONCURRENT_TITLE_READS = 6;

function schedule<T>(task: () => Promise<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		const run = () => {
			active += 1;
			task()
				.then(resolve, reject)
				.finally(() => {
					active -= 1;
					queue.shift()?.();
				});
		};
		if (active < MAX_CONCURRENT_TITLE_READS) run();
		else queue.push(run);
	});
}

export function useMarkdownTitle(node: FileNode, enabled: boolean, version: number): string | null {
	const [title, setTitle] = useState<string | null>(null);
	useEffect(() => {
		if (!enabled || !isMarkdownName(node.name)) {
			setTitle(null);
			return;
		}
		const cacheKey = `${version}:${node.key}`;
		let pending = titleCache.get(cacheKey);
		if (!pending) {
			pending = schedule(() => readTitle(node)).catch(() => null);
			titleCache.set(cacheKey, pending);
		}
		let cancelled = false;
		void pending.then((value) => {
			if (!cancelled) setTitle(value);
		});
		return () => {
			cancelled = true;
		};
	}, [enabled, node, version]);
	return title;
}

/* ── Row ── */

interface RowProps {
	readonly node: TreeNode;
	readonly depth: number;
	readonly expanded: boolean;
	readonly loading: boolean;
	readonly selected: boolean;
	readonly focused: boolean;
	readonly showTitles: boolean;
	readonly version: number;
	readonly onActivate: (node: TreeNode) => void;
	readonly onFocus: (node: TreeNode) => void;
	readonly overrideTitle?: string | null;
}

export function TreeRow({
	node,
	depth,
	expanded,
	loading,
	selected,
	focused,
	showTitles,
	version,
	onActivate,
	onFocus,
	overrideTitle,
}: RowProps) {
	const isDirectory = node.kind === 'directory';
	const readable = isDirectory || documentKind(node.name) !== null;
	const loadedTitle = useMarkdownTitle(
		node as FileNode,
		!isDirectory && showTitles && overrideTitle === undefined,
		version
	);
	const title = isDirectory ? null : overrideTitle !== undefined ? (showTitles ? overrideTitle : null) : loadedTitle;
	const Icon = isDirectory ? (expanded ? FolderOpen : Folder) : isMarkdownName(node.name) ? FileText : File;

	return (
		// biome-ignore lint/a11y/useKeyWithClickEvents: keyboard is handled by the parent tree (roving tabindex, Enter/Space/arrows)
		<div
			role="treeitem"
			aria-level={depth + 1}
			aria-expanded={isDirectory ? expanded : undefined}
			aria-selected={selected}
			aria-disabled={!readable || undefined}
			tabIndex={focused ? 0 : -1}
			data-key={node.key}
			title={node.name}
			onClick={() => readable && onActivate(node)}
			onFocus={() => onFocus(node)}
			className={clsx(
				'group relative flex min-h-[30px] items-center gap-1.5 rounded-md pr-2 outline-none',
				'focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset',
				selected
					? 'bg-accent-soft text-fg'
					: readable
						? 'text-fg-muted hover:bg-surface-hover hover:text-fg'
						: 'text-fg-subtle opacity-60',
				title ? 'py-1' : 'py-[5px]'
			)}
			style={{ paddingLeft: 6 + depth * 14 }}
		>
			<span className="grid size-4 shrink-0 place-items-center text-fg-subtle">
				{isDirectory ? (
					loading ? (
						<LoaderCircle className="size-3.5 animate-spin" aria-hidden />
					) : (
						<ChevronRight
							className={clsx('size-3.5 transition-transform duration-150', expanded && 'rotate-90')}
							aria-hidden
						/>
					)
				) : null}
			</span>
			<Icon className={clsx('size-4 shrink-0', selected ? 'text-accent' : 'text-fg-subtle')} aria-hidden />
			{title ? (
				<span className="flex min-w-0 flex-col leading-tight">
					<span className={clsx('truncate text-[13px]', selected && 'font-medium')}>{title}</span>
					<span className="truncate text-[11px] text-fg-subtle">{node.name}</span>
				</span>
			) : (
				<span className={clsx('min-w-0 truncate text-[13px]', selected && 'font-medium', isDirectory && 'text-fg')}>
					{node.name}
				</span>
			)}
		</div>
	);
}

/** Arrow-key navigation shared by tree-like lists (roving tabindex). */
export function useTreeKeyboard(
	rows: readonly { node: TreeNode; depth: number }[],
	handlers: {
		activate: (node: TreeNode) => void;
		expand: (node: TreeNode) => void;
		collapse: (node: TreeNode) => boolean;
	}
) {
	return useCallback(
		(event: KeyboardEvent<HTMLDivElement>) => {
			const current = (event.target as HTMLElement).closest<HTMLElement>('[role="treeitem"]');
			if (!current) return;
			const index = rows.findIndex((row) => row.node.key === current.dataset.key);
			if (index < 0) return;
			const row = rows[index];
			if (!row) return;
			const focusIndex = (next: number) => {
				const target = rows[Math.max(0, Math.min(rows.length - 1, next))];
				if (!target) return;
				event.currentTarget.querySelector<HTMLElement>(`[data-key="${CSS.escape(target.node.key)}"]`)?.focus();
			};
			switch (event.key) {
				case 'ArrowDown':
					event.preventDefault();
					focusIndex(index + 1);
					break;
				case 'ArrowUp':
					event.preventDefault();
					focusIndex(index - 1);
					break;
				case 'Home':
					event.preventDefault();
					focusIndex(0);
					break;
				case 'End':
					event.preventDefault();
					focusIndex(rows.length - 1);
					break;
				case 'ArrowRight':
					if (row.node.kind === 'directory') {
						event.preventDefault();
						handlers.expand(row.node);
					}
					break;
				case 'ArrowLeft': {
					event.preventDefault();
					if (handlers.collapse(row.node)) break;
					for (let i = index - 1; i >= 0; i--) {
						if ((rows[i]?.depth ?? 0) < row.depth) {
							focusIndex(i);
							break;
						}
					}
					break;
				}
				case 'Enter':
				case ' ':
					event.preventDefault();
					handlers.activate(row.node);
					break;
			}
		},
		[rows, handlers]
	);
}

/* ── Tree for a folder ── */

interface FileTreeProps {
	readonly root: DirectoryNode;
	readonly version: number;
	readonly activeKey: string | null;
	readonly activePath: string | null;
	readonly activeTitle: string | null;
	readonly showTitles: boolean;
	readonly onOpenFile: (node: FileNode) => void;
	readonly label: string;
}

export function FileTree({
	root,
	version,
	activeKey,
	activePath,
	activeTitle,
	showTitles,
	onOpenFile,
	label,
}: FileTreeProps) {
	const [children, setChildren] = useState<ReadonlyMap<string, readonly TreeNode[]>>(new Map());
	const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
	const [loadingKeys, setLoadingKeys] = useState<ReadonlySet<string>>(new Set());
	const [focusedKey, setFocusedKey] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const ignore = useRef<Promise<IgnoreMatcher | null> | null>(null);
	const nodesByKey = useRef(new Map<string, DirectoryNode>());

	const load = useCallback(
		async (directory: DirectoryNode) => {
			nodesByKey.current.set(directory.key, directory);
			setLoadingKeys((keys) => new Set(keys).add(directory.key));
			try {
				ignore.current ??= loadIgnoreMatcher(root);
				const nodes = await listDirectory(directory, { ignore: await ignore.current });
				setChildren((map) => new Map(map).set(directory.key, nodes));
				setError(null);
			} catch {
				if (directory.key === root.key)
					setError(`Couldn't read “${root.name}”. It may have moved, or access was revoked.`);
			} finally {
				setLoadingKeys((keys) => {
					const next = new Set(keys);
					next.delete(directory.key);
					return next;
				});
			}
		},
		[root]
	);

	// New root: start fresh.
	useEffect(() => {
		ignore.current = null;
		nodesByKey.current = new Map();
		setChildren(new Map());
		setExpanded(new Set());
		void load(root);
	}, [root, load]);

	// Refresh: reload the root and every open folder.
	const firstVersion = useRef(version);
	// biome-ignore lint/correctness/useExhaustiveDependencies: only `version` should trigger a refresh
	useEffect(() => {
		if (version === firstVersion.current) return;
		ignore.current = null;
		void load(root);
		for (const key of expanded) {
			const node = nodesByKey.current.get(key);
			if (node) void load(node);
		}
	}, [version]);

	// Reveal the open document: expand its parent folders.
	useEffect(() => {
		if (!activePath) return;
		const segments = splitPath(dirname(activePath));
		if (segments.length === 0) return;
		let cancelled = false;
		void (async () => {
			let path = '';
			for (const segment of segments) {
				path = path ? `${path}/${segment}` : segment;
				const directory = await findDirectory(root, path);
				if (cancelled || !directory) return;
				nodesByKey.current.set(directory.key, directory);
				setExpanded((keys) => new Set(keys).add(directory.key));
				await load(directory);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [activePath, root, load]);

	const toggle = useCallback(
		(directory: DirectoryNode, open?: boolean) => {
			setExpanded((keys) => {
				const next = new Set(keys);
				const shouldOpen = open ?? !keys.has(directory.key);
				if (shouldOpen) next.add(directory.key);
				else next.delete(directory.key);
				return next;
			});
			if ((open ?? !expanded.has(directory.key)) && !children.has(directory.key)) void load(directory);
		},
		[children, expanded, load]
	);

	const rows = useMemo(() => {
		const out: { node: TreeNode; depth: number }[] = [];
		const walk = (key: string, depth: number) => {
			for (const node of children.get(key) ?? []) {
				out.push({ node, depth });
				if (node.kind === 'directory' && expanded.has(node.key)) walk(node.key, depth + 1);
			}
		};
		walk(root.key, 0);
		return out;
	}, [children, expanded, root.key]);

	const activate = useCallback(
		(node: TreeNode) => {
			if (node.kind === 'directory') toggle(node);
			else onOpenFile(node);
		},
		[onOpenFile, toggle]
	);

	const handlers = useMemo(
		() => ({
			activate,
			expand: (node: TreeNode) => {
				if (node.kind === 'directory') toggle(node, true);
			},
			collapse: (node: TreeNode) => {
				if (node.kind === 'directory' && expanded.has(node.key)) {
					toggle(node, false);
					return true;
				}
				return false;
			},
		}),
		[activate, expanded, toggle]
	);
	const onKeyDown = useTreeKeyboard(rows, handlers);

	if (error) return <p className="px-3 py-4 text-[12px] leading-relaxed text-danger">{error}</p>;
	if (!children.has(root.key)) {
		return (
			<div className="flex flex-col gap-2 px-3 py-3" aria-busy="true">
				{[72, 56, 64, 48].map((width) => (
					<div key={width} className="h-3.5 animate-pulse rounded bg-surface-hover" style={{ width: `${width}%` }} />
				))}
			</div>
		);
	}
	if (rows.length === 0) return <p className="px-3 py-4 text-[12px] text-fg-subtle">This folder is empty.</p>;

	const focusTarget =
		focusedKey && rows.some((row) => row.node.key === focusedKey) ? focusedKey : (activeKey ?? rows[0]?.node.key);

	return (
		<div role="tree" aria-label={label} className="flex flex-col gap-px px-1.5 py-1" onKeyDown={onKeyDown}>
			{rows.map(({ node, depth }) => (
				<TreeRow
					key={node.key}
					node={node}
					depth={depth}
					expanded={node.kind === 'directory' && expanded.has(node.key)}
					loading={loadingKeys.has(node.key)}
					selected={node.key === activeKey}
					focused={node.key === focusTarget}
					showTitles={showTitles}
					version={version}
					onActivate={activate}
					onFocus={(focused) => setFocusedKey(focused.key)}
					overrideTitle={node.key === activeKey ? activeTitle : undefined}
				/>
			))}
		</div>
	);
}
