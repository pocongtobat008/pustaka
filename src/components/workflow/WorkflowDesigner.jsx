
import React, { useState, useCallback, useRef } from 'react';
import {
    ReactFlow,
    Controls,
    Background,
    applyNodeChanges,
    applyEdgeChanges,
    addEdge,
    Panel,
    MarkerType,
    Handle,
    Position
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { User, ShieldCheck, Play, Flag, Trash2, Save, X, MessageSquareText, Paperclip, Upload, FileText, Image as ImageIcon } from 'lucide-react';
import { API_URL } from '../../services/database';
import { getFullUrl } from '../../utils/urlHelper';

// --- Handle style helper ---
const handleStyle = "w-3 h-3 border-2 border-white";

// --- Custom Nodes ---

const StartNode = () => (
    <div className="px-6 py-3 rounded-2xl bg-emerald-500 text-white shadow-xl border-2 border-emerald-400 flex items-center gap-3 min-w-[150px] relative">
        <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
            <Play size={18} fill="white" />
        </div>
        <div>
            <p className="text-[10px] font-black uppercase opacity-70">Trigger</p>
            <p className="font-bold">START</p>
        </div>
        <Handle id="top" type="source" position={Position.Top} className={`${handleStyle} bg-emerald-300`} />
        <Handle id="right" type="source" position={Position.Right} className={`${handleStyle} bg-emerald-300`} />
        <Handle id="bottom" type="source" position={Position.Bottom} className={`${handleStyle} bg-emerald-300`} />
        <Handle id="left" type="source" position={Position.Left} className={`${handleStyle} bg-emerald-300`} />
    </div>
);

const EndNode = () => (
    <div className="px-6 py-3 rounded-2xl bg-indigo-600 text-white shadow-xl border-2 border-indigo-400 flex items-center gap-3 min-w-[150px] relative">
        <Handle id="top" type="source" position={Position.Top} className={`${handleStyle} bg-indigo-300`} />
        <Handle id="right" type="source" position={Position.Right} className={`${handleStyle} bg-indigo-300`} />
        <Handle id="bottom" type="source" position={Position.Bottom} className={`${handleStyle} bg-indigo-300`} />
        <Handle id="left" type="source" position={Position.Left} className={`${handleStyle} bg-indigo-300`} />
        <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
            <Flag size={18} fill="white" />
        </div>
        <div>
            <p className="text-[10px] font-black uppercase opacity-70">Status</p>
            <p className="font-bold">COMPLETED</p>
        </div>
    </div>
);

const ApproverNode = ({ data }) => {
    const hasNotes = !!(data.instruction || data.notes);
    const hasDocs = (data.documents || []).length > 0;

    return (
        <div className="px-6 py-4 rounded-3xl bg-white dark:bg-slate-900 shadow-2xl border-2 border-indigo-100 dark:border-indigo-800 min-w-[200px] group relative hover:border-indigo-500 transition-all">
            {/* One handle per side — all source, connectionMode=loose handles direction */}
            <Handle id="top" type="source" position={Position.Top} className={`${handleStyle} bg-indigo-500`} />
            <Handle id="right" type="source" position={Position.Right} className={`${handleStyle} bg-indigo-500`} />
            <Handle id="bottom" type="source" position={Position.Bottom} className={`${handleStyle} bg-indigo-500`} />
            <Handle id="left" type="source" position={Position.Left} className={`${handleStyle} bg-indigo-500`} />

            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                    <ShieldCheck size={20} />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Approver</p>
                    <p className="font-bold text-slate-800 dark:text-white truncate">{data.label || 'Pilih User...'}</p>
                    <p className="text-[9px] text-indigo-500 font-bold truncate">{data.username || '-'}</p>
                </div>
            </div>

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
                </div>
            )}
        </div>
    );
};

const nodeTypes = {
    start: StartNode,
    end: EndNode,
    approver: ApproverNode,
};

// --- Designer Component ---

