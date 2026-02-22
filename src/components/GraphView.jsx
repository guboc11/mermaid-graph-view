import { useEffect, useRef, useCallback, useState } from 'react';
import * as d3 from 'd3';


const REL_STYLES = {
  inheritance: { color: '#f97316', dashed: false, label: '상속' },
  composition: { color: '#3b82f6', dashed: false, label: '합성' },
  aggregation: { color: '#10b981', dashed: false, label: '집합' },
  association: { color: '#a78bfa', dashed: false, label: '연관' },
  dependency: { color: '#f43f5e', dashed: true, label: '의존' },
  realization: { color: '#ec4899', dashed: true, label: '실체화' },
  link: { color: '#6b7280', dashed: false, label: '링크' },
};

const STORAGE_KEY = 'mgv-layout';

const TIER_LEGEND = [
  { tier: 'isolated', stroke: '#64748b', label: '고립 (0)' },
  { tier: 'leaf',     stroke: '#3b82f6', label: 'Leaf (≤33%)' },
  { tier: 'normal',   stroke: '#10b981', label: 'Normal (≤66%)' },
  { tier: 'connected',stroke: '#f97316', label: 'Connected (≤90%)' },
  { tier: 'hub',      stroke: '#ef4444', label: 'Hub (>90%)' },
];

const readSavedLayout = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); }
  catch { return null; }
};

