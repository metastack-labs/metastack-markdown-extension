import { clsx } from 'clsx';
import { type FormEvent, useEffect, useId, useState } from 'react';
import { hasFileUrlAccess, IS_FIREFOX, MOD_KEY_LABEL, openExtensionDetails } from '../../lib/platform.ts';
import {
	type ContentWidth,
	FONT_SIZE_RANGE,
	LINE_HEIGHT_RANGE,
	type Settings,
	type ThemePreference,
} from '../../lib/settings.ts';
import type { ConfirmRequest, NewDocumentTarget } from '../use-workspace.ts';
import { Dialog, Segmented, Switch } from './primitives.tsx';

/* ── Confirm ── */

export function ConfirmDialog({ request }: { readonly request: ConfirmRequest | null }) {
	const cancelValue = request?.actions.find((action) => action.value === 'cancel')?.value ?? 'cancel';
	return (
		<Dialog
			open={request !== null}
			title={request?.title ?? ''}
			description={request?.message}
			onClose={() => request?.resolve(cancelValue)}
			footer={request?.actions.map((action) => (
				<button
					key={action.value}
					type="button"
					// The safe primary choice takes focus; a destructive action never does.
					data-autofocus={action.variant === 'primary' ? '' : undefined}
					className={clsx('button', `button-${action.variant}`, action.variant === 'ghost' && 'mr-auto')}
					onClick={() => request.resolve(action.value)}
				>
					{action.label}
				</button>
			))}
		/>
	);
}

/* ── New document ── */

export function NewDocumentDialog({
	target,
	onCreate,
	onClose,
}: {
	readonly target: NewDocumentTarget | null;
	readonly onCreate: (name: string) => Promise<string | null>;
	readonly onClose: () => void;
}) {
	const [name, setName] = useState('untitled.md');
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const inputId = useId();

	useEffect(() => {
		if (target) {
			setName('untitled.md');
			setError(null);
			setBusy(false);
		}
	}, [target]);

	const submit = async (event: FormEvent) => {
		event.preventDefault();
		setBusy(true);
		const problem = await onCreate(name);
		setBusy(false);
		setError(problem);
	};

	return (
		<Dialog
			open={target !== null}
			title="New document"
			description={
				<>
					Creates a Markdown file in <span className="font-medium text-fg">{target?.label}</span>.
				</>
			}
			onClose={onClose}
			footer={
				<>
					<button type="button" className="button button-ghost" onClick={onClose}>
						Cancel
					</button>
					<button
						type="submit"
						form={`${inputId}-form`}
						className="button button-primary"
						disabled={busy}
						aria-busy={busy}
					>
						Create document
					</button>
				</>
			}
		>
			<form id={`${inputId}-form`} onSubmit={(event) => void submit(event)} className="flex flex-col gap-1.5">
				<label htmlFor={inputId} className="text-[12px] font-medium text-fg-muted">
					File name
				</label>
				<input
					id={inputId}
					value={name}
					onChange={(event) => {
						setName(event.target.value);
						setError(null);
					}}
					onFocus={(event) => event.target.setSelectionRange(0, Math.max(0, event.target.value.lastIndexOf('.')))}
					data-autofocus=""
					spellCheck={false}
					aria-invalid={error ? true : undefined}
					aria-describedby={error ? `${inputId}-error` : undefined}
					className="h-9 rounded-[10px] border border-line-strong bg-canvas px-3 font-mono text-[13px] outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
				/>
				{error ? (
					<p id={`${inputId}-error`} className="text-[12px] text-danger">
						{error}
					</p>
				) : null}
			</form>
		</Dialog>
	);
}

/* ── Saving a file:// document ── */

export function GrantSaveDialog({
	open,
	fileName,
	onChooseFolder,
	onDownload,
	onClose,
}: {
	readonly open: boolean;
	readonly fileName: string;
	readonly onChooseFolder: () => void;
	readonly onDownload: () => void;
	readonly onClose: () => void;
}) {
	return (
		<Dialog
			open={open}
			title="Allow saving to this folder"
			description={
				<>
					The browser opened “{fileName}” read-only. To save over it, choose the folder it's in (or any folder above it)
					once — the folder then appears in your sidebar and saves go straight to disk.
				</>
			}
			onClose={onClose}
			footer={
				<>
					<button type="button" className="button button-ghost mr-auto" onClick={onDownload}>
						Save a copy instead
					</button>
					<button type="button" className="button button-secondary" onClick={onClose}>
						Cancel
					</button>
					<button type="button" className="button button-primary" onClick={onChooseFolder}>
						Choose folder…
					</button>
				</>
			}
		/>
	);
}

/* ── Settings ── */

const SHORTCUTS: ReadonlyArray<[string, string]> = [
	[`${MOD_KEY_LABEL} S`, 'Save'],
	[`${MOD_KEY_LABEL} ⇧ S`, 'Save a copy'],
	[`${MOD_KEY_LABEL} E`, 'Switch between reading and editing'],
	[`${MOD_KEY_LABEL} \\`, 'Show or hide the sidebar'],
	[`${MOD_KEY_LABEL} ⇧ \\`, 'Show or hide the outline'],
	[`${MOD_KEY_LABEL} F`, 'Find (while editing)'],
];

