/**
 * Reads MDX's JSX elements (`<Name prop="…" text={`…`} flag />`, `<Name>…</Name>`) without running
 * anything. Prop values are read as literals only: strings, template literals without `${}`, numbers
 * and booleans. Any other expression is kept as source text and never evaluated, the same rule the
 * MetaStack content pipeline applies to content ("props are literal text").
 */

export type JsxValue =
	| { readonly kind: 'literal'; readonly value: string | number | boolean }
	| { readonly kind: 'expression'; readonly source: string };

export interface JsxProp {
	/** `...` for a spread attribute (`{...props}`). */
	readonly name: string;
	readonly value: JsxValue;
}

export interface JsxElement {
	readonly name: string;
	readonly props: readonly JsxProp[];
	/** Source between the opening and closing tags; `null` when self-closing. */
	readonly children: string | null;
	/** Characters consumed, from `<` through the closing tag. */
	readonly length: number;
}

const COMPONENT_NAME = /[A-Z][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*/y;
const ATTRIBUTE_NAME = /[A-Za-z_$][\w$:.-]*/y;
const CLOSING_TAG = /<\/\s*([A-Za-z][\w.]*)?\s*>/y;
const NUMBER = /^-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/** JSX attribute strings take HTML character references, not backslash escapes. */
function decodeEntities(text: string): string {
	return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
		if (entity[0] === '#') {
			const hex = entity[1]?.toLowerCase() === 'x';
			const code = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
			return Number.isFinite(code) && code <= 0x10ffff ? String.fromCodePoint(code) : match;
		}
		return ENTITIES[entity.toLowerCase()] ?? match;
	});
}

const SIMPLE_ESCAPES: Record<string, string> = { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', v: '\v', '0': '\0' };

/** Cooks the escapes of a JS string or template literal body. */
function unescapeJs(body: string): string {
	return body.replace(/\\(u\{[0-9a-f]+\}|u[0-9a-f]{4}|x[0-9a-f]{2}|\r\n|[\s\S])/gi, (_match, sequence: string) => {
		const lower = sequence.toLowerCase();
		if (lower.startsWith('u{'))
			return String.fromCodePoint(Math.min(Number.parseInt(sequence.slice(2, -1), 16), 0x10ffff));
		if (lower.startsWith('u') && sequence.length === 5)
			return String.fromCharCode(Number.parseInt(sequence.slice(1), 16));
		if (lower.startsWith('x') && sequence.length === 3)
			return String.fromCharCode(Number.parseInt(sequence.slice(1), 16));
		if (sequence === '\n' || sequence === '\r\n' || sequence === '\r') return '';
		return SIMPLE_ESCAPES[sequence] ?? sequence;
	});
}

/** The value of `{…}` when it is a plain literal; otherwise the expression, unevaluated. */
export function literalFromExpression(source: string): JsxValue {
	const trimmed = source.trim();
	const quoted = /^(["'])((?:\\[\s\S]|(?!\1)[^\\\n])*)\1$/.exec(trimmed);
	if (quoted) return { kind: 'literal', value: unescapeJs(quoted[2] ?? '') };
	const template = /^`((?:\\[\s\S]|[^\\`])*)`$/.exec(trimmed);
	if (template && !/(?:^|[^\\])(?:\\\\)*\$\{/.test(template[1] ?? '')) {
		return { kind: 'literal', value: unescapeJs(template[1] ?? '') };
	}
	if (trimmed === 'true' || trimmed === 'false') return { kind: 'literal', value: trimmed === 'true' };
	if (NUMBER.test(trimmed)) return { kind: 'literal', value: Number(trimmed) };
	return { kind: 'expression', source: trimmed };
}

/** Index just past the `}` matching the `{` at `start`, skipping strings, templates and comments; -1 if unbalanced. */
export function skipExpression(src: string, start: number): number {
	let depth = 0;
	// Each open template literal remembers the brace depth of its `${`, so `}` can close it.
	const templates: number[] = [];
	let i = start;
	while (i < src.length) {
		const char = src[i];
		if (templates.length > 0 && depth === templates.at(-1)) {
			// Inside a template literal's text.
			if (char === '\\') i += 2;
			else if (char === '`') {
				templates.pop();
				i += 1;
			} else if (char === '$' && src[i + 1] === '{') {
				depth += 1;
				i += 2;
			} else i += 1;
			continue;
		}
		if (char === '"' || char === "'") {
			i += 1;
			while (i < src.length && src[i] !== char && src[i] !== '\n') i += src[i] === '\\' ? 2 : 1;
			i += 1;
		} else if (char === '`') {
			templates.push(depth);
			i += 1;
		} else if (char === '/' && src[i + 1] === '*') {
			const end = src.indexOf('*/', i + 2);
			if (end < 0) return -1;
			i = end + 2;
		} else if (char === '/' && src[i + 1] === '/') {
			const end = src.indexOf('\n', i);
			i = end < 0 ? src.length : end;
		} else if (char === '{') {
			depth += 1;
			i += 1;
		} else if (char === '}') {
			depth -= 1;
			i += 1;
			if (depth === 0) return i;
		} else i += 1;
	}
	return -1;
}

