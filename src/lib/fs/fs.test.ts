import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { documentKind, languageForName, normaliseNewFileName } from './file-types.ts';
import { createIgnoreMatcher, isAlwaysIgnored } from './gitignore.ts';
import {
	assetPathCandidates,
	assetUrlCandidates,
	candidatePathsWithinRoot,
	containingDirectoryUrl,
	fileUrlCrumbs,
	fileUrlToPath,
	parentDirectoryUrl,
	resolveReference,
} from './paths.ts';

describe('resolveReference', () => {
	test('relative, parent, root-relative and encoded references', () => {
		assert.deepEqual(resolveReference('docs/guides', './setup.md#install'), {
			path: 'docs/guides/setup.md',
			hash: 'install',
		});
		assert.deepEqual(resolveReference('docs/guides', '../img/a%20b.png?raw=1'), {
			path: 'docs/img/a b.png',
			hash: null,
		});
		assert.deepEqual(resolveReference('docs', '/README.md'), { path: 'README.md', hash: null });
		assert.equal(resolveReference('', '../outside.md'), null);
	});
});

describe('file URLs', () => {
	test('paths, parents and crumbs', () => {
		const url = 'file:///Users/me/My%20Notes/plan.md';
		assert.equal(fileUrlToPath(url), '/Users/me/My Notes/plan.md');
		assert.equal(containingDirectoryUrl(url), 'file:///Users/me/My%20Notes/');
		assert.equal(parentDirectoryUrl(url), 'file:///Users/me/My%20Notes/');
		assert.equal(parentDirectoryUrl('file:///Users/me/'), 'file:///Users/');
		assert.equal(parentDirectoryUrl('file:///'), null);
		assert.deepEqual(
			fileUrlCrumbs(url).map((crumb) => crumb.name),
			['Users', 'me', 'My Notes']
		);
		assert.equal(fileUrlCrumbs('file:///Users/me/').at(-1)?.url, 'file:///Users/me/');
	});

	test('candidate paths inside a granted folder', () => {
		assert.deepEqual(candidatePathsWithinRoot('/Users/me/notes/a/notes/b.md', 'notes'), ['a/notes/b.md', 'b.md']);
		assert.deepEqual(candidatePathsWithinRoot('/Users/me/b.md', 'notes'), []);
		assert.deepEqual(candidatePathsWithinRoot('/x/notes.md', 'notes.md'), []);
	});
});

describe('gitignore', () => {
	const matcher = createIgnoreMatcher(
		['# comment', 'dist/', '*.log', '!keep.log', '/secret.md', 'docs/**/draft-*.md', 'build'].join('\n')
	);

	test('basic patterns', () => {
		assert.equal(matcher('dist', true), true);
		assert.equal(matcher('dist', false), false);
		assert.equal(matcher('a/b/debug.log', false), true);
		assert.equal(matcher('keep.log', false), false);
		assert.equal(matcher('secret.md', false), true);
		assert.equal(matcher('sub/secret.md', false), false);
		assert.equal(matcher('docs/x/y/draft-1.md', false), true);
		assert.equal(matcher('docs/draft-1.md', false), true);
		assert.equal(matcher('src/build', true), true);
		assert.equal(matcher('README.md', false), false);
	});

	test('always-ignored names', () => {
		assert.equal(isAlwaysIgnored('node_modules', true), true);
		assert.equal(isAlwaysIgnored('.DS_Store', false), true);
		assert.equal(isAlwaysIgnored('.planning', true), false);
	});
});

describe('file types', () => {
	test('kinds and languages', () => {
		assert.equal(documentKind('README.md'), 'markdown');
		assert.equal(documentKind('notes.MARKDOWN'), 'markdown');
		assert.equal(documentKind('data.json'), 'text');
		assert.equal(documentKind('Makefile'), 'text');
		assert.equal(documentKind('.env.local'), 'text');
		assert.equal(documentKind('photo.png'), null);
		assert.equal(languageForName('main.tsx'), 'typescript');
	});

	test('new file names', () => {
		assert.deepEqual(normaliseNewFileName(' plan '), { name: 'plan.md' });
		assert.deepEqual(normaliseNewFileName('v1.2 plan'), { name: 'v1.2 plan.md' });
		assert.deepEqual(normaliseNewFileName('notes.txt'), { name: 'notes.txt' });
		assert.ok('error' in normaliseNewFileName('a/b'));
		assert.ok('error' in normaliseNewFileName('   '));
	});
});

describe('asset candidates', () => {
	test('relative references have one candidate', () => {
		assert.deepEqual(assetPathCandidates('guides', './a.png'), ['guides/a.png']);
		assert.deepEqual(assetPathCandidates('guides', '../../a.png'), []);
		assert.deepEqual(assetUrlCandidates('file:///site/guides/x.mdx', 'a.png'), ['file:///site/guides/a.png']);
	});

	test('root-relative references try each enclosing folder, nearest first', () => {
		assert.deepEqual(assetPathCandidates('content/guides', '/media/v1.png'), [
			'content/guides/media/v1.png',
			'content/media/v1.png',
			'media/v1.png',
		]);
		assert.deepEqual(assetUrlCandidates('file:///repo/content/guides/x.mdx', '/media/v1.png'), [
			'file:///repo/content/guides/media/v1.png',
			'file:///repo/content/media/v1.png',
			'file:///repo/media/v1.png',
			'file:///media/v1.png',
		]);
	});
});