export function SettingsDialog({
	open,
	settings,
	onChange,
	onClose,
}: {
	readonly open: boolean;
	readonly settings: Settings;
	readonly onChange: (patch: Partial<Settings>) => void;
	readonly onClose: () => void;
}) {
	const [fileAccess, setFileAccess] = useState<boolean | null>(null);
	useEffect(() => {
		if (open) void hasFileUrlAccess().then(setFileAccess);
	}, [open]);
	const sizeId = useId();
	const leadingId = useId();

	return (
		<Dialog
			open={open}
			title="Settings"
			onClose={onClose}
			width={520}
			footer={
				<button type="button" className="button button-primary" onClick={onClose}>
					Done
				</button>
			}
		>
			<div className="flex max-h-[62vh] flex-col overflow-y-auto pr-1">
				<section className="flex flex-col gap-3 pb-5">
					<h3 className="text-[12px] font-semibold text-fg-subtle">Reading</h3>
					<div className="flex items-center justify-between gap-4">
						<span className="text-[13px] font-medium">Theme</span>
						<Segmented<ThemePreference>
							label="Theme"
							value={settings.theme}
							onChange={(theme) => onChange({ theme })}
							options={[
								{ value: 'system', label: 'System' },
								{ value: 'light', label: 'Light' },
								{ value: 'dark', label: 'Dark' },
							]}
						/>
					</div>
					<div className="flex items-center justify-between gap-4">
						<span className="text-[13px] font-medium">Page width</span>
						<Segmented<ContentWidth>
							label="Page width"
							value={settings.contentWidth}
							onChange={(contentWidth) => onChange({ contentWidth })}
							options={[
								{ value: 'narrow', label: 'Narrow' },
								{ value: 'medium', label: 'Medium' },
								{ value: 'wide', label: 'Wide' },
								{ value: 'full', label: 'Full' },
							]}
						/>
					</div>
					<div className="flex items-center justify-between gap-4">
						<label htmlFor={sizeId} className="text-[13px] font-medium">
							Text size
						</label>
						<div className="flex items-center gap-3">
							<input
								id={sizeId}
								type="range"
								min={FONT_SIZE_RANGE.min}
								max={FONT_SIZE_RANGE.max}
								step={1}
								value={settings.fontSize}
								onChange={(event) => onChange({ fontSize: Number(event.target.value) })}
								className="w-40 accent-[var(--accent)]"
							/>
							<span className="w-10 text-right text-[12px] text-fg-muted tabular-nums">{settings.fontSize}px</span>
						</div>
					</div>
					<div className="flex items-center justify-between gap-4">
						<label htmlFor={leadingId} className="text-[13px] font-medium">
							Line spacing
						</label>
						<div className="flex items-center gap-3">
							<input
								id={leadingId}
								type="range"
								min={LINE_HEIGHT_RANGE.min}
								max={LINE_HEIGHT_RANGE.max}
								step={0.05}
								value={settings.lineHeight}
								onChange={(event) => onChange({ lineHeight: Number(event.target.value) })}
								className="w-40 accent-[var(--accent)]"
							/>
							<span className="w-10 text-right text-[12px] text-fg-muted tabular-nums">
								{settings.lineHeight.toFixed(2)}
							</span>
						</div>
					</div>
				</section>

				<section className="flex flex-col border-t border-line py-4">
					<h3 className="pb-1 text-[12px] font-semibold text-fg-subtle">Files</h3>
					<Switch
						label="Show document titles"
						description="List Markdown files by their first heading, with the file name underneath."
						checked={settings.showTitles}
						onChange={(showTitles) => onChange({ showTitles })}
					/>
					<Switch
						label="Open local Markdown files here"
						description="When the browser opens a .md file from your computer, show it in this workspace."
						checked={settings.openLocalMarkdown}
						onChange={(openLocalMarkdown) => onChange({ openLocalMarkdown })}
					/>
					<Switch
						label="Open local folder listings here"
						description="Show file:// folder pages in this workspace instead of the browser's plain list."
						checked={settings.openLocalFolders}
						onChange={(openLocalFolders) => onChange({ openLocalFolders })}
					/>
					{fileAccess === false && !IS_FIREFOX ? (
						<p className="mt-1 rounded-[10px] bg-warning-soft px-3 py-2.5 text-[12px] leading-relaxed text-pretty">
							These need <span className="font-medium">Allow access to file URLs</span>, which is off.{' '}
							<button
								type="button"
								className="font-medium text-accent hover:underline"
								onClick={() => void openExtensionDetails()}
							>
								Turn it on
							</button>
						</p>
					) : null}
				</section>

				<section className="flex flex-col border-t border-line pt-4">
					<h3 className="pb-2 text-[12px] font-semibold text-fg-subtle">Keyboard shortcuts</h3>
					<dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2 text-[13px]">
						{SHORTCUTS.map(([keys, action]) => (
							<div key={keys} className="contents">
								<dt className="text-fg-muted">{action}</dt>
								<dd className="text-right">
									<kbd className="kbd">{keys}</kbd>
								</dd>
							</div>
						))}
					</dl>
				</section>
			</div>
		</Dialog>
	);
}
