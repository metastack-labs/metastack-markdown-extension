import { Marked, type TokenizerAndRendererExtension, type Tokens } from 'marked';
import markedFootnote from 'marked-footnote';
import { type FrontMatter, splitFrontMatter } from './front-matter.ts';
import { highlightCode } from './highlight.ts';
import { escapeHtml, htmlToText, isExternalUrl, isRelativeReference } from './html.ts';
import { Slugger } from './slug.ts';

export interface TocEntry {
	readonly id: string;
	readonly text: string;
	readonly level: number;
}

export interface RenderedMarkdown {
	/** Unsanitized HTML. Always pass it through the sanitizer before inserting it into a page. */
	readonly html: string;
	readonly toc: TocEntry[];
	/** Front-matter title, else the first level-1 heading. */
	readonly title: string | null;
	readonly frontMatter: FrontMatter | null;
	readonly hasMath: boolean;
	readonly hasMermaid: boolean;
}

type AlertKind = 'note' | 'tip' | 'important' | 'warning' | 'caution';

// Octicons (MIT) used by GitHub for alert titles.
const ALERT_ICONS: Record<AlertKind, string> = {
	note: '<path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm8-6.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM6.5 7.75A.75.75 0 0 1 7.25 7h1a.75.75 0 0 1 .75.75v2.75h.25a.75.75 0 0 1 0 1.5h-2a.75.75 0 0 1 0-1.5h.25v-2h-.25a.75.75 0 0 1-.75-.75ZM8 6a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"/>',
	tip: '<path d="M8 1.5c-2.363 0-4 1.69-4 3.75 0 .984.424 1.625.984 2.304l.214.253c.223.264.47.556.673.848.284.411.537.896.621 1.49a.75.75 0 0 1-1.484.211c-.04-.282-.163-.547-.37-.847a8.456 8.456 0 0 0-.542-.68c-.084-.1-.173-.205-.268-.32C3.201 7.75 2.5 6.766 2.5 5.25 2.5 2.31 4.863 0 8 0s5.5 2.31 5.5 5.25c0 1.516-.701 2.5-1.328 3.259-.095.115-.184.22-.268.319-.207.245-.383.453-.541.681-.208.3-.33.565-.37.847a.751.751 0 0 1-1.485-.212c.084-.593.337-1.078.621-1.489.203-.292.45-.584.673-.848.075-.088.147-.173.213-.253.561-.679.985-1.32.985-2.304 0-2.06-1.637-3.75-4-3.75ZM5.75 12h4.5a.75.75 0 0 1 0 1.5h-4.5a.75.75 0 0 1 0-1.5ZM6 15.25a.75.75 0 0 1 .75-.75h2.5a.75.75 0 0 1 0 1.5h-2.5a.75.75 0 0 1-.75-.75Z"/>',
	important:
		'<path d="M0 1.75C0 .784.784 0 1.75 0h12.5C15.216 0 16 .784 16 1.75v9.5A1.75 1.75 0 0 1 14.25 13H8.06l-2.573 2.573A1.458 1.458 0 0 1 3 14.543V13H1.75A1.75 1.75 0 0 1 0 11.25Zm1.75-.25a.25.25 0 0 0-.25.25v9.5c0 .138.112.25.25.25h2a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.749.749 0 0 1 .53-.22h6.5a.25.25 0 0 0 .25-.25v-9.5a.25.25 0 0 0-.25-.25Zm7 2.25v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 9a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"/>',
	warning:
		'<path d="M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575Zm1.763.707a.25.25 0 0 0-.44 0L1.698 13.132a.25.25 0 0 0 .22.368h12.164a.25.25 0 0 0 .22-.368Zm.53 3.996v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"/>',
	caution:
		'<path d="M4.47.22A.749.749 0 0 1 5 0h6c.199 0 .389.079.53.22l4.25 4.25c.141.14.22.331.22.53v6a.749.749 0 0 1-.22.53l-4.25 4.25A.749.749 0 0 1 11 16H5a.749.749 0 0 1-.53-.22L.22 11.53A.749.749 0 0 1 0 11V5c0-.199.079-.389.22-.53Zm.84 1.28L1.5 5.31v5.38l3.81 3.81h5.38l3.81-3.81V5.31L10.69 1.5ZM8 4a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"/>',
};

const ALERT_MARKER = /^\s*<p>\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*(?:\r?\n|<br\s*\/?>)?/i;

function renderAlert(kind: AlertKind, bodyAfterMarker: string): string {
	const label = kind.charAt(0).toUpperCase() + kind.slice(1);
	const body = `<p>${bodyAfterMarker}`.replace(/^<p>\s*<\/p>\s*/, '');
	return `<div class="markdown-alert markdown-alert-${kind}"><p class="markdown-alert-title"><svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="currentColor">${ALERT_ICONS[kind]}</svg>${label}</p>${body}</div>\n`;
}

interface MathToken extends Tokens.Generic {
	readonly text: string;
	readonly display: boolean;
}

/** Placeholder hydrated by KaTeX in the browser; the escaped TeX is the no-JS fallback. */
function mathMarkup(tex: string, display: boolean, block: boolean): string {
	const escaped = escapeHtml(tex);
	const tag = block ? 'div' : 'span';
	const mode = display ? 'math-display' : 'math-inline';
	return `<${tag} class="math ${mode}" data-tex="${escaped}">${escaped}</${tag}>${block ? '\n' : ''}`;
}

