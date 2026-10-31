import DOMPurify from 'dompurify';
import { isRelativeReference } from './html.ts';

let configured = false;

function configure(): void {
	if (configured) return;
	configured = true;
	DOMPurify.addHook('afterSanitizeAttributes', (node) => {
		if (node.tagName === 'A' && node.getAttribute('target') === '_blank') {
			node.setAttribute('rel', 'noopener noreferrer');
		}
		// Raw <img src="./x.png"> in Markdown resolves against the open folder, not the extension.
		if (node.tagName === 'IMG') {
			const src = node.getAttribute('src');
			if (src && isRelativeReference(src)) {
				node.setAttribute('data-local-src', src);
				node.removeAttribute('src');
			}
		}
	});
}

/**
 * Sanitize rendered Markdown. Local files can contain arbitrary HTML, so scripts, event
 * handlers, styles and embeds are stripped; links, images, tables, SVG and data-* stay.
 */
export function sanitizeHtml(html: string): string {
	configure();
	return DOMPurify.sanitize(html, {
		ADD_ATTR: ['target'],
		FORBID_TAGS: ['style', 'form', 'iframe', 'frame', 'object', 'embed', 'base', 'meta', 'link'],
		FORBID_ATTR: ['style'],
	});
}