export default function WorkflowDesigner({ initialNodes = [], initialEdges = [], accentColor = '#6366f1', onSave, onClose, users = [] }) {
    const [nodes, setNodes] = useState(initialNodes.length > 0 ? initialNodes : [
        { id: 'start', type: 'start', position: { x: 50, y: 150 }, data: { label: 'Start' } },
        { id: 'end', type: 'end', position: { x: 600, y: 150 }, data: { label: 'End' } },
    ]);
    const [edges, setEdges] = useState(initialEdges);
    const [selectedNode, setSelectedNode] = useState(null);
    const [selectedEdgeId, setSelectedEdgeId] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef(null);

    const onNodesChange = useCallback(
        (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
        [setNodes]
    );
    const onEdgesChange = useCallback(
        (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
        [setEdges]
    );
    const resolvedAccentColor = accentColor || '#6366f1';

    const edgePalette = ['#6366f1', '#10b981', '#f43f5e', '#f59e0b', '#3b82f6'];

    const onConnect = useCallback(
        (params) => setEdges((eds) => addEdge({
            ...params,
            animated: true,
            type: 'smoothstep',
            markerEnd: { type: MarkerType.ArrowClosed, color: resolvedAccentColor, width: 20, height: 20 },
            style: { strokeWidth: 2.5, stroke: resolvedAccentColor }
        }, eds)),
        [setEdges, resolvedAccentColor]
    );

    const handleEdgeClick = useCallback((event, edge) => {
        event.stopPropagation();
        setSelectedNode(null);
        setSelectedEdgeId(edge.id);
    }, []);

    const updateSelectedEdgeColor = useCallback((color) => {
        if (!selectedEdgeId) return;
        setEdges((eds) => eds.map((edge) => {
            if (edge.id !== selectedEdgeId) return edge;
            return {
                ...edge,
                style: { ...(edge.style || {}), strokeWidth: 2.5, stroke: color },
                markerEnd: { type: MarkerType.ArrowClosed, color, width: 20, height: 20 }
            };
        }));
    }, [selectedEdgeId]);

    const deleteSelectedEdge = useCallback(() => {
        if (!selectedEdgeId) return;
        if (!window.confirm('Hapus garis koneksi ini?')) return;
        setEdges((eds) => eds.filter((e) => e.id !== selectedEdgeId));
        setSelectedEdgeId(null);
    }, [selectedEdgeId]);

    const addApprover = () => {
        const id = `node_${Date.now()}`;
        const newNode = {
            id,
            type: 'approver',
            position: { x: 300, y: 150 },
            data: { label: 'Klik untuk set user', username: '', instruction: '', documents: [] },
        };
        setNodes((nds) => nds.concat(newNode));
    };

    const handleNodeClick = (event, node) => {
        setSelectedEdgeId(null);
        if (node.type === 'approver') {
            setNodes(nds => {
                const latestNode = nds.find(n => n.id === node.id);
                setSelectedNode(latestNode || node);
                return nds;
            });
        } else {
            setSelectedNode(null);
        }
    };

    const updateNodeField = useCallback((fieldUpdates) => {
        if (!selectedNode) return;
        setNodes((nds) =>
            nds.map((node) => {
                if (node.id === selectedNode.id) {
                    const updated = {
                        ...node,
                        data: { ...node.data, ...fieldUpdates },
                    };
                    setSelectedNode(updated);
                    return updated;
                }
                return node;
            })
        );
    }, [selectedNode]);

    const selectUser = (username, name) => {
        updateNodeField({ label: name, username: username });
    };

    const updateInstruction = (text) => {
        updateNodeField({ instruction: text });
    };

    const handleFileUpload = async (e) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setIsUploading(true);
        try {
            const uploaded = [];
            for (const file of files) {
                const formData = new FormData();
                formData.append('file', file);
                const response = await fetch(`${API_URL}/upload`, {
                    method: 'POST',
                    credentials: 'include',
                    body: formData
                });
                if (!response.ok) throw new Error('Upload failed');
                const result = await response.json();
                uploaded.push({ url: result.url || result.path, name: file.name });
            }
            const currentDocs = selectedNode?.data?.documents || [];
            updateNodeField({ documents: [...currentDocs, ...uploaded] });
        } catch (err) {
            console.error('Upload error:', err);
            alert('Gagal upload file: ' + err.message);
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const removeDocument = (idx) => {
        const currentDocs = selectedNode?.data?.documents || [];
        updateNodeField({ documents: currentDocs.filter((_, i) => i !== idx) });
    };

    const deleteNode = (id) => {
        if (id === 'start' || id === 'end') return;
        setNodes((nds) => nds.filter((n) => n.id !== id));
        setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
        setSelectedNode(null);
    };

    const handleSave = () => {
        onSave({ nodes, edges });
    };

    const selectedEdge = edges.find((e) => e.id === selectedEdgeId) || null;
    const selectedEdgeColor = selectedEdge?.style?.stroke || resolvedAccentColor;

    const isImage = (url) => /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url);

    return (
        <div className="w-full h-full bg-slate-50 dark:bg-slate-950 relative overflow-hidden flex">
            {/* Toolbar */}
            <div className="w-80 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 p-6 flex flex-col gap-4 z-10 shadow-2xl overflow-hidden">
                <div className="flex justify-between items-center mb-2">
                    <h2 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                        <Save className="text-indigo-500" size={20} /> Workflow
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all">
                        <X size={20} className="text-slate-400" />
                    </button>
                </div>

                <div className="space-y-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Aksi</p>
                    <button
                        onClick={addApprover}
                        className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-500/20"
                    >
                        <User size={16} /> Tambah Approver
                    </button>
                </div>

                {selectedEdge && (
                    <div className="space-y-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Edge Properties</p>
                        <p className="text-[10px] text-slate-500">Pilih warna untuk garis yang sedang dipilih.</p>
                        <div className="flex items-center gap-2">
                            {edgePalette.map((color) => (
                                <button
                                    key={color}
                                    onClick={() => updateSelectedEdgeColor(color)}
                                    className={`w-7 h-7 rounded-full border-2 transition-all ${selectedEdgeColor === color ? 'border-white dark:border-slate-900 ring-2 ring-indigo-500 scale-110' : 'border-transparent opacity-70 hover:opacity-100'}`}
                                    style={{ backgroundColor: color }}
                                    title={`Warna ${color}`}
                                />
                            ))}
                        </div>
                        <button
                            onClick={deleteSelectedEdge}
                            className="w-full py-2.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-[10px] font-black uppercase tracking-widest border border-red-100 dark:border-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/30"
                        >
                            Hapus Garis Terpilih
                        </button>
                    </div>
                )}

                {selectedNode && (
                    <div className="flex-1 min-h-0 overflow-y-auto space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-300 custom-scrollbar pr-1">
                        {/* Header */}
                        <div className="flex justify-between items-center sticky top-0 bg-white dark:bg-slate-900 z-10 pb-2">
                            <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Node Properties</p>
                            <button onClick={() => deleteNode(selectedNode.id)} className="text-red-500 hover:text-red-600 p-1">
                                <Trash2 size={16} />
                            </button>
                        </div>

                        {/* User Picker */}
                        <div className="space-y-2">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-tight">Pilih User Approver</label>
                            <div className="grid grid-cols-1 gap-2 max-h-[160px] overflow-y-auto no-scrollbar">
                                {users.map(u => (
                                    <button
                                        key={u.username}
                                        onClick={() => selectUser(u.username, u.name)}
                                        className={`w-full text-left p-3 rounded-xl border-2 transition-all ${selectedNode.data.username === u.username ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'border-transparent bg-slate-50 dark:bg-slate-800 hover:border-slate-200'}`}
                                    >
                                        <p className="text-sm font-bold dark:text-white">{u.name}</p>
                                        <p className="text-[10px] text-slate-400">{u.username} - {u.department}</p>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Instruction */}
                        <div className="space-y-2">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-tight flex items-center gap-1">
                                <MessageSquareText size={10} className="text-indigo-500" /> Instruksi Kerja
                            </label>
                            <textarea
                                value={selectedNode.data.instruction || ''}
                                onChange={(e) => updateInstruction(e.target.value)}
                                placeholder="Tuliskan instruksi kerja untuk step ini..."
                                rows={4}
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500 rounded-2xl outline-none dark:text-white text-sm resize-none"
                            />
                        </div>

                        {/* File Upload */}
                        <div className="space-y-2">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-tight flex items-center gap-1">
                                <Paperclip size={10} className="text-amber-500" /> Lampiran
                            </label>
                            <input
                                ref={fileInputRef}
                                type="file"
                                multiple
                                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                                onChange={handleFileUpload}
                                className="hidden"
                            />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isUploading}
                                className="w-full py-3 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-2xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-amber-100 transition-all border-2 border-dashed border-amber-200 dark:border-amber-800 disabled:opacity-50"
                            >
                                {isUploading ? (
                                    <><span className="animate-spin">⏳</span> Uploading...</>
                                ) : (
                                    <><Upload size={14} /> Upload File</>
                                )}
                            </button>

                            {/* Attachment previews */}
                            {(selectedNode.data.documents || []).length > 0 && (
                                <div className="grid grid-cols-2 gap-2 mt-2">
                                    {(selectedNode.data.documents || []).map((doc, idx) => {
                                        const url = doc.url || doc;
                                        return (
                                            <div key={idx} className="relative group/att rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                                                {isImage(url) ? (
                                                    <img src={getFullUrl(url)} alt={doc.name || `File ${idx + 1}`} className="w-full aspect-video object-cover" />
                                                ) : (
                                                    <div className="flex items-center gap-2 p-3">
                                                        <FileText size={16} className="text-amber-500 flex-shrink-0" />
                                                        <span className="text-[9px] font-bold text-slate-600 dark:text-slate-300 truncate">
                                                            {doc.name || (typeof url === 'string' ? url.split('/').pop() : `File ${idx + 1}`)}
                                                        </span>
                                                    </div>
                                                )}
                                                <button
                                                    onClick={() => removeDocument(idx)}
                                                    className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover/att:opacity-100 transition-all shadow-lg"
                                                >
                                                    <X size={10} />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                    <button
                        onClick={handleSave}
                        className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-500 transition-all shadow-xl shadow-emerald-500/20"
                    >
                        Terapkan Alur
                    </button>
                </div>
            </div>

            {/* Canvas */}
            <div className="flex-1 relative">
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onEdgeClick={handleEdgeClick}
                    nodeTypes={nodeTypes}
                    onNodeClick={handleNodeClick}
                    onPaneClick={() => {
                        setSelectedNode(null);
                        setSelectedEdgeId(null);
                    }}
                    connectionMode="loose"
                    deleteKeyCode="Delete"
                    fitView
                    className="bg-slate-50 dark:bg-[#0B1437]"
                >
                    <Background color="#94a3b8" gap={20} size={1} />
                    <Controls />
                    <Panel position="top-right" className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-3 rounded-2xl border border-white/20 shadow-xl">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status Flow</p>
                        <p className="text-xs font-bold text-slate-800 dark:text-white">Drafting Master Flow</p>
                    </Panel>
                </ReactFlow>
            </div>
        </div>
    );
}
