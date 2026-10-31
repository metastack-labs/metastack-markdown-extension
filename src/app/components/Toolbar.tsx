import { clsx } from 'clsx';
import {
	BookOpen,
	Columns2,
	Copy,
	Download,
	Ellipsis,
	FilePlus2,
	FileUp,
	FolderPlus,
	LoaderCircle,
	PanelLeft,
	PanelRight,
	Pencil,
	Printer,
	RefreshCw,
	Settings,
} from 'lucide-react';
import { Fragment } from 'react';
import { MOD_KEY_LABEL, supportsFileSystemAccess } from '../../lib/platform.ts';
import type { Crumb, ViewMode } from '../types.ts';
import type { Workspace } from '../use-workspace.ts';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger, Segmented } from './primitives.tsx';

interface ToolbarProps {
	readonly workspace: Workspace;
	readonly sidebarOpen: boolean;
	readonly outlineOpen: boolean;
	readonly outlineAvailable: boolean;
	readonly stats: { readonly words: number; readonly minutes: number } | null;
	readonly saveLabel: string;
	readonly onToggleSidebar: () => void;
	readonly onToggleOutline: () => void;
	readonly onOpenSettings: () => void;
}

const MAX_CRUMBS = 5;

function Breadcrumbs({
	crumbs,
	fileName,
	onNavigate,
}: {
	crumbs: readonly Crumb[];
	fileName: string | null;
	onNavigate: (url: string) => void;
}) {
	const collapsed = crumbs.length > MAX_CRUMBS;
	const visible: Array<Crumb | null> = collapsed ? [crumbs[0] ?? null, null, ...crumbs.slice(-3)] : [...crumbs];
	return (
		<nav
			aria-label="Location"
			className="flex min-w-0 items-center gap-1 overflow-hidden text-[13px] whitespace-nowrap"
		>
			{visible.map((crumb, index) => (
				<Fragment key={crumb ? `${index}-${crumb.name}` : 'ellipsis'}>
					{crumb === null ? (
						<span className="shrink-0 text-fg-subtle" title={crumbs.map((item) => item.name).join(' / ')}>
							…
						</span>
					) : crumb.url ? (
						<button
							type="button"
							onClick={() => crumb.url && onNavigate(crumb.url)}
							className="min-w-0 shrink truncate rounded px-0.5 text-fg-muted hover:text-accent"
						>
							{crumb.name}
						</button>
					) : (
						<span className="min-w-0 shrink truncate px-0.5 text-fg-muted">{crumb.name}</span>
					)}
					<span className="shrink-0 text-fg-subtle/60" aria-hidden>
						/
					</span>
				</Fragment>
			))}
			{fileName ? (
				<span className="min-w-0 shrink-0 truncate px-0.5 font-medium text-fg" aria-current="page">
					{fileName}
				</span>
			) : null}
		</nav>
	);
}

