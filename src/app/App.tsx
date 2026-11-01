import { FilePlus2, FolderOpen } from 'lucide-react';
import { type CSSProperties, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { applyLineEnding } from '../lib/fs/eol.ts';
import { downloadText } from '../lib/fs/write.ts';
import { countWords, renderMarkdown } from '../lib/markdown/render.ts';
import { sanitizeHtml } from '../lib/markdown/sanitize.ts';
import { findTaskMarkers } from '../lib/markdown/tasks.ts';
import { supportsFileSystemAccess } from '../lib/platform.ts';
import type { ContentWidth } from '../lib/settings.ts';
import { ConfirmDialog, GrantSaveDialog, NewDocumentDialog, SettingsDialog } from './components/Dialogs.tsx';
import { DocumentPane } from './components/DocumentPane.tsx';
import { Outline } from './components/Outline.tsx';
import { DropOverlay, Toast } from './components/Overlays.tsx';
import { ResizeHandle } from './components/primitives.tsx';
import { Sidebar } from './components/Sidebar.tsx';
import { Toolbar } from './components/Toolbar.tsx';
import { Welcome } from './components/Welcome.tsx';
import { useAppliedTheme, useSettings } from './use-settings.ts';
import { useWorkspace } from './use-workspace.ts';

const READING_WIDTHS: Record<ContentWidth, string> = {
	narrow: '40rem',
	medium: '46rem',
	wide: '60rem',
	full: '100%',
};

export function App() {
	const [settings, updateSettings] = useSettings();
	const dark = useAppliedTheme(settings.theme);
	const workspace = useWorkspace();
	const { doc, draft, dirty, mode } = workspace;
	const [settingsOpen, setSettingsOpen] = useState(false);
	const [sidebarWidth, setSidebarWidth] = useState(settings.sidebarWidth);
	const [outlineWidth, setOutlineWidth] = useState(settings.outlineWidth);
	const scrollRef = useRef<HTMLDivElement>(null);

	useEffect(() => setSidebarWidth(settings.sidebarWidth), [settings.sidebarWidth]);
	useEffect(() => setOutlineWidth(settings.outlineWidth), [settings.outlineWidth]);

	// Render from a deferred copy so typing in split view stays responsive — but only within one
	// document: a newly opened document must never render with the previous one's text.
	const live = useMemo(() => ({ id: doc?.id ?? null, text: draft }), [doc?.id, draft]);
	const deferred = useDeferredValue(live);
	const source = deferred.id === live.id ? deferred.text : live.text;
	const isMarkdown = doc?.kind === 'markdown';
	const isMdx = doc?.name.toLowerCase().endsWith('.mdx') ?? false;
	const rendered = useMemo(
		() => (isMarkdown ? renderMarkdown(source, { mdx: isMdx }) : null),
		[isMarkdown, isMdx, source]
	);
	const sanitizedHtml = useMemo(() => (rendered ? sanitizeHtml(rendered.html) : ''), [rendered]);
	const taskCount = useMemo(() => (isMarkdown ? findTaskMarkers(source).length : 0), [isMarkdown, source]);
	const stats = useMemo(() => (isMarkdown ? countWords(source) : null), [isMarkdown, source]);

	const outlineAvailable = isMarkdown && mode !== 'edit';
	const showOutline = outlineAvailable && settings.outlineOpen;
	const saveLabel =
		doc?.node?.backend.type === 'handle' || (doc?.origin.type === 'file-url' && supportsFileSystemAccess())
			? 'Save'
			: supportsFileSystemAccess()
				? 'Save as…'
				: 'Download';

	useEffect(() => {
		const title = rendered?.title ?? doc?.name;
		document.title = title ? `${dirty ? '● ' : ''}${title}` : 'MetaStack Markdown';
	}, [doc?.name, dirty, rendered?.title]);

	// Keyboard shortcuts.
	const shortcutState = useRef({ workspace, settings, updateSettings });
	shortcutState.current = { workspace, settings, updateSettings };
	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
			const { workspace: ws, settings: current, updateSettings: update } = shortcutState.current;
			const key = event.key.toLowerCase();
			if (key === 's') {
				event.preventDefault();
				if (event.shiftKey) void ws.saveAs();
				else void ws.save();
			} else if (key === 'e' && !event.shiftKey && ws.doc) {
				event.preventDefault();
				ws.setMode(ws.mode === 'read' ? 'edit' : 'read');
			} else if (event.code === 'Backslash') {
				event.preventDefault();
				if (event.shiftKey) update({ outlineOpen: !current.outlineOpen });
				else update({ sidebarOpen: !current.sidebarOpen });
			}
		};
		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	}, []);

	const readingStyle = {
		'--reading-size': `${settings.fontSize}px`,
		'--reading-leading': String(settings.lineHeight),
		'--reading-width': READING_WIDTHS[settings.contentWidth],
		'--editor-size': `${Math.max(13, settings.fontSize - 2)}px`,
		'--editor-width': settings.contentWidth === 'full' ? '100%' : READING_WIDTHS[settings.contentWidth],
	} as CSSProperties;

	const nothingOpen = !doc && !workspace.activeFolder && !workspace.fileUrlFolder;

	return (
		<div className="flex h-full flex-col bg-canvas" style={readingStyle}>
			<Toolbar
				workspace={workspace}
				sidebarOpen={settings.sidebarOpen}
				outlineOpen={showOutline}
				outlineAvailable={outlineAvailable}
				stats={stats}
				saveLabel={saveLabel}
				onToggleSidebar={() => updateSettings({ sidebarOpen: !settings.sidebarOpen })}
				onToggleOutline={() => updateSettings({ outlineOpen: !settings.outlineOpen })}
				onOpenSettings={() => setSettingsOpen(true)}
			/>
			<div className="flex min-h-0 flex-1">
				{settings.sidebarOpen ? (
					<>
						<aside data-chrome="" className="min-h-0 shrink-0 bg-surface" style={{ width: sidebarWidth }}>
							<Sidebar workspace={workspace} showTitles={settings.showTitles} activeTitle={rendered?.title ?? null} />
						</aside>
						<ResizeHandle
							label="Resize sidebar"
							side="left"
							width={sidebarWidth}
							onResize={setSidebarWidth}
							onCommit={(width) => updateSettings({ sidebarWidth: width })}
						/>
					</>
				) : null}

				<main className="min-h-0 min-w-0 flex-1" aria-busy={workspace.loading}>
					{doc ? (
						<DocumentPane
							workspace={workspace}
							rendered={rendered}
							sanitizedHtml={sanitizedHtml}
							taskCount={taskCount}
							dark={dark}
							scrollRef={scrollRef}
						/>
					) : !workspace.ready || workspace.loading ? (
						<div className="mx-auto flex max-w-[46rem] flex-col gap-3 px-10 pt-14" aria-busy="true">
							{[45, 92, 84, 88, 60].map((width) => (
								<div
									key={width}
									className="h-4 animate-pulse rounded bg-surface-hover"
									style={{ width: `${width}%` }}
								/>
							))}
						</div>
					) : workspace.loadError ? (
						<EmptyState title="Couldn't open this file" message={workspace.loadError} workspace={workspace} />
					) : nothingOpen ? (
						<div className="thin-scroll h-full overflow-y-auto">
							<Welcome workspace={workspace} />
						</div>
					) : (
						<EmptyState
							title={workspace.activeFolder?.name ?? workspace.fileUrlFolder?.name ?? 'Nothing open'}
							message="Choose a document from the sidebar, or start a new one."
							workspace={workspace}
						/>
					)}
				</main>

				{showOutline && rendered ? (
					<>
						<ResizeHandle
							label="Resize outline"
							side="right"
							width={outlineWidth}
							onResize={setOutlineWidth}
							onCommit={(width) => updateSettings({ outlineWidth: width })}
						/>
						<aside
							data-chrome=""
							className="thin-scroll min-h-0 shrink-0 overflow-y-auto bg-surface"
							style={{ width: outlineWidth }}
						>
							<Outline entries={rendered.toc} scrollRoot={scrollRef} />
						</aside>
					</>
				) : null}
			</div>

			<DropOverlay onDrop={(items) => void workspace.handleIntake(items)} />
			<Toast notice={workspace.notice} onDismiss={workspace.dismissNotice} />
			<ConfirmDialog request={workspace.confirmRequest} />
			<NewDocumentDialog
				target={workspace.newDocumentTarget}
				onCreate={workspace.createDocument}
				onClose={workspace.closeNewDocument}
			/>
			<GrantSaveDialog
				open={workspace.grantSaveOpen}
				fileName={doc?.name ?? ''}
				onChooseFolder={() => void workspace.grantFolderAndSave()}
				onDownload={() => {
					workspace.closeGrantSave();
					if (doc) downloadText(doc.name, applyLineEnding(draft, doc.eol));
				}}
				onClose={workspace.closeGrantSave}
			/>
			<SettingsDialog
				open={settingsOpen}
				settings={settings}
				onChange={updateSettings}
				onClose={() => setSettingsOpen(false)}
			/>
		</div>
	);
}

function EmptyState({
	title,
	message,
	workspace,
}: {
	readonly title: string;
	readonly message: string;
	readonly workspace: ReturnType<typeof useWorkspace>;
}) {
	return (
		<div className="animate-fade flex h-full items-center justify-center px-6">
			<div className="flex max-w-[400px] flex-col items-center text-center">
				<FolderOpen className="mb-4 size-8 text-fg-subtle" aria-hidden />
				<h2 className="text-[16px] font-semibold tracking-[-0.01em] text-balance">{title}</h2>
				<p className="mt-1.5 text-[13px] leading-relaxed text-fg-muted text-pretty">{message}</p>
				<button
					type="button"
					className="button button-secondary mt-5"
					onClick={() => void workspace.requestNewDocument()}
				>
					<FilePlus2 className="size-3.5" aria-hidden />
					New document
				</button>
			</div>
		</div>
	);
}
