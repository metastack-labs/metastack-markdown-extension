import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
	HANDOFF_KEY_PREFIX,
	handoffKey,
	parseOpenFileUrlMessage,
	parseStoredHandoff,
	staleHandoffKeys,
} from './handoff.ts';
import { DEFAULT_SETTINGS, normaliseSettings } from './settings.ts';

describe('settings', () => {
	test('fills defaults and clamps out-of-range values', () => {
		assert.deepEqual(normaliseSettings(undefined), DEFAULT_SETTINGS);
		const settings = normaliseSettings({ theme: 'neon', fontSize: 99, lineHeight: 1.234, sidebarWidth: 5 });
		assert.equal(settings.theme, 'system');
		assert.equal(settings.fontSize, 22);
		assert.equal(settings.lineHeight, 1.3);
		assert.equal(settings.sidebarWidth, 180);
	});
});

describe('handoff', () => {
	test('accepts a well-formed markdown message and strips the fragment', () => {
		const parsed = parseOpenFileUrlMessage({
			type: 'open-file-url',
			handoff: {
				url: 'file:///Users/me/a.md#intro',
				kind: 'markdown',
				text: '# A',
				entries: [
					{ name: 'a.md', url: 'file:///Users/me/a.md', isDirectory: false },
					{ name: 'evil', url: 'https://evil.test/', isDirectory: true },
					null,
				],
			},
		});
		assert.ok(parsed);
		assert.equal(parsed.handoff.url, 'file:///Users/me/a.md');
		assert.equal(parsed.handoff.entries?.length, 1);
	});

	test('rejects non-file URLs and markdown without text', () => {
		assert.equal(
			parseOpenFileUrlMessage({
				type: 'open-file-url',
				handoff: { url: 'https://x.test/a.md', kind: 'markdown', text: '' },
			}),
			null
		);
		assert.equal(
			parseOpenFileUrlMessage({ type: 'open-file-url', handoff: { url: 'file:///a.md', kind: 'markdown' } }),
			null
		);
		assert.equal(parseStoredHandoff({ url: 'file:///d/', kind: 'directory' }), null);
	});

	test('keys share one entry per file regardless of fragment', () => {
		assert.equal(handoffKey('file:///a.md#x'), `${HANDOFF_KEY_PREFIX}file:///a.md`);
	});

	test('prunes old and excess handoffs', () => {
		const now = 1_000_000_000;
		const stored = {
			[`${HANDOFF_KEY_PREFIX}old`]: { createdAt: now - 10_000 },
			[`${HANDOFF_KEY_PREFIX}a`]: { createdAt: now - 1 },
			[`${HANDOFF_KEY_PREFIX}b`]: { createdAt: now - 2 },
			[`${HANDOFF_KEY_PREFIX}c`]: { createdAt: now - 3 },
			[`${HANDOFF_KEY_PREFIX}broken`]: 'nope',
			settings: { createdAt: 0 },
		};
		assert.deepEqual(staleHandoffKeys(stored, now, 5_000, 2).sort(), [
			`${HANDOFF_KEY_PREFIX}broken`,
			`${HANDOFF_KEY_PREFIX}c`,
			`${HANDOFF_KEY_PREFIX}old`,
		]);
	});
});
