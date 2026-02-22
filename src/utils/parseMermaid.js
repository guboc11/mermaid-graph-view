// Operators ordered by length (longer first to avoid partial matches)
const OPERATORS = [
  { op: '<|--', type: 'inheritance', sourceIdx: 1, targetIdx: 0 },
  { op: '--|>', type: 'inheritance', sourceIdx: 0, targetIdx: 1 },
  { op: '<|..', type: 'realization', sourceIdx: 1, targetIdx: 0 },
  { op: '..|>', type: 'realization', sourceIdx: 0, targetIdx: 1 },
  { op: '--*', type: 'composition', sourceIdx: 1, targetIdx: 0 },
  { op: '*--', type: 'composition', sourceIdx: 0, targetIdx: 1 },
  { op: '--o', type: 'aggregation', sourceIdx: 1, targetIdx: 0 },
  { op: 'o--', type: 'aggregation', sourceIdx: 0, targetIdx: 1 },
  { op: '<--', type: 'association', sourceIdx: 1, targetIdx: 0 },
  { op: '-->', type: 'association', sourceIdx: 0, targetIdx: 1 },
  { op: '<..', type: 'dependency', sourceIdx: 1, targetIdx: 0 },
  { op: '..>', type: 'dependency', sourceIdx: 0, targetIdx: 1 },
  { op: '--', type: 'link', sourceIdx: 0, targetIdx: 1 },
];

function tryParseRelationship(line) {
  for (const { op, type, sourceIdx, targetIdx } of OPERATORS) {
    const idx = line.indexOf(op);
    if (idx === -1) continue;

    const left = line.substring(0, idx).trim();
    const rest = line.substring(idx + op.length).trim();

    let right = rest;
    let label = '';
    const colonMatch = rest.match(/^(\w+)\s*:\s*(.+)$/);
    if (colonMatch) {
      right = colonMatch[1];
      label = colonMatch[2].trim();
    } else {
      right = rest.split(/\s/)[0];
    }

    if (!left.match(/^\w+$/) || !right.match(/^\w+$/)) continue;

    const parts = [left, right];
    return {
      source: parts[sourceIdx],
      target: parts[targetIdx],
      type,
      label,
    };
  }
  return null;
}

export function parseMermaidClassDiagram(input) {
  const nodeMap = new Map();
  const links = [];

  const addNode = (name) => {
    if (name && !nodeMap.has(name)) {
      nodeMap.set(name, { id: name, members: [], stereotype: null });
    }
  };

  const rawLines = input.split('\n').map((l) => l.trim());
  const lines = rawLines.filter(
    (l) => l && !l.startsWith('%%') && !l.startsWith('note')
  );

  let i = 0;
  if (lines[i] === 'classDiagram') i++;

  while (i < lines.length) {
    const line = lines[i];

    // Skip namespace keyword
    if (line.startsWith('namespace')) {
      i++;
      continue;
    }

    // Skip bare braces (from namespace blocks)
    if (line === '{' || line === '}') {
      i++;
      continue;
    }

    // Class declaration: class ClassName ["display name"] [{]
    const classMatch = line.match(/^class\s+(\w+)(?:\s+"[^"]*")?(?:\s*\{)?/);
    if (classMatch) {
      const name = classMatch[1];
      addNode(name);

      if (line.includes('{')) {
        if (!line.includes('}')) {
          // Multi-line body
          i++;
          while (i < lines.length && !lines[i].startsWith('}')) {
            const member = lines[i].trim();
            if (member.startsWith('<<') && member.endsWith('>>')) {
              nodeMap.get(name).stereotype = member.replace(/[<>]/g, '').trim();
            } else if (member) {
              nodeMap.get(name).members.push(member);
            }
            i++;
          }
        } else {
          // Inline body: class Foo { +method() }
          const bodyMatch = line.match(/\{([^}]*)\}/);
          if (bodyMatch) {
            bodyMatch[1].split(',').forEach((m) => {
              const member = m.trim();
              if (member) nodeMap.get(name).members.push(member);
            });
          }
        }
      }
      i++;
      continue;
    }

    // Relationship line
    const rel = tryParseRelationship(line);
    if (rel && rel.source !== rel.target) {
      addNode(rel.source);
      addNode(rel.target);
      links.push(rel);
      i++;
      continue;
    }

    i++;
  }

  return {
    nodes: Array.from(nodeMap.values()),
    links,
  };
}

