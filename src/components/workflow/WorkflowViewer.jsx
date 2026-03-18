
import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    ReactFlow,
    Controls,
    Background,
    MarkerType,
    Handle,
    Position
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ShieldCheck, Play, Flag, CheckCircle2, XCircle, Clock, Paperclip, MessageSquareText, X, FileText, Eye, User, ZoomIn } from 'lucide-react';
import { getFullUrl } from '../../utils/urlHelper';

// --- Custom Nodes (Read-only, single handle per side) ---

const StartNode = () => (
    <div className="px-6 py-3 rounded-2xl bg-emerald-500 text-white shadow-xl border-2 border-emerald-400 flex items-center gap-3 min-w-[150px] relative">
        <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
            <Play size={18} fill="white" />
        </div>
        <div>
            <p className="text-[10px] font-black uppercase opacity-70">Trigger</p>
            <p className="font-bold">START</p>
        </div>
        <Handle id="top" type="source" position={Position.Top} className="opacity-0" />
        <Handle id="right" type="source" position={Position.Right} className="opacity-0" />
        <Handle id="bottom" type="source" position={Position.Bottom} className="opacity-0" />
        <Handle id="left" type="source" position={Position.Left} className="opacity-0" />
    </div>
);

const EndNode = ({ data }) => (
    <div className={`px-6 py-3 rounded-2xl text-white shadow-xl border-2 flex items-center gap-3 min-w-[150px] relative ${data.status === 'Completed' ? 'bg-indigo-600 border-indigo-400' : 'bg-slate-400 border-slate-300'}`}>
        <Handle id="top" type="source" position={Position.Top} className="opacity-0" />
        <Handle id="right" type="source" position={Position.Right} className="opacity-0" />
        <Handle id="bottom" type="source" position={Position.Bottom} className="opacity-0" />
        <Handle id="left" type="source" position={Position.Left} className="opacity-0" />
        <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
            <Flag size={18} fill="white" />
        </div>
        <div>
            <p className="text-[10px] font-black uppercase opacity-70">Status</p>
            <p className="font-bold uppercase tracking-tight">{data.status || 'END'}</p>
        </div>
    </div>
);

