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

const readSavedLayout = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); }
  catch { return null; }
};

export default function GraphView({ nodes, links, graphKey }) {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const zoomRef = useRef(null);
  const simNodesRef = useRef([]);
  const [localKey, setLocalKey] = useState(0);
  const [saveStatus, setSaveStatus] = useState(null); // null | 'saved' | 'no-data'

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
      positions[n.id] = { x: Math.round(n.x || 0), y: Math.round(n.y || 0) };
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

    // Deep copy for D3 mutation, apply saved positions if available
    const simNodes = nodes.map((n) => {
      const saved = savedLayout?.[n.id];
      return saved
        ? { ...n, x: saved.x, y: saved.y, fx: saved.x, fy: saved.y } // pinned
        : { ...n };
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
    const fillScale = d3.scaleSequential()
      .domain([0, maxDegree])
      .interpolator(d3.interpolateRgb('#0f0a1e', '#5b21b6'));
    const strokeScale = d3.scaleSequential()
      .domain([0, maxDegree])
      .interpolator(d3.interpolateRgb('#4c1d95', '#e879f9'));

    const nodeRadius = (d) => radiusScale(degreeMap.get(d.id) || 0);
    const nodeFill = (d) => fillScale(degreeMap.get(d.id) || 0);
    const nodeStroke = (d) => strokeScale(degreeMap.get(d.id) || 0);

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

    // ── Zoom ──────────────────────────────────────────────────────────────
    const g = svg.append('g');
    const zoom = d3
      .zoom()
      .scaleExtent([0.05, 12])
      .on('zoom', (event) => g.attr('transform', event.transform));

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
          .distance(140)
          .strength(0.4)
      )
      .force('charge', d3.forceManyBody().strength(-500))
      .force('center', d3.forceCenter(0, 0))
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

    // Outer glow ring (hidden by default)
    nodeEl
      .append('circle')
      .attr('class', 'node-glow-ring')
      .attr('r', (d) => nodeRadius(d) + 7)
      .attr('fill', 'none')
      .attr('stroke', (d) => nodeStroke(d))
      .attr('stroke-width', 2)
      .attr('opacity', 0);

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
        const adjusted = d.id.length > 12 ? base - 1 : base;
        return `${Math.max(7, adjusted)}px`;
      })
      .attr('font-weight', '500')
      .attr('font-family', '"SF Mono", "Fira Code", monospace')
      .style('pointer-events', 'none')
      .style('user-select', 'none')
      .text((d) => d.id);

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

        d3.select(this)
          .select('.node-circle')
          .attr('stroke', '#a78bfa')
          .attr('stroke-width', 2.5)
          .attr('fill', '#2d1a5e');

        d3.select(this)
          .select('.node-glow-ring')
          .transition()
          .duration(200)
          .attr('opacity', 0.5);

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
      .on('mouseleave', function () {
        nodeGroup.selectAll('g.node').style('opacity', 1);
        linkEl.style('stroke-opacity', 0.65);

        d3.select(this)
          .select('.node-circle')
          .attr('stroke', (n) => nodeStroke(n))
          .attr('stroke-width', 1.5)
          .attr('fill', (n) => nodeFill(n));

        d3.select(this)
          .select('.node-glow-ring')
          .transition()
          .duration(200)
          .attr('opacity', 0);

        tooltip.style('display', 'none');
      });

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
      d.fx = null;
      d.fy = null;
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
      </div>

      {/* Help hint */}
      <div className="graph-hint">스크롤 줌 · 드래그 이동 · 노드 호버</div>

      {/* Legend */}
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
    </div>
  );
}
