import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { clsx } from 'clsx';
import {
	type ComponentProps,
	type KeyboardEvent,
	type PointerEvent,
	type ReactNode,
	useEffect,
	useRef,
	useState,
} from 'react';
import { PANEL_WIDTH_RANGE } from '../../lib/settings.ts';

/* ── Dialog (native <dialog>: focus trap, Escape and backdrop for free) ── */

interface DialogProps {
	readonly open: boolean;
	readonly title: string;
	readonly description?: ReactNode;
	readonly onClose: () => void;
	readonly children?: ReactNode;
	readonly footer: ReactNode;
	readonly width?: number;
}

export function Dialog({ open, title, description, onClose, children, footer, width = 440 }: DialogProps) {
	const ref = useRef<HTMLDialogElement>(null);
	const onCloseRef = useRef(onClose);
	onCloseRef.current = onClose;

	// React's autoFocus runs before showModal(), when the dialog is still hidden, so focus the
	// element marked data-autofocus after opening — and again when the content changes while open.
	// biome-ignore lint/correctness/useExhaustiveDependencies: `title` marks new content in an already-open dialog
	useEffect(() => {
		const dialog = ref.current;
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		if (!open && dialog.open) dialog.close();
		if (open) dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus();
	}, [open, title]);

	useEffect(() => {
		const dialog = ref.current;
		if (!dialog) return;
		const handleCancel = (event: Event) => {
			event.preventDefault();
			onCloseRef.current();
		};
		const handleClick = (event: MouseEvent) => {
			if (event.target === dialog) onCloseRef.current();
		};
		dialog.addEventListener('cancel', handleCancel);
		dialog.addEventListener('click', handleClick);
		return () => {
			dialog.removeEventListener('cancel', handleCancel);
			dialog.removeEventListener('click', handleClick);
		};
	}, []);

	return (
		<dialog
			ref={ref}
			className="app-dialog pop-surface"
			style={{ maxWidth: `min(${width}px, calc(100vw - 32px))` }}
			aria-label={title}
		>
			{open ? (
				<div className="flex flex-col">
					<div className="flex flex-col gap-1.5 px-5 pt-5">
						<h2 className="text-[15px] font-semibold tracking-[-0.01em] text-balance">{title}</h2>
						{description ? (
							<div className="text-[13px] leading-relaxed text-fg-muted text-pretty">{description}</div>
						) : null}
					</div>
					{children ? <div className="px-5 pt-4">{children}</div> : null}
					<div className="mt-5 flex items-center justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>
				</div>
			) : null}
		</dialog>
	);
}

/* ── Menu (Radix dropdown) ── */

export const Menu = DropdownMenu.Root;
export const MenuTrigger = DropdownMenu.Trigger;

export function MenuContent({ className, children, ...props }: ComponentProps<typeof DropdownMenu.Content>) {
	return (
		<DropdownMenu.Portal>
			<DropdownMenu.Content
				sideOffset={6}
				collisionPadding={12}
				className={clsx('pop-surface animate-pop z-50 min-w-[220px] max-w-[320px] p-1', className)}
				{...props}
			>
				{children}
			</DropdownMenu.Content>
		</DropdownMenu.Portal>
	);
}

export function MenuItem({ className, ...props }: ComponentProps<typeof DropdownMenu.Item>) {
	return <DropdownMenu.Item className={clsx('menu-item', className)} {...props} />;
}

export function MenuLabel({ className, ...props }: ComponentProps<typeof DropdownMenu.Label>) {
	return (
		<DropdownMenu.Label
			className={clsx('px-2 pt-2 pb-1 text-[11px] font-medium text-fg-subtle', className)}
			{...props}
		/>
	);
}

export function MenuSeparator() {
	return <DropdownMenu.Separator className="mx-1 my-1 h-px bg-line" />;
}

/* ── Segmented control ── */

interface SegmentedProps<T extends string> {
	readonly label: string;
	readonly value: T;
	readonly options: ReadonlyArray<{
		readonly value: T;
		readonly label: string;
		readonly icon?: ReactNode;
		readonly title?: string;
	}>;
	readonly onChange: (value: T) => void;
	readonly size?: 'sm' | 'md';
	readonly iconOnlyBelow?: boolean;
}

