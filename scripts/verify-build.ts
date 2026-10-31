/**
 * Checks the built extensions against what the stores and our privacy policy promise.
 *
 *   bun run build && bun run verify
 *
 * The permission and host lists below are a contract: PRIVACY.md and docs/store-listing.md
 * justify exactly these. If a change needs more, update those documents in the same change,
 * then this allowlist.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUTPUT = join(ROOT, '.output');

const ALLOWED_PERMISSIONS = ['storage'];
const ALLOWED_MATCHES = ['file:///*'];
const GECKO_ID = 'markdown@metastacklabs.com';
const ICON_SIZES = [16, 32, 48, 128];
/** Chrome Web Store allows 75 characters for the name and 132 for the description; AMO allows 50 for the name. */
const MAX_NAME = 50;
const MAX_DESCRIPTION = 132;

type Json = Record<string, unknown>;

const failures: string[] = [];
const fail = (target: string, message: string) => failures.push(`${target}: ${message}`);

function readJson(path: string): Json {
	return JSON.parse(readFileSync(path, 'utf8')) as Json;
}

function sameList(actual: unknown, expected: readonly string[]): boolean {
	return Array.isArray(actual) && actual.length === expected.length && expected.every((item) => actual.includes(item));
}

function pngSize(path: string): { width: number; height: number } | null {
	const bytes = readFileSync(path);
	const signature = '89504e470d0a1a0a';
	if (bytes.length < 24 || bytes.subarray(0, 8).toString('hex') !== signature) return null;
	return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function filesUnder(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		return statSync(path).isDirectory() ? filesUnder(path) : [path];
	});
}

function resolveMessage(dir: string, value: unknown): string {
	if (typeof value !== 'string') return '';
	const match = /^__MSG_(\w+)__$/.exec(value);
	if (!match) return value;
	const messages = readJson(join(dir, '_locales', 'en', 'messages.json')) as Record<string, { message?: string }>;
	return messages[match[1] as string]?.message ?? '';
}

function checkIcon(target: string, dir: string, path: unknown, size: number): void {
	if (typeof path !== 'string' || !existsSync(join(dir, path))) {
		fail(target, `missing ${size}px icon ${String(path)}`);
		return;
	}
	const actual = pngSize(join(dir, path));
	if (!actual || actual.width !== size || actual.height !== size) {
		fail(
			target,
			`${path} should be a ${size}x${size} PNG, got ${actual ? `${actual.width}x${actual.height}` : 'not a PNG'}`
		);
	}
}

/** Both stores reject remotely hosted code; extension pages must load scripts and styles from the package. */
function checkNoRemoteCode(target: string, dir: string): void {
	const remoteScript = /<script\b[^>]*\bsrc=["']?(?:https?:)?\/\//i;
	const remoteStyle = /<link\b[^>]*\bhref=["']?(?:https?:)?\/\/[^>]*>/i;
	const remoteImport = /\b(?:import|importScripts)\s*\(\s*["'`]https?:/;
	const remoteCssImport = /@import\s+(?:url\()?["']?https?:/i;
	for (const file of filesUnder(dir)) {
		const name = relative(dir, file);
		if (file.endsWith('.html')) {
			const html = readFileSync(file, 'utf8');
			if (remoteScript.test(html)) fail(target, `${name} loads a remote script`);
			if (remoteStyle.test(html)) fail(target, `${name} links a remote resource`);
		} else if (file.endsWith('.js') && remoteImport.test(readFileSync(file, 'utf8'))) {
			fail(target, `${name} imports remote code`);
		} else if (file.endsWith('.css') && remoteCssImport.test(readFileSync(file, 'utf8'))) {
			fail(target, `${name} imports a remote stylesheet`);
		}
	}
}

function verify(target: 'chrome-mv3' | 'firefox-mv2', version: string): void {
	const dir = join(OUTPUT, target);
	const manifestPath = join(dir, 'manifest.json');
	if (!existsSync(manifestPath)) {
		fail(target, 'not built (run `bun run build` first)');
		return;
	}
	const manifest = readJson(manifestPath);
	const isFirefox = target === 'firefox-mv2';

	if (manifest.version !== version) fail(target, `version ${String(manifest.version)} ≠ package.json ${version}`);

	const name = resolveMessage(dir, manifest.name);
	const description = resolveMessage(dir, manifest.description);
	if (!name || name.length > MAX_NAME) fail(target, `name must be 1–${MAX_NAME} characters, got "${name}"`);
	if (!description || description.length > MAX_DESCRIPTION) {
		fail(target, `description must be 1–${MAX_DESCRIPTION} characters, got ${description.length}`);
	}

	if (!sameList(manifest.permissions, ALLOWED_PERMISSIONS)) {
		fail(
			target,
			`permissions ${JSON.stringify(manifest.permissions)} ≠ allowlist ${JSON.stringify(ALLOWED_PERMISSIONS)}`
		);
	}
	for (const key of ['host_permissions', 'optional_permissions', 'optional_host_permissions']) {
		if (key in manifest) fail(target, `unexpected ${key}`);
	}
	const csp = JSON.stringify(manifest.content_security_policy ?? '');
	if (/unsafe-eval|https?:/.test(csp)) fail(target, `content_security_policy loosened: ${csp}`);

	const contentScripts = (manifest.content_scripts ?? []) as Array<{ matches?: unknown }>;
	for (const script of contentScripts) {
		if (!sameList(script.matches, ALLOWED_MATCHES)) {
			fail(target, `content script matches ${JSON.stringify(script.matches)} ≠ ${JSON.stringify(ALLOWED_MATCHES)}`);
		}
	}
	if (!isFirefox) {
		for (const entry of (manifest.web_accessible_resources ?? []) as Array<{ matches?: unknown }>) {
			if (!sameList(entry.matches, ALLOWED_MATCHES)) fail(target, 'web_accessible_resources exposed beyond file://');
		}
	}

	const icons = (manifest.icons ?? {}) as Record<string, unknown>;
	for (const size of ICON_SIZES) checkIcon(target, dir, icons[size], size);
	const action = (manifest[isFirefox ? 'browser_action' : 'action'] ?? {}) as {
		default_icon?: Record<string, unknown>;
	};
	for (const [size, path] of Object.entries(action.default_icon ?? {})) checkIcon(target, dir, path, Number(size));
	if (!action.default_icon) fail(target, 'toolbar button has no default_icon');

	if (isFirefox) {
		const settings = (manifest.browser_specific_settings ?? {}) as Json;
		const gecko = (settings.gecko ?? {}) as Json;
		if (gecko.id !== GECKO_ID)
			fail(target, `gecko id ${String(gecko.id)} ≠ ${GECKO_ID} (it is permanent once published)`);
		const consent = (gecko.data_collection_permissions ?? {}) as Json;
		if (!sameList(consent.required, ['none']))
			fail(target, 'data_collection_permissions must declare required: ["none"]');
		if ('gecko_android' in settings) fail(target, 'gecko_android would list the add-on for Android, which is untested');
	} else if (typeof manifest.minimum_chrome_version !== 'string') {
		fail(target, 'minimum_chrome_version is missing');
	}

	checkNoRemoteCode(target, dir);
}

const { version } = readJson(join(ROOT, 'package.json')) as { version: string };
verify('chrome-mv3', version);
verify('firefox-mv2', version);

if (failures.length > 0) {
	console.error(`Build verification failed:\n${failures.map((line) => `  ✗ ${line}`).join('\n')}`);
	process.exit(1);
}
console.log(`✓ chrome-mv3 and firefox-mv2 ${version}: permissions, icons, metadata and no remote code`);
