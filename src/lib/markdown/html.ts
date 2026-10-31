const ESCAPES: Record<string, string> = {
	'&': '&amp;',
	'<': '&lt;',
	'>': '&gt;',
	'"': '&quot;',
	"'": '&#39;',
};

/** Escape text for safe use in HTML text nodes and double-quoted attributes. */
export function escapeHtml(value: string): string {
	return value.replace(/[&<>"']/g, (char) => ESCAPES[char] ?? char);
}

const NAMED_ENTITIES: Record<string, string> = {
	amp: '&',
	lt: '<',
	gt: '>',
	quot: '"',
	apos: "'",
	nbsp: ' ',
};

/** Convert a small HTML fragment (inline markup only) to plain text. */
export function htmlToText(html: string): string {
	return html
		.replace(/<[^>]*>/g, '')
		.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
			if (entity[0] === '#') {
				const code =
					entity[1]?.toLowerCase() === 'x'
						? Number.parseInt(entity.slice(2), 16)
						: Number.parseInt(entity.slice(1), 10);
				return Number.isFinite(code) ? String.fromCodePoint(code) : match;
			}
			return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
		})
		.replace(/\s+/g, ' ')
		.trim();
}

/** True when a URL has a scheme or is protocol-relative (i.e. is not a relative path). */
export function hasScheme(url: string): boolean {
	return /^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith('//');
}

export function isExternalUrl(url: string): boolean {
	return /^(https?:|mailto:|tel:)/i.test(url) || url.startsWith('//');
}

/** A path relative to the current document: not absolute-URL, not in-page anchor, not data/blob. */
export function isRelativeReference(url: string): boolean {
	const trimmed = url.trim();
	return trimmed.length > 0 && !trimmed.startsWith('#') && !hasScheme(trimmed);
}
