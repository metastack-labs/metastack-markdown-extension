# Changelog

Notable changes to MetaStack Markdown. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/). The release workflow publishes the section matching the tagged version as the GitHub release notes.

## [Unreleased]

## [0.1.0] - Unreleased

First public release.

### Added

- A workspace page for local Markdown: drop files or folders onto it, or use the file and folder pickers.
- Markdown files and folder listings the browser opens (`file://`) open in the workspace instead of as plain text.
- GitHub-style rendering: tables, task lists, footnotes, alerts, syntax highlighting, KaTeX math, Mermaid diagrams, front matter, heading anchors and an "On this page" outline.
- Read, Edit and Split views with a CodeMirror source editor. Saving keeps the file exactly as written, including its line endings.
- Chrome and Edge save in place, remember opened folders, and warn before overwriting a file that changed on disk. Firefox saves by downloading a copy.
- New documents, task checkboxes you can tick in the preview, light and dark themes, and reading settings.
- MDX components render the way they do in MetaStack: `PromptBlock` (with Copy prompt), `Callout`, `GuideImage`, `ShotPlaceholder`, `Steps`, `Checklist`, `Kbd` and `PullQuote`. Props are read as plain text and never run; unknown components and invalid props show as written, with the reason.
- `.mdx` files hide `{/* comments */}` and `import`/`export` lines.
- Root-relative images (`/media/…`) resolve against the nearest enclosing folder that has them.
