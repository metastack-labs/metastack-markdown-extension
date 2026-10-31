export type ThemePreference = 'system' | 'light' | 'dark';
export type ContentWidth = 'narrow' | 'medium' | 'wide' | 'full';

export interface Settings {
	readonly theme: ThemePreference;
	/** Reading font size in px. */
	readonly fontSize: number;
	readonly lineHeight: number;
	readonly contentWidth: ContentWidth;
	/** Show each Markdown file's first heading in the file list. */
	readonly showTitles: boolean;
	/** Open `file://` Markdown pages in the workspace instead of the browser's plain-text view. */
	readonly openLocalMarkdown: boolean;
	/** Open `file://` folder listings in the workspace. */
	readonly openLocalFolders: boolean;
	readonly sidebarOpen: boolean;
	readonly outlineOpen: boolean;
	readonly sidebarWidth: number;
	readonly outlineWidth: number;
}

export const SETTINGS_KEY = 'settings';

export const DEFAULT_SETTINGS: Settings = {
	theme: 'system',
	fontSize: 16,
	lineHeight: 1.65,
	contentWidth: 'medium',
	showTitles: true,
	openLocalMarkdown: true,
	openLocalFolders: true,
	sidebarOpen: true,
	outlineOpen: true,
	sidebarWidth: 280,
	outlineWidth: 240,
};

export const FONT_SIZE_RANGE = { min: 13, max: 22 } as const;
export const LINE_HEIGHT_RANGE = { min: 1.3, max: 2.1 } as const;
export const PANEL_WIDTH_RANGE = { min: 180, max: 480 } as const;

const THEMES: readonly ThemePreference[] = ['system', 'light', 'dark'];
const WIDTHS: readonly ContentWidth[] = ['narrow', 'medium', 'wide', 'full'];

function clamp(value: unknown, min: number, max: number, fallback: number): number {
	return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
	return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
	return typeof value === 'boolean' ? value : fallback;
}

/** Accepts anything read from storage and returns a complete, in-range settings object. */
export function normaliseSettings(raw: unknown): Settings {
	const input = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
	const d = DEFAULT_SETTINGS;
	return {
		theme: oneOf(input.theme, THEMES, d.theme),
		fontSize: Math.round(clamp(input.fontSize, FONT_SIZE_RANGE.min, FONT_SIZE_RANGE.max, d.fontSize)),
		lineHeight:
			Math.round(clamp(input.lineHeight, LINE_HEIGHT_RANGE.min, LINE_HEIGHT_RANGE.max, d.lineHeight) * 100) / 100,
		contentWidth: oneOf(input.contentWidth, WIDTHS, d.contentWidth),
		showTitles: bool(input.showTitles, d.showTitles),
		openLocalMarkdown: bool(input.openLocalMarkdown, d.openLocalMarkdown),
		openLocalFolders: bool(input.openLocalFolders, d.openLocalFolders),
		sidebarOpen: bool(input.sidebarOpen, d.sidebarOpen),
		outlineOpen: bool(input.outlineOpen, d.outlineOpen),
		sidebarWidth: Math.round(clamp(input.sidebarWidth, PANEL_WIDTH_RANGE.min, PANEL_WIDTH_RANGE.max, d.sidebarWidth)),
		outlineWidth: Math.round(clamp(input.outlineWidth, PANEL_WIDTH_RANGE.min, PANEL_WIDTH_RANGE.max, d.outlineWidth)),
	};
}