// ── Flowchart parser ───────────────────────────────────────────────────────

const NODE_SHAPE_RE = /^(\w+)(?:\[\[([^\]]*)\]\]|\[\(([^)]*)\)\]|\(\(([^)]*)\)\)|\[([^\]]*)\]|\(([^)]*)\)|\{([^}]*)\})?$/;

function parseNodeToken(token) {
  const m = token.trim().match(NODE_SHAPE_RE);
  if (!m) return null;
  const id = m[1];
  const label = m[2] ?? m[3] ?? m[4] ?? m[5] ?? m[6] ?? m[7] ?? null;
  return { id, label: label !== null ? label.trim() : id };
}

const PIPE_LABEL_RE  = /^(.+?)\s*(-.->|==>|-->|---)\|([^|]*)\|\s*(.+)$/;
const SPACE_LABEL_RE = /^(.+?)\s+--\s+(.+?)\s+(-->|==>)\s+(.+)$/;
const BARE_EDGE_RE   = /^(.+?)\s*(-.->|==>|-->|---)\s*(.+)$/;

export function parseMermaidFlowchart(input) {
  const nodeMap = new Map();
  const links = [];

  const OPERATOR_MAP = {
    '-.->': 'dependency', '==>': 'composition',
    '-->': 'association', '---': 'link',
  };

  const addNode = (id, label) => {
    if (!id) return;
    if (!nodeMap.has(id)) {
      nodeMap.set(id, { id, label: label ?? id, members: [], stereotype: null });
    } else if (label !== null && nodeMap.get(id).label === id) {
      nodeMap.get(id).label = label;
    }
  };

  const lines = input.split('\n').map(l => l.trim())
    .filter(l => l && !l.startsWith('%%'));

  for (const line of lines) {
    if (/^(graph|flowchart)\s+\w+/i.test(line)) continue;
    if (/^subgraph\b/i.test(line) || /^end\s*$/.test(line)) continue;
    if (/^(style|classDef|class|linkStyle|click)\b/i.test(line)) continue;

    let parsed = false;

    // 1. Pipe label:  A -->|label| B
    let m = line.match(PIPE_LABEL_RE);
    if (m) {
      const s = parseNodeToken(m[1]), t = parseNodeToken(m[4]);
      if (s && t) {
        addNode(s.id, s.label !== s.id ? s.label : null);
        addNode(t.id, t.label !== t.id ? t.label : null);
        links.push({ source: s.id, target: t.id, type: OPERATOR_MAP[m[2]], label: m[3].trim() });
        parsed = true;
      }
    }

    // 2. Space label:  A -- text --> B
    if (!parsed) {
      m = line.match(SPACE_LABEL_RE);
      if (m) {
        const s = parseNodeToken(m[1]), t = parseNodeToken(m[4]);
        if (s && t) {
          addNode(s.id, s.label !== s.id ? s.label : null);
          addNode(t.id, t.label !== t.id ? t.label : null);
          links.push({ source: s.id, target: t.id, type: OPERATOR_MAP[m[3]], label: m[2].trim() });
          parsed = true;
        }
      }
    }

    // 3. Bare edge:  A --> B
    if (!parsed) {
      m = line.match(BARE_EDGE_RE);
      if (m) {
        const s = parseNodeToken(m[1]), t = parseNodeToken(m[3]);
        if (s && t) {
          addNode(s.id, s.label !== s.id ? s.label : null);
          addNode(t.id, t.label !== t.id ? t.label : null);
          links.push({ source: s.id, target: t.id, type: OPERATOR_MAP[m[2]], label: '' });
          parsed = true;
        }
      }
    }

    // 4. Standalone node declaration:  A[Start]
    if (!parsed) {
      const n = parseNodeToken(line);
      if (n) addNode(n.id, n.label !== n.id ? n.label : null);
    }
  }

  return { nodes: Array.from(nodeMap.values()), links };
}

export function parseMermaid(input) {
  const first = input.split('\n').map(l => l.trim())
    .find(l => l && !l.startsWith('%%'));
  if (!first) return { nodes: [], links: [] };

  if (/^(graph|flowchart)\s+\w+/i.test(first)) {
    return parseMermaidFlowchart(input);
  }
  return parseMermaidClassDiagram(input);
}
