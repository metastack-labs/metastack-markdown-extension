import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { dedent, literalFromExpression, readJsxElement, readMdxComment } from './jsx.ts';
import { renderMarkdown } from './render.ts';

const props = (source: string) =>
	Object.fromEntries((readJsxElement(source)?.props ?? []).map((prop) => [prop.name, prop.value]));

describe('readJsxElement', () => {
	test('reads literal props without evaluating anything', () => {
		const source =
			'<PromptBlock title="check &amp; go" text={`line one\nline \\`two\\``} open count={3} label={\'a\\nb\'} />';
		const element = readJsxElement(source);
		assert.equal(element?.name, 'PromptBlock');
		assert.equal(element?.children, null);
		assert.equal(element?.length, source.length);
		assert.deepEqual(props(source), {
			title: { kind: 'literal', value: 'check & go' },
			text: { kind: 'literal', value: 'line one\nline `two`' },
			open: { kind: 'literal', value: true },
			count: { kind: 'literal', value: 3 },
			label: { kind: 'literal', value: 'a\nb' },
		});
	});

	test('keeps code as unevaluated source', () => {
		// biome-ignore lint/suspicious/noTemplateCurlyInString: MDX source text that contains a template expression
		assert.deepEqual(literalFromExpression('`hi ${name}`'), { kind: 'expression', source: '`hi ${name}`' });
		assert.deepEqual(literalFromExpression('alert(1)'), { kind: 'expression', source: 'alert(1)' });
		// biome-ignore lint/suspicious/noTemplateCurlyInString: an escaped `${` stays literal text
		assert.deepEqual(literalFromExpression('`costs \\${5}`'), { kind: 'literal', value: 'costs ${5}' });
		assert.deepEqual(props('<A {...rest} b={{ c: "}" }} />'), {
			'...': { kind: 'expression', source: '...rest' },
			b: { kind: 'expression', source: '{ c: "}" }' },
		});
	});

	test('reads children up to the matching closing tag, skipping nested elements', () => {
		const source = '<Callout variant="note">\nOuter <Callout variant="rule">inner</Callout> text\n</Callout> after';
		const element = readJsxElement(source);
		assert.equal(element?.children, '\nOuter <Callout variant="rule">inner</Callout> text\n');
		assert.equal(source.slice(element?.length), ' after');
	});

	test('rejects lowercase tags, unclosed elements and broken props', () => {
		assert.equal(readJsxElement('<div>x</div>'), null);
		assert.equal(readJsxElement('<Callout variant="note">no end'), null);
		assert.equal(readJsxElement('<PromptBlock text={`never closed />'), null);
		assert.equal(readJsxElement('<A b=c />'), null);
	});

	test('reads MDX comments and dedents children', () => {
		assert.equal(readMdxComment('{/* Shot R1: a } inside */} rest'), '{/* Shot R1: a } inside */}'.length);
		assert.equal(readMdxComment('{ notAComment }'), 0);
		assert.equal(dedent('\n  a\n    b\n\n  c\n'), '\na\n  b\n\nc\n');
	});
});

