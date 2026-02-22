# Mermaid Graph Viewer

Turn your static Mermaid diagrams into interactive, draggable force-directed graphs — shareable via URL hash.

**[→ Live Demo](https://mermaid-graph-view.onrender.com)**

## Why

Static Mermaid diagrams break down once you have 20+ nodes — the fixed layout
makes exploration painful and sharing "look at this cluster" requires screenshots.

Mermaid Graph Viewer converts your syntax into a D3.js force simulation where
you can drag nodes freely, highlight connections on hover, and share the exact
diagram state via a URL hash. No backend. No sign-up.

## Key Features

- **Drag-and-drop nodes** — reposition freely with force simulation
- **Edge flow animation** — hold `Space` to animate all edges
- **Hover highlighting** — see connected nodes and edges instantly
- **URL hash sharing** — current diagram encoded in URL, no server needed
- **Node color tiers** — hubs vs leaves visualized by connection count

## Getting Started

```bash
pnpm install
pnpm dev
```

Open `http://localhost:5173` in your browser.

## Supported Diagram Types

The diagram type is detected automatically from the first non-comment line.

### Class Diagram

```
classDiagram
class Animal {
  <<abstract>>
  +name: String
  +speak() void
}
class Dog
Animal <|-- Dog : inherits
```

### Flowchart

```
flowchart TD
A[Start] -->|success| B[Process]
B --> C{Branch}
C -->|yes| D((Done))
C -->|no| E[Error]
E -.-> F[(Storage)]
```

```
graph LR
A ==> B
C --- D
```

## Interactions

| Action | Effect |
|--------|--------|
| Drag node | Move node freely |
| Double-click node | Pin / unpin node (amber dot indicator) |
| Hover node | Highlight connected nodes and edges |
| Scroll / pinch | Zoom in / out |
| Drag background | Pan |
| `Space` (hold) | Global flow mode — animates all edges with degree-based coloring |
| Fit button (`⊡`) | Auto-fit graph to viewport |
| Save button | Persist node positions to `localStorage` |
| Load button | Restore saved positions |

## Edge Types

| Syntax | Type | Color |
|--------|------|-------|
| `-->` | Association | Purple |
| `---` | Link | Gray |
| `-.->` | Dependency | Red (dashed) |
| `==>` | Composition | Blue |
| `<\|--` / `--\|>` | Inheritance | Orange |
| `--*` / `*--` | Composition | Blue |
| `--o` / `o--` | Aggregation | Green |
| `..\|>` / `<\|..` | Realization | Pink (dashed) |

## Node Shapes (Flowchart)

| Syntax | Shape |
|--------|-------|
| `A[text]` | Rectangle |
| `A(text)` | Rounded rectangle |
| `A((text))` | Circle |
| `A{text}` | Diamond |
| `A[[text]]` | Subroutine |
| `A[(text)]` | Cylinder |

## Node Color Tiers

Nodes are colored by their connection count relative to the most-connected node.

| Tier | Condition | Border Color |
|------|-----------|--------------|
| Isolated | 0 connections | Gray |
| Leaf | ≤ 33% of max | Blue |
| Normal | ≤ 66% of max | Green |
| Connected | ≤ 90% of max | Orange |
| Hub | > 90% of max | Red |

## Tech Stack

- React 19 + Vite
- D3.js (force simulation, zoom, drag)
- CodeMirror (editor)
