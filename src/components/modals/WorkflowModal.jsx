import React from 'react';
import Modal from '../common/Modal';
import WorkflowDesigner from '../workflow/WorkflowDesigner';

export default function WorkflowModal({
  isOpen,
  onClose,
  editingFlow,
  flowForm,
  setFlowForm,
  handleSaveVisualFlow,
  users
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingFlow ? `Edit Alur: ${flowForm.name}` : "Desain Alur Baru"}
      size="max-w-7xl"
      noPadding
    >
      <div className="flex h-full min-h-0 flex-col">
        {/* Header Controls (Name & Description) */}
        <div className="p-6 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nama Alur Persetujuan</label>
            <input
              className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500 rounded-2xl outline-none dark:text-white font-black"
              placeholder="Contoh: Alur Pengadaan Barang"
              value={flowForm.name}
              onChange={e => setFlowForm({ ...flowForm, name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Deskripsi Singkat</label>
            <input
              className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500 rounded-2xl outline-none dark:text-white font-medium"
              placeholder="Tujuan dari alur persetujuan ini..."
              value={flowForm.description}
              onChange={e => setFlowForm({ ...flowForm, description: e.target.value })}
            />
          </div>
        </div>

        <div className="flex-1 min-h-0">
          <WorkflowDesigner
            initialNodes={flowForm.visual_config?.nodes || []}
            initialEdges={flowForm.visual_config?.edges || []}
            users={users}
            onClose={onClose}
            onSave={({ nodes, edges }) => {
              const approverNodes = nodes.filter(n => n.type === 'approver');
              const steps = approverNodes.map(n => ({
                username: n.data.username,
                name: n.data.label,
                nodeId: n.id
              }));

              const updatedForm = {
                ...flowForm,
                steps: steps,
                visual_config: { nodes, edges }
              };

              setFlowForm(updatedForm);
              handleSaveVisualFlow(updatedForm);
            }}
          />
        </div>
      </div>
    </Modal>
  );
}