# MetaStack Markdown

A browser extension for Chrome, Edge and Firefox that turns the browser into a workspace for your local Markdown. Drop files or whole folders onto the page to read them beautifully, edit them in place, and keep them organised — nothing leaves your computer.

## Features

- **Drag and drop** Markdown files or folders onto the workspace, or open them with the file and folder pickers.
- **Open `.md` files from anywhere** — drag one onto any tab or open it from your file manager and it opens in the workspace instead of as plain text. Local folder listings (`file:///…/`) open there too.
- **GitHub-quality rendering** — GFM tables, task lists, footnotes, alerts (`> [!NOTE]`), syntax highlighting, KaTeX math, Mermaid diagrams, front matter, heading anchors, an "On this page" outline with scroll tracking, and relative images and links resolved against the folder.
- **Lossless editing** — a CodeMirror 6 source editor with Read, Edit and Split (live preview) views. Files are saved exactly as written; nothing is reformatted.
- **Real saves** (Chrome/Edge) — writes straight back to the file on disk, detects when another app changed it, and reloads live when the file changes while you're only reading.
- **Folders that stick** (Chrome/Edge) — opened folders are remembered across sessions, with `.gitignore` and `node_modules`-style folders hidden from the tree.
- **Manage documents** — create new documents in the current folder, check off tasks right in the preview, copy or download Markdown, print.
- Light and dark themes, adjustable text size, line spacing and page width, resizable panels, keyboard shortcuts.

## Use it locally

```bash
bun install
bun run build
```

**Chrome / Edge**

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and choose `.output/chrome-mv3`.
3. Open the extension's **Details** and turn on **Allow access to file URLs** — this lets `.md` files you drag onto a tab open in the workspace.
4. Click the toolbar icon (or press <kbd>Alt</kbd> <kbd>Shift</kbd> <kbd>M</kbd>) to open the workspace.

**Firefox**

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…** and choose `.output/firefox-mv2/manifest.json`.

Temporary add-ons are removed when Firefox quits. For a permanent install, sign the add-on through [addons.mozilla.org](https://addons.mozilla.org/developers/) (it can be unlisted).

Try it with the sample documents in [`examples/`](./examples): open that folder in the workspace.

## Development

Requires [Bun](https://bun.sh) 1.3+ and Node 24+.

| Command                           | What it does                                                                            |
| --------------------------------- | --------------------------------------------------------------------------------------- |
| `bun run dev`                     | Chrome with hot reload (WXT launches a dev browser profile)                             |
| `bun run dev:firefox`             | Same, in Firefox                                                                        |
| `bun run build`                   | Production builds for Chrome (`.output/chrome-mv3`) and Firefox (`.output/firefox-mv2`) |
| `bun run zip`                     | Store-ready zips in `.output/` (Firefox also gets a sources zip for review)             |
| `bun run typecheck`               | `tsc --noEmit`                                                                          |
| `bun run lint` / `bun run format` | Biome check / fix                                                                       |
| `bun run test`                    | Unit tests with `node --test`                                                           |
| `bun run check`                   | Typecheck, lint, test and build — run before every PR                                   |

`bunfig.toml` refuses package versions published less than 7 days ago, as a supply-chain guard.

## How it works

```
 file:///…/notes.md ──► content script ──► background ──► workspace.html?src=…
 (browser's text view)   reads the text,     stores the       renders, edits,
                         lists the folder     handoff          saves
 drag & drop / pickers ────────────────────────────────────────► workspace.html
```

- **Workspace page** (`src/entrypoints/workspace`, `src/app`) — the whole app: one React page for viewing, editing and organising. The toolbar button and the <kbd>Alt</kbd> <kbd>Shift</kbd> <kbd>M</kbd> shortcut open it.
- **File hand-off** (`src/entrypoints/file-viewer.content.ts`, `src/lib/handoff.ts`) — on `file://` pages the content script reads what the browser already loaded (the raw Markdown, or a folder listing via a hidden frame), the background stores it in `storage.local`, and the tab is replaced with the workspace.
- **Files** (`src/lib/fs`) — one tree model over four sources: File System Access handles (read/write), drag-and-drop entries, `<input webkitdirectory>` files, and `file://` URLs.
- **Rendering** (`src/lib/markdown`) — `marked` with GitHub-compatible heading slugs, alerts, footnotes and math tokenizers; every result passes through DOMPurify before it reaches the page. KaTeX and Mermaid load only when a document uses them.

### Saving, per browser

| Opened via                                     | Chrome / Edge                                            | Firefox          |
| ---------------------------------------------- | -------------------------------------------------------- | ---------------- |
| Folder picker, or dropping a folder or file    | Saves in place                                           | Downloads a copy |
| A `.md` file opened by the browser (`file://`) | Asks once for the containing folder, then saves in place | Downloads a copy |
| New document                                   | Created in the open folder                               | Downloads a copy |

Firefox doesn't implement the File System Access API, so it can't write to files on disk; everything else works the same.

## Publishing

1. Bump `version` in `package.json`.
2. `bun run check && bun run zip`.
3. **Chrome Web Store** — upload `.output/*-chrome.zip`. Permission notes for review: `storage` keeps settings and hands local files to the workspace; the `file:///*` content script opens local Markdown in the workspace and runs only when the user enables file access.
4. **Firefox Add-ons** — upload `.output/*-firefox.zip` and the matching `*-sources.zip`. The linter reports `eval`/`innerHTML` warnings from bundled Mermaid, Cytoscape and DOMPurify; extension code inserts only DOMPurify-sanitized HTML.

WXT can automate both submissions with `wxt submit`; see the [WXT publishing guide](https://wxt.dev/guide/essentials/publishing).

## Privacy

The extension makes no network requests of its own and collects nothing. Documents are read from and written to your disk directly. Remote images referenced by a document load from their own hosts, as they would on GitHub.

## Project layout

```
src/
  entrypoints/      background, file:// content script, workspace page
  app/              React workspace: state (use-workspace.ts), components
  lib/markdown/     rendering, sanitising, math/diagram hydration, task lists
  lib/fs/           file tree model, saving, saved folders, drag-and-drop intake
  lib/              settings and the file hand-off contract
  styles/           tokens, reading typography, code colours
examples/           sample documents for manual checks
public/_locales/    extension name and description
```
