import React from 'react';
import { Truck } from 'lucide-react';
import Modal from '../common/Modal';

export default function ExternalTransferModal({ isOpen, onClose, externalDate, setExternalDate, handleExternalTransfer }) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Kirim ke Indoarsip"
      size="max-w-sm"
    >
      <div className="pt-24">
        <div className="w-16 h-16 rounded-[2rem] bg-indigo-600 text-white flex items-center justify-center shadow-2xl shadow-indigo-600/30 mx-auto mb-6">
          <Truck size={32} />
        </div>

        <p className="text-xs text-center text-slate-500 mb-8 font-black uppercase tracking-widest opacity-60">Tentukan Tanggal Pengiriman</p>

        <div className="space-y-6">
          <div className="relative group">
            <input
              type="date"
              value={externalDate}
              onChange={(e) => setExternalDate(e.target.value)}
              className="w-full px-6 py-4 text-lg font-black border-2 border-indigo-500/10 bg-slate-50 dark:bg-slate-800/50 rounded-2xl focus:border-indigo-500 transition-all outline-none dark:text-white"
            />
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => handleExternalTransfer('Indoarsip', externalDate)}
              className="w-full py-4 bg-indigo-600 text-white text-xs font-black rounded-2xl hover:bg-indigo-500 shadow-xl shadow-indigo-500/30 transition-all transform active:scale-95 uppercase tracking-widest"
            >
              Konfirmasi Pengiriman
            </button>
            <button onClick={onClose} className="w-full py-4 bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white text-xs font-black rounded-2xl transition-all uppercase tracking-widest">Batalkan</button>
          </div>
        </div>
      </div>
    </Modal>
  );
}