export function Segmented<T extends string>({ label, value, options, onChange, size = 'sm' }: SegmentedProps<T>) {
	const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
		event.preventDefault();
		const index = options.findIndex((option) => option.value === value);
		const delta = event.key === 'ArrowRight' ? 1 : -1;
		const next = options[(index + delta + options.length) % options.length];
		if (next) onChange(next.value);
		const buttons = event.currentTarget.querySelectorAll('button');
		buttons[(index + delta + options.length) % options.length]?.focus();
	};
	return (
		<div
			role="radiogroup"
			aria-label={label}
			onKeyDown={onKeyDown}
			className="flex shrink-0 items-center gap-0.5 rounded-[9px] bg-surface-hover p-0.5"
		>
			{options.map((option) => {
				const selected = option.value === value;
				return (
					// biome-ignore lint/a11y/useSemanticElements: see the radiogroup above
					<button
						key={option.value}
						type="button"
						role="radio"
						aria-checked={selected}
						tabIndex={selected ? 0 : -1}
						title={option.title}
						onClick={() => onChange(option.value)}
						className={clsx(
							'flex items-center justify-center gap-1.5 rounded-[7px] font-medium whitespace-nowrap transition-colors duration-100',
							size === 'sm' ? 'h-6 px-2 text-[12px]' : 'h-7 px-3 text-[13px]',
							selected ? 'bg-surface-raised text-fg shadow-[0_1px_2px_rgb(0_0_0/0.12)]' : 'text-fg-muted hover:text-fg'
						)}
					>
						{option.icon}
						<span>{option.label}</span>
					</button>
				);
			})}
		</div>
	);
}

/* ── Switch ── */

export function Switch({
	checked,
	onChange,
	label,
	description,
}: {
	readonly checked: boolean;
	readonly onChange: (checked: boolean) => void;
	readonly label: string;
	readonly description?: string;
}) {
	return (
		<label className="flex cursor-default items-start justify-between gap-4 py-2.5">
			<span className="flex min-w-0 flex-col gap-0.5">
				<span className="text-[13px] font-medium">{label}</span>
				{description ? <span className="text-[12px] leading-snug text-fg-muted text-pretty">{description}</span> : null}
			</span>
			<button
				type="button"
				role="switch"
				aria-checked={checked}
				aria-label={label}
				onClick={() => onChange(!checked)}
				className={clsx(
					'relative mt-0.5 h-[18px] w-8 shrink-0 rounded-full transition-colors duration-150',
					checked ? 'bg-primary' : 'bg-line-strong'
				)}
			>
				<span
					className={clsx(
						'absolute top-[2px] left-[2px] size-[14px] rounded-full bg-white shadow-sm transition-transform duration-150 ease-out',
						checked && 'translate-x-[14px]'
					)}
				/>
			</button>
		</label>
	);
}

/* ── Panel resize handle (pointer + keyboard) ── */

export function ResizeHandle({
	label,
	width,
	side,
	onResize,
	onCommit,
}: {
	readonly label: string;
	readonly width: number;
	/** Which side of the handle the panel is on. */
	readonly side: 'left' | 'right';
	readonly onResize: (width: number) => void;
	readonly onCommit: (width: number) => void;
}) {
	const [dragging, setDragging] = useState(false);
	const start = useRef({ x: 0, width });
	const latest = useRef(width);
	latest.current = width;
	const clamp = (value: number) => Math.min(PANEL_WIDTH_RANGE.max, Math.max(PANEL_WIDTH_RANGE.min, Math.round(value)));

	const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
		if (event.button !== 0) return;
		event.preventDefault();
		event.currentTarget.setPointerCapture(event.pointerId);
		start.current = { x: event.clientX, width };
		setDragging(true);
	};
	const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
		if (!dragging) return;
		const delta = event.clientX - start.current.x;
		onResize(clamp(start.current.width + (side === 'left' ? delta : -delta)));
	};
	const onPointerUp = () => {
		if (!dragging) return;
		setDragging(false);
		onCommit(latest.current);
	};
	const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
		event.preventDefault();
		const grow = (event.key === 'ArrowRight') === (side === 'left');
		const next = clamp(width + (grow ? 16 : -16));
		onResize(next);
		onCommit(next);
	};

	return (
		// biome-ignore lint/a11y/useSemanticElements: a focusable, draggable splitter; <hr> can't take focus or pointer input
		<div
			role="separator"
			aria-orientation="vertical"
			aria-label={label}
			aria-valuemin={PANEL_WIDTH_RANGE.min}
			aria-valuemax={PANEL_WIDTH_RANGE.max}
			aria-valuenow={width}
			tabIndex={0}
			data-chrome=""
			data-dragging={dragging ? '' : undefined}
			className="resize-handle"
			onPointerDown={onPointerDown}
			onPointerMove={onPointerMove}
			onPointerUp={onPointerUp}
			onPointerCancel={onPointerUp}
			onKeyDown={onKeyDown}
		/>
	);
}
