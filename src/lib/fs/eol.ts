/**
 * Line endings. The app works on LF-only text internally (the editor, the renderer and the
 * browser's own text view all normalise to LF) and restores each file's style when writing,
 * so a Windows-authored file keeps its CRLF endings.
 */

export type LineEnding = '\n' | '\r\n';

export interface NormalisedText {
	readonly text: string;
	readonly eol: LineEnding;
}

/** The file's dominant line ending; LF when there are no line breaks. */
export function detectLineEnding(text: string): LineEnding {
	const crlf = text.match(/\r\n/g)?.length ?? 0;
	const lf = (text.match(/\n/g)?.length ?? 0) - crlf;
	return crlf > lf ? '\r\n' : '\n';
}

export function normaliseLineEndings(raw: string): NormalisedText {
	return { text: raw.replace(/\r\n/g, '\n'), eol: detectLineEnding(raw) };
}

/** Convert LF-only text back to the file's line ending. */
export function applyLineEnding(text: string, eol: LineEnding): string {
	return eol === '\n' ? text : text.replace(/\r?\n/g, eol);
}

/** Same document, ignoring line-ending differences. */
export function sameText(a: string, b: string): boolean {
	return a.replace(/\r\n/g, '\n') === b.replace(/\r\n/g, '\n');
}
