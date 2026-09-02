import React from 'react';
import { Truck } from 'lucide-react';
import Modal from '../common/Modal';
import { useLanguage } from '../../contexts/LanguageContext';

export default function ExternalTransferModal({ isOpen, onClose, externalDate, setExternalDate, handleExternalTransfer }) {
    const { t } = useLanguage();
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("modal.externalTransfer")}
      size="max-w-sm"
    >
      <div className="pt-4">
        <div className="w-16 h-16 rounded-[2rem] bg-blue-600 text-white flex items-center justify-center shadow-2xl shadow-blue-600/30 mx-auto mb-6">
          <Truck size={32} />
        </div>

        <p className="text-xs text-center text-stone-500 mb-8 font-black uppercase tracking-widest opacity-60">Tentukan Tanggal Pengiriman</p>

        <div className="space-y-6">
          <div className="relative group">
            <input
              type="date"
              value={externalDate}
              onChange={(e) => setExternalDate(e.target.value)}
              className="w-full px-6 py-4 text-lg font-black border-2 border-blue-500/10 bg-stone-50 dark:bg-[#0d0d0d]/50 rounded-2xl focus:border-blue-500 transition-all outline-none dark:text-white"
            />
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => handleExternalTransfer('Indoarsip', externalDate)}
              className="w-full py-4 bg-blue-600 text-white text-xs font-black rounded-2xl hover:bg-blue-500 shadow-xl shadow-blue-500/30 transition-all transform active:scale-95 uppercase tracking-widest"
            >
              Konfirmasi Pengiriman
            </button>
            <button onClick={onClose} className="w-full py-4 bg-stone-100 dark:bg-[#0d0d0d] text-stone-500 hover:text-stone-800 dark:hover:text-white text-xs font-black rounded-2xl transition-all uppercase tracking-widest">Batalkan</button>
          </div>
        </div>
      </div>
    </Modal>
  );
}