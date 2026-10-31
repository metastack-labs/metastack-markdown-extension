import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import c from 'highlight.js/lib/languages/c';
import cpp from 'highlight.js/lib/languages/cpp';
import csharp from 'highlight.js/lib/languages/csharp';
import css from 'highlight.js/lib/languages/css';
import diff from 'highlight.js/lib/languages/diff';
import dockerfile from 'highlight.js/lib/languages/dockerfile';
import go from 'highlight.js/lib/languages/go';
import graphql from 'highlight.js/lib/languages/graphql';
import ini from 'highlight.js/lib/languages/ini';
import java from 'highlight.js/lib/languages/java';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import kotlin from 'highlight.js/lib/languages/kotlin';
import makefile from 'highlight.js/lib/languages/makefile';
import markdown from 'highlight.js/lib/languages/markdown';
import php from 'highlight.js/lib/languages/php';
import plaintext from 'highlight.js/lib/languages/plaintext';
import python from 'highlight.js/lib/languages/python';
import ruby from 'highlight.js/lib/languages/ruby';
import rust from 'highlight.js/lib/languages/rust';
import scss from 'highlight.js/lib/languages/scss';
import shell from 'highlight.js/lib/languages/shell';
import sql from 'highlight.js/lib/languages/sql';
import swift from 'highlight.js/lib/languages/swift';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import yaml from 'highlight.js/lib/languages/yaml';
import { escapeHtml } from './html.ts';

const LANGUAGES = {
	bash,
	c,
	cpp,
	csharp,
	css,
	diff,
	dockerfile,
	go,
	graphql,
	ini,
	java,
	javascript,
	json,
	kotlin,
	makefile,
	markdown,
	php,
	plaintext,
	python,
	ruby,
	rust,
	scss,
	shell,
	sql,
	swift,
	typescript,
	xml,
	yaml,
};

for (const [name, definition] of Object.entries(LANGUAGES)) {
	hljs.registerLanguage(name, definition);
}
// Common fence names that the bundled grammars don't alias themselves.
hljs.registerAliases(['jsx'], { languageName: 'javascript' });
hljs.registerAliases(['zsh', 'sh', 'shellscript'], { languageName: 'bash' });
hljs.registerAliases(['toml', 'conf', 'env'], { languageName: 'ini' });
hljs.registerAliases(['jsonc', 'json5'], { languageName: 'json' });
hljs.registerAliases(['text', 'txt'], { languageName: 'plaintext' });

export interface Highlighted {
	readonly html: string;
	/** Canonical grammar name when the language is known. */
	readonly language: string | null;
}

/** Highlight with an explicit language only; unknown or missing languages are escaped, never guessed. */
export function highlightCode(code: string, language: string | null | undefined): Highlighted {
	const requested = language?.trim().toLowerCase();
	const grammar = requested ? hljs.getLanguage(requested) : undefined;
	if (!requested || !grammar) return { html: escapeHtml(code), language: null };
	const result = hljs.highlight(code, { language: requested, ignoreIllegals: true });
	return { html: result.value, language: requested };
}

export function isKnownLanguage(language: string): boolean {
	return hljs.getLanguage(language.toLowerCase()) !== undefined;
}
