import React, { useEffect, useRef, useState, useCallback } from 'react';

// ── Self-contained force-directed graph (no external deps) ──
// Renders nodes + edges on a <canvas> with a simple velocity-Verlet
// force simulation: repulsion (charge), attraction (spring on edges),
// and centering gravity. Supports drag, zoom (wheel), pan, and hover.

const TYPE_LABEL = {
    category: 'Kategori',
    training_doc: 'Dokumen Training',
    chunk: 'Chunk',
    knowledge: 'Knowledge',
    correction: 'Koreksi',
    brain_memory: '1MBrain Memory',
};

export default function KnowledgeGraph({ data, height = 520 }) {
    const canvasRef = useRef(null);
    const wrapRef = useRef(null);
    const [selected, setSelected] = useState(null);
    const [hover, setHover] = useState(null);
    const [filter, setFilter] = useState('all');

    // simulation state kept in refs to avoid re-renders
    const simRef = useRef({ nodes: [], edges: [], raf: null, drag: null, pan: { x: 0, y: 0 }, zoom: 1, w: 800, h: 520, mouse: { x: 0, y: 0 } });

    const buildSim = useCallback(() => {
        const sim = simRef.current;
        const nodes = (data?.nodes || []).map((n, i) => ({
            ...n,
            x: Math.cos((i / Math.max(1, data.nodes.length)) * Math.PI * 2) * 200 + (Math.random() - 0.5) * 40,
            y: Math.sin((i / Math.max(1, data.nodes.length)) * Math.PI * 2) * 200 + (Math.random() - 0.5) * 40,
            vx: 0, vy: 0,
        }));
        const byId = Object.fromEntries(nodes.map(n => [n.id, n]));
        const edges = (data?.edges || []).filter(e => byId[e.source] && byId[e.target]).map(e => ({ ...e, s: byId[e.source], t: byId[e.target] }));
        sim.nodes = nodes;
        sim.edges = edges;
        sim.byId = byId;
    }, [data]);

    useEffect(() => {
        buildSim();
        setSelected(null);
    }, [buildSim]);

    // animation loop
    useEffect(() => {
        const sim = simRef.current;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        let running = true;

        const resize = () => {
            const wrap = wrapRef.current;
            if (!wrap) return;
            const dpr = window.devicePixelRatio || 1;
            sim.w = wrap.clientWidth;
            sim.h = height;
            canvas.width = sim.w * dpr;
            canvas.height = sim.h * dpr;
            canvas.style.width = sim.w + 'px';
            canvas.style.height = sim.h + 'px';
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        };
        resize();
        const ro = new ResizeObserver(resize);
        if (wrapRef.current) ro.observe(wrapRef.current);

        const tick = () => {
            if (!running) return;
            step(sim);
            draw(ctx, sim, filter, hover, selected);
            sim.raf = requestAnimationFrame(tick);
        };
        tick();

        return () => {
            running = false;
            if (sim.raf) cancelAnimationFrame(sim.raf);
            ro.disconnect();
        };
    }, [filter, hover, selected, height]);

    const getPos = (sim, p) => ({ x: p.x * sim.zoom + sim.pan.x + sim.w / 2, y: p.y * sim.zoom + sim.pan.y + sim.h / 2 });
    const toWorld = (sim, sx, sy) => ({ x: (sx - sim.pan.x - sim.w / 2) / sim.zoom, y: (sy - sim.pan.y - sim.h / 2) / sim.zoom });

    const nodeAt = (sim, sx, sy) => {
        const w = toWorld(sim, sx, sy);
        for (let i = sim.nodes.length - 1; i >= 0; i--) {
            const n = sim.nodes[i];
            const r = (n.size || 6) * sim.zoom + 4;
            if ((n.x - w.x) ** 2 + (n.y - w.y) ** 2 <= r * r) return n;
        }
        return null;
    };

    const onDown = (e) => {
        const sim = simRef.current;
        const rect = canvasRef.current.getBoundingClientRect();
        const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
        const n = nodeAt(sim, sx, sy);
        if (n) {
            sim.drag = { node: n, dx: n.x - toWorld(sim, sx, sy).x, dy: n.y - toWorld(sim, sx, sy).y };
            setSelected(n);
        } else {
            sim.panStart = { x: sx, y: sy, px: sim.pan.x, py: sim.pan.y };
        }
    };
    const onMove = (e) => {
        const sim = simRef.current;
        const rect = canvasRef.current.getBoundingClientRect();
        const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
        sim.mouse = { x: sx, y: sy };
        if (sim.drag) {
            const w = toWorld(sim, sx, sy);
            sim.drag.node.x = w.x + sim.drag.dx;
            sim.drag.node.y = w.y + sim.drag.dy;
            sim.drag.node.vx = 0; sim.drag.node.vy = 0;
        } else if (sim.panStart) {
            sim.pan.x = sim.panStart.px + (sx - sim.panStart.x);
            sim.pan.y = sim.panStart.py + (sy - sim.panStart.y);
        } else {
            const n = nodeAt(sim, sx, sy);
            setHover(n ? n.id : null);
            canvasRef.current.style.cursor = n ? 'pointer' : (sim.panStart ? 'grabbing' : 'grab');
        }
    };
    const onUp = () => { simRef.current.drag = null; simRef.current.panStart = null; };
    const onWheel = (e) => {
        e.preventDefault();
        const sim = simRef.current;
        const factor = e.deltaY < 0 ? 1.1 : 0.9;
        sim.zoom = Math.min(3, Math.max(0.3, sim.zoom * factor));
    };

    const stats = data?.stats || {};

    return (
        <div className="space-y-3">
            {/* Controls */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-bold text-gray-500 dark:text-slate-400">Filter:</span>
                {['all', 'category', 'training_doc', 'knowledge', 'correction', 'brain_memory'].map(f => (
                    <button key={f} onClick={() => setFilter(f)}
                        className={`px-2 py-1 rounded-md transition-colors ${filter === f ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700'}`}>
                        {f === 'all' ? 'Semua' : (TYPE_LABEL[f] || f)}
                    </button>
                ))}
                <div className="ml-auto flex gap-3 text-[11px] text-gray-500 dark:text-slate-400">
                    <span>📁 {stats.trainingDocs || 0} docs</span>
                    <span>🧩 {stats.chunks || 0} chunks</span>
                    <span>🧠 {stats.knowledge || 0} knowledge</span>
                    <span>✅ {stats.knowledgeTrained || 0} trained</span>
                    <span>🔧 {stats.corrections || 0} koreksi</span>
                    <span>🧠 {stats.nodes || 0} memori</span>
                </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-3 text-[11px] text-gray-500 dark:text-slate-400">
                <Legend color="#8b5cf6" label="Kategori" />
                <Legend color="#22d3ee" label="Dokumen Training" />
                <Legend color="#67e8f9" label="Chunk" />
                <Legend color="#34d399" label="Knowledge (terlatih)" />
                <Legend color="#a3a3a3" label="Knowledge (belum)" />
                <Legend color="#f43f5e" label="Koreksi" />
                <Legend color="#f59e0b" label="1MBrain Memory" />
            </div>

            <div ref={wrapRef} className="relative w-full rounded-xl border dark:border-slate-700/50 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 overflow-hidden">
                <canvas
                    ref={canvasRef}
                    className="block touch-none"
                    onMouseDown={onDown}
                    onMouseMove={onMove}
                    onMouseUp={onUp}
                    onMouseLeave={onUp}
                    onWheel={onWheel}
                />
                <div className="absolute bottom-2 left-2 text-[10px] text-gray-400 dark:text-slate-500 pointer-events-none">
                    Scroll = zoom · Drag node = geser · Drag kosong = pan · Hover = detail
                </div>
            </div>

            {/* Detail panel */}
            {(selected || hover) && (() => {
                const n = simRef.current.byId?.[(selected || {}).id] || simRef.current.byId?.[hover];
                if (!n) return null;
                return (
                    <div className="text-xs bg-white dark:bg-slate-800 border dark:border-slate-700/50 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="w-3 h-3 rounded-full" style={{ background: n.color }} />
                            <span className="font-bold dark:text-white">{n.label}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400">{TYPE_LABEL[n.type] || n.type}</span>
                        </div>
                        {n.category && <div className="text-gray-500 dark:text-slate-400">Kategori: {n.category}</div>}
                        {n.status && <div className="text-gray-500 dark:text-slate-400">Status: {n.status}</div>}
                        {n.meta?.usedInTraining !== undefined && <div className="text-gray-500 dark:text-slate-400">Terpakai di training: {n.meta.usedInTraining ? 'Ya' : 'Belum'}</div>}
                        {n.meta?.repeatCount !== undefined && <div className="text-gray-500 dark:text-slate-400">Ditanyakan: {n.meta.repeatCount}x</div>}
                        {n.meta?.confidence !== undefined && <div className="text-gray-500 dark:text-slate-400">Confidence: {(n.meta.confidence * 100).toFixed(0)}%</div>}
                        {n.meta?.applied !== undefined && <div className="text-gray-500 dark:text-slate-400">Diterapkan: {n.meta.applied ? 'Ya' : 'Belum'}</div>}
                        {n.meta?.severity !== undefined && <div className="text-gray-500 dark:text-slate-400">Severity: {(n.meta.severity * 100).toFixed(0)}%</div>}
                    </div>
                );
            })()}
        </div>
    );
}

function Legend({ color, label }) {
    return (
        <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} /> {label}
        </span>
    );
}

