import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderMarkdown } from './render.ts';
import { findTaskMarkers, toggleTask } from './tasks.ts';

const SOURCE = `---
title: Tasks
---
- [ ] first
* [x] second
  1. [ ] nested ordered
> - [X] quoted

\`\`\`md
- [ ] inside code, not a task
\`\`\`

- [] not a task
- [ ]no space, not a task
`;

test('finds task markers in document order, skipping code and front matter', () => {
	const markers = findTaskMarkers(SOURCE);
	assert.deepEqual(
		markers.map((m) => m.checked),
		[false, true, false, true]
	);
	for (const marker of markers) assert.match(SOURCE[marker.offset] ?? '', /[ xX]/);
});

test('marker count matches the checkboxes the renderer emits', () => {
	const rendered = renderMarkdown(SOURCE).html;
	assert.equal((rendered.match(/type="checkbox"/g) ?? []).length, findTaskMarkers(SOURCE).length);
});

test('toggles a task in place', () => {
	const toggled = toggleTask(SOURCE, 0, true);
	assert.ok(toggled);
	assert.match(toggled, /^- \[x\] first$/m);
	assert.equal(toggled.length, SOURCE.length);
	assert.equal(toggleTask(SOURCE, 99, true), null);
	assert.match(toggleTask(SOURCE, 3, false) ?? '', /^> - \[ \] quoted$/m);
});
