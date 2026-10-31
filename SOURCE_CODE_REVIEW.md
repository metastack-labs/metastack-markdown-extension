# Source code review

Notes for addons.mozilla.org reviewers. This archive holds the complete source of the Firefox add-on. The add-on is bundled and minified with [WXT](https://wxt.dev) and Vite, so this is the code as written, before bundling.

## Requirements

- macOS, Linux or Windows (tested on macOS 15 and Ubuntu 24.04)
- [Node.js](https://nodejs.org) 24
- [Bun](https://bun.sh) 1.3.11 (open source, MIT). Install it with `npm install --global bun@1.3.11`, or `curl -fsSL https://bun.sh/install | bash -s "bun-v1.3.11"`.

## Build

From the root of this archive:

```bash
bun install --frozen-lockfile
bun run build:firefox
```

The add-on is written to `.output/firefox-mv2/`. It is identical, file for file, to the uploaded package; we check that before every release by rebuilding from this archive.

## Notes

- **Dependencies** come from npm, pinned in `bun.lock`. No code is downloaded or run from the internet at runtime.
- **No data collection.** The manifest declares `data_collection_permissions.required: ["none"]`. Nothing leaves the device.
- **`innerHTML` and `eval` warnings** from the linter come from bundled libraries: React, DOMPurify, highlight.js, Mermaid and its dependencies (d3, Cytoscape, graphlib), and a CodeMirror grammar. The add-on's own code sets HTML in two places only: rendered Markdown after DOMPurify sanitisation (`src/lib/markdown/sanitize.ts`), and Mermaid's SVG output with Mermaid's `securityLevel: 'strict'` (`src/lib/markdown/enhance.ts`).
- **Manifest warning about Firefox for Android 140.** The add-on is for Firefox desktop only, so the manifest has no `gecko_android` key and it isn't offered for Android.
- **`file:///*` content script** (`src/entrypoints/file-viewer.content.ts`) reads a local Markdown file or folder listing the browser has opened and hands it to the add-on's own page. The background script accepts that message only from this content script on a `file://` page (`src/lib/handoff.ts`).
