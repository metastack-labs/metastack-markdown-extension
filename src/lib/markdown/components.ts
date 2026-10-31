/**
 * MDX components the viewer renders, as HTML. Ported from MetaStack's production guide blocks
 * (metastack-app `learning-lab/guide-blocks.tsx`) and the content pipeline's lab and editorial
 * components, with the same props and copy so documents look the way they do in MetaStack.
 *
 * Output is plain HTML that goes through the sanitizer like the rest of the document; interactive
 * parts (copy a prompt, tick a checklist) are wired up by MarkdownView through `data-action`.
 */
import { escapeHtml, isRelativeReference } from './html.ts';
import type { JsxProp } from './jsx.ts';

export type PropValue = string | boolean;

export interface PropSpec {
	readonly type: 'string' | 'boolean';
	readonly required?: boolean;
	readonly oneOf?: readonly string[];
	readonly default?: string;
}

/** none: self-closing. block: Markdown between the tags. inline: text inside a sentence. list: one Markdown list. */
export type ChildrenKind = 'none' | 'block' | 'inline' | 'list';

export interface RenderedChildren {
	readonly html: string;
	/** Each item of the first list in the children, rendered; null when there is no list. */
	readonly items: readonly string[] | null;
}

export interface RenderContext {
	/** A document-unique id for aria-labelledby and similar. */
	readonly id: (prefix: string) => string;
}

export interface ComponentDefinition {
	readonly name: string;
	readonly children: ChildrenKind;
	readonly props: Readonly<Record<string, PropSpec>>;
	readonly render: (
		props: Readonly<Record<string, PropValue | undefined>>,
		children: RenderedChildren,
		context: RenderContext
	) => string;
}

const attr = (value: PropValue | undefined): string => escapeHtml(String(value ?? ''));

// Lucide icons (ISC), as production's PromptBlock uses.
const COPY_ICON =
	'<svg class="mdx-icon mdx-icon-copy" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>';
const CHECK_ICON =
	'<svg class="mdx-icon mdx-icon-check" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';

/** Status line under a prompt; MarkdownView swaps it after copying. */
export const PROMPT_STATUS = {
	idle: 'Replace the bracketed parts with your own details.',
	copied: 'Prompt copied. Replace the bracketed parts before using it.',
	failed: 'Copy isn’t available here. The prompt is selected, so you can copy it yourself.',
} as const;

function imageSource(src: string): string {
	return isRelativeReference(src) ? `data-local-src="${escapeHtml(src)}"` : `src="${escapeHtml(src)}"`;
}

const DEFINITIONS: readonly ComponentDefinition[] = [
	{
		name: 'PromptBlock',
		children: 'none',
		props: { text: { type: 'string', required: true }, title: { type: 'string', default: 'A prompt to adapt' } },
		render: ({ text, title }, _children, context) => {
			const id = context.id('prompt');
			return [
				'<div class="mdx-prompt">',
				'<div class="mdx-prompt-heading">',
				`<p id="${id}">${attr(title)}</p>`,
				`<button type="button" class="mdx-prompt-copy" data-action="copy-prompt" aria-label="Copy prompt: ${attr(title)}">${COPY_ICON}${CHECK_ICON}Copy prompt</button>`,
				'</div>',
				`<pre aria-labelledby="${id}"><code>${attr(text)}</code></pre>`,
				`<p class="mdx-prompt-status" role="status">${PROMPT_STATUS.idle}</p>`,
				'</div>\n',
			].join('');
		},
	},
	{
		name: 'Callout',
		children: 'block',
		props: { variant: { type: 'string', required: true, oneOf: ['rule', 'note'] } },
		render: ({ variant }, children) =>
			`<aside class="mdx-callout" data-variant="${attr(variant)}"><p class="mdx-callout-label">${variant === 'rule' ? '✋ Rule' : 'Note'}</p><div class="mdx-callout-body">${children.html}</div></aside>\n`,
	},
	{
		name: 'GuideImage',
		children: 'none',
		props: {
			src: { type: 'string', required: true },
			alt: { type: 'string', required: true },
			caption: { type: 'string', required: true },
		},
		render: ({ src, alt, caption }) =>
			`<figure class="mdx-guide-image"><img ${imageSource(String(src))} alt="${attr(alt)}" width="1200" height="675" loading="lazy"><figcaption>${attr(caption)}</figcaption></figure>\n`,
	},
	{
		name: 'ShotPlaceholder',
		children: 'none',
		props: {
			shot: { type: 'string', required: true },
			brief: { type: 'string', required: true },
			alt: { type: 'string', required: true },
			caption: { type: 'string', required: true },
		},
		render: ({ shot, brief, alt, caption }) =>
			[
				`<figure class="mdx-shot-placeholder" data-shot="${attr(shot)}">`,
				'<div class="mdx-shot-placeholder-frame">',
				`<span class="mdx-shot-placeholder-label">Screenshot ${attr(shot)} · not captured yet</span>`,
				`<span class="mdx-shot-placeholder-brief">${attr(brief)}</span>`,
				`<span class="mdx-shot-placeholder-alt">Alt text: ${attr(alt)}</span>`,
				'</div>',
				`<figcaption>${attr(caption)}</figcaption>`,
				'</figure>\n',
			].join(''),
	},
	{
		name: 'Steps',
		children: 'list',
		props: {},
		render: (_props, children) => {
			if (!children.items) return `<div class="mdx-steps">${children.html}</div>\n`;
			const items = children.items.map(
				(item, index) =>
					`<li><span class="mdx-steps-number" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span><div class="mdx-steps-body">${item}</div></li>`
			);
			return `<ol class="mdx-steps">${items.join('')}</ol>\n`;
		},
	},
	{
		name: 'Checklist',
		children: 'list',
		props: { title: { type: 'string', default: 'Before moving on' } },
		render: ({ title }, children, context) => {
			if (!children.items) return `<div class="mdx-checklist">${children.html}</div>\n`;
			const id = context.id('checklist');
			const items = children.items.map(
				(item) => `<li><label><input type="checkbox" data-action="checklist-item"><span>${item}</span></label></li>`
			);
			return [
				`<div class="mdx-checklist" role="group" aria-labelledby="${id}">`,
				`<p class="mdx-checklist-title" id="${id}">${attr(title)}</p>`,
				`<ul class="mdx-checklist-items">${items.join('')}</ul>`,
				`<p class="mdx-checklist-progress" role="status">0 of ${children.items.length} checked</p>`,
				'</div>\n',
			].join('');
		},
	},
	{
		name: 'Kbd',
		children: 'inline',
		props: {},
		render: (_props, children) => `<kbd class="mdx-kbd">${children.html}</kbd>`,
	},
	{
		name: 'PullQuote',
		children: 'block',
		props: { cite: { type: 'string' } },
		render: ({ cite }, children) =>
			`<figure class="mdx-pull-quote"><blockquote>${children.html}</blockquote>${cite ? `<figcaption>${attr(cite)}</figcaption>` : ''}</figure>\n`,
	},
];