const ApproverNode = ({ data }) => {
    const isDone = data.status === 'Approved';
    const isRejected = data.status === 'Rejected';
    const isActive = data.status === 'Active' || data.status === 'Pending_Active';
    const isDefined = data.status === 'Defined';

    const hasNotes = !!(data.instruction || data.notes);
    const hasDocs = (data.documents || []).length > 0;

    return (
        <div className={`rounded-3xl bg-white dark:bg-slate-900 shadow-2xl border-2 min-w-[220px] max-w-[280px] transition-all cursor-pointer hover:shadow-indigo-500/10 hover:shadow-3xl relative ${isDone || isDefined ? 'border-indigo-500' :
            isRejected ? 'border-red-500' :
                isActive ? 'border-amber-500 ring-4 ring-amber-500/20 scale-105 z-50' :
                    'border-slate-100 dark:border-slate-800'
            }`}>
            {/* One handle per side */}
            <Handle id="top" type="source" position={Position.Top} className="opacity-0" />
            <Handle id="right" type="source" position={Position.Right} className="opacity-0" />
            <Handle id="bottom" type="source" position={Position.Bottom} className="opacity-0" />
            <Handle id="left" type="source" position={Position.Left} className="opacity-0" />

            <div className="px-5 py-4">
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center ${isDone || isDefined ? 'bg-indigo-50 text-indigo-600' :
                        isRejected ? 'bg-red-50 text-red-600' :
                            isActive ? 'bg-amber-50 text-amber-600 animate-pulse' :
                                'bg-slate-50 dark:bg-slate-800 text-slate-400'
                        }`}>
                        {isDone || isDefined ? <ShieldCheck size={20} /> :
                            isRejected ? <XCircle size={20} /> :
                                isActive ? <Clock size={20} /> : <ShieldCheck size={20} />}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{data.role || 'Approver'}</p>
                        <p className="font-bold text-slate-800 dark:text-white truncate">{data.label}</p>
                        {!isDefined && (
                            <div className="flex items-center gap-1 mt-1">
                                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-tighter ${isDone ? 'bg-emerald-500/10 text-emerald-600' :
                                    isRejected ? 'bg-red-500/10 text-red-600' :
                                        isActive ? 'bg-amber-500/10 text-amber-600' :
                                            'bg-slate-100 dark:bg-slate-800 text-slate-500'
                                    }`}>
                                    {data.status || 'Waiting'}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {data.action_date && (
                    <p className="text-[8px] text-slate-400 mt-2 font-bold italic">Done: {new Date(data.action_date).toLocaleDateString()}</p>
                )}

                {/* Badge indicators */}
                {(hasNotes || hasDocs) && (
                    <div className="flex items-center gap-1.5 mt-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                        {hasNotes && (
                            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 text-[8px] font-bold">
                                <MessageSquareText size={9} /> Instruksi
                            </span>
                        )}
                        {hasDocs && (
                            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-50 dark:bg-amber-900/30 text-amber-500 text-[8px] font-bold">
                                <Paperclip size={9} /> {data.documents.length}
                            </span>
                        )}
                        <span className="ml-auto flex items-center gap-0.5 text-[7px] text-slate-400 font-bold uppercase">
                            <Eye size={8} /> Detail
                        </span>
                    </div>
                )}

                {!hasNotes && !hasDocs && (
                    <div className="flex items-center justify-center gap-1 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                        <span className="text-[7px] text-slate-400 font-bold uppercase flex items-center gap-0.5">
                            <Eye size={8} /> Klik untuk detail
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
};

const nodeTypes = {
    start: StartNode,
    end: EndNode,
    approver: ApproverNode,
};

// --- Detail Popup Component ---
function NodeDetailPopup({ node, onClose }) {
    const [previewImage, setPreviewImage] = useState(null);
    const data = node.data;

    const isDone = data.status === 'Approved';
    const isRejected = data.status === 'Rejected';
    const isActive = data.status === 'Active' || data.status === 'Pending_Active';

    const notes = data.instruction || data.notes || '';
    const docs = data.documents || [];

    const isImage = (url) => /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url);

    if (typeof document === 'undefined') return null;

    return createPortal((
        <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-[10020] bg-black/60 backdrop-blur-md animate-in fade-in duration-200" onClick={onClose} />

            {/* Popup */}
            <div className="fixed left-1/2 top-1/2 z-[10030] w-[420px] max-w-[92vw] max-h-[92vh] -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-300">
                {/* Header */}
                <div className={`p-5 border-b border-slate-100 dark:border-slate-800 ${isDone ? 'bg-emerald-50 dark:bg-emerald-900/10' :
                    isRejected ? 'bg-red-50 dark:bg-red-900/10' :
                        isActive ? 'bg-amber-50 dark:bg-amber-900/10' :
                            'bg-slate-50 dark:bg-slate-800/50'
                    }`}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isDone ? 'bg-emerald-500 text-white' :
                                isRejected ? 'bg-red-500 text-white' :
                                    isActive ? 'bg-amber-500 text-white' :
                                        'bg-indigo-500 text-white'
                                }`}>
                                <ShieldCheck size={24} />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{data.role || 'Approver'}</p>
                                <p className="text-lg font-black text-slate-800 dark:text-white">{data.label}</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-white/50 dark:hover:bg-slate-700 rounded-xl transition-all">
                            <X size={18} className="text-slate-400" />
                        </button>
                    </div>

                    <div className="flex items-center gap-2 mt-3">
                        {data.username && (
                            <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/60 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300">
                                <User size={10} /> {data.username}
                            </span>
                        )}
                        <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${isDone ? 'bg-emerald-500/20 text-emerald-700' :
                            isRejected ? 'bg-red-500/20 text-red-700' :
                                isActive ? 'bg-amber-500/20 text-amber-700' :
                                    'bg-slate-200 dark:bg-slate-700 text-slate-500'
                            }`}>
                            {data.status || 'Waiting'}
                        </span>
                        {data.action_date && (
                            <span className="text-[10px] text-slate-400 font-bold italic ml-auto">
                                {new Date(data.action_date).toLocaleDateString()}
                            </span>
                        )}
                    </div>
                </div>

                {/* Body */}
                <div className="p-5 overflow-y-auto max-h-[calc(92vh-9rem)] custom-scrollbar space-y-5">
                    {/* Instruction */}
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1 mb-2">
                            <MessageSquareText size={10} className="text-indigo-500" /> Instruksi Kerja
                        </p>
                        {notes ? (
                            <div className="p-4 bg-indigo-50/60 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-800/50">
                                <p className="text-sm text-indigo-700 dark:text-indigo-300 leading-relaxed whitespace-pre-wrap">{notes}</p>
                            </div>
                        ) : (
                            <p className="text-xs text-slate-400 italic px-1">Tidak ada instruksi khusus untuk step ini.</p>
                        )}
                    </div>

                    {/* Attachments */}
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1 mb-2">
                            <Paperclip size={10} className="text-amber-500" /> Lampiran ({docs.length})
                        </p>
                        {docs.length > 0 ? (
                            <div className="grid grid-cols-2 gap-2">
                                {docs.map((doc, dIdx) => {
                                    const url = doc.url || doc;
                                    return isImage(url) ? (
                                        <div
                                            key={dIdx}
                                            className="relative aspect-video rounded-xl overflow-hidden border border-amber-200/50 dark:border-amber-800/50 bg-white dark:bg-slate-800 cursor-pointer group/img hover:ring-2 hover:ring-indigo-500 transition-all"
                                            onClick={() => setPreviewImage(getFullUrl(url))}
                                        >
                                            <img
                                                src={getFullUrl(url)}
                                                alt={doc.name || `Lampiran ${dIdx + 1}`}
                                                className="w-full h-full object-cover transition-transform group-hover/img:scale-110"
                                            />
                                            <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/20 transition-all flex items-center justify-center">
                                                <ZoomIn size={20} className="text-white opacity-0 group-hover/img:opacity-100 transition-all drop-shadow-lg" />
                                            </div>
                                        </div>
                                    ) : (
                                        <a
                                            key={dIdx}
                                            href={getFullUrl(url)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-2 p-3 rounded-xl bg-white dark:bg-slate-800 border border-amber-200/50 dark:border-amber-800/50 hover:bg-amber-50 transition-all"
                                        >
                                            <FileText size={16} className="text-amber-500 flex-shrink-0" />
                                            <span className="text-xs font-bold text-slate-600 dark:text-slate-300 truncate">
                                                {doc.name || (typeof url === 'string' ? url.split('/').pop() : `File ${dIdx + 1}`)}
                                            </span>
                                        </a>
                                    );
                                })}
                            </div>
                        ) : (
                            <p className="text-xs text-slate-400 italic px-1">Tidak ada lampiran.</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Full-screen Image Preview */}
            {previewImage && (
                <div
                    className="fixed inset-0 z-[10040] bg-black/80 flex items-center justify-center animate-in fade-in duration-200 cursor-pointer"
                    onClick={() => setPreviewImage(null)}
                >
                    <button className="absolute top-4 right-4 p-2 bg-white/20 rounded-full hover:bg-white/40 transition-all">
                        <X size={24} className="text-white" />
                    </button>
                    <img
                        src={previewImage}
                        alt="Preview"
                        className="max-w-[90vw] max-h-[90vh] object-contain rounded-2xl shadow-2xl animate-in zoom-in-95 duration-300"
                    />
                </div>
            )}
        </>
    ), document.body);
}

