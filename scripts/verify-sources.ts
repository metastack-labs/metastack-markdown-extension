/**
 * Rebuilds the Firefox add-on from its sources zip, the way an addons.mozilla.org reviewer will,
 * and checks the result is byte-for-byte the add-on zip we upload.
 *
 *   bun run zip && bun run verify:sources [--keep]
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const { name, version } = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
	name: string;
	version: string;
};
const sourcesZip = join(ROOT, '.output', `${name}-${version}-sources.zip`);
const addonZip = join(ROOT, '.output', `${name}-${version}-firefox.zip`);

for (const zip of [sourcesZip, addonZip]) {
	if (!existsSync(zip)) {
		console.error(`Missing ${relative(ROOT, zip)}; run \`bun run zip\` first.`);
		process.exit(1);
	}
}

function hashes(dir: string): Map<string, string> {
	const result = new Map<string, string>();
	const walk = (current: string) => {
		for (const entry of readdirSync(current)) {
			const path = join(current, entry);
			if (statSync(path).isDirectory()) walk(path);
			else result.set(relative(dir, path), createHash('sha256').update(readFileSync(path)).digest('hex'));
		}
	};
	walk(dir);
	return result;
}

const work = mkdtempSync(join(tmpdir(), 'metastack-markdown-sources-'));
const sources = join(work, 'sources');
const expected = join(work, 'expected');
const run = (command: string, args: string[], cwd = work) => execFileSync(command, args, { cwd, stdio: 'inherit' });

try {
	run('unzip', ['-q', sourcesZip, '-d', sources]);
	run('unzip', ['-q', addonZip, '-d', expected]);
	// The same two commands SOURCE_CODE_REVIEW.md gives reviewers.
	run('bun', ['install', '--frozen-lockfile'], sources);
	run('bun', ['run', 'build:firefox'], sources);

	const want = hashes(expected);
	const got = hashes(join(sources, '.output', 'firefox-mv2'));
	const differences = [
		...[...want.keys()].filter((file) => !got.has(file)).map((file) => `missing from rebuild: ${file}`),
		...[...got.keys()].filter((file) => !want.has(file)).map((file) => `only in rebuild: ${file}`),
		...[...want].filter(([file, hash]) => got.has(file) && got.get(file) !== hash).map(([file]) => `differs: ${file}`),
	];
	if (differences.length > 0) {
		console.error(
			`The sources zip does not reproduce the add-on:\n${differences.map((line) => `  ✗ ${line}`).join('\n')}`
		);
		process.exitCode = 1;
	} else {
		console.log(`✓ Rebuilt ${want.size} files from ${relative(ROOT, sourcesZip)}; identical to the add-on zip`);
	}
} finally {
	if (process.argv.includes('--keep')) console.log(`Kept ${work}`);
	else rmSync(work, { recursive: true, force: true });
}
