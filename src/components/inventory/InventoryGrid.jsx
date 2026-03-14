import React from 'react';
import { Package, Plus } from 'lucide-react';

export default function InventoryGrid({
    TOTAL_SLOTS,
    inventory,
    handleSlotClick,
    getStatusStyle,
    isMatch,
    inventorySearchQuery,
    currentPage = 1,
    itemsPerPage = 25
}) {
    // Determine which slots to show
    const startIdx = (currentPage - 1) * itemsPerPage;
    const endIdx = inventorySearchQuery ? TOTAL_SLOTS : Math.min(startIdx + itemsPerPage, TOTAL_SLOTS);

    // In search mode, we show everything that matches, but if not searching, we show the page slice
    const visibleSlotIds = [];
    if (inventorySearchQuery) {
        // Show only matching slots when searching
        for (let i = 1; i <= TOTAL_SLOTS; i++) {
            const slot = inventory.find(s => Number(s.id) === i) || { id: i, status: 'EMPTY' };
            if (isMatch(slot)) visibleSlotIds.push(i);
        }
    } else {
        // Show fixed page slice when not searching
        for (let i = startIdx + 1; i <= endIdx; i++) {
            visibleSlotIds.push(i);
        }
    }

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {visibleSlotIds.map((slotId, displayIdx) => {
                const slot = inventory.find(s => Number(s.id) === slotId) || { id: slotId, status: 'EMPTY' };
                const status = (slot.status || 'EMPTY').toUpperCase();
                const statusStyle = getStatusStyle(status);
                const matched = isMatch(slot);

                return (
                    <button
                        key={slotId}
                        onClick={() => handleSlotClick(slot)}
                        disabled={!matched && inventorySearchQuery}
                        style={{ animationDelay: `${displayIdx * 10}ms` }}
                        className={`aspect-square rounded-[2rem] flex flex-col items-center justify-center relative group transition-all duration-500 animate-in zoom-in-90 fade-in fill-mode-both p-4
                        ${status === 'EMPTY'
                                ? 'bg-white/30 dark:bg-slate-800/20 backdrop-blur-sm border-2 border-dashed border-slate-300/60 dark:border-slate-600/60 hover:border-indigo-400 hover:bg-white/60 dark:hover:bg-slate-800/40 hover:shadow-[0_0_30px_rgba(99,102,241,0.2)] hover:scale-105 z-0 hover:z-10'
                                : `border-2 ${statusStyle.color} shadow-xl hover:shadow-2xl hover:scale-110 hover:-rotate-2 z-0 hover:z-10 ring-1 ring-white/10 opacity-100`
                            }
                        ${!matched && inventorySearchQuery ? 'opacity-20 grayscale cursor-not-allowed scale-90' : 'opacity-100'}
                    `}
                    >
                        <span className="text-[12px] font-black font-mono mb-1 text-slate-400/50 absolute top-4 right-6 z-10 mix-blend-multiply dark:mix-blend-screen opacity-40 group-hover:opacity-100 transition-opacity">#{String(slotId).padStart(3, '0')}</span>

                        {status !== 'EMPTY' ? (
                            <div className="flex flex-col items-center gap-3 w-full px-2 relative z-10 transition-transform duration-500 group-hover:scale-110">
                                <div className={`p-4 rounded-[1.5rem] bg-white/40 dark:bg-black/20 backdrop-blur-md shadow-inner group-hover:shadow-indigo-500/50 transition-all ${statusStyle.color.replace('border-', 'text-')}`}>
                                    <Package size={32} className="opacity-90 group-hover:scale-125 transition-transform duration-500" />
                                </div>
                                {slot.boxData?.id && (
                                    <div className="space-y-1 w-full flex flex-col items-center">
                                        <p className="text-[11px] font-black uppercase tracking-tighter truncate max-w-full text-center bg-white/80 dark:bg-black/60 backdrop-blur-md rounded-xl px-3 py-1 shadow-sm text-slate-800 dark:text-white border border-white/20">
                                            {slot.boxData.id}
                                        </p>
                                        <p className="text-[9px] font-bold opacity-40 uppercase tracking-widest">{status}</p>
                                    </div>
                                )}
                                {/* Matches & Snippets */}
                                {isMatch(slot) && inventorySearchQuery && (
                                    <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-[10px] px-3 py-1 rounded-full font-black shadow-xl animate-bounce pointer-events-none whitespace-nowrap z-20 ring-4 ring-indigo-500/20">SEARCH MATCH</div>
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-2 opacity-40 group-hover:opacity-100 transition-all">
                                <Plus size={40} className="text-slate-300 dark:text-slate-600 group-hover:text-indigo-400 group-hover:rotate-90 transition-all duration-500" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Kosong</span>
                            </div>
                        )}
                    </button>
                )
            })}
        </div>
    );
}
