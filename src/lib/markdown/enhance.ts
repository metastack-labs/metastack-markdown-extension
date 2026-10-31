/**
 * Browser-only hydration for rendered Markdown. KaTeX and Mermaid are large, so they are
 * imported on demand, only for documents that use them.
 */

type Katex = typeof import('katex').default;
type Mermaid = typeof import('mermaid').default;

let katexPromise: Promise<Katex> | null = null;
let mermaidPromise: Promise<Mermaid> | null = null;

function loadKatex(): Promise<Katex> {
	katexPromise ??= Promise.all([import('katex'), import('katex/dist/katex.min.css')]).then(([mod]) => mod.default);
	return katexPromise;
}

function loadMermaid(): Promise<Mermaid> {
	mermaidPromise ??= import('mermaid').then((mod) => mod.default);
	return mermaidPromise;
}

export async function renderMath(container: HTMLElement): Promise<void> {
	const nodes = container.querySelectorAll<HTMLElement>('.math[data-tex]:not([data-rendered])');
	if (nodes.length === 0) return;
	const katex = await loadKatex();
	for (const node of nodes) {
		const tex = node.dataset.tex ?? '';
		try {
			katex.render(tex, node, {
				displayMode: node.classList.contains('math-display'),
				throwOnError: false,
				output: 'htmlAndMathml',
			});
			node.dataset.rendered = '';
		} catch {
			node.classList.add('math-error');
		}
	}
}

let mermaidSequence = 0;

export async function renderMermaid(container: HTMLElement, dark: boolean, signal: AbortSignal): Promise<void> {
	const blocks = container.querySelectorAll<HTMLElement>('.mermaid-block[data-mermaid]');
	if (blocks.length === 0) return;
	const mermaid = await loadMermaid();
	if (signal.aborted) return;
	mermaid.initialize({
		startOnLoad: false,
		securityLevel: 'strict',
		theme: dark ? 'dark' : 'default',
		fontFamily: 'inherit',
	});
	for (const block of blocks) {
		if (signal.aborted) return;
		const source = block.dataset.source ?? block.textContent ?? '';
		block.dataset.source = source;
		mermaidSequence += 1;
		try {
			const { svg } = await mermaid.render(`mermaid-diagram-${mermaidSequence}`, source);
			if (signal.aborted) return;
			block.innerHTML = svg;
			block.classList.remove('mermaid-error');
			block.setAttribute('role', 'img');
			block.setAttribute('aria-label', 'Diagram');
		} catch (error) {
			block.classList.add('mermaid-error');
			const message = document.createElement('p');
			message.className = 'mermaid-error-message';
			message.textContent = `Couldn't draw this diagram: ${error instanceof Error ? error.message.split('\n')[0] : 'syntax error'}`;
			const code = document.createElement('pre');
			code.textContent = source;
			block.replaceChildren(message, code);
		}
	}
}
