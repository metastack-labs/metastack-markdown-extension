import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { countWords, renderMarkdown } from './render.ts';
import { Slugger, slugify } from './slug.ts';

describe('slugify', () => {
	test('matches GitHub anchors', () => {
		assert.equal(slugify('MetaStack Engine planning'), 'metastack-engine-planning');
		assert.equal(slugify('What’s new in v2.0?'), 'whats-new-in-v20');
		assert.equal(slugify('Foo -- Bar'), 'foo----bar');
		assert.equal(slugify('Café & Crème'), 'café--crème');
	});

	test('dedupes within a document', () => {
		const slugger = new Slugger();
		assert.deepEqual(
			['Intro', 'Intro', 'Intro-1', 'Intro'].map((text) => slugger.slug(text)),
			['intro', 'intro-1', 'intro-1-1', 'intro-2']
		);
		assert.equal(new Slugger().slug('!!!'), 'section');
	});
});

describe('renderMarkdown', () => {
	test('headings get ids, anchors and a TOC with plain text', () => {
		const result = renderMarkdown('# Title\n\n## The **bold** part\n\n## The **bold** part\n');
		assert.deepEqual(result.toc, [
			{ id: 'title', text: 'Title', level: 1 },
			{ id: 'the-bold-part', text: 'The bold part', level: 2 },
			{ id: 'the-bold-part-1', text: 'The bold part', level: 2 },
		]);
		assert.match(
			result.html,
			/<h2 id="the-bold-part">The <strong>bold<\/strong> part<a class="heading-anchor" href="#the-bold-part"/
		);
		assert.equal(result.title, 'Title');
	});

	test('front matter is split off and its title wins', () => {
		const result = renderMarkdown('---\ntitle: "Planning workflow"\ntags: [a]\n---\n# Heading\n');
		assert.equal(result.title, 'Planning workflow');
		assert.equal(result.frontMatter?.raw, 'title: "Planning workflow"\ntags: [a]');
		assert.doesNotMatch(result.html, /tags:/);
	});

	test('code fences are highlighted with a copy button; unknown languages are escaped', () => {
		const ts = renderMarkdown('```ts\nconst a: number = 1;\n```\n');
		assert.match(ts.html, /class="code-block"/);
		assert.match(ts.html, /<span class="code-lang">ts<\/span>/);
		assert.match(ts.html, /class="hljs language-ts"/);
		assert.match(ts.html, /hljs-keyword/);
		const unknown = renderMarkdown('```nope\n<script>alert(1)</script>\n```\n');
		assert.match(unknown.html, /&lt;script&gt;/);
		assert.doesNotMatch(unknown.html, /<script>/);
	});

	test('mermaid fences become placeholders', () => {
		const result = renderMarkdown('```mermaid\ngraph TD; A-->B\n```\n');
		assert.equal(result.hasMermaid, true);
		assert.match(result.html, /<div class="mermaid-block" data-mermaid="">graph TD; A--&gt;B<\/div>/);
	});

	test('math: inline, display and block, but not currency or code', () => {
		const result = renderMarkdown(
			'Energy $E = mc^2$ costs $5 and $10.\n\n$$\n\\int_0^1 x\\,dx\n$$\n\nInline display $$a+b$$ here. `$x$` stays code.\n'
		);
		assert.equal(result.hasMath, true);
		assert.match(result.html, /<span class="math math-inline" data-tex="E = mc\^2">/);
		assert.match(result.html, /costs \$5 and \$10\./);
		assert.match(result.html, /<div class="math math-display" data-tex="\\int_0\^1 x\\,dx">/);
		assert.match(result.html, /<span class="math math-display" data-tex="a\+b">/);
		assert.match(result.html, /<code>\$x\$<\/code>/);
		assert.equal(renderMarkdown('Just $5.\n').hasMath, false);
	});

	test('GitHub alerts', () => {
		const result = renderMarkdown('> [!WARNING]\n> Careful **now**.\n\n> plain quote\n');
		assert.match(result.html, /<div class="markdown-alert markdown-alert-warning">/);
		assert.match(result.html, /<p class="markdown-alert-title"><svg[^>]*>.*<\/svg>Warning<\/p>/);
		assert.match(result.html, /Careful <strong>now<\/strong>\./);
		assert.doesNotMatch(result.html, /\[!WARNING\]/);
		assert.match(result.html, /<blockquote>\n<p>plain quote<\/p>/);
	});

	test('links: external open in a new tab, relative stay in-app', () => {
		const result = renderMarkdown('[site](https://example.com) [doc](./other.md#intro) [top](#title)\n');
		assert.match(result.html, /<a href="https:\/\/example.com" target="_blank" rel="noopener noreferrer">site<\/a>/);
		assert.match(result.html, /<a href="\.\/other\.md#intro">doc<\/a>/);
		assert.match(result.html, /<a href="#title">top<\/a>/);
	});

	test('relative images are deferred to the viewer', () => {
		const result = renderMarkdown('![diagram](<../img/a b.png>) ![remote](https://x.test/a.png)\n');
		assert.match(result.html, /<img data-local-src="\.\.\/img\/a b\.png" alt="diagram" loading="lazy">/);
		assert.match(result.html, /<img src="https:\/\/x\.test\/a\.png" alt="remote" loading="lazy">/);
	});

	test('task lists and footnotes', () => {
		const result = renderMarkdown('- [ ] todo\n- [x] done\n\nClaim.[^1]\n\n[^1]: Source.\n');
		assert.equal((result.html.match(/type="checkbox"/g) ?? []).length, 2);
		assert.match(result.html, /data-footnotes/);
	});
});

describe('countWords', () => {
	test('skips front matter and fenced code', () => {
		const stats = countWords('---\ntitle: x\n---\nOne two three.\n\n```js\nconst ignored = true;\n```\nfour\n');
		assert.equal(stats.words, 4);
		assert.equal(stats.minutes, 1);
	});
});
