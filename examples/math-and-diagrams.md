# Math & Diagrams Demo

## KaTeX Inline Math

Einstein's famous equation $E = mc^2$ changed physics forever. The quadratic formula $x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}$ solves any second-degree polynomial equation.

In statistics, the standard deviation is $\sigma = \sqrt{\frac{1}{N}\sum_{i=1}^{N}(x_i - \mu)^2}$ where $\mu$ is the mean.

## KaTeX Display Math

The Fourier Transform:

$$F(\omega) = \int_{-\infty}^{\infty} f(t) \, e^{-i\omega t} \, dt$$

Euler's identity, often called the most beautiful equation in mathematics:

$$e^{i\pi} + 1 = 0$$

Maxwell's equations in differential form:

$$\nabla \cdot \mathbf{E} = \frac{\rho}{\epsilon_0}$$

$$\nabla \times \mathbf{B} = \mu_0 \mathbf{J} + \mu_0 \epsilon_0 \frac{\partial \mathbf{E}}{\partial t}$$

The Schrödinger equation:

$$i\hbar \frac{\partial}{\partial t} \Psi(\mathbf{r}, t) = \hat{H} \Psi(\mathbf{r}, t)$$

## Mermaid Flowchart

```mermaid
flowchart TD
    A[User visits file:// URL] --> B{Is it a Markdown file?}
    B -->|Yes| C[Parse with Marked]
    B -->|No| D{Is it JSON?}
    D -->|Yes| E[Pretty-print / Explorer]
    D -->|No| F{Is it CSV?}
    F -->|Yes| G[Render as table]
    F -->|No| H{Directory?}
    H -->|Yes| I[Show file browser]
    H -->|No| J[Show raw text]
    C --> K[Render with syntax highlighting]
    K --> L[Setup TOC, lightbox, anchors]
```

## Mermaid Sequence Diagram

```mermaid
sequenceDiagram
    participant User
    participant ContentScript
    participant Background
    participant Offscreen
    participant FileSystem

    User->>ContentScript: Click "Save"
    ContentScript->>Background: file-save request
    Background->>Offscreen: save-file message
    Offscreen->>Offscreen: Find stored handle
    alt Handle found
        Offscreen->>FileSystem: Write file
        FileSystem-->>Offscreen: Success
        Offscreen-->>Background: { ok: true }
    else No handle
        Offscreen-->>Background: { needsGrant: true }
        Background->>User: Open grant window
        User->>Background: Select directory
        Background->>Offscreen: Retry save
        Offscreen->>FileSystem: Write file
        Offscreen-->>Background: { ok: true }
    end
    Background-->>ContentScript: Result
    ContentScript-->>User: "Saved!"
```

## Mermaid Class Diagram

```mermaid
classDiagram
    class Settings {
        +string theme
        +boolean showTitles
        +boolean jsonExplorer
        +boolean leftOpen
        +boolean rightOpen
        +number fontSize
        +number lineHeight
    }

    class DirEntry {
        +string name
        +boolean isDir
        +string url
    }

    class TocEntry {
        +string id
        +string text
        +number level
    }

    Settings --> DirEntry : configures display
    TocEntry --> DirEntry : navigates to
```