function mathExtensions(onMath: () => void): TokenizerAndRendererExtension[] {
	return [
		{
			name: 'blockMath',
			level: 'block',
			start: (src) => /^\$\$/m.exec(src)?.index,
			tokenizer(src) {
				const match = /^\$\$([\s\S]+?)\$\$[ \t]*(?:\n+|$)/.exec(src);
				if (!match?.[1]) return undefined;
				return { type: 'blockMath', raw: match[0], text: match[1].trim(), display: true };
			},
			renderer(token) {
				onMath();
				return mathMarkup((token as MathToken).text, true, true);
			},
		},
		{
			name: 'inlineMath',
			level: 'inline',
			start: (src) => {
				const index = src.indexOf('$');
				return index < 0 ? undefined : index;
			},
			tokenizer(src) {
				const display = /^\$\$(?!\$)([^\n]+?)\$\$/.exec(src);
				if (display?.[1]) {
					return { type: 'inlineMath', raw: display[0], text: display[1].trim(), display: true };
				}
				// Pandoc rule: no space after the opening `$` or before the closing `$`,
				// and the closing `$` must not be followed by a digit (so "$5 and $10" stays text).
				const inline = /^\$(?![\s$])((?:\\.|[^\\\n$])+?)(?<![\s\\])\$(?![\d$])/.exec(src);
				if (inline?.[1]) {
					return { type: 'inlineMath', raw: inline[0], text: inline[1], display: false };
				}
				return undefined;
			},
			renderer(token) {
				onMath();
				const math = token as MathToken;
				return mathMarkup(math.text, math.display, false);
			},
		},
	];
}

/**
 * Markdown → HTML. Pure and synchronous so it runs in tests and in a render pass.
 * Math and Mermaid become placeholders that the browser hydrates lazily; relative images
 * become `data-local-src` so the viewer can resolve them against the open folder.
 */
export function renderMarkdown(source: string): RenderedMarkdown {
	const { frontMatter, body } = splitFrontMatter(source);
	const slugger = new Slugger();
	const toc: TocEntry[] = [];
	let firstH1: string | null = null;
	let hasMath = false;
	let hasMermaid = false;

	const marked = new Marked({ gfm: true, breaks: false });
	marked.use(markedFootnote());
	marked.use({
		extensions: mathExtensions(() => {
			hasMath = true;
		}),
		renderer: {
			heading({ tokens, depth }) {
				const inner = this.parser.parseInline(tokens);
				const text = htmlToText(inner);
				const id = slugger.slug(text);
				toc.push({ id, text, level: depth });
				if (depth === 1 && firstH1 === null) firstH1 = text;
				return `<h${depth} id="${id}">${inner}<a class="heading-anchor" href="#${id}" aria-label="Link to this section">#</a></h${depth}>\n`;
			},
			code({ text, lang }) {
				const language = (lang ?? '').trim().split(/\s+/)[0] ?? '';
				if (language.toLowerCase() === 'mermaid') {
					hasMermaid = true;
					return `<div class="mermaid-block" data-mermaid="">${escapeHtml(text)}</div>\n`;
				}
				const highlighted = highlightCode(text, language);
				const label = language ? `<span class="code-lang">${escapeHtml(language)}</span>` : '';
				const langClass = highlighted.language ? ` language-${escapeHtml(highlighted.language)}` : '';
				return `<div class="code-block">${label}<button type="button" class="code-copy" data-action="copy-code">Copy</button><pre><code class="hljs${langClass}">${highlighted.html}</code></pre></div>\n`;
			},
			blockquote({ tokens }) {
				const inner = this.parser.parse(tokens);
				const marker = ALERT_MARKER.exec(inner);
				if (!marker?.[1]) return `<blockquote>\n${inner}</blockquote>\n`;
				return renderAlert(marker[1].toLowerCase() as AlertKind, inner.slice(marker[0].length));
			},
			link({ href, title, tokens }) {
				const inner = this.parser.parseInline(tokens);
				const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
				const external = isExternalUrl(href) ? ' target="_blank" rel="noopener noreferrer"' : '';
				return `<a href="${escapeHtml(href)}"${titleAttr}${external}>${inner}</a>`;
			},
			image({ href, title, text }) {
				const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
				const alt = escapeHtml(text);
				const source = isRelativeReference(href) ? `data-local-src="${escapeHtml(href)}"` : `src="${escapeHtml(href)}"`;
				return `<img ${source} alt="${alt}"${titleAttr} loading="lazy">`;
			},
		},
	});

	const parsed = marked.parse(body, { async: false });
	const html = typeof parsed === 'string' ? parsed : '';

	return {
		html,
		toc,
		title: frontMatter?.title ?? firstH1,
		frontMatter,
		hasMath,
		hasMermaid,
	};
}

export interface WordStats {
	readonly words: number;
	readonly minutes: number;
}

/** Words of prose (front matter and fenced code excluded) and a 230 wpm reading estimate. */
export function countWords(source: string): WordStats {
	const { body } = splitFrontMatter(source);
	const prose = body.replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1[ \t]*$/gm, ' ');
	const words = prose.match(/[\p{L}\p{N}][\p{L}\p{N}'’_-]*/gu)?.length ?? 0;
	return { words, minutes: Math.max(1, Math.round(words / 230)) };
}
