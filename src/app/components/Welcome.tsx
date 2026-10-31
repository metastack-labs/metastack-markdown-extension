import { FilePlus2, FileUp, Folder, FolderPlus, ShieldCheck, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { hasFileUrlAccess, IS_FIREFOX, openExtensionDetails, supportsFileSystemAccess } from '../../lib/platform.ts';
import type { Workspace } from '../use-workspace.ts';

/** First screen: nothing open yet. */
export function Welcome({ workspace }: { readonly workspace: Workspace }) {
	const [fileAccess, setFileAccess] = useState<boolean | null>(null);
	useEffect(() => {
		void hasFileUrlAccess().then(setFileAccess);
	}, []);
	const savedFolders = workspace.folders.filter((folder) => folder.saved);
	const canWrite = supportsFileSystemAccess();

	return (
		<div className="animate-fade flex min-h-full items-center justify-center px-4 py-12">
			<div className="flex w-full max-w-[520px] flex-col">
				<img src="/icons/128.png" alt="" className="mb-6 size-12 rounded-[14px]" />
				<h1 className="text-[26px] leading-tight font-semibold tracking-[-0.025em] text-balance">
					Read and edit your Markdown, right in the browser
				</h1>
				<p className="mt-3 max-w-[60ch] text-[14px] leading-relaxed text-fg-muted text-pretty">
					Drop Markdown files or a whole folder anywhere on this page. Everything stays on your computer.
				</p>

				<div className="mt-7 flex flex-wrap items-center gap-2">
					<button
						type="button"
						className="button button-primary button-lg"
						onClick={() => void workspace.openFolderPicker()}
					>
						<FolderPlus className="size-4" aria-hidden />
						Open folder
					</button>
					<button
						type="button"
						className="button button-secondary button-lg"
						onClick={() => void workspace.openFilePicker()}
					>
						<FileUp className="size-4" aria-hidden />
						Open file
					</button>
					<button
						type="button"
						className="button button-ghost button-lg"
						onClick={() => void workspace.requestNewDocument()}
					>
						<FilePlus2 className="size-4" aria-hidden />
						New document
					</button>
				</div>

				{savedFolders.length > 0 ? (
					<section aria-label="Recent folders" className="mt-10">
						<h2 className="mb-2 text-[12px] font-semibold text-fg-subtle">Recent folders</h2>
						<ul className="overflow-hidden rounded-xl border border-line">
							{savedFolders.map((folder) => (
								<li key={folder.id} className="group flex items-center border-b border-line last:border-b-0">
									<button
										type="button"
										onClick={() => void workspace.activateFolder(folder.id, { openReadme: true })}
										className="flex min-h-11 min-w-0 flex-1 items-center gap-3 px-3.5 text-left hover:bg-surface-hover"
									>
										<Folder className="size-4 shrink-0 text-fg-subtle" aria-hidden />
										<span className="min-w-0 flex-1 truncate text-[13px] font-medium">{folder.name}</span>
										{folder.access !== 'granted' ? (
											<span className="shrink-0 text-[12px] text-fg-subtle">Click to reconnect</span>
										) : null}
									</button>
									<button
										type="button"
										aria-label={`Remove ${folder.name} from recent folders`}
										onClick={() => void workspace.removeFolder(folder.id)}
										className="icon-button mr-2 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
									>
										<X className="size-3.5" aria-hidden />
									</button>
								</li>
							))}
						</ul>
					</section>
				) : null}

				<div className="mt-10 flex flex-col gap-3 border-t border-line pt-5 text-[12px] leading-relaxed text-fg-muted">
					{fileAccess === false ? (
						<div className="flex items-start gap-3">
							<ShieldCheck className="mt-0.5 size-4 shrink-0 text-fg-subtle" aria-hidden />
							<p className="min-w-0 flex-1 text-pretty">
								To open <code className="font-mono text-[11px]">.md</code> files you drag onto any tab, turn on{' '}
								<span className="font-medium text-fg">Allow access to file URLs</span> for this extension.{' '}
								<button
									type="button"
									className="font-medium text-accent hover:underline"
									onClick={() => void openExtensionDetails()}
								>
									Open extension settings
								</button>
							</p>
						</div>
					) : fileAccess && !IS_FIREFOX ? (
						<p className="text-pretty">
							Tip: drag a .md file onto any tab, or open one from your file manager — it opens here.
						</p>
					) : null}
					{canWrite ? null : (
						<p className="text-pretty">
							This browser can't write to files on disk, so saving downloads a copy you can use to replace the original.
						</p>
					)}
				</div>
			</div>
		</div>
	);
}