export default function GraphView({ nodes, links, graphKey }) {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const zoomRef = useRef(null);
  const simNodesRef = useRef([]);
  const pinnedNodesRef = useRef(new Set());
  const [localKey, setLocalKey] = useState(0);
  const [saveStatus, setSaveStatus] = useState(null); // null | 'saved' | 'no-data'
  const [showHelp, setShowHelp] = useState(false);

  const handleFit = useCallback(() => {
    if (!zoomRef.current || !svgRef.current) return;
    const { zoom, svg, g } = zoomRef.current;
    const svgEl = svgRef.current;
    const w = svgEl.clientWidth;
    const h = svgEl.clientHeight;
    const bounds = g.node().getBBox();
    if (!bounds.width || !bounds.height) return;
    const scale = Math.min(
      0.9,
      Math.min(w / bounds.width, h / bounds.height) * 0.85
    );
    const tx = w / 2 - scale * (bounds.x + bounds.width / 2);
    const ty = h / 2 - scale * (bounds.y + bounds.height / 2);
    svg
      .transition()
      .duration(600)
      .call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
  }, []);

  const handleSave = useCallback(() => {
    if (simNodesRef.current.length === 0) return;
    const positions = {};
    simNodesRef.current.forEach((n) => {
      positions[n.id] = {
        x: Math.round(n.x || 0),
        y: Math.round(n.y || 0),
        pinned: pinnedNodesRef.current.has(n.id),
      };
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus(null), 2000);
  }, []);

  const handleLoad = useCallback(() => {
    const saved = readSavedLayout();
    if (!saved) {
      setSaveStatus('no-data');
      setTimeout(() => setSaveStatus(null), 2000);
      return;
    }
    setLocalKey((k) => k + 1);
  }, []);

  const handleZoomIn = useCallback(() => {
    if (!zoomRef.current) return;
    const { zoom, svg } = zoomRef.current;
    svg.transition().duration(300).call(zoom.scaleBy, 1.4);
  }, []);

  const handleZoomOut = useCallback(() => {
    if (!zoomRef.current) return;
    const { zoom, svg } = zoomRef.current;
    svg.transition().duration(300).call(zoom.scaleBy, 1 / 1.4);
  }, []);

  useEffect(() => {
    if (!svgRef.current) return;

    const svgEl = svgRef.current;
    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();
    svg.on('.zoom', null);

    if (nodes.length === 0) return;

    const w = svgEl.clientWidth || 800;
    const h = svgEl.clientHeight || 600;

    // ── Saved layout ──────────────────────────────────────────────────────
    const savedLayout = readSavedLayout();

    // Clear pins for this graph render
    pinnedNodesRef.current.clear();

    // Deep copy for D3 mutation, apply saved positions if available
    const simNodes = nodes.map((n) => {
      const saved = savedLayout?.[n.id];
      if (saved) {
        if (saved.pinned) pinnedNodesRef.current.add(n.id);
        return saved.pinned
          ? { ...n, x: saved.x, y: saved.y, fx: saved.x, fy: saved.y }
          : { ...n, x: saved.x, y: saved.y };
      }
      return { ...n };
    });
    simNodesRef.current = simNodes;

    const simLinks = links.map((l) => ({
      source: l.source,
      target: l.target,
      type: l.type,
      label: l.label,
    }));

    // ── Degree (연결 수) ──────────────────────────────────────────────────
    const degreeMap = new Map(simNodes.map((n) => [n.id, 0]));
    simLinks.forEach((l) => {
      degreeMap.set(l.source, (degreeMap.get(l.source) || 0) + 1);
      degreeMap.set(l.target, (degreeMap.get(l.target) || 0) + 1);
    });
    const maxDegree = Math.max(...degreeMap.values(), 1);

    const radiusScale = d3.scaleLinear().domain([0, maxDegree]).range([16, 42]);

    const getNodeTier = (degree, maxDeg) => {
      if (degree === 0) return 'isolated';
      const ratio = degree / maxDeg;
      if (ratio <= 0.33) return 'leaf';
      if (ratio <= 0.66) return 'normal';
      if (ratio <= 0.90) return 'connected';
      return 'hub';
    };

    const TIER_STYLES = {
      isolated: { fill: '#1e2a3a', stroke: '#64748b' },
      leaf:     { fill: '#1e3a5f', stroke: '#3b82f6' },
      normal:   { fill: '#064e3b', stroke: '#10b981' },
      connected:{ fill: '#431407', stroke: '#f97316' },
      hub:      { fill: '#450a0a', stroke: '#ef4444' },
    };

    const nodeRadius = (d) => radiusScale(degreeMap.get(d.id) || 0);
    const nodeFill = (d) => TIER_STYLES[getNodeTier(degreeMap.get(d.id) || 0, maxDegree)].fill;
    const nodeStroke = (d) => TIER_STYLES[getNodeTier(degreeMap.get(d.id) || 0, maxDegree)].stroke;

    // ── Defs ──────────────────────────────────────────────────────────────
    const defs = svg.append('defs');

    // Glow filter
    const glow = defs.append('filter').attr('id', 'node-glow');
    glow
      .append('feGaussianBlur')
      .attr('in', 'SourceGraphic')
      .attr('stdDeviation', '5')
      .attr('result', 'blur');
    const glowMerge = glow.append('feMerge');
    glowMerge.append('feMergeNode').attr('in', 'blur');
    glowMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    // Arrowhead markers
    Object.entries(REL_STYLES).forEach(([type, style]) => {
      defs
        .append('marker')
        .attr('id', `arrow-${type}`)
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 10)
        .attr('refY', 0)
        .attr('markerWidth', 7)
        .attr('markerHeight', 7)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,-5L10,0L0,5Z')
        .attr('fill', style.color)
        .attr('opacity', 0.85);
    });

    defs
      .append('style')
      .text(`
        @keyframes dash-flow {
          from { stroke-dashoffset: 16; }
          to   { stroke-dashoffset: 0;  }
        }
      `);

    // ── Zoom ──────────────────────────────────────────────────────────────
    const globalFlowActive = { current: false };

    const g = svg.append('g');
    const zoom = d3
      .zoom()
      .scaleExtent([0.05, 12])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
        if (globalFlowActive.current) applyGlobalFlow();
      });

    svg.call(zoom);
    // Initial transform: center the origin
    svg.call(zoom.transform, d3.zoomIdentity.translate(w / 2, h / 2));

    zoomRef.current = { zoom, svg, g };

    // ── Simulation ────────────────────────────────────────────────────────
    const simulation = d3
      .forceSimulation(simNodes)
      .force(
        'link',
        d3
          .forceLink(simLinks)
          .id((d) => d.id)
          .distance(180)
          .strength(0.3)
      )
      .force('charge', d3.forceManyBody().strength(-900))
      .force('center', d3.forceCenter(0, 0).strength(0.05))
      .force('collision', d3.forceCollide((d) => nodeRadius(d) + 20));

    // ── Links ─────────────────────────────────────────────────────────────
    const linkGroup = g.append('g').attr('class', 'links');

    const linkEl = linkGroup
      .selectAll('line')
      .data(simLinks)
      .join('line')
      .attr('stroke', (d) => REL_STYLES[d.type]?.color ?? '#6b7280')
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', (d) =>
        REL_STYLES[d.type]?.dashed ? '7,4' : null
      )
      .attr('stroke-opacity', 0.65)
      .attr('marker-end', (d) =>
        d.type !== 'link' ? `url(#arrow-${d.type})` : null
      );

    const linkLabelEl = linkGroup
      .selectAll('text.link-label')
      .data(simLinks.filter((l) => l.label))
      .join('text')
      .attr('class', 'link-label')
      .attr('text-anchor', 'middle')
      .attr('fill', '#6b7280')
      .attr('font-size', '10px')
      .attr('font-family', 'monospace')
      .style('pointer-events', 'none')
      .text((d) => d.label);

    // ── Nodes ─────────────────────────────────────────────────────────────
    const nodeGroup = g.append('g').attr('class', 'nodes');

    const nodeEl = nodeGroup
      .selectAll('g.node')
      .data(simNodes)
      .join('g')
      .attr('class', 'node')
      .style('cursor', 'grab');

    // Outer glow ring (hidden by default, visible when pinned)
    nodeEl
      .append('circle')
      .attr('class', 'node-glow-ring')
      .attr('r', (d) => nodeRadius(d) + 7)
      .attr('fill', 'none')
      .attr('stroke', (d) => nodeStroke(d))
      .attr('stroke-width', 2)
      .attr('filter', (d) => pinnedNodesRef.current.has(d.id) ? 'url(#node-glow)' : null)
      .attr('opacity', (d) => pinnedNodesRef.current.has(d.id) ? 0.75 : 0);

    // Main circle
    nodeEl
      .append('circle')
      .attr('class', 'node-circle')
      .attr('r', (d) => nodeRadius(d))
      .attr('fill', (d) => nodeFill(d))
      .attr('stroke', (d) => nodeStroke(d))
      .attr('stroke-width', 1.5);

    // Stereotype label (small, above class name)
    nodeEl
      .filter((d) => d.stereotype)
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '-0.6em')
      .attr('fill', '#7c3aed')
      .attr('font-size', '8px')
      .attr('font-family', 'monospace')
      .style('pointer-events', 'none')
      .style('user-select', 'none')
      .text((d) => `«${d.stereotype}»`);

    // Class name label
    nodeEl
      .append('text')
      .attr('class', 'node-label')
      .attr('text-anchor', 'middle')
      .attr('dy', (d) => (d.stereotype ? '0.8em' : '0.35em'))
      .attr('fill', '#e2e8f0')
      .attr('font-size', (d) => {
        const r = nodeRadius(d);
        const base = r < 22 ? 9 : r < 30 ? 10 : r < 38 ? 12 : 13;
        const adjusted = (d.label || d.id).length > 12 ? base - 1 : base;
        return `${Math.max(7, adjusted)}px`;
      })
      .attr('font-weight', '500')
      .attr('font-family', '"SF Mono", "Fira Code", monospace')
      .style('pointer-events', 'none')
      .style('user-select', 'none')
      .text((d) => d.label || d.id);

    // Pin indicator dot (amber, top-right of node)
    nodeEl
      .append('circle')
      .attr('class', 'pin-dot')
      .attr('r', 4)
      .attr('cx', (d) => nodeRadius(d) - 3)
      .attr('cy', (d) => -(nodeRadius(d) - 3))
      .attr('fill', '#f59e0b')
      .attr('stroke', '#78350f')
      .attr('stroke-width', 1)
      .attr('display', (d) =>
        pinnedNodesRef.current.has(d.id) ? null : 'none'
      );

    // Double-click to toggle pin
    nodeEl.on('dblclick', (event, d) => {
      event.stopPropagation();
      if (pinnedNodesRef.current.has(d.id)) {
        pinnedNodesRef.current.delete(d.id);
        d.fx = null;
        d.fy = null;
        simulation.alphaTarget(0.1).restart();
      } else {
        pinnedNodesRef.current.add(d.id);
        d.fx = d.x;
        d.fy = d.y;
      }
      nodeEl.select('.pin-dot')
        .attr('display', (nd) => pinnedNodesRef.current.has(nd.id) ? null : 'none');
      nodeEl.select('.node-glow-ring')
        .attr('filter', (nd) => pinnedNodesRef.current.has(nd.id) ? 'url(#node-glow)' : null)
        .transition().duration(300)
        .attr('opacity', (nd) => pinnedNodesRef.current.has(nd.id) ? 0.75 : 0);
    });

    // ── Tooltip ───────────────────────────────────────────────────────────
    const tooltip = d3
      .select(containerRef.current)
      .append('div')
      .style('position', 'absolute')
      .style('display', 'none')
      .style('background', '#0f0c1a')
      .style('border', '1px solid #5b21b6')
      .style('border-radius', '8px')
      .style('padding', '10px 14px')
      .style('color', '#e2e8f0')
      .style('font-size', '12px')
      .style('font-family', '"SF Mono", "Fira Code", monospace')
      .style('pointer-events', 'none')
      .style('z-index', '100')
      .style('max-width', '240px')
      .style('line-height', '1.7')
      .style('box-shadow', '0 4px 24px rgba(0,0,0,0.6)');

    // ── Hover ─────────────────────────────────────────────────────────────
    nodeEl
      .on('mouseenter', function (event, d) {
        const connectedIds = new Set([d.id]);
        simLinks.forEach((l) => {
          const src =
            typeof l.source === 'object' ? l.source.id : l.source;
          const tgt =
            typeof l.target === 'object' ? l.target.id : l.target;
          if (src === d.id) connectedIds.add(tgt);
          if (tgt === d.id) connectedIds.add(src);
        });

        nodeGroup
          .selectAll('g.node')
          .style('opacity', (n) => (connectedIds.has(n.id) ? 1 : 0.12));

        linkEl.style('stroke-opacity', (l) => {
          const src =
            typeof l.source === 'object' ? l.source.id : l.source;
          const tgt =
            typeof l.target === 'object' ? l.target.id : l.target;
          return src === d.id || tgt === d.id ? 1 : 0.05;
        });

        linkEl
          .attr('stroke-dasharray', (l) => {
            const src = typeof l.source === 'object' ? l.source.id : l.source;
            const tgt = typeof l.target === 'object' ? l.target.id : l.target;
            return src === d.id || tgt === d.id ? '10,6' : null;
          })
          .attr('stroke', (l) => {
            const src = typeof l.source === 'object' ? l.source.id : l.source;
            const tgt = typeof l.target === 'object' ? l.target.id : l.target;
            if (src === d.id) return '#f87171'; // out → 붉은 계열
            if (tgt === d.id) return '#60a5fa'; // in  → 푸른 계열
            return REL_STYLES[l.type]?.color ?? '#6b7280';
          })
          .style('animation', (l) => {
            const src = typeof l.source === 'object' ? l.source.id : l.source;
            const tgt = typeof l.target === 'object' ? l.target.id : l.target;
            return src === d.id || tgt === d.id ? 'dash-flow 0.6s linear infinite' : null;
          });

        d3.select(this)
          .select('.node-circle')
          .attr('stroke', (n) => nodeStroke(n))
          .attr('stroke-width', 2.5)
          .attr('fill', '#1a1a2e');

        d3.select(this)
          .select('.node-glow-ring')
          .transition()
          .duration(200)
          .attr('opacity', pinnedNodesRef.current.has(d.id) ? 1.0 : 0.5);

        if (d.members && d.members.length > 0) {
          const membersHtml = d.members
            .map((m) => `<div style="color:#94a3b8;padding-left:4px">${m}</div>`)
            .join('');
          tooltip
            .style('display', 'block')
            .html(
              `<div style="color:#a78bfa;font-weight:600;margin-bottom:6px;border-bottom:1px solid #2d1a5e;padding-bottom:4px">${d.id}</div>${membersHtml}`
            );
        }
      })
      .on('mousemove', function (event) {
        const rect = containerRef.current.getBoundingClientRect();
        tooltip
          .style('left', event.clientX - rect.left + 14 + 'px')
          .style('top', event.clientY - rect.top - 12 + 'px');
      })
      .on('mouseleave', function (event, d) {
        nodeGroup.selectAll('g.node').style('opacity', 1);
        linkEl.style('stroke-opacity', 0.65);

        if (globalFlowActive.current) {
          applyGlobalFlow();
        } else {
          linkEl
            .attr('stroke-dasharray', (l) => REL_STYLES[l.type]?.dashed ? '7,4' : null)
            .attr('stroke', (l) => REL_STYLES[l.type]?.color ?? '#6b7280')
            .style('animation', null);
        }

        d3.select(this)
          .select('.node-circle')
          .attr('stroke', (n) => nodeStroke(n))
          .attr('stroke-width', 1.5)
          .attr('fill', (n) => nodeFill(n));

        d3.select(this)
          .select('.node-glow-ring')
          .transition()
          .duration(200)
          .attr('opacity', pinnedNodesRef.current.has(d.id) ? 0.75 : 0);

        tooltip.style('display', 'none');
      });

    // ── Space bar: global flow toggle ────────────────────────────────────
    const applyGlobalFlow = () => {
      linkEl
        .attr('stroke-dasharray', '10,6')
        .attr('stroke', (l) => {
          const srcId = typeof l.source === 'object' ? l.source.id : l.source;
          const tgtId = typeof l.target === 'object' ? l.target.id : l.target;
          const srcDeg = degreeMap.get(srcId) ?? 0;
          const tgtDeg = degreeMap.get(tgtId) ?? 0;
          if (srcDeg === tgtDeg) return REL_STYLES[l.type]?.color ?? '#6b7280';
          return srcDeg < tgtDeg ? '#60a5fa' : '#f87171';
        })
        .style('animation', 'dash-flow 0.6s linear infinite');

      const k = d3.zoomTransform(svg.node()).k;
      const TARGET = 12;

      nodeEl.select('text.node-label')
        .attr('font-size', (d) => {
          const r = nodeRadius(d);
          const base = r < 22 ? 9 : r < 30 ? 10 : r < 38 ? 12 : 13;
          const original = Math.max(7, (d.label || d.id).length > 12 ? base - 1 : base);
          return `${Math.max(original, TARGET / k)}px`;
        });

      linkLabelEl.attr('font-size', `${Math.max(10, TARGET / k)}px`);
    };

    const clearGlobalFlow = () => {
      linkEl
        .attr('stroke-dasharray', (l) => REL_STYLES[l.type]?.dashed ? '7,4' : null)
        .attr('stroke', (l) => REL_STYLES[l.type]?.color ?? '#6b7280')
        .style('animation', null);

      nodeEl.select('text.node-label')
        .attr('font-size', (d) => {
          const r = nodeRadius(d);
          const base = r < 22 ? 9 : r < 30 ? 10 : r < 38 ? 12 : 13;
          return `${Math.max(7, (d.label || d.id).length > 12 ? base - 1 : base)}px`;
        });

      linkLabelEl.attr('font-size', '10px');
    };

    const handleKeyDown = (e) => {
      if (e.code !== 'Space' || e.repeat) return;
      e.preventDefault();
      globalFlowActive.current = true;
      applyGlobalFlow();
    };

    const handleKeyUp = (e) => {
      if (e.code !== 'Space') return;
      globalFlowActive.current = false;
      clearGlobalFlow();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // ── Drag ──────────────────────────────────────────────────────────────
    function dragstarted(event, d) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
      d3.select(this).style('cursor', 'grabbing');
    }
    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    }
    function dragended(event, d) {
      if (!event.active) simulation.alphaTarget(0);
      if (!pinnedNodesRef.current.has(d.id)) {
        d.fx = null;
        d.fy = null;
      }
      d3.select(this).style('cursor', 'grab');
    }

    nodeEl.call(
      d3.drag().on('start', dragstarted).on('drag', dragged).on('end', dragended)
    );

    // ── Tick ──────────────────────────────────────────────────────────────
    simulation.on('tick', () => {
      linkEl
        .attr('x1', (d) => {
          const dx = d.target.x - d.source.x;
          const dy = d.target.y - d.source.y;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          return d.source.x + (dx / len) * (nodeRadius(d.source) + 2);
        })
        .attr('y1', (d) => {
          const dx = d.target.x - d.source.x;
          const dy = d.target.y - d.source.y;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          return d.source.y + (dy / len) * (nodeRadius(d.source) + 2);
        })
        .attr('x2', (d) => {
          const dx = d.target.x - d.source.x;
          const dy = d.target.y - d.source.y;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          return d.target.x - (dx / len) * (nodeRadius(d.target) + 2);
        })
        .attr('y2', (d) => {
          const dx = d.target.x - d.source.x;
          const dy = d.target.y - d.source.y;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          return d.target.y - (dy / len) * (nodeRadius(d.target) + 2);
        });

      linkLabelEl
        .attr('x', (d) => (d.source.x + d.target.x) / 2)
        .attr('y', (d) => (d.source.y + d.target.y) / 2 - 6);

      nodeEl.attr('transform', (d) => `translate(${d.x},${d.y})`);
    });


    return () => {
      simulation.stop();
      tooltip.remove();
      svg.on('.zoom', null);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [nodes, links, graphKey, localKey, handleFit]);

  // Used relationship types for legend
  const usedTypes = [...new Set(links.map((l) => l.type))];

  return (
    <div ref={containerRef} className="graph-container">
      <svg ref={svgRef} className="graph-svg" />

      {nodes.length === 0 && (
        <div className="graph-empty">
          <div className="graph-empty-icon">◈</div>
          <p>classDiagram을 입력하면</p>
          <p>그래프가 여기에 표시됩니다</p>
        </div>
      )}

      {/* Controls */}
      <div className="graph-controls">
        <button className="ctrl-btn" onClick={handleZoomIn} title="확대">+</button>
        <button className="ctrl-btn" onClick={handleZoomOut} title="축소">−</button>
        <button className="ctrl-btn fit-btn" onClick={handleFit} title="화면에 맞추기">⊡</button>
        <div className="ctrl-divider" />
        <button
          className={`ctrl-btn ctrl-btn--text ${saveStatus === 'saved' ? 'ctrl-btn--ok' : ''}`}
          onClick={handleSave}
          title="현재 레이아웃 저장"
        >
          {saveStatus === 'saved' ? '✓' : '저장'}
        </button>
        <button
          className={`ctrl-btn ctrl-btn--text ${saveStatus === 'no-data' ? 'ctrl-btn--err' : ''}`}
          onClick={handleLoad}
          title="저장된 레이아웃 불러오기"
        >
          {saveStatus === 'no-data' ? '없음' : '불러오기'}
        </button>
        <div className="ctrl-divider" />
        <button
          className="ctrl-btn ctrl-btn--text"
          onClick={() => setShowHelp(true)}
          title="도움말"
        >?</button>
      </div>

      {/* Help hint */}
      <div className="graph-hint">스크롤 줌 · 드래그 이동 · 노드 호버 · 더블클릭 핀 고정 · 스페이스 전체 흐름</div>

      {/* Relationship legend */}
      {usedTypes.length > 0 && (
        <div className="graph-legend">
          {usedTypes.map((type) => {
            const style = REL_STYLES[type];
            if (!style) return null;
            return (
              <div key={type} className="legend-item">
                <span
                  className="legend-line"
                  style={{
                    borderTopColor: style.color,
                    borderTopStyle: style.dashed ? 'dashed' : 'solid',
                  }}
                />
                <span className="legend-label" style={{ color: style.color }}>
                  {style.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Node tier legend */}
      {nodes.length > 0 && (
        <div className="graph-legend graph-legend--tier">
          {TIER_LEGEND.map(({ tier, stroke, label }) => (
            <div key={tier} className="legend-item">
              <span
                className="legend-dot"
                style={{ background: stroke }}
              />
              <span className="legend-label" style={{ color: stroke }}>
                {label}
              </span>
            </div>
          ))}
        </div>
      )}

      {showHelp && (
        <div className="help-overlay" onClick={() => setShowHelp(false)}>
          <div className="help-modal" onClick={(e) => e.stopPropagation()}>
            <button className="help-close" onClick={() => setShowHelp(false)}>✕</button>
            <h2 className="help-title">사용법</h2>

            <section className="help-section">
              <h3>📝 다이어그램 작성</h3>
              <ul>
                <li>왼쪽 에디터에 Mermaid 문법으로 그래프 입력</li>
                <li><code>graph TD</code>, <code>flowchart LR</code> 등 방향 지원</li>
                <li>예: <code>A[노드] --&gt; B[다른 노드]</code></li>
              </ul>
            </section>

            <section className="help-section">
              <h3>🔍 화면 조작</h3>
              <ul>
                <li><strong>스크롤</strong> — 줌 인/아웃</li>
                <li><strong>드래그</strong> — 화면 이동</li>
                <li><strong>노드 드래그</strong> — 노드 위치 이동</li>
                <li><strong>더블클릭</strong> — 노드 핀 고정 / 해제</li>
              </ul>
            </section>

            <section className="help-section">
              <h3>✨ 특수 기능</h3>
              <ul>
                <li><strong>스페이스바 홀드</strong> — 전체 흐름 애니메이션<br/>
                  <span className="help-note">파란색 = 상위 → 하위 / 빨간색 = 하위 → 상위</span>
                </li>
                <li><strong>노드 호버</strong> — 연결 노드 강조</li>
                <li><strong>저장 / 불러오기</strong> — 로컬 저장</li>
              </ul>
            </section>

            <section className="help-section">
              <h3>🎯 컨트롤 버튼</h3>
              <ul>
                <li><code>+</code> / <code>−</code> — 줌 인 / 줌 아웃</li>
                <li><code>⊡</code> — 화면에 맞추기</li>
                <li><code>?</code> — 이 도움말</li>
              </ul>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
