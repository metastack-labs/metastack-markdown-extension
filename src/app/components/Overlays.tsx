import { clsx } from 'clsx';
import { CircleAlert, CircleCheck, Info, Upload, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { dragHasFiles, type IntakeItem, readDrop } from '../../lib/fs/intake.ts';
import type { Notice } from '../types.ts';

/** Full-window drop target. Listens on window (capture) so the editor never swallows a file drop. */
export function DropOverlay({ onDrop }: { readonly onDrop: (items: IntakeItem[]) => void }) {
	const [active, setActive] = useState(false);
	const onDropRef = useRef(onDrop);
	onDropRef.current = onDrop;

	useEffect(() => {
		let depth = 0;
		const enter = (event: DragEvent) => {
			if (!dragHasFiles(event)) return;
			depth += 1;
			setActive(true);
		};
		const over = (event: DragEvent) => {
			if (!dragHasFiles(event)) return;
			event.preventDefault();
			if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
		};
		const leave = (event: DragEvent) => {
			if (!dragHasFiles(event)) return;
			depth = Math.max(0, depth - 1);
			if (depth === 0) setActive(false);
		};
		const drop = (event: DragEvent) => {
			if (!dragHasFiles(event) || !event.dataTransfer) return;
			event.preventDefault();
			event.stopPropagation();
			depth = 0;
			setActive(false);
			void readDrop(event.dataTransfer).then((items) => onDropRef.current(items));
		};
		window.addEventListener('dragenter', enter, true);
		window.addEventListener('dragover', over, true);
		window.addEventListener('dragleave', leave, true);
		window.addEventListener('drop', drop, true);
		return () => {
			window.removeEventListener('dragenter', enter, true);
			window.removeEventListener('dragover', over, true);
			window.removeEventListener('dragleave', leave, true);
			window.removeEventListener('drop', drop, true);
		};
	}, []);

	if (!active) return null;
	return (
		<div className="animate-fade pointer-events-none fixed inset-0 z-50 grid place-items-center bg-canvas/70 p-6 backdrop-blur-[6px]">
			<div className="flex w-full max-w-md flex-col items-center gap-3 rounded-[20px] border-2 border-dashed border-accent bg-surface-raised px-8 py-10 text-center shadow-pop">
				<Upload className="size-6 text-accent" aria-hidden />
				<p className="text-[15px] font-semibold">Drop to open</p>
				<p className="text-[13px] text-fg-muted">Markdown files, text files or a folder</p>
			</div>
		</div>
	);
}

export function Toast({ notice, onDismiss }: { readonly notice: Notice | null; readonly onDismiss: () => void }) {
	useEffect(() => {
		if (!notice) return;
		const timer = window.setTimeout(onDismiss, notice.tone === 'error' ? 7000 : notice.action ? 6000 : 3200);
		return () => window.clearTimeout(timer);
	}, [notice, onDismiss]);

	const Icon = notice?.tone === 'error' ? CircleAlert : notice?.tone === 'success' ? CircleCheck : Info;
	return (
		<div
			aria-live="polite"
			className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex justify-center px-4"
			data-chrome=""
		>
			{notice ? (
				<div
					key={notice.id}
					role={notice.tone === 'error' ? 'alert' : 'status'}
					className="pop-surface animate-pop pointer-events-auto flex max-w-[560px] items-center gap-3 py-2 pr-2 pl-3.5"
				>
					<Icon
						className={clsx(
							'size-4 shrink-0',
							notice.tone === 'error' ? 'text-danger' : notice.tone === 'success' ? 'text-success' : 'text-fg-subtle'
						)}
						aria-hidden
					/>
					<p className="min-w-0 flex-1 text-[13px] leading-snug text-pretty">{notice.message}</p>
					{notice.action ? (
						<button
							type="button"
							className="button button-ghost text-accent"
							onClick={() => {
								notice.action?.run();
								onDismiss();
							}}
						>
							{notice.action.label}
						</button>
					) : null}
					<button type="button" className="icon-button" aria-label="Dismiss" onClick={onDismiss}>
						<X className="size-3.5" aria-hidden />
					</button>
				</div>
			) : null}
		</div>
	);
}