function skipSpace(src: string, index: number): number {
	let i = index;
	while (i < src.length && /\s/.test(src[i] as string)) i += 1;
	return i;
}

function matchAt(pattern: RegExp, src: string, index: number): string | null {
	pattern.lastIndex = index;
	return pattern.exec(src)?.[0] ?? null;
}

/**
 * Reads the element whose `<` is at `from`. Returns null unless it is a well-formed component
 * element (capitalised name) with a matching closing tag.
 */
export function readJsxElement(src: string, from = 0): JsxElement | null {
	if (src[from] !== '<') return null;
	const name = matchAt(COMPONENT_NAME, src, from + 1);
	if (!name) return null;
	let i = from + 1 + name.length;
	const props: JsxProp[] = [];

	for (;;) {
		i = skipSpace(src, i);
		if (src.startsWith('/>', i)) {
			return { name, props, children: null, length: i + 2 - from };
		}
		if (src[i] === '>') {
			i += 1;
			break;
		}
		if (src[i] === '{') {
			const end = skipExpression(src, i);
			if (end < 0) return null;
			props.push({ name: '...', value: { kind: 'expression', source: src.slice(i + 1, end - 1).trim() } });
			i = end;
			continue;
		}
		const attribute = matchAt(ATTRIBUTE_NAME, src, i);
		if (!attribute) return null;
		i += attribute.length;
		const afterName = skipSpace(src, i);
		if (src[afterName] !== '=') {
			props.push({ name: attribute, value: { kind: 'literal', value: true } });
			continue;
		}
		const valueStart = skipSpace(src, afterName + 1);
		const quote = src[valueStart];
		if (quote === '"' || quote === "'") {
			const end = src.indexOf(quote, valueStart + 1);
			if (end < 0) return null;
			props.push({
				name: attribute,
				value: { kind: 'literal', value: decodeEntities(src.slice(valueStart + 1, end)) },
			});
			i = end + 1;
		} else if (quote === '{') {
			const end = skipExpression(src, valueStart);
			if (end < 0) return null;
			props.push({ name: attribute, value: literalFromExpression(src.slice(valueStart + 1, end - 1)) });
			i = end;
		} else return null;
	}

	// Children run to the matching closing tag; nested elements are skipped whole.
	const childrenStart = i;
	let position = i;
	for (;;) {
		const next = src.indexOf('<', position);
		if (next < 0) return null;
		CLOSING_TAG.lastIndex = next;
		const closing = CLOSING_TAG.exec(src);
		if (closing) {
			if (closing[1] === name) {
				return { name, props, children: src.slice(childrenStart, next), length: next + closing[0].length - from };
			}
			position = next + closing[0].length;
			continue;
		}
		const nested = readJsxElement(src, next);
		position = nested ? next + nested.length : next + 1;
	}
}

/** `{/* … *\/}` at `from`: MDX's comment syntax. Returns its length, or 0. */
export function readMdxComment(src: string, from = 0): number {
	const match = /\{\s*\/\*[\s\S]*?\*\/\s*\}/y;
	match.lastIndex = from;
	return match.exec(src)?.[0].length ?? 0;
}

/** Removes the indentation every non-blank line shares, so indented children aren't read as code. */
export function dedent(text: string): string {
	const lines = text.split('\n');
	let indent = Number.POSITIVE_INFINITY;
	for (const line of lines) {
		if (line.trim() === '') continue;
		indent = Math.min(indent, /^[ \t]*/.exec(line)?.[0].length ?? 0);
	}
	if (!Number.isFinite(indent) || indent === 0) return text;
	return lines.map((line) => line.slice(Math.min(indent, /^[ \t]*/.exec(line)?.[0].length ?? 0))).join('\n');
}