describe('MDX components', () => {
	test('renders a PromptBlock like production, with the prompt escaped and untouched by Markdown', () => {
		const { html } = renderMarkdown(
			'Open it:\n\n<PromptBlock\n  title="check the brief landed"\n  text={`in three lines: what\'s your job? <b>*not*</b>`}\n/>\n\nAfter.'
		);
		assert.match(html, /<div class="mdx-prompt">/);
		assert.match(html, /<p id="mdx-prompt-1">check the brief landed<\/p>/);
		assert.match(html, /data-action="copy-prompt" aria-label="Copy prompt: check the brief landed"/);
		assert.match(html, /<code>in three lines: what&#39;s your job\? &lt;b&gt;\*not\*&lt;\/b&gt;<\/code>/);
		assert.match(html, /<p>Open it:<\/p>/);
		assert.match(html, /<p>After\.<\/p>/);
	});

	test('fills defaults and interrupts a paragraph like MDX', () => {
		const { html } = renderMarkdown('Send this:\n<PromptBlock text="hello" />\nThen check.');
		assert.match(html, /<p>Send this:<\/p>/);
		assert.match(html, /<p id="mdx-prompt-1">A prompt to adapt<\/p>/);
		assert.match(html, /<p>Then check\.<\/p>/);
	});

	test('renders Markdown children, including headings for the outline', () => {
		const { html, toc } = renderMarkdown(
			'<Callout variant="rule">\n  ### Keep it short\n\n  Use **one** job.\n</Callout>'
		);
		assert.match(html, /<aside class="mdx-callout" data-variant="rule"><p class="mdx-callout-label">✋ Rule<\/p>/);
		assert.match(html, /<strong>one<\/strong>/);
		assert.deepEqual(
			toc.map((entry) => entry.text),
			['Keep it short']
		);
	});

	test('renders list components item by item', () => {
		const { html } = renderMarkdown(
			'<Steps>\n- Open the app\n- Click **New**\n</Steps>\n\n<Checklist>\n- one\n- two\n</Checklist>'
		);
		assert.match(
			html,
			/<ol class="mdx-steps"><li><span class="mdx-steps-number" aria-hidden="true">01<\/span><div class="mdx-steps-body">Open the app<\/div><\/li>/
		);
		assert.match(html, /Click <strong>New<\/strong>/);
		assert.match(html, /<p class="mdx-checklist-title" id="mdx-checklist-1">Before moving on<\/p>/);
		assert.match(html, /0 of 2 checked/);
	});

	test('renders inline components inside a sentence', () => {
		const { html } = renderMarkdown('Press <Kbd>⌘ Space</Kbd> to start.');
		assert.equal(html, '<p>Press <kbd class="mdx-kbd">⌘ Space</kbd> to start.</p>\n');
	});

	test('shows unknown components and invalid props instead of dropping them', () => {
		const unknown = renderMarkdown('<Tabs active="2">\nBody text\n</Tabs>').html;
		assert.match(unknown, /<code>&lt;Tabs&gt;<\/code> isn’t a built-in component/);
		assert.match(unknown, /<dt>active<\/dt><dd>2<\/dd>/);
		assert.match(unknown, /<p>Body text<\/p>/);

		const missing = renderMarkdown('<PromptBlock title="x" />').html;
		assert.match(missing, /couldn’t be shown: it needs a <code>text<\/code> prop/);
		const code = renderMarkdown('<PromptBlock text={prompt} />').html;
		assert.match(code, /<code>text<\/code> must be plain text, not code/);
		const variant = renderMarkdown('<Callout variant="tip">x</Callout>').html;
		assert.match(variant, /<code>variant<\/code> must be &quot;rule&quot; or &quot;note&quot;/);
	});

	test('leaves code, ALL-CAPS HTML and stray angle brackets alone in plain Markdown', () => {
		assert.match(renderMarkdown('```mdx\n<PromptBlock text="x" />\n```').html, /&lt;PromptBlock/);
		assert.match(renderMarkdown('Use `<Callout>` here.').html, /<code>&lt;Callout&gt;<\/code>/);
		assert.equal(renderMarkdown('Some <B>bold</B> text.').html, '<p>Some <B>bold</B> text.</p>\n');
		assert.equal(renderMarkdown('A List<String> type.').html, '<p>A List<String> type.</p>\n');
	});

	test('hides MDX comments and ESM only in .mdx documents', () => {
		const source =
			"import { X } from './x.js'\nexport const meta = { a: 1 }\n\n# Title\n\n{/* Shot R1: capture this */}\n\nText {/* note */} here.";
		const mdx = renderMarkdown(source, { mdx: true }).html;
		assert.doesNotMatch(mdx, /import|export|Shot R1|note/);
		assert.match(mdx, /<p>Text {2}here\.<\/p>/);
		const markdown = renderMarkdown(source).html;
		assert.match(markdown, /import \{ X \}/);
		assert.match(markdown, /Shot R1/);
	});

	test('reads every capitalised tag as a component in MDX', () => {
		assert.match(renderMarkdown('<B>bold</B>', { mdx: true }).html, /mdx-unknown/);
	});

	test('maps GuideImage and ShotPlaceholder to the same footprint', () => {
		const image = renderMarkdown('<GuideImage src="/media/guides/a/v1.png" alt="A brief" caption="The brief." />').html;
		assert.match(image, /<img data-local-src="\/media\/guides\/a\/v1.png" alt="A brief" width="1200" height="675"/);
		const shot = renderMarkdown('<ShotPlaceholder shot="V1" brief="The app" alt="Alt" caption="Cap" />').html;
		assert.match(shot, /Screenshot V1 · not captured yet/);
		assert.match(shot, /<figcaption>Cap<\/figcaption>/);
	});
});
