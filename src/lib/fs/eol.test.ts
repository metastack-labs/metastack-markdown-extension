import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyLineEnding, detectLineEnding, normaliseLineEndings, sameText } from './eol.ts';

test('detects the dominant line ending', () => {
	assert.equal(detectLineEnding('a\r\nb\r\nc'), '\r\n');
	assert.equal(detectLineEnding('a\nb\nc'), '\n');
	assert.equal(detectLineEnding('a\r\nb\nc\nd'), '\n');
	assert.equal(detectLineEnding('no breaks'), '\n');
});

test('round-trips CRLF files through LF editing', () => {
	const raw = '# Title\r\n\r\n- [ ] task\r\n';
	const { text, eol } = normaliseLineEndings(raw);
	assert.equal(text, '# Title\n\n- [ ] task\n');
	assert.equal(applyLineEnding(text, eol), raw);
	assert.equal(applyLineEnding(`${text}added\n`, eol), `${raw}added\r\n`);
	assert.equal(applyLineEnding('a\nb', '\n'), 'a\nb');
});

test('compares text regardless of line endings', () => {
	assert.equal(sameText('a\r\nb', 'a\nb'), true);
	assert.equal(sameText('a\r\nb', 'a\nc'), false);
});
