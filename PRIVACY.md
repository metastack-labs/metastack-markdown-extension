# Privacy policy

_Last updated 31 October 2026_

MetaStack Markdown is a browser extension for reading and editing Markdown files on your own computer. It is built so that your documents stay there.

## What the extension doesn't do

- It doesn't send your documents, file names or anything else to MetaStack Labs or anyone else. It has no accounts, analytics, telemetry, advertising or tracking, and it makes no network requests of its own.
- It doesn't sell, share or transfer any data.
- It doesn't load or run code from the internet. Everything it runs ships inside the extension.

## What it reads and keeps on your device

| Data | Where it's kept | Why | How long |
| --- | --- | --- | --- |
| The Markdown files and folders you open | In the open workspace tab | To show and edit them | Until you close the tab |
| The text of a local file the browser opened (a `file://` page), its address, and the list of files in its folder | The extension's local storage | To hand the file from the browser's tab to the workspace | Deleted after 7 days; at most 20 are kept |
| Folders you choose to keep (Chrome and Edge) | The extension's IndexedDB, as the browser's file-access handles, with the folder name and when it was added and last opened. File contents are not stored | To reopen those folders in later sessions | Until you remove the folder from the sidebar |
| Your settings (theme, text size, layout) | The extension's local storage | To remember your preferences | Until you change them |

The workspace page's address includes the path of the open file, so it appears in your browser history like any other page you visit.

Uninstalling the extension deletes everything it stored.

## Saving files

In Chrome and Edge, the extension writes to a file on your disk only after you grant access to that file or its folder through the browser's own permission prompt, and only when you save or tick a task in the preview. In Firefox, saving downloads a copy through the browser's download manager.

## Content inside your documents

Documents can point to things on the internet. When a document includes an image hosted on another website, your browser loads that image from that website to show it, as it would on any web page, and the website receives the usual request details, such as your IP address. Links open only when you click them.

## Permissions

- **Storage** keeps your settings and the hand-off data described above.
- **Access to `file://` pages** lets a small script run on local files the browser opens, so Markdown files and folder listings open in the workspace. It never runs on websites. Chrome and Edge run it only after you turn on **Allow access to file URLs** for the extension.

## Changes

If the way the extension handles data changes, this page and its date will be updated in the same release. Earlier versions are in the [repository history](https://github.com/metastack-labs/metastack-markdown-extension/commits/main/PRIVACY.md).

## Contact

Questions about privacy: [open an issue](https://github.com/metastack-labs/metastack-markdown-extension/issues) on GitHub.
