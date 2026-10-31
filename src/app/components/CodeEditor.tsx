import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { bracketMatching, HighlightStyle, indentOnInput, syntaxHighlighting } from '@codemirror/language';
import { languages } from '@codemirror/language-data';
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search';
import { EditorState, type Extension } from '@codemirror/state';
import {
	drawSelection,
	dropCursor,
	EditorView,
	highlightActiveLine,
	highlightSpecialChars,
	keymap,
	placeholder,
} from '@codemirror/view';
import { tags as t } from '@lezer/highlight';
import { useEffect, useRef } from 'react';

const theme = EditorView.theme({
	'&': {
		height: '100%',
		color: 'var(--fg)',
		backgroundColor: 'transparent',
		fontSize: 'var(--editor-size, 14px)',
	},
	'&.cm-focused': { outline: 'none' },
	'.cm-scroller': {
		fontFamily: 'var(--font-mono)',
		lineHeight: '1.7',
		overscrollBehavior: 'contain',
		scrollbarWidth: 'thin',
	},
	'.cm-content': {
		maxWidth: 'var(--editor-width, 52rem)',
		margin: '0 auto',
		padding: '28px 32px 40vh',
		caretColor: 'var(--accent)',
	},
	'.cm-line': { padding: '0' },
	'.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--accent)', borderLeftWidth: '2px' },
	'&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection':
		{ backgroundColor: 'var(--selection)' },
	'.cm-activeLine': { backgroundColor: 'color-mix(in srgb, var(--surface-hover) 45%, transparent)' },
	'.cm-selectionMatch': { backgroundColor: 'var(--accent-soft)' },
	'.cm-matchingBracket': { backgroundColor: 'var(--accent-soft)', outline: 'none' },
	'.cm-placeholder': { color: 'var(--fg-subtle)' },
	'.cm-panels': {
		backgroundColor: 'var(--surface)',
		color: 'var(--fg)',
		borderColor: 'var(--line)',
		fontFamily: 'var(--font-sans)',
	},
	'.cm-panels.cm-panels-top': { borderBottom: '1px solid var(--line)' },
	'.cm-panel.cm-search': { padding: '8px 12px', fontSize: '12px' },
	'.cm-panel.cm-search input, .cm-panel.cm-search button': {
		fontFamily: 'var(--font-sans)',
		fontSize: '12px',
		borderRadius: '6px',
	},
	'.cm-textfield': {
		backgroundColor: 'var(--canvas)',
		border: '1px solid var(--line-strong)',
		color: 'var(--fg)',
	},
	'.cm-button': {
		backgroundImage: 'none',
		backgroundColor: 'var(--surface-raised)',
		border: '1px solid var(--line-strong)',
		color: 'var(--fg)',
	},
	'.cm-searchMatch': { backgroundColor: 'var(--warning-soft)', outline: '1px solid var(--warning)' },
	'.cm-searchMatch.cm-searchMatch-selected': { backgroundColor: 'var(--accent-soft)' },
});

const highlightStyle = HighlightStyle.define([
	{ tag: t.heading1, fontWeight: '700', fontSize: '1.3em' },
	{ tag: t.heading2, fontWeight: '700', fontSize: '1.15em' },
	{ tag: [t.heading3, t.heading4, t.heading5, t.heading6], fontWeight: '650' },
	{ tag: t.strong, fontWeight: '700' },
	{ tag: t.emphasis, fontStyle: 'italic' },
	{ tag: t.strikethrough, textDecoration: 'line-through' },
	{ tag: [t.link, t.url], color: 'var(--accent)' },
	{ tag: t.monospace, color: 'var(--hl-string)' },
	{ tag: t.quote, color: 'var(--fg-muted)' },
	{ tag: [t.processingInstruction, t.meta, t.contentSeparator, t.labelName], color: 'var(--fg-subtle)' },
	{ tag: t.list, color: 'var(--hl-type)' },
	{ tag: [t.keyword, t.modifier, t.operatorKeyword, t.controlKeyword], color: 'var(--hl-keyword)' },
	{ tag: [t.string, t.special(t.string), t.regexp], color: 'var(--hl-string)' },
	{ tag: [t.number, t.bool, t.null, t.atom], color: 'var(--hl-number)' },
	{ tag: [t.comment, t.lineComment, t.blockComment], color: 'var(--hl-comment)', fontStyle: 'italic' },
	{
		tag: [t.function(t.variableName), t.function(t.propertyName), t.className, t.typeName, t.definition(t.typeName)],
		color: 'var(--hl-title)',
	},
	{ tag: [t.propertyName, t.attributeName], color: 'var(--hl-attr)' },
	{ tag: [t.tagName, t.angleBracket], color: 'var(--hl-tag)' },
	{ tag: t.invalid, color: 'var(--danger)' },
]);

interface CodeEditorProps {
	/** Remounts the editor when it changes (new document). */
	readonly documentId: string;
	readonly value: string;
	readonly markdownMode: boolean;
	readonly onChange: (value: string) => void;
	readonly onSave: () => void;
	readonly label: string;
}

/** CodeMirror 6 source editor. Lossless: the file is edited exactly as written. */
export default function CodeEditor({ documentId, value, markdownMode, onChange, onSave, label }: CodeEditorProps) {
	const host = useRef<HTMLDivElement>(null);
	const view = useRef<EditorView | null>(null);
	const handlers = useRef({ onChange, onSave });
	handlers.current = { onChange, onSave };
	const latestValue = useRef(value);
	latestValue.current = value;

	// biome-ignore lint/correctness/useExhaustiveDependencies: the editor owns its text after mount; `value` syncs in the effect below
	useEffect(() => {
		if (!host.current) return;
		const extensions: Extension[] = [
			highlightSpecialChars(),
			history(),
			drawSelection(),
			dropCursor(),
			indentOnInput(),
			bracketMatching(),
			highlightActiveLine(),
			highlightSelectionMatches(),
			EditorView.lineWrapping,
			EditorState.tabSize.of(4),
			placeholder('Start writing…'),
			syntaxHighlighting(highlightStyle),
			theme,
			keymap.of([
				{
					key: 'Mod-s',
					preventDefault: true,
					run: () => {
						handlers.current.onSave();
						return true;
					},
				},
				indentWithTab,
				...defaultKeymap,
				...historyKeymap,
				...searchKeymap,
			]),
			EditorView.contentAttributes.of({ 'aria-label': label, spellcheck: 'true', autocorrect: 'off' }),
			EditorView.updateListener.of((update) => {
				if (update.docChanged) handlers.current.onChange(update.state.doc.toString());
			}),
		];
		if (markdownMode) extensions.push(markdown({ base: markdownLanguage, codeLanguages: languages }));
		const editor = new EditorView({
			state: EditorState.create({ doc: latestValue.current, extensions }),
			parent: host.current,
		});
		view.current = editor;
		editor.focus();
		return () => {
			editor.destroy();
			view.current = null;
		};
	}, [documentId, markdownMode]);

	// Apply outside changes (reload from disk, task toggles) without losing undo history.
	useEffect(() => {
		const editor = view.current;
		if (!editor) return;
		const current = editor.state.doc.toString();
		if (current !== value) {
			editor.dispatch({ changes: { from: 0, to: current.length, insert: value } });
		}
	}, [value]);

	return <div ref={host} className="h-full min-h-0" />;
}
