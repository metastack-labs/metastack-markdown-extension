/**
 * Renders the extension icons and store images from the MetaStack mark.
 *
 *   bun run brand
 *
 * `src/assets/metastack-mark.svg` is a byte-for-byte copy of the MetaStack brand mark. Its paths
 * are reused as they are, in white on the brand ink tile; the mark is never redrawn. The PNGs are
 * committed, so building the extension (and Firefox's reproducible source review) never depends
 * on image tooling. Regenerate only when the mark or a size below changes, and record the new
 * version in assets/brand/assets.json.
 */
import { mkdir, readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const INK = '#242824';
const PAPER = '#ffffff';

const root = (path: string) => fileURLToPath(new URL(`../${path}`, import.meta.url));

const markFile = await readFile(root('src/assets/metastack-mark.svg'), 'utf8');
const markPaths = [...markFile.matchAll(/<path\b[^>]*\bd="([^"]+)"/g)].map((match) => match[1]);
if (markPaths.length !== 2) throw new Error(`Expected the two halves of the mark, found ${markPaths.length} paths`);

/** The mark is drawn on a 64-unit grid; its artwork spans 8–56, so it is 48 units square. */
function mark(size: number, markSize: number): string {
	const scale = markSize / 48;
	const offset = size / 2 - 32 * scale;
	const paths = markPaths.map((d) => `<path d="${d}"/>`).join('');
	return `<g fill="${PAPER}" transform="translate(${offset} ${offset}) scale(${scale})">${paths}</g>`;
}

interface IconSpec {
	readonly size: number;
	readonly tile: number;
	readonly radius: number;
	readonly markSize: number;
}

/**
 * Toolbar sizes (16, 32) fill the canvas so the mark stays legible; at a scale of 0.25 and 0.5 every
 * edge of the mark lands on a whole pixel. Larger sizes keep Chrome's store-icon padding: 96px of
 * artwork with 16px of transparent space on each side of the 128px icon.
 */
const ICONS: readonly IconSpec[] = [
	{ size: 16, tile: 16, radius: 3.5, markSize: 12 },
	{ size: 32, tile: 32, radius: 7, markSize: 24 },
	{ size: 48, tile: 36, radius: 8, markSize: 24 },
	{ size: 128, tile: 96, radius: 22, markSize: 60 },
];

function iconSvg({ size, tile, radius, markSize }: IconSpec): string {
	const inset = (size - tile) / 2;
	return [
		`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`,
		`<rect x="${inset}" y="${inset}" width="${tile}" height="${tile}" rx="${radius}" fill="${INK}"/>`,
		mark(size, markSize),
		'</svg>',
	].join('');
}

interface ImageSpec {
	readonly file: string;
	readonly width: number;
	readonly height: number;
	readonly markSize: number;
}

/** Chrome Web Store promo tiles: no text, and still clear at half size. */
const STORE_IMAGES: readonly ImageSpec[] = [
	{ file: 'assets/brand/store/promo-small.v1.png', width: 440, height: 280, markSize: 112 },
	{ file: 'assets/brand/store/marquee.v1.png', width: 1400, height: 560, markSize: 208 },
];

function storeSvg({ width, height, markSize }: ImageSpec): string {
	const scale = markSize / 48;
	const x = width / 2 - 32 * scale;
	const y = height / 2 - 32 * scale;
	const paths = markPaths.map((d) => `<path d="${d}"/>`).join('');
	return [
		`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
		`<rect width="${width}" height="${height}" fill="${INK}"/>`,
		`<g fill="${PAPER}" transform="translate(${x} ${y}) scale(${scale})">${paths}</g>`,
		'</svg>',
	].join('');
}

async function render(svg: string, file: string, width: number, height: number): Promise<void> {
	const target = root(file);
	await mkdir(dirname(target), { recursive: true });
	await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(target);
	const meta = await sharp(target).metadata();
	if (meta.width !== width || meta.height !== height) {
		throw new Error(`${file} rendered at ${meta.width}x${meta.height}, expected ${width}x${height}`);
	}
	console.log(`${file}  ${width}x${height}`);
}

for (const icon of ICONS) {
	await render(iconSvg(icon), `public/icons/${icon.size}.png`, icon.size, icon.size);
}
for (const image of STORE_IMAGES) {
	await render(storeSvg(image), image.file, image.width, image.height);
}