// ── Force simulation step ──
function step(sim) {
    const { nodes, edges } = sim;
    const N = nodes.length;
    if (N === 0) return;
    const REPULSION = 4000;
    const SPRING = 0.02;
    const SPRING_LEN = 70;
    const GRAVITY = 0.005;
    const CENTER = { x: 0, y: 0 };

    for (const n of nodes) { n.fx = 0; n.fy = 0; }

    for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
            const a = nodes[i], b = nodes[j];
            let dx = a.x - b.x, dy = a.y - b.y;
            let d2 = dx * dx + dy * dy;
            if (d2 < 0.01) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; d2 = 0.01; }
            const d = Math.sqrt(d2);
            const f = REPULSION / d2;
            const fx = (dx / d) * f, fy = (dy / d) * f;
            a.fx += fx; a.fy += fy;
            b.fx -= fx; b.fy -= fy;
        }
    }

    for (const e of edges) {
        const a = e.s, b = e.t;
        let dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const f = (d - SPRING_LEN) * SPRING;
        const fx = (dx / d) * f, fy = (dy / d) * f;
        a.fx += fx; a.fy += fy;
        b.fx -= fx; b.fy -= fy;
    }

    for (const n of nodes) {
        n.fx += (CENTER.x - n.x) * GRAVITY;
        n.fy += (CENTER.y - n.y) * GRAVITY;
        if (sim.drag && sim.drag.node === n) { n.vx = 0; n.vy = 0; continue; }
        n.vx = (n.vx + n.fx) * 0.85;
        n.vy = (n.vy + n.fy) * 0.85;
        n.x += n.vx; n.y += n.vy;
    }
}

