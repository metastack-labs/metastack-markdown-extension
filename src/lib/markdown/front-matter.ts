export interface FrontMatter {
	/** The YAML between the fences, without the fences. */
	readonly raw: string;
	/** `title:` value when present (quotes stripped). */
	readonly title: string | null;
}

export interface SplitResult {
	readonly frontMatter: FrontMatter | null;
	readonly body: string;
}

const FRONT_MATTER = /^﻿?---[ \t]*\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/;

export function splitFrontMatter(source: string): SplitResult {
	const match = FRONT_MATTER.exec(source);
	if (!match) return { frontMatter: null, body: source };
	const raw = match[1] ?? '';
	return {
		frontMatter: { raw, title: readTitle(raw) },
		body: source.slice(match[0].length),
	};
}

function readTitle(yaml: string): string | null {
	const match = /^title:[ \t]*(.+?)[ \t]*$/m.exec(yaml);
	if (!match?.[1]) return null;
	const value = match[1].replace(/^(['"])(.*)\1$/, '$2').trim();
	return value || null;
}