// --- Main Viewer ---

export default function WorkflowViewer({ nodes = [], edges = [], accentColor, currentStepNodeId, approvalStatus, stepsStatus = [], sopMode = false }) {
    const [detailNode, setDetailNode] = useState(null);

    const processedNodes = useMemo(() => {
        return nodes.map(node => {
            if (node.type === 'approver') {
                if (sopMode) {
                    return {
                        ...node,
                        data: { ...node.data, status: 'Defined' }
                    };
                }
                const step = stepsStatus.find(s => s.node_id === node.id);
                const isNodeActive = node.id === currentStepNodeId && approvalStatus === 'Pending';
                return {
                    ...node,
                    data: {
                        ...node.data,
                        status: isNodeActive ? 'Active' : (step?.status || 'Pending'),
                        action_date: step?.action_date
                    }
                };
            }
            if (node.type === 'end') {
                if (sopMode) {
                    return { ...node, data: { ...node.data, status: 'Completed' } };
                }
                return {
                    ...node,
                    data: {
                        ...node.data,
                        status: approvalStatus === 'Approved' ? 'Completed' : (approvalStatus === 'Rejected' ? 'Stopped' : 'Pending')
                    }
                };
            }
            return node;
        });
    }, [nodes, currentStepNodeId, approvalStatus, stepsStatus, sopMode]);

    const processedEdges = useMemo(() => {
        return edges.map(edge => {
            const finalColor = edge.style?.stroke || accentColor || '#6366f1';
            return {
            ...edge,
            animated: true,
            type: 'smoothstep',
            style: { ...(edge.style || {}), strokeWidth: 2.5, stroke: finalColor },
            markerEnd: { type: MarkerType.ArrowClosed, color: finalColor, width: 20, height: 20 }
            };
        });
    }, [edges, accentColor]);

    const handleNodeClick = (event, node) => {
        if (node.type === 'approver') {
            const processed = processedNodes.find(n => n.id === node.id);
            setDetailNode(processed || node);
        }
    };

    return (
        <div className="w-full h-full bg-slate-50 dark:bg-[#0B1437] relative">
            <ReactFlow
                nodes={processedNodes}
                edges={processedEdges}
                nodeTypes={nodeTypes}
                fitView
                nodesDraggable={false}
                nodesConnectable={false}
                elementsSelectable={false}
                connectionMode="loose"
                panOnScroll
                onNodeClick={handleNodeClick}
                className="bg-transparent"
            >
                <Background color="#94a3b8" gap={20} size={1} />
                <Controls />
            </ReactFlow>

            {detailNode && (
                <NodeDetailPopup
                    node={detailNode}
                    onClose={() => setDetailNode(null)}
                />
            )}
        </div>
    );
}
