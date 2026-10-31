# Store listing

Copy and answers for the Chrome Web Store, Firefox Add-ons (AMO) and Edge Add-ons. Keep this file in step with [PRIVACY.md](../PRIVACY.md) and the manifest. `scripts/verify-build.ts` fails the build if the permissions drift from what's justified here.

## Shared fields

| Field | Value |
| --- | --- |
| Name | MetaStack Markdown |
| Summary | Drop local Markdown files or folders into your browser to read, edit and organise them. |
| Language | English |
| Homepage | https://github.com/metastack-labs/metastack-markdown-extension |
| Support | https://github.com/metastack-labs/metastack-markdown-extension/issues |
| Privacy policy | https://github.com/metastack-labs/metastack-markdown-extension/blob/main/PRIVACY.md |
| Licence | MIT |

The name and summary come from `public/_locales/en/messages.json`; change them there first.

## Description

Use this for Chrome and Edge. For Firefox, replace the "Open .md files from anywhere" paragraph and the last note with the Firefox versions below.

```text
MetaStack Markdown turns your browser into a workspace for the Markdown files on your computer. Drop in a file or a whole folder to read it, edit it and keep it organised. Your documents stay on your computer.

READ
• GitHub-style rendering: tables, task lists, footnotes, alerts, syntax highlighting, math and Mermaid diagrams
• An outline of the headings, plus word count and reading time
• Relative links and images open from the document's own folder
• Light and dark themes, with adjustable text size, line spacing and page width

EDIT
• Read, Edit and Split views, with a live preview as you type
• Saves exactly what you wrote: nothing is reformatted and line endings are kept
• Tick task-list checkboxes right in the preview

ORGANISE
• Open folders and browse them in a sidebar that hides ignored and dependency folders
• Create new documents in the open folder
• Your folders are remembered between sessions, and changes save straight to disk

OPEN .MD FILES FROM ANYWHERE
Turn on "Allow access to file URLs" in the extension's details, and any Markdown file you open in the browser, by dragging it onto a tab or from your file manager, opens in the workspace instead of as plain text.

PRIVATE BY DESIGN
No accounts, no analytics and no network requests of its own. Your browser reads and saves your files directly.

Open source under the MIT licence: https://github.com/metastack-labs/metastack-markdown-extension
```

Firefox versions of the two changed parts:

```text
OPEN .MD FILES FROM ANYWHERE
Any Markdown file you open in Firefox, by dragging it onto a tab or from your file manager, opens in the workspace instead of as plain text.
```

```text
A NOTE ON SAVING
Firefox doesn't let extensions write to files on disk, so Save downloads a copy of your document. Everything else works the same as in Chrome.
```

In the Firefox description, also remove the last Organise bullet: remembering folders and saving to disk work only in Chrome and Edge.

## Chrome Web Store

**Store listing**

- Category: Developer Tools
- Graphic assets:
  - Store icon: [`public/icons/128.png`](../public/icons/128.png)
  - Small promo tile (440×280): [`assets/brand/store/promo-small.v1.png`](../assets/brand/store/promo-small.v1.png)
  - Marquee (1400×560, optional): [`assets/brand/store/marquee.v1.png`](../assets/brand/store/marquee.v1.png)
  - Screenshots (1280×800, 1–5): see [Screenshots](#screenshots)

**Privacy practices**

| Field | Answer |
| --- | --- |
| Single purpose | View, edit and organise Markdown files stored on the user's computer. |
| `storage` justification | Keeps the user's display settings. When the browser opens a local Markdown file, it briefly holds that file's text so the extension's workspace page can show it; these entries are deleted after 7 days. |
| Host permission justification (`file:///*`) | A content script runs only on `file://` pages, never on websites. When the browser opens a local Markdown file or folder listing, it reads that text or listing and opens it in the extension's workspace. |
| Remote code | No, I am not using remote code. |
| Data usage | Tick **Website content**: the extension reads the Markdown files the user opens, on the device only. The Chrome Web Store asks for disclosure even when data never leaves the device. Then tick all three certifications. |
| Privacy policy URL | https://github.com/metastack-labs/metastack-markdown-extension/blob/main/PRIVACY.md |

## Firefox Add-ons

- Upload `.output/*-firefox.zip`. When asked whether the add-on needs source code to review, choose **Yes** and upload `.output/*-sources.zip`.
- Compatibility: Firefox only, not Firefox for Android.
- Categories: Web Development
- Licence: MIT License
- Privacy policy: paste [PRIVACY.md](../PRIVACY.md) (optional for add-ons that collect no data, but it saves reviewer questions).
- Notes to reviewer: "Build instructions and notes are in SOURCE_CODE_REVIEW.md at the root of the sources zip."
- Screenshots: the same images as the Chrome Web Store.

## Edge Add-ons

Upload the Chrome zip (`.output/*-chrome.zip`) in Partner Center and reuse the Chrome listing, privacy answers and images.

## Screenshots

The stores need real captures of the extension, not mock-ups. Capture each one at exactly 1280×800:

1. Open the workspace, then DevTools (<kbd>F12</kbd>), turn on the device toolbar (<kbd>Ctrl</kbd>/<kbd>⌘</kbd> <kbd>Shift</kbd> <kbd>M</kbd>), and set **Responsive** to 1280 × 800 with a device pixel ratio of 1.
2. From the device toolbar's **⋮** menu, choose **Capture screenshot**.

Suggested set, using the files in [`examples/`](../examples):

1. `examples/README.md` in Read view, light theme, with the sidebar and outline open.
2. The same document in Split view, mid-edit.
3. `examples/math-and-diagrams.md` in dark theme.
4. `examples/syntax-highlighting.md` in dark theme.
5. The welcome screen with a folder being dragged in.

Save them as `assets/brand/store/screenshot-<n>.v1.png` and add each to [`assets/brand/assets.json`](../assets/brand/assets.json).
