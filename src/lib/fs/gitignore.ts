/** Directories that are never worth browsing for documents. */
export const ALWAYS_IGNORED_DIRECTORIES = new Set([
	'.git',
	'.hg',
	'.svn',
	'node_modules',
	'bower_components',
	'.next',
	'.nuxt',
	'.svelte-kit',
	'.turbo',
	'.cache',
	'.parcel-cache',
	'.output',
	'.wxt',
	'.venv',
	'venv',
	'__pycache__',
	'.tox',
	'.gradle',
	'.idea',
	'Pods',
	'target',
	'coverage',
	'.nyc_output',
]);

export const ALWAYS_IGNORED_FILES = new Set(['.DS_Store', 'Thumbs.db', 'desktop.ini']);

interface Rule {
	readonly regex: RegExp;
	readonly negated: boolean;
	readonly directoryOnly: boolean;
}

function globToRegexSource(glob: string): string {
	let out = '';
	for (let i = 0; i < glob.length; i++) {
		const char = glob[i] ?? '';
		if (char === '*') {
			if (glob[i + 1] === '*') {
				const atSegmentStart = i === 0 || glob[i - 1] === '/';
				const followedBySlash = glob[i + 2] === '/';
				if (atSegmentStart && followedBySlash) {
					out += '(?:.*/)?';
					i += 2;
				} else {
					out += '.*';
					i += 1;
				}
			} else {
				out += '[^/]*';
			}
		} else if (char === '?') {
			out += '[^/]';
		} else if (char === '[') {
			const close = glob.indexOf(']', i + 1);
			if (close > i + 1) {
				const body = glob
					.slice(i + 1, close)
					.replace(/^!/, '^')
					.replace(/\\/g, '\\\\');
				out += `[${body}]`;
				i = close;
			} else {
				out += '\\[';
			}
		} else if (char === '\\' && i + 1 < glob.length) {
			out += `\\${glob[i + 1]}`;
			i += 1;
		} else {
			out += char.replace(/[.+^${}()|\]\\]/g, '\\$&');
		}
	}
	return out;
}

function parseRule(line: string): Rule | null {
	let pattern = line.replace(/(?<!\\)\s+$/, '');
	if (!pattern || pattern.startsWith('#')) return null;
	const negated = pattern.startsWith('!');
	if (negated) pattern = pattern.slice(1);
	const directoryOnly = pattern.endsWith('/');
	if (directoryOnly) pattern = pattern.replace(/\/+$/, '');
	if (!pattern) return null;
	// A slash anywhere but the end anchors the pattern to the .gitignore's directory.
	const anchored = pattern.includes('/');
	pattern = pattern.replace(/^\//, '');
	const body = globToRegexSource(pattern);
	const regex = new RegExp(`^${anchored ? '' : '(?:.*/)?'}${body}$`);
	return { regex, negated, directoryOnly };
}

export type IgnoreMatcher = (relativePath: string, isDirectory: boolean) => boolean;

/**
 * Matcher for one root `.gitignore`. Paths are relative to that root. Parents are filtered
 * as the tree is expanded, so only the path itself is tested here.
 */
export function createIgnoreMatcher(gitignore: string): IgnoreMatcher {
	const rules = gitignore
		.split(/\r?\n/)
		.map(parseRule)
		.filter((rule): rule is Rule => rule !== null);
	return (relativePath, isDirectory) => {
		let ignored = false;
		for (const rule of rules) {
			if (rule.directoryOnly && !isDirectory) continue;
			if (rule.regex.test(relativePath)) ignored = !rule.negated;
		}
		return ignored;
	};
}

export function isAlwaysIgnored(name: string, isDirectory: boolean): boolean {
	return isDirectory ? ALWAYS_IGNORED_DIRECTORIES.has(name) : ALWAYS_IGNORED_FILES.has(name);
}
