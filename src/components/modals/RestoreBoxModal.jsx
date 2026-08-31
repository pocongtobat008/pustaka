import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
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
    const { t } = useLanguage();
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Restore Box"
      size="max-w-md"
    >
      <div className="relative z-10 pt-4">
        <div className="flex justify-between items-center mb-6">
          <div>
            <p className="text-xs text-slate-500 dark:text-white/40 font-medium tracking-wide uppercase mt-1">
              Kembalikan ke Gudang
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-500 to-blue-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
            <Truck className="text-white" size={24} />
          </div>
        </div>

        <div className="bg-white/50 dark:bg-[#0d0d0d]/50 rounded-2xl p-4 border border-white/40 dark:border-white/5 mb-6 flex gap-4 items-center">
          <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <Package size={20} />
          </div>
          <div>
            <h4 className="font-bold text-slate-800 dark:text-white text-lg">{selectedExternalItem?.boxId}</h4>
            <p className="text-xs text-slate-500 dark:text-white/40">
              Dari: <span className="font-semibold text-blue-500">{selectedExternalItem?.destination}</span>
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 dark:text-white/40 uppercase tracking-wider ml-1">
              Pilih Slot Tujuan (Kosong)
            </label>
            <div className="relative">
              <select
                className="w-full appearance-none bg-white/50 dark:bg-[#0d0d0d]/50 border border-slate-200 dark:border-white/[0.06] rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all cursor-pointer hover:bg-white/80 dark:hover:bg-white/[0.05]/80"
                value={restoreTargetSlot}
                onChange={(e) => setRestoreTargetSlot(e.target.value)}
              >
                <option value="">{t("opt.selectSlot")}</option>
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
            <button onClick={onClose} className="flex-1 px-4 py-3 rounded-xl text-sm font-bold text-slate-500 hover:text-slate-700 dark:text-white/40 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-all">Batal</button>
            <button
              onClick={handleRestoreExternal}
              disabled={!restoreTargetSlot}
              className={`flex-[2] px-4 py-3 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 shadow-lg transition-all ${!restoreTargetSlot ? 'bg-slate-300 dark:bg-[#111] cursor-not-allowed text-slate-400' : 'bg-gradient-to-r from-blue-600 to-blue-600 hover:from-blue-500 hover:to-blue-500 hover:shadow-blue-500/25 hover:scale-[1.02] active:scale-95'}`}
            >
              <ArrowRight size={18} /> Konfirmasi
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}