export function Toolbar({
	workspace,
	sidebarOpen,
	outlineOpen,
	outlineAvailable,
	stats,
	saveLabel,
	onToggleSidebar,
	onToggleOutline,
	onOpenSettings,
}: ToolbarProps) {
	const { doc, dirty, saving, mode } = workspace;
	const canSaveCopy = doc !== null;

	return (
		<header data-chrome="" className="flex h-11 shrink-0 items-center gap-2 border-b border-line bg-surface px-2">
			<div className="flex min-w-0 flex-1 items-center gap-1.5">
				<button
					type="button"
					className="icon-button"
					aria-pressed={sidebarOpen}
					aria-label="Toggle file sidebar"
					title={`Toggle sidebar (${MOD_KEY_LABEL}\\)`}
					onClick={onToggleSidebar}
				>
					<PanelLeft className="size-4" aria-hidden />
				</button>
				{doc ? (
					<Breadcrumbs
						crumbs={doc.crumbs}
						fileName={doc.name}
						onNavigate={(url) => void workspace.navigateFileUrl(url)}
					/>
				) : (
					<span className="flex min-w-0 items-center gap-2 text-[13px] font-medium text-fg-muted">
						<span className="brand-mark size-4" aria-hidden="true" />
						<span className="truncate">MetaStack Markdown</span>
					</span>
				)}
				{stats ? (
					<span className="ml-2 hidden shrink-0 text-[12px] text-fg-subtle tabular-nums lg:inline">
						{stats.words.toLocaleString()} words · {stats.minutes} min read
					</span>
				) : null}
			</div>

			<div className="flex shrink-0 items-center gap-1">
				{saving ? (
					<span className="mr-1 flex items-center gap-1.5 text-[12px] text-fg-muted" aria-live="polite">
						<LoaderCircle className="size-3.5 animate-spin" aria-hidden />
						Saving…
					</span>
				) : dirty ? (
					<span className="mr-1 hidden items-center gap-1.5 text-[12px] text-fg-muted sm:flex" aria-live="polite">
						<span className="size-1.5 rounded-full bg-warning" aria-hidden />
						Unsaved changes
					</span>
				) : null}
				{doc && (dirty || doc.origin.type === 'untitled') ? (
					<button
						type="button"
						className="button button-primary mr-1"
						onClick={() => void workspace.save()}
						disabled={saving}
						aria-keyshortcuts="Meta+S Control+S"
					>
						{saveLabel}
					</button>
				) : null}
				{doc ? (
					<Segmented<ViewMode>
						label="View"
						value={mode}
						onChange={workspace.setMode}
						options={[
							{
								value: 'read',
								label: 'Read',
								icon: <BookOpen className="size-3.5" aria-hidden />,
								title: `Read (${MOD_KEY_LABEL}E)`,
							},
							{
								value: 'edit',
								label: 'Edit',
								icon: <Pencil className="size-3.5" aria-hidden />,
								title: `Edit (${MOD_KEY_LABEL}E)`,
							},
							{
								value: 'split',
								label: 'Split',
								icon: <Columns2 className="size-3.5" aria-hidden />,
								title: 'Edit with live preview',
							},
						]}
					/>
				) : null}
				<button
					type="button"
					className="icon-button ml-1"
					aria-label="New document"
					title="New document"
					onClick={() => void workspace.requestNewDocument()}
				>
					<FilePlus2 className="size-4" aria-hidden />
				</button>
				<Menu>
					<MenuTrigger asChild>
						<button
							type="button"
							className="icon-button data-[state=open]:bg-surface-active"
							aria-label="More actions"
							title="More actions"
						>
							<Ellipsis className="size-4" aria-hidden />
						</button>
					</MenuTrigger>
					<MenuContent align="end">
						<MenuItem onSelect={() => void workspace.openFilePicker()}>
							<FileUp className="size-4" aria-hidden />
							Open file…
						</MenuItem>
						<MenuItem onSelect={() => void workspace.openFolderPicker()}>
							<FolderPlus className="size-4" aria-hidden />
							Open folder…
						</MenuItem>
						<MenuSeparator />
						<MenuItem disabled={!canSaveCopy} onSelect={() => void workspace.saveAs()}>
							<Download className="size-4" aria-hidden />
							{supportsFileSystemAccess() ? 'Save a copy…' : 'Download'}
						</MenuItem>
						<MenuItem disabled={!doc?.node} onSelect={() => void workspace.reloadFromDisk()}>
							<RefreshCw className="size-4" aria-hidden />
							Reload from disk
						</MenuItem>
						<MenuItem
							disabled={!doc}
							onSelect={() => {
								void navigator.clipboard
									.writeText(workspace.draft)
									.then(() => workspace.notify('Copied Markdown to the clipboard', 'success'));
							}}
						>
							<Copy className="size-4" aria-hidden />
							Copy Markdown
						</MenuItem>
						<MenuItem disabled={!doc} onSelect={() => window.print()}>
							<Printer className="size-4" aria-hidden />
							Print…
						</MenuItem>
					</MenuContent>
				</Menu>
				<button type="button" className="icon-button" aria-label="Settings" title="Settings" onClick={onOpenSettings}>
					<Settings className="size-4" aria-hidden />
				</button>
				<button
					type="button"
					className={clsx('icon-button', !outlineAvailable && 'invisible')}
					aria-pressed={outlineOpen}
					aria-label="Toggle outline"
					title={`Toggle outline (${MOD_KEY_LABEL}⇧\\)`}
					onClick={onToggleOutline}
					disabled={!outlineAvailable}
				>
					<PanelRight className="size-4" aria-hidden />
				</button>
			</div>
		</header>
	);
}
