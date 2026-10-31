import { clsx } from 'clsx';
import {
	Check,
	ChevronDown,
	CornerLeftUp,
	FileText,
	FileUp,
	FolderOpen,
	FolderPlus,
	HardDrive,
	RefreshCw,
	X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { documentKind } from '../../lib/fs/file-types.ts';
import type { TreeNode } from '../../lib/fs/nodes.ts';
import { supportsFileSystemAccess } from '../../lib/platform.ts';
import type { Workspace } from '../use-workspace.ts';
import { FileTree, TreeRow, useTreeKeyboard } from './FileTree.tsx';
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from './primitives.tsx';

interface SidebarProps {
	readonly workspace: Workspace;
	readonly showTitles: boolean;
	readonly activeTitle: string | null;
}

export function Sidebar({ workspace, showTitles, activeTitle }: SidebarProps) {
	const { activeFolder, fileUrlFolder, folders, doc, looseFiles } = workspace;
	const heading = activeFolder?.name ?? fileUrlFolder?.name ?? 'No folder open';
	const activeKey = doc?.node?.key ?? null;
	const docInActiveFolder = doc?.origin.type === 'folder' && doc.origin.folderId === activeFolder?.id;

	return (
		<nav aria-label="Files" className="flex h-full min-h-0 flex-col">
			<div className="flex h-11 shrink-0 items-center px-2">
				<Menu>
					<MenuTrigger asChild>
						<button
							type="button"
							className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-surface-hover data-[state=open]:bg-surface-hover"
						>
							<FolderOpen className="size-4 shrink-0 text-fg-subtle" aria-hidden />
							<span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{heading}</span>
							<ChevronDown className="size-3.5 shrink-0 text-fg-subtle" aria-hidden />
							<span className="sr-only">Switch folder</span>
						</button>
					</MenuTrigger>
					<MenuContent align="start" className="w-[260px]">
						{folders.length > 0 ? (
							<>
								<MenuLabel>Folders</MenuLabel>
								{folders.map((folder) => (
									<MenuItem key={folder.id} onSelect={() => void workspace.activateFolder(folder.id)}>
										{folder.id === activeFolder?.id ? (
											<Check className="size-4" aria-hidden />
										) : (
											<span className="size-4" />
										)}
										<span className="min-w-0 flex-1 truncate">{folder.name}</span>
										{folder.access !== 'granted' ? <span className="text-[11px] text-fg-subtle">Reconnect</span> : null}
									</MenuItem>
								))}
								<MenuSeparator />
							</>
						) : null}
						<MenuItem onSelect={() => void workspace.openFolderPicker()}>
							<FolderPlus className="size-4" aria-hidden />
							Open folder…
						</MenuItem>
						<MenuItem onSelect={() => void workspace.openFilePicker()}>
							<FileUp className="size-4" aria-hidden />
							Open file…
						</MenuItem>
						{activeFolder ? (
							<>
								<MenuSeparator />
								<MenuItem onSelect={workspace.refreshTree}>
									<RefreshCw className="size-4" aria-hidden />
									Refresh
								</MenuItem>
								<MenuItem onSelect={() => void workspace.removeFolder(activeFolder.id)}>
									<X className="size-4" aria-hidden />
									Remove from list
								</MenuItem>
							</>
						) : null}
					</MenuContent>
				</Menu>
			</div>

			<div className="thin-scroll min-h-0 flex-1 overflow-y-auto pb-3">
				{activeFolder ? (
					activeFolder.access === 'granted' ? (
						<FileTree
							root={activeFolder.node}
							version={workspace.treeVersion}
							activeKey={docInActiveFolder ? activeKey : null}
							activePath={docInActiveFolder ? (doc?.node?.path ?? null) : null}
							activeTitle={docInActiveFolder ? activeTitle : null}
							showTitles={showTitles}
							onOpenFile={(node) => void workspace.openFile(node, { type: 'folder', folderId: activeFolder.id })}
							label={activeFolder.name}
						/>
					) : (
						<div className="flex flex-col items-start gap-3 px-4 py-4">
							<p className="text-[12px] leading-relaxed text-fg-muted text-pretty">
								Your browser needs permission again to show “{activeFolder.name}”.
							</p>
							<button
								type="button"
								className="button button-secondary"
								onClick={() => void workspace.activateFolder(activeFolder.id)}
							>
								<HardDrive className="size-3.5" aria-hidden />
								Allow access
							</button>
						</div>
					)
				) : fileUrlFolder ? (
					<FileUrlListing workspace={workspace} showTitles={showTitles} activeTitle={activeTitle} />
				) : (
					<div className="flex flex-col items-start gap-3 px-4 py-4">
						<p className="text-[12px] leading-relaxed text-fg-muted text-pretty">
							Open a folder to browse its documents here.
						</p>
						<button type="button" className="button button-secondary" onClick={() => void workspace.openFolderPicker()}>
							<FolderPlus className="size-3.5" aria-hidden />
							Open folder
						</button>
					</div>
				)}

				{looseFiles.length > 0 ? (
					<section aria-label="Open files" className="mt-3 border-t border-line pt-2">
						<h3 className="px-4 pt-1 pb-1.5 text-[11px] font-semibold text-fg-subtle">Open files</h3>
						<ul className="flex flex-col gap-px px-1.5">
							{looseFiles.map((file) => {
								const selected = file.key === activeKey;
								return (
									<li key={file.key} className="group relative">
										<button
											type="button"
											onClick={() => void workspace.openFile(file, { type: 'loose' })}
											className={clsx(
												'flex min-h-[30px] w-full min-w-0 items-center gap-2 rounded-md pr-8 pl-[26px] text-left text-[13px]',
												selected
													? 'bg-accent-soft font-medium text-fg'
													: 'text-fg-muted hover:bg-surface-hover hover:text-fg'
											)}
										>
											<FileText
												className={clsx('size-4 shrink-0', selected ? 'text-accent' : 'text-fg-subtle')}
												aria-hidden
											/>
											<span className="min-w-0 truncate">{file.name}</span>
										</button>
										<button
											type="button"
											aria-label={`Close ${file.name}`}
											onClick={() => workspace.closeLooseFile(file.key)}
											className="icon-button absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
										>
											<X className="size-3.5" aria-hidden />
										</button>
									</li>
								);
							})}
						</ul>
					</section>
				) : null}
			</div>
		</nav>
	);
}

/** Siblings of a file:// document, as listed by the browser. */
function FileUrlListing({
	workspace,
	showTitles,
	activeTitle,
}: {
	readonly workspace: Workspace;
	readonly showTitles: boolean;
	readonly activeTitle: string | null;
}) {
	const { fileUrlFolder, doc } = workspace;
	const [focusedKey, setFocusedKey] = useState<string | null>(null);
	const activeUrl = doc?.origin.type === 'file-url' ? doc.origin.url : null;
	const entries = fileUrlFolder?.entries ?? null;
	const rows = useMemo(() => (entries ?? []).map((node) => ({ node, depth: 0 })), [entries]);
	const handlers = useMemo(
		() => ({
			activate: (node: TreeNode) => {
				if (node.backend.type === 'url') void workspace.navigateFileUrl(node.backend.url);
			},
			expand: () => undefined,
			collapse: () => false,
		}),
		[workspace.navigateFileUrl]
	);
	const onKeyDown = useTreeKeyboard(rows, handlers);
	if (!fileUrlFolder) return null;

	const activeKey =
		rows.find((row) => row.node.backend.type === 'url' && row.node.backend.url === activeUrl)?.node.key ?? null;
	const focusTarget = focusedKey ?? activeKey ?? rows[0]?.node.key ?? null;

	return (
		<div className="flex flex-col">
			{fileUrlFolder.parentUrl ? (
				<button
					type="button"
					onClick={() => fileUrlFolder.parentUrl && void workspace.navigateFileUrl(fileUrlFolder.parentUrl)}
					className="mx-1.5 flex min-h-[30px] items-center gap-1.5 rounded-md px-1.5 text-[13px] text-fg-muted hover:bg-surface-hover hover:text-fg"
				>
					<span className="grid size-4 place-items-center">
						<CornerLeftUp className="size-3.5" aria-hidden />
					</span>
					<span>Parent folder</span>
				</button>
			) : null}
			{entries === null ? (
				<p className="px-4 py-3 text-[12px] leading-relaxed text-fg-subtle text-pretty">
					The browser didn't list this folder. Open it to browse every file.
				</p>
			) : rows.length === 0 ? (
				<p className="px-4 py-3 text-[12px] text-fg-subtle">This folder is empty.</p>
			) : (
				<div
					role="tree"
					aria-label={fileUrlFolder.name}
					className="flex flex-col gap-px px-1.5 py-1"
					onKeyDown={onKeyDown}
				>
					{rows.map(({ node }) => (
						<TreeRow
							key={node.key}
							node={node}
							depth={0}
							expanded={false}
							loading={false}
							selected={node.key === activeKey}
							focused={node.key === focusTarget}
							showTitles={showTitles}
							version={0}
							onActivate={handlers.activate}
							onFocus={(focused) => setFocusedKey(focused.key)}
							overrideTitle={node.key === activeKey ? activeTitle : undefined}
						/>
					))}
				</div>
			)}
			{supportsFileSystemAccess() && doc && documentKind(doc.name) ? (
				<div className="mx-3 mt-4 flex flex-col items-start gap-2 border-t border-line pt-3">
					<p className="text-[12px] leading-relaxed text-fg-muted text-pretty">
						Open this folder to browse subfolders and save without extra prompts.
					</p>
					<button type="button" className="button button-secondary" onClick={() => void workspace.openFolderPicker()}>
						<FolderPlus className="size-3.5" aria-hidden />
						Open folder
					</button>
				</div>
			) : null}
		</div>
	);
}
