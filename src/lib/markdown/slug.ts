/**
 * GitHub-compatible heading slugs, so `#anchors` written against GitHub keep working here.
 * Lowercase, drop everything except letters, marks, numbers, connector punctuation,
 * spaces and hyphens, then turn spaces into hyphens (runs of hyphens are kept, as on GitHub).
 */
export function slugify(text: string): string {
	return text
		.trim()
		.toLowerCase()
		.replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, '')
		.replace(/ /g, '-');
}

/** Produces unique slugs within one document: `intro`, `intro-1`, `intro-2`, … */
export class Slugger {
	private readonly seen = new Map<string, number>();

	slug(text: string): string {
		const base = slugify(text) || 'section';
		let candidate = base;
		let count = this.seen.get(base) ?? 0;
		while (this.seen.has(candidate)) {
			count += 1;
			candidate = `${base}-${count}`;
		}
		this.seen.set(base, count);
		this.seen.set(candidate, 0);
		return candidate;
	}
}
