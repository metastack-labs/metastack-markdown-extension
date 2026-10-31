# Security policy

## Supported versions

Security fixes go into the latest release, which the Chrome Web Store and Firefox Add-ons install automatically.

## Reporting a vulnerability

Please report vulnerabilities privately through GitHub: open the repository's **Security** tab and choose **Report a vulnerability**. Don't open a public issue.

Include what an attacker could do, the browser and extension version, and the steps or a sample file that reproduces it. We'll acknowledge the report, keep you updated while we work on a fix, and credit you in the release notes unless you'd rather we didn't.

## What's in scope

The extension renders untrusted files and can write to the user's disk, so these matter most:

- Script execution or HTML injection from a Markdown, HTML or SVG file, including via Mermaid diagrams or math.
- Writing to, or reading, a file the user didn't open or grant access to.
- Another extension or a web page sending messages that the extension acts on.
- Anything that sends document contents off the device.