// ── Draw ──
function draw(ctx, sim, filter, hoverId, selectedNode) {
    const { nodes, edges, w, h, zoom, pan } = sim;
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2 + pan.x, cy = h / 2 + pan.y;
    const tp = (p) => ({ x: p.x * zoom + cx, y: p.y * zoom + cy });

    // edges
    ctx.lineWidth = 1;
    for (const e of edges) {
        const showS = filter === 'all' || e.s.type === filter;
        const showT = filter === 'all' || e.t.type === filter;
        if (!showS && !showT) continue;
        const a = tp(e.s), b = tp(e.t);
        let color = 'rgba(148,163,184,0.25)';
        if (e.type === 'trained_into') color = 'rgba(52,211,153,0.5)';
        else if (e.type === 'corrected_into' || e.type === 'refines') color = 'rgba(244,63,94,0.5)';
        else if (e.type === 'has_chunk') color = 'rgba(103,232,249,0.35)';
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
    }

    // nodes
    for (const n of nodes) {
        if (filter !== 'all' && n.type !== filter) continue;
        const p = tp(n);
        const r = (n.size || 6) * zoom;
        const isHi = hoverId === n.id || (selectedNode && selectedNode.id === n.id);
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fillStyle = n.color || '#94a3b8';
        ctx.fill();
        if (isHi) {
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#fff';
            ctx.stroke();
        }
        // labels for larger nodes or when zoomed/hovered
        if (r > 6 || isHi) {
            ctx.fillStyle = isHi ? '#0f172a' : 'rgba(15,23,42,0.7)';
            if (document.documentElement.classList.contains('dark')) ctx.fillStyle = isHi ? '#fff' : 'rgba(226,232,240,0.8)';
            ctx.font = `${Math.max(9, Math.min(13, r))}px sans-serif`;
            ctx.textAlign = 'center';
            const label = n.label && n.label.length > 22 ? n.label.slice(0, 20) + '…' : (n.label || '');
            ctx.fillText(label, p.x, p.y - r - 3);
        }
    }
}
