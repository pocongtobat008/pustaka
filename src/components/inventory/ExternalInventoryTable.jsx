import React from 'react';
import { Package, Clock, FileText, Truck } from 'lucide-react';

export default function ExternalInventoryTable({
    externalItems,
    isMatch,
    onViewExternal,
    onRestoreExternal,
    hasPermission
}) {
    return (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 overflow-hidden">
                <table className="w-full text-sm text-left border-collapse">
                    <thead className="bg-white/60 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 backdrop-blur-xl border-b border-white/30 dark:border-white/5">
                        <tr>
                            <th className="px-6 py-5 font-bold uppercase tracking-wider text-xs">Box ID</th>
                            <th className="px-6 py-5 font-bold uppercase tracking-wider text-xs">Tujuan</th>
                            <th className="px-6 py-5 font-bold uppercase tracking-wider text-xs">Tanggal Kirim</th>
                            <th className="px-6 py-5 font-bold uppercase tracking-wider text-xs">Pengirim</th>
                            <th className="px-6 py-5 font-bold uppercase tracking-wider text-xs">Isi</th>
                            <th className="px-6 py-5 font-bold uppercase tracking-wider text-xs">Status</th>
                            <th className="px-6 py-5 font-bold uppercase tracking-wider text-xs text-right">Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {externalItems.filter(isMatch).length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-6 py-8 text-center text-gray-500 dark:text-slate-400">
                                    Belum ada data barang keluar {externalItems.length > 0 && "yang cocok dengan pencarian"}.
                                </td>
                            </tr>
                        ) : (
                            externalItems.filter(isMatch).map(item => (
                                <tr key={item.id} className="hover:bg-white/40 dark:hover:bg-slate-800/40 transition-colors group border-b border-indigo-50 dark:border-slate-800/50">
                                    <td className="px-6 py-4 font-bold text-slate-800 dark:text-white flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                            <Package size={20} />
                                        </div>
                                        {item.boxId}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="px-3 py-1 bg-indigo-100/50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs font-bold border border-indigo-200 dark:border-indigo-500/30 backdrop-blur-sm shadow-sm">{item.destination}</span>
                                    </td>
                                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                                        <div className="flex items-center gap-2">
                                            <Clock size={14} className="text-indigo-400" />
                                            {new Date(item.sentDate).toLocaleDateString()}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center text-[10px] font-bold shadow-inner">
                                                {item.sender?.charAt(0) || '?'}
                                            </div>
                                            <span className="font-medium text-xs">{item.sender}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                                            {(item.boxData?.ordners?.length || 0)} Ord • {(item.boxData?.ordners?.reduce((acc, o) => acc + (o.invoices?.length || 0), 0) || 0)} Inv
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                                            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_#10b981] animate-pulse"></div>
                                            Archived
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex gap-2 justify-end transition-opacity">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onViewExternal(item); }}
                                                className="group/btn relative p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-indigo-500/50 hover:shadow-lg hover:shadow-indigo-500/10 transition-all duration-300"
                                                title="Lihat Detail"
                                            >
                                                <div className="absolute inset-0 bg-indigo-500/5 rounded-xl opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300"></div>
                                                <FileText size={18} className="text-slate-400 group-hover/btn:text-indigo-600 transition-colors duration-300 relative z-10" />
                                            </button>
                                            {hasPermission('inventory', 'edit') && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); onRestoreExternal(item); }}
                                                    className="group/btn relative p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-emerald-500/50 hover:shadow-lg hover:shadow-emerald-500/10 transition-all duration-300"
                                                    title="Restore ke Gudang"
                                                >
                                                    <div className="absolute inset-0 bg-emerald-500/5 rounded-xl opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300"></div>
                                                    <Truck size={18} className="text-slate-400 group-hover/btn:text-emerald-600 transition-colors duration-300 relative z-10 transform rotate-180" />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
