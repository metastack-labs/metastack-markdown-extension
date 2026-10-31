import { type MouseEvent, useCallback, useEffect, useRef, useState } from 'react';
import { safeDecode } from '../../lib/fs/paths.ts';
import { PROMPT_STATUS } from '../../lib/markdown/components.ts';
import { renderMath, renderMermaid } from '../../lib/markdown/enhance.ts';
import { isRelativeReference } from '../../lib/markdown/html.ts';
import { Dialog } from './primitives.tsx';

interface MarkdownViewProps {
	/** Changes when a different document is shown; resets the image cache. */
	readonly documentId: string;
	/** Sanitized HTML. */
	readonly html: string;
	readonly frontMatter: string | null;
	readonly dark: boolean;
	/** Number of task markers in the source; checkboxes are only interactive when it matches. */
	readonly taskCount: number;
	readonly pendingHash: string | null;
	readonly onHashHandled: () => void;
	readonly resolveAsset: (reference: string) => Promise<Blob | null>;
	readonly onReference: (href: string) => void;
	readonly onToggleTask?: (index: number, checked: boolean) => void;
	/** Delay Mermaid while typing in split view. */
	readonly live?: boolean;
}

function prefersReducedMotion(): boolean {
	return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** PromptBlock's copy button, with production's status messages and a select-it-yourself fallback. */
async function copyPrompt(button: HTMLButtonElement): Promise<void> {
	const block = button.closest('.mdx-prompt');
	const code = block?.querySelector('pre code');
	const status = block?.querySelector('.mdx-prompt-status');
	if (!code || !status) return;
	button.disabled = true;
	button.setAttribute('aria-busy', 'true');
	try {
		await navigator.clipboard.writeText(code.textContent ?? '');
		button.dataset.state = 'copied';
		status.textContent = PROMPT_STATUS.copied;
	} catch {
		const range = document.createRange();
		range.selectNodeContents(code);
		window.getSelection()?.removeAllRanges();
		window.getSelection()?.addRange(range);
		button.dataset.state = 'failed';
		status.textContent = PROMPT_STATUS.failed;
	} finally {
		button.disabled = false;
		button.removeAttribute('aria-busy');
	}
}

/** Checklist ticks are for the reader's session only; they never change the document. */
function updateChecklist(box: HTMLInputElement): void {
	box.closest('li')?.toggleAttribute('data-checked', box.checked);
	const list = box.closest('.mdx-checklist');
	const progress = list?.querySelector('.mdx-checklist-progress');
	if (!list || !progress) return;
	const boxes = list.querySelectorAll<HTMLInputElement>('input[data-action="checklist-item"]');
	const checked = [...boxes].filter((item) => item.checked).length;
	progress.textContent = `${checked} of ${boxes.length} checked`;
}

export function scrollToHeading(root: ParentNode, id: string): boolean {
	const target = root.querySelector(`#${CSS.escape(id)}`);
	if (!target) return false;
	target.scrollIntoView({ block: 'start', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
	return true;
}

export function MarkdownView({
	documentId,
	html,
	frontMatter,
	dark,
	taskCount,
	pendingHash,
	onHashHandled,
	resolveAsset,
	onReference,
	onToggleTask,
	live = false,
}: MarkdownViewProps) {
	const contentRef = useRef<HTMLDivElement>(null);
	const assetCache = useRef(new Map<string, Promise<string | null>>());
	const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);

	// Blob URLs belong to one document; release them when it changes or unmounts.
	// biome-ignore lint/correctness/useExhaustiveDependencies: documentId scopes the blob-URL cache; releasing it when the document changes is the point
	useEffect(() => {
		const cache = assetCache.current;
		return () => {
			for (const pending of cache.values()) {
				void pending.then((url) => url && URL.revokeObjectURL(url));
			}
			cache.clear();
		};
	}, [documentId]);

	// Relative images resolve against the open folder.
	// biome-ignore lint/correctness/useExhaustiveDependencies: html is a trigger: the effect re-scans the DOM after innerHTML is replaced
	useEffect(() => {
		const root = contentRef.current;
		if (!root) return;
		let cancelled = false;
		for (const image of root.querySelectorAll<HTMLImageElement>('img[data-local-src]')) {
			const reference = image.dataset.localSrc ?? '';
			let pending = assetCache.current.get(reference);
			if (!pending) {
				pending = resolveAsset(reference).then((blob) => (blob ? URL.createObjectURL(blob) : null));
				assetCache.current.set(reference, pending);
			}
			void pending.then((url) => {
				if (cancelled) return;
				if (url) {
					image.src = url;
					delete image.dataset.missing;
				} else {
					image.dataset.missing = '';
					image.title = `Couldn't find ${reference}`;
				}
			});
		}
		return () => {
			cancelled = true;
		};
	}, [documentId, html, resolveAsset]);

	// Math right away; diagrams after a short pause so typing stays smooth.
	// biome-ignore lint/correctness/useExhaustiveDependencies: html is a trigger: the effect re-scans the DOM after innerHTML is replaced
	useEffect(() => {
		const root = contentRef.current;
		if (!root) return;
		const controller = new AbortController();
		void renderMath(root);
		const timer = window.setTimeout(() => void renderMermaid(root, dark, controller.signal), live ? 400 : 0);
		return () => {
			controller.abort();
			window.clearTimeout(timer);
		};
	}, [html, dark, live]);

	// Task checkboxes become interactive when they line up with the source.
	// biome-ignore lint/correctness/useExhaustiveDependencies: html is a trigger: the effect re-scans the DOM after innerHTML is replaced
	useEffect(() => {
		const root = contentRef.current;
		if (!root) return;
		const boxes = root.querySelectorAll<HTMLInputElement>('li > input[type="checkbox"]');
		const interactive = Boolean(onToggleTask) && boxes.length === taskCount;
		boxes.forEach((box, index) => {
			box.disabled = !interactive;
			if (interactive) {
				box.dataset.taskIndex = String(index);
				box.setAttribute('aria-label', box.checked ? 'Mark task as not done' : 'Mark task as done');
			}
		});
	}, [html, onToggleTask, taskCount]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: html is a trigger: scroll once the new content is in the DOM
	useEffect(() => {
		if (!pendingHash || !contentRef.current) return;
		scrollToHeading(contentRef.current, pendingHash);
		onHashHandled();
	}, [pendingHash, html, onHashHandled]);

	const onClick = useCallback(
		(event: MouseEvent<HTMLDivElement>) => {
			const target = event.target as HTMLElement;

			const copyButton = target.closest<HTMLButtonElement>('[data-action="copy-code"]');
			if (copyButton) {
				const code = copyButton.closest('.code-block')?.querySelector('code')?.textContent ?? '';
				void navigator.clipboard.writeText(code).then(() => {
					copyButton.textContent = 'Copied';
					copyButton.dataset.copied = '';
					window.setTimeout(() => {
						copyButton.textContent = 'Copy';
						delete copyButton.dataset.copied;
					}, 1500);
				});
				return;
			}

			const promptButton = target.closest<HTMLButtonElement>('[data-action="copy-prompt"]');
			if (promptButton) {
				void copyPrompt(promptButton);
				return;
			}

			const checklistBox = target.closest<HTMLInputElement>('input[data-action="checklist-item"]');
			if (checklistBox) {
				updateChecklist(checklistBox);
				return;
			}

			const checkbox = target.closest<HTMLInputElement>('input[data-task-index]');
			if (checkbox && onToggleTask) {
				onToggleTask(Number(checkbox.dataset.taskIndex), checkbox.checked);
				return;
			}

			const link = target.closest<HTMLAnchorElement>('a[href]');
			if (link) {
				const href = link.getAttribute('href') ?? '';
				if (href.startsWith('#')) {
					event.preventDefault();
					if (contentRef.current) scrollToHeading(contentRef.current, safeDecode(href.slice(1)));
					return;
				}
				if (link.target === '_blank') return;
				if (isRelativeReference(href)) {
					event.preventDefault();
					onReference(href);
				}
				return;
			}

			const image = target.closest<HTMLImageElement>('img');
			if (image?.currentSrc && !image.dataset.missing) {
				setLightbox({ src: image.currentSrc, alt: image.alt });
			}
		},
		[onReference, onToggleTask]
	);

	return (
		<article className="markdown-body">
			{frontMatter ? (
				<details className="front-matter">
					<summary>Front matter</summary>
					<pre>
						<code>{frontMatter}</code>
					</pre>
				</details>
			) : null}
			{/* biome-ignore lint/a11y/useKeyWithClickEvents: delegated handler; every target inside is a native link, button or checkbox */}
			{/* biome-ignore lint/a11y/noStaticElementInteractions: same delegated handler */}
			<div
				ref={contentRef}
				className="markdown-content"
				onClick={onClick}
				// biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized with DOMPurify in sanitizeHtml()
				dangerouslySetInnerHTML={{ __html: html }}
			/>
			<Dialog
				open={lightbox !== null}
				title={lightbox?.alt || 'Image'}
				onClose={() => setLightbox(null)}
				width={1200}
				footer={
					<button type="button" className="button button-secondary" onClick={() => setLightbox(null)}>
						Close
					</button>
				}
			>
				{lightbox ? (
					<img
						src={lightbox.src}
						alt={lightbox.alt}
						className="mx-auto max-h-[72vh] max-w-full rounded-lg object-contain"
					/>
				) : null}
			</Dialog>
		</article>
	);
}
