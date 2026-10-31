<p align="center">
  <img src="public/icons/128.png" width="96" height="96" alt="">
</p>

<h1 align="center">MetaStack Markdown</h1>

<p align="center">
  Read, edit and organise the Markdown files on your computer, right in Chrome, Edge or Firefox.<br>
  Drop in a file or a whole folder. Nothing leaves your computer.
</p>

<p align="center">
  <a href="https://github.com/metastack-labs/metastack-markdown-extension/actions/workflows/ci.yml"><img src="https://github.com/metastack-labs/metastack-markdown-extension/actions/workflows/ci.yml/badge.svg" alt="CI status"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License"></a>
</p>

## Features

- **Drag and drop** Markdown files or folders onto the workspace, or open them with the file and folder pickers.
- **Open `.md` files from anywhere.** Drag one onto any tab or open it from your file manager, and it opens in the workspace instead of as plain text. Local folder listings (`file:///…/`) open there too.
- **GitHub-style rendering:** tables, task lists, footnotes, alerts (`> [!NOTE]`), syntax highlighting, KaTeX math, Mermaid diagrams, front matter, heading anchors, and an "On this page" outline that follows your scroll. Relative images and links resolve against the document's folder.
- **Lossless editing** in Read, Edit and Split (live preview) views. Files are saved exactly as written, line endings included; nothing is reformatted.
- **Real saves** (Chrome and Edge): changes go straight back to the file on disk, with a warning if another app changed it first, and the view reloads when the file changes while you're reading.
- **Folders that stick** (Chrome and Edge): opened folders are remembered across sessions, and `.gitignore`d and dependency folders are hidden from the tree.
- **Manage documents:** create new ones in the current folder, tick tasks in the preview, copy or download Markdown, print.
- Light and dark themes, adjustable text size, line spacing and page width, resizable panels and keyboard shortcuts.

## Install

The Chrome Web Store and Firefox Add-ons listings are on their way. Until then:

**Chrome or Edge, from a release**

1. Download `metastack-markdown-extension-<version>-chrome.zip` from [Releases](https://github.com/metastack-labs/metastack-markdown-extension/releases) and unzip it.
2. Open `chrome://extensions` (or `edge://extensions`), turn on **Developer mode**, click **Load unpacked** and choose the unzipped folder.

**Firefox, from source**

Build it (see [Development](#development)), open `about:debugging#/runtime/this-firefox`, click **Load Temporary Add-on…** and choose `.output/firefox-mv2/manifest.json`. Temporary add-ons are removed when Firefox quits.

**Then**

- Click the toolbar button, or press <kbd>Alt</kbd> <kbd>Shift</kbd> <kbd>M</kbd>, to open the workspace.
- In Chrome and Edge, open the extension's **Details** and turn on **Allow access to file URLs** so `.md` files you open in the browser open in the workspace.
- Try it with the sample documents in [`examples/`](examples): open that folder in the workspace.

### Saving, per browser

| Opened via | Chrome and Edge | Firefox |
| --- | --- | --- |
| Folder picker, or dropping a folder or file | Saves in place | Downloads a copy |
| A `.md` file opened by the browser (`file://`) | Asks once for the containing folder, then saves in place | Downloads a copy |
| New document | Created in the open folder | Downloads a copy |

Firefox doesn't let extensions write to files on disk, so it downloads a copy instead; everything else works the same.

## Privacy

No accounts, analytics or network requests of its own: your documents are read from and saved to your disk by your browser. Remote images referenced by a document load from their own hosts, as they would on GitHub. The full details are in the [privacy policy](PRIVACY.md).

## Development

Requires [Bun](https://bun.sh) 1.3 and [Node.js](https://nodejs.org) 24.

```bash
bun install
bun run dev
```

| Command | What it does |
| --- | --- |
| `bun run dev` / `dev:firefox` | Hot-reloading dev build in a fresh Chrome or Firefox profile |
| `bun run build` | Production builds in `.output/chrome-mv3` and `.output/firefox-mv2` |
| `bun run check` | Typecheck, Biome, unit tests, both builds and the manifest checks. Run it before every pull request |
| `bun run zip` | Store-ready zips in `.output/`, plus the Firefox sources zip |
| `bun run verify:sources` | Rebuilds the Firefox add-on from its sources zip and checks it's identical, as Mozilla's reviewers will |
| `bun run brand` | Re-renders the icons and store images from the MetaStack mark |
| `bun run test` | Unit tests with `node --test` |
| `bun run lint` / `format` | Biome check / fix |

`bunfig.toml` refuses package versions published less than 7 days ago, as a supply-chain guard.

### How it works

```
 file:///…/notes.md ──► content script ──► background ──► workspace.html?src=…
 (browser's text view)   reads the text,     stores the       renders, edits,
                         lists the folder     hand-off         saves
 drag & drop / pickers ────────────────────────────────────────► workspace.html
```

- **Workspace page** (`src/entrypoints/workspace`, `src/app`): the whole app, one React page for viewing, editing and organising.
- **File hand-off** (`src/entrypoints/file-viewer.content.ts`, `src/lib/handoff.ts`): on `file://` pages, the content script reads what the browser already loaded (the raw Markdown, or a folder listing via a hidden frame), the background stores it in `storage.local`, and the tab is replaced with the workspace.
- **Files** (`src/lib/fs`): one tree model over four sources: File System Access handles (read and write), drag-and-drop entries, `<input webkitdirectory>` files, and `file://` URLs.
- **Rendering** (`src/lib/markdown`): `marked` with GitHub-compatible heading slugs, alerts, footnotes and math. Every result passes through DOMPurify before it reaches the page. KaTeX and Mermaid load only when a document uses them.

### Project layout

```
src/
  entrypoints/      background, file:// content script, workspace page
  app/              React workspace: state (use-workspace.ts), components
  lib/markdown/     rendering, sanitising, math and diagrams, task lists
  lib/fs/           file tree model, saving, saved folders, drag-and-drop intake
  lib/              settings and the file hand-off contract
  styles/           tokens, reading typography, code colours
  assets/           the MetaStack mark
public/             icons and the extension's name and description
scripts/            brand rendering, build and source verification
assets/brand/       store images and their provenance
docs/               store listing copy and the publishing runbook
examples/           sample documents
```

## Releasing

Tag a version and the Release workflow builds, verifies and drafts a GitHub release; a second workflow submits it to the stores. The steps, store listing copy and reviewer notes are in [docs/publishing.md](docs/publishing.md) and [docs/store-listing.md](docs/store-listing.md).

## Contributing

Issues and pull requests are welcome; see [CONTRIBUTING.md](CONTRIBUTING.md). Please report security issues privately as described in [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE) © MetaStack Labs
