import { basename, extname } from './paths.ts';

const MARKDOWN_EXTENSIONS = new Set(['.md', '.markdown', '.mdown', '.mkd', '.mdx']);

/** Extension → highlight.js language for plain-text files shown read-only as code. */
const TEXT_LANGUAGES: Record<string, string> = {
	'.txt': 'plaintext',
	'.text': 'plaintext',
	'.log': 'plaintext',
	'.csv': 'plaintext',
	'.tsv': 'plaintext',
	'.json': 'json',
	'.jsonc': 'json',
	'.yaml': 'yaml',
	'.yml': 'yaml',
	'.toml': 'ini',
	'.ini': 'ini',
	'.cfg': 'ini',
	'.conf': 'ini',
	'.env': 'ini',
	'.xml': 'xml',
	'.html': 'xml',
	'.htm': 'xml',
	'.svg': 'xml',
	'.css': 'css',
	'.scss': 'scss',
	'.js': 'javascript',
	'.mjs': 'javascript',
	'.cjs': 'javascript',
	'.jsx': 'javascript',
	'.ts': 'typescript',
	'.mts': 'typescript',
	'.cts': 'typescript',
	'.tsx': 'typescript',
	'.py': 'python',
	'.rb': 'ruby',
	'.rs': 'rust',
	'.go': 'go',
	'.java': 'java',
	'.kt': 'kotlin',
	'.swift': 'swift',
	'.c': 'c',
	'.h': 'c',
	'.cpp': 'cpp',
	'.hpp': 'cpp',
	'.cs': 'csharp',
	'.php': 'php',
	'.sql': 'sql',
	'.graphql': 'graphql',
	'.gql': 'graphql',
	'.sh': 'bash',
	'.bash': 'bash',
	'.zsh': 'bash',
	'.diff': 'diff',
	'.patch': 'diff',
};

const TEXT_FILE_NAMES: Record<string, string> = {
	license: 'plaintext',
	licence: 'plaintext',
	readme: 'plaintext',
	changelog: 'plaintext',
	authors: 'plaintext',
	makefile: 'makefile',
	dockerfile: 'dockerfile',
	'.gitignore': 'plaintext',
	'.gitattributes': 'plaintext',
	'.editorconfig': 'ini',
	'.npmrc': 'ini',
	'.nvmrc': 'plaintext',
};

const IMAGE_TYPES: Record<string, string> = {
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.gif': 'image/gif',
	'.webp': 'image/webp',
	'.avif': 'image/avif',
	'.svg': 'image/svg+xml',
	'.bmp': 'image/bmp',
	'.ico': 'image/x-icon',
};

export type DocumentKind = 'markdown' | 'text';

export function isMarkdownName(name: string): boolean {
	return MARKDOWN_EXTENSIONS.has(extname(name));
}

function textLanguage(name: string): string | null {
	const base = basename(name).toLowerCase();
	const byName = TEXT_FILE_NAMES[base];
	if (byName) return byName;
	if (base.startsWith('.env')) return 'ini';
	return TEXT_LANGUAGES[extname(base)] ?? null;
}

/** How a file opens in the viewer, or `null` when it is not a text document we can show. */
export function documentKind(name: string): DocumentKind | null {
	if (isMarkdownName(name)) return 'markdown';
	return textLanguage(name) ? 'text' : null;
}

export function languageForName(name: string): string {
	if (isMarkdownName(name)) return 'markdown';
	return textLanguage(name) ?? 'plaintext';
}

export function imageMimeType(name: string): string | null {
	return IMAGE_TYPES[extname(name)] ?? null;
}

/** Normalise a user-typed document name: trim, reject path separators, default to `.md`. */
export function normaliseNewFileName(input: string): { name: string } | { error: string } {
	const name = input.trim();
	if (!name) return { error: 'Enter a file name.' };
	if (/[\\/]/.test(name)) return { error: 'Use a name without slashes.' };
	if (name === '.' || name === '..') return { error: 'Choose a different name.' };
	if (/[<>:"|?*]/.test(name) || [...name].some((char) => char.charCodeAt(0) < 32)) {
		return { error: 'Remove special characters like < > : " | ? *' };
	}
	return { name: documentKind(name) ? name : `${name}.md` };
}
