import { RefreshCw, TriangleAlert } from 'lucide-react';
import { lazy, type RefObject, Suspense, useMemo } from 'react';
import { highlightCode } from '../../lib/markdown/highlight.ts';
import type { RenderedMarkdown } from '../../lib/markdown/render.ts';
import type { Workspace } from '../use-workspace.ts';
import { MarkdownView } from './MarkdownView.tsx';

const CodeEditor = lazy(() => import('./CodeEditor.tsx'));

interface DocumentPaneProps {
	readonly workspace: Workspace;
	readonly rendered: RenderedMarkdown | null;
	readonly sanitizedHtml: string;
	readonly taskCount: number;
	readonly dark: boolean;
	readonly scrollRef: RefObject<HTMLDivElement | null>;
}

function EditorFallback() {
	return (
		<div className="flex h-full flex-col gap-3 px-8 py-8" aria-busy="true">
			{[38, 82, 74, 60].map((width) => (
				<div key={width} className="h-3.5 animate-pulse rounded bg-surface-hover" style={{ width: `${width}%` }} />
			))}
		</div>
	);
}

function TextView({ text, language }: { readonly text: string; readonly language: string }) {
	const html = useMemo(() => highlightCode(text, language).html, [text, language]);
	return (
		<div className="text-document mx-auto max-w-[72rem]">
			{/* biome-ignore lint/security/noDangerouslySetInnerHtml: highlight.js escapes the source and only adds span markup */}
			<pre className="hljs" dangerouslySetInnerHTML={{ __html: html }} />
		</div>
	);
}

export function DocumentPane({ workspace, rendered, sanitizedHtml, taskCount, dark, scrollRef }: DocumentPaneProps) {
	const { doc, draft, mode, diskChanged } = workspace;
	if (!doc) return null;
	const isMarkdown = doc.kind === 'markdown';
	const showEditor = mode === 'edit' || mode === 'split';
	const showPreview = mode === 'read' || mode === 'split';

	const preview =
		isMarkdown && rendered ? (
			<MarkdownView
				documentId={doc.id}
				html={sanitizedHtml}
				frontMatter={rendered.frontMatter?.raw ?? null}
				dark={dark}
				taskCount={taskCount}
				pendingHash={doc.pendingHash}
				onHashHandled={workspace.clearPendingHash}
				resolveAsset={workspace.resolveAsset}
				onReference={(href) => void workspace.openReference(href)}
				onToggleTask={(index, checked) => void workspace.toggleTaskAt(index, checked)}
				live={mode === 'split'}
			/>
		) : (
			<TextView text={draft} language={doc.language} />
		);

	return (
		<div className="flex h-full min-h-0 flex-col">
			{diskChanged ? (
				<div
					role="alert"
					data-chrome=""
					className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-line bg-warning-soft px-4 py-2 text-[13px]"
				>
					<TriangleAlert className="size-4 shrink-0 text-warning" aria-hidden />
					<span className="min-w-0 flex-1 text-pretty">“{doc.name}” changed on disk while you were editing.</span>
					<button type="button" className="button button-ghost" onClick={workspace.dismissDiskChange}>
						Keep my version
					</button>
					<button type="button" className="button button-secondary" onClick={() => void workspace.reloadFromDisk()}>
						<RefreshCw className="size-3.5" aria-hidden />
						Reload from disk
					</button>
				</div>
			) : null}
			<div className={mode === 'split' ? 'grid min-h-0 flex-1 grid-cols-2' : 'flex min-h-0 flex-1'}>
				{showEditor ? (
					<div
						className={mode === 'split' ? 'min-h-0 min-w-0 border-r border-line' : 'min-h-0 min-w-0 flex-1'}
						data-chrome=""
					>
						<Suspense fallback={<EditorFallback />}>
							<CodeEditor
								documentId={doc.id}
								value={draft}
								markdownMode={isMarkdown}
								onChange={workspace.updateDraft}
								onSave={() => void workspace.save()}
								label={`Editing ${doc.name}`}
							/>
						</Suspense>
					</div>
				) : null}
				{showPreview ? (
					<div
						ref={scrollRef}
						data-print-root=""
						className="thin-scroll min-h-0 min-w-0 flex-1 overflow-y-auto px-6 pt-10 pb-24 sm:px-10"
					>
						{preview}
					</div>
				) : null}
			</div>
		</div>
	);
}
