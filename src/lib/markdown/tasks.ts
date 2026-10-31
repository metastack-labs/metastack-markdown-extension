import { splitFrontMatter } from './front-matter.ts';

/** A task-list item marker (`- [ ]` / `- [x]`) found in Markdown source. */
export interface TaskMarker {
	/** Offset of the character between the brackets (` ` or `x`). */
	readonly offset: number;
	readonly checked: boolean;
}

// List item (optionally inside blockquotes) followed by a GFM task box and whitespace.
const TASK = /^((?:[ \t]*>)*[ \t]*(?:[-*+]|\d{1,9}[.)])[ \t]+)\[([ xX])\](?=[ \t]|$)/gm;
const FENCE = /^[ \t]*(`{3,}|~{3,})[^\n]*\n[\s\S]*?(?:^[ \t]*\1[ \t]*$|(?![\s\S]))/gm;

/**
 * Task markers in document order, skipping fenced code and front matter.
 * The order matches the order of checkboxes the renderer emits, which lets the viewer
 * map "the Nth checkbox" back to a source offset.
 */
export function findTaskMarkers(source: string): TaskMarker[] {
	const { body } = splitFrontMatter(source);
	const bodyStart = source.length - body.length;
	// Blank fenced code with same-length filler so offsets stay aligned.
	const masked = body.replace(FENCE, (block) => block.replace(/[^\n]/g, ' '));
	const markers: TaskMarker[] = [];
	for (const match of masked.matchAll(TASK)) {
		const prefix = match[1] ?? '';
		const box = match[2] ?? ' ';
		markers.push({
			offset: bodyStart + (match.index ?? 0) + prefix.length + 1,
			checked: box !== ' ',
		});
	}
	return markers;
}

/** Return `source` with the Nth task toggled, or `null` when there is no such task. */
export function toggleTask(source: string, index: number, checked: boolean): string | null {
	const marker = findTaskMarkers(source)[index];
	if (!marker) return null;
	return `${source.slice(0, marker.offset)}${checked ? 'x' : ' '}${source.slice(marker.offset + 1)}`;
}
