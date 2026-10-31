# Alerts & Formatting Demo

## GitHub-style Alerts

> [!NOTE]
> This is a note alert. Use it for additional context or helpful information that users should be aware of.

> [!TIP]
> This is a tip alert. Use it for suggestions that help users get the most out of something.

> [!IMPORTANT]
> This is an important alert. Use it for critical information that users need to know.

> [!WARNING]
> This is a warning alert. Use it for urgent information that requires immediate attention.

> [!CAUTION]
> This is a caution alert. Use it for actions that could cause irreversible consequences.

## Tables

| Feature | Status | Priority | Bundle Impact |
|---------|--------|----------|--------------|
| Syntax highlighting | Done | High | +150KB (bundled) |
| Mermaid diagrams | Done | High | CDN lazy-load |
| KaTeX math | Done | Medium | CDN lazy-load |
| Copy code button | Done | High | ~1KB |
| Image lightbox | Done | Medium | ~2KB |
| GFM alerts | Done | Medium | ~3KB |
| Heading anchors | Done | Low | ~1KB |
| Word count | Done | Low | ~0.5KB |

## Text Formatting

This paragraph has **bold text**, *italic text*, ~~strikethrough~~, and `inline code`. You can also combine them: ***bold italic***, **`bold code`**, and *`italic code`*.

## Task Lists

- [x] Implement syntax highlighting
- [x] Add copy code button
- [x] Mermaid diagram support
- [x] Image lightbox
- [x] KaTeX math rendering
- [x] Font size / line height controls
- [x] GitHub-style alerts
- [x] Word count / reading time
- [x] Heading anchor links
- [ ] Native messaging host (future)
- [ ] Auto-refresh on file change (future)

## Blockquotes

> "The best way to predict the future is to invent it."
> — Alan Kay

> Nested blockquotes work too:
>
> > This is a nested blockquote.
> > It can contain **formatted text** and `code`.

## Headings with Duplicate Names

The following headings test the unique ID generation:

### What it is

This is the first "What it is" section.

### Details

Some details here.

### What it is

This is the second "What it is" section — it should have a unique ID (`what-it-is-1`) and the TOC should correctly link to each one independently.

### What it is

Third one! ID should be `what-it-is-2`. Click each in the sidebar to verify they scroll to the correct heading.

## Horizontal Rules

Content above the rule.

---

Content below the rule.

## Links

- [External link](https://github.com) opens in a new tab
- [Relative link](./syntax-highlighting.md) navigates within the viewer
- [Another relative link](./math-and-diagrams.md)

## Images

Here's a placeholder to test the lightbox (click to zoom):

![Placeholder](https://via.placeholder.com/800x400/1a1b1f/4b9efa?text=Click+to+open+lightbox)

## Lists

### Ordered List

1. First item
2. Second item
   1. Sub-item A
   2. Sub-item B
3. Third item

### Unordered List

- Item one
  - Nested item
    - Deeply nested
  - Another nested
- Item two
- Item three

## Code Without Language

```
This is a code block without a specified language.
It should still be styled as a code block with a copy button.
The auto-detect feature of highlight.js may try to identify it.
```
