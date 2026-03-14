import React from 'react';
import { Truck, Package, ChevronRight, CheckCircle2, ArrowRight } from 'lucide-react';
import Modal from '../common/Modal';

export default function RestoreBoxModal({ 
  isOpen, 
  onClose, 
  selectedExternalItem, 
  inventory, 
  restoreTargetSlot, 
  setRestoreTargetSlot, 
  handleRestoreExternal 
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Restore Box"
      size="max-w-md"
    >
      <div className="relative z-10 pt-24">
        <div className="flex justify-between items-center mb-6">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium tracking-wide uppercase mt-1">
              Kembalikan ke Gudang
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <Truck className="text-white" size={24} />
          </div>
        </div>

        <div className="bg-white/50 dark:bg-slate-800/50 rounded-2xl p-4 border border-white/40 dark:border-white/5 mb-6 flex gap-4 items-center">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <Package size={20} />
          </div>
          <div>
            <h4 className="font-bold text-slate-800 dark:text-white text-lg">{selectedExternalItem?.boxId}</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Dari: <span className="font-semibold text-indigo-500">{selectedExternalItem?.destination}</span>
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-1">
              Pilih Slot Tujuan (Kosong)
            </label>
            <div className="relative">
              <select
                className="w-full appearance-none bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all cursor-pointer hover:bg-white/80 dark:hover:bg-slate-800/80"
                value={restoreTargetSlot}
                onChange={(e) => setRestoreTargetSlot(e.target.value)}
              >
                <option value="">-- Pilih Slot Kosong --</option>
                {inventory.filter(s => s.status === 'EMPTY').map(s => (
                  <option key={s.id} value={s.id}>Slot #{String(s.id).padStart(3, '0')}</option>
                ))}
              </select>
              <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 rotate-90 pointer-events-none" size={16} />
            </div>
            {restoreTargetSlot && (
              <p className="text-[10px] text-green-500 font-bold ml-1 flex items-center gap-1 animate-in fade-in slide-in-from-left-2">
                <CheckCircle2 size={10} /> Slot tersedia
              </p>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <button onClick={onClose} className="flex-1 px-4 py-3 rounded-xl text-sm font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-all">Batal</button>
            <button
              onClick={handleRestoreExternal}
              disabled={!restoreTargetSlot}
              className={`flex-[2] px-4 py-3 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 shadow-lg transition-all ${!restoreTargetSlot ? 'bg-slate-300 dark:bg-slate-700 cursor-not-allowed text-slate-400' : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 hover:shadow-indigo-500/25 hover:scale-[1.02] active:scale-95'}`}
            >
              <ArrowRight size={18} /> Konfirmasi
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}