export const BUILT_IN_COMPONENTS: ReadonlyMap<string, ComponentDefinition> = new Map(
	DEFINITIONS.map((definition) => [definition.name, definition])
);

export function componentDefinition(name: string): ComponentDefinition | undefined {
	return BUILT_IN_COMPONENTS.get(name);
}

interface ResolvedProps {
	readonly props: Record<string, PropValue | undefined>;
	/** Reasons the component can't render as written. */
	readonly problems: string[];
}

/** Checks the written props against the definition, filling defaults. */
export function resolveProps(definition: ComponentDefinition, written: readonly JsxProp[]): ResolvedProps {
	const props: Record<string, PropValue | undefined> = {};
	const problems: string[] = [];
	const given = new Map(written.map((prop) => [prop.name, prop.value]));
	for (const [name, spec] of Object.entries(definition.props)) {
		const value = given.get(name);
		if (!value) {
			if (spec.required) problems.push(`it needs a \`${name}\` prop`);
			else props[name] = spec.default;
			continue;
		}
		if (value.kind === 'expression') {
			problems.push(`\`${name}\` must be plain text, not code`);
			continue;
		}
		const literal = spec.type === 'boolean' ? value.value === true || value.value === 'true' : String(value.value);
		if (spec.oneOf && !spec.oneOf.includes(String(literal))) {
			problems.push(`\`${name}\` must be ${spec.oneOf.map((option) => `"${option}"`).join(' or ')}`);
			continue;
		}
		props[name] = literal;
	}
	return { props, problems };
}

function describeValue(prop: JsxProp): string {
	if (prop.value.kind === 'expression') return `{${prop.value.source}}`;
	return String(prop.value.value);
}

/** Shown in place of a component that isn't built in, or can't render as written. */
export function renderFallback(
	name: string,
	written: readonly JsxProp[],
	children: RenderedChildren,
	problems: readonly string[],
	inline: boolean
): string {
	const tag = `&lt;${escapeHtml(name)}&gt;`;
	if (inline) {
		const reason = problems.length > 0 ? `${name} ${problems.join(', ')}` : `${name} isn’t a built-in component`;
		return `<span class="mdx-unknown-inline" title="${escapeHtml(reason.replaceAll('`', ''))}">${children.html || tag}</span>`;
	}
	const message =
		problems.length > 0
			? `couldn’t be shown: ${problems.map((problem) => escapeHtml(problem).replace(/`([^`]+)`/g, '<code>$1</code>')).join('; ')}.`
			: 'isn’t a built-in component, so it’s shown as written.';
	const props = written
		.map(
			(prop) =>
				`<div><dt>${escapeHtml(prop.name)}</dt><dd>${escapeHtml(describeValue(prop)).replace(/\n/g, '<br>')}</dd></div>`
		)
		.join('');
	return [
		`<div class="mdx-unknown" data-component="${escapeHtml(name)}">`,
		`<p class="mdx-unknown-head"><code>${tag}</code> ${message}</p>`,
		props ? `<dl class="mdx-unknown-props">${props}</dl>` : '',
		children.html ? `<div class="mdx-unknown-children">${children.html}</div>` : '',
		'</div>\n',
	].join('');
}

/** Renders a component element, or the fallback when it can't be. */
export function renderComponent(
	name: string,
	written: readonly JsxProp[],
	children: RenderedChildren,
	context: RenderContext,
	inline: boolean
): string {
	const definition = componentDefinition(name);
	if (!definition) return renderFallback(name, written, children, [], inline);
	const { props, problems } = resolveProps(definition, written);
	if (problems.length > 0) return renderFallback(name, written, children, problems, inline);
	return definition.render(props, children, context);
}
