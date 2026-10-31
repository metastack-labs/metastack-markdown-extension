import { clsx } from 'clsx';
import { type RefObject, useEffect, useState } from 'react';
import type { TocEntry } from '../../lib/markdown/render.ts';
import { scrollToHeading } from './MarkdownView.tsx';

interface OutlineProps {
	readonly entries: readonly TocEntry[];
	/** The element that scrolls the rendered document. */
	readonly scrollRoot: RefObject<HTMLElement | null>;
}

/** "On this page": headings of the open document, highlighting the one in view. */
export function Outline({ entries, scrollRoot }: OutlineProps) {
	const [activeId, setActiveId] = useState<string | null>(null);

	useEffect(() => {
		const root = scrollRoot.current;
		if (!root || entries.length === 0) return;
		let frame = 0;
		const update = () => {
			frame = 0;
			const top = root.getBoundingClientRect().top + 96;
			let current: string | null = entries[0]?.id ?? null;
			for (const entry of entries) {
				const element = root.querySelector(`#${CSS.escape(entry.id)}`);
				if (!element) continue;
				if (element.getBoundingClientRect().top <= top) current = entry.id;
				else break;
			}
			// At the very bottom, the last heading wins even if it can't reach the top.
			if (root.scrollTop + root.clientHeight >= root.scrollHeight - 4) current = entries.at(-1)?.id ?? current;
			setActiveId(current);
		};
		const onScroll = () => {
			if (!frame) frame = requestAnimationFrame(update);
		};
		update();
		root.addEventListener('scroll', onScroll, { passive: true });
		return () => {
			root.removeEventListener('scroll', onScroll);
			if (frame) cancelAnimationFrame(frame);
		};
	}, [entries, scrollRoot]);

	if (entries.length === 0) {
		return <p className="px-4 py-3 text-[12px] text-fg-subtle">No headings in this document.</p>;
	}
	const minLevel = Math.min(...entries.map((entry) => entry.level));

	return (
		<nav aria-label="On this page" className="flex flex-col">
			<h2 className="px-4 pt-3.5 pb-2 text-[11px] font-semibold text-fg-subtle">On this page</h2>
			<ul className="flex flex-col pr-3 pb-6">
				{entries.map((entry) => {
					const active = entry.id === activeId;
					return (
						<li key={entry.id}>
							<a
								href={`#${entry.id}`}
								aria-current={active ? 'location' : undefined}
								onClick={(event) => {
									event.preventDefault();
									if (scrollRoot.current) scrollToHeading(scrollRoot.current, entry.id);
									setActiveId(entry.id);
								}}
								className={clsx(
									'block border-l-2 py-[5px] pr-1 text-[13px] leading-snug transition-colors duration-100',
									active ? 'border-accent font-medium text-accent' : 'border-transparent text-fg-muted hover:text-fg'
								)}
								style={{ paddingLeft: 14 + (entry.level - minLevel) * 12 }}
							>
								<span className="line-clamp-2">{entry.text}</span>
							</a>
						</li>
					);
				})}
			</ul>
		</nav>
	);
}
