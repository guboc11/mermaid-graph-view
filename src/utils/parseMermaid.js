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
