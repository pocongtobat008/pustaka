import React from 'react';
import { Package, Plus } from 'lucide-react';

// Move Cell outside to prevent re-creation (and thus re-mounting) on every parent render
// This is the primary fix for the "flickering/blinking" issue.
// Accept `docList` so the Cell can consult document OCR results if the invoice entry itself
// doesn't yet have `ocrContent` (fallback to server-side `documents` table).
const Cell = React.memo(({ slotId, slot, handleSlotClick, getStatusStyle, isMatch, inventorySearchQuery, docList = [] }) => {
    const status = (slot.status || 'EMPTY').toUpperCase();
    const statusStyle = getStatusStyle(status);
    const matched = isMatch(slot);

    // Parse box_data safely to check for OCR processing
    let boxData = slot.box_data || slot.boxData;
    if (typeof boxData === 'string') {
        try { boxData = JSON.parse(boxData); } catch (e) { boxData = null; }
    }

    // Safety net: don't show spinner if OCR content already exists (broadened check)
    const isOcrProcessing = boxData?.ordners?.some(ord =>
        ord.invoices?.some(inv => {
            const hasStatus = (inv.status === 'processing' || inv.status === 'waiting' || inv.status === 'stalled');
            const content = inv.ocrContent || inv.ocr_content || '';
            let hasContent = content.trim().length > 0;

            // Fallback: look up corresponding document in docList by id or invoice/file metadata
            if (!hasContent && Array.isArray(docList) && docList.length > 0) {
                const matched = docList.find(d => d && (String(d.id) === String(inv.id) || (d.title && inv.fileName && d.title.includes(inv.fileName)) || (d.invoiceNo && String(d.invoiceNo) === String(inv.invoiceNo))));
                if (matched && (matched.ocrContent || matched.ocr_content) && String(matched.ocrContent || matched.ocr_content).trim().length > 0) {
                    hasContent = true;
                }
                // Also if matched doc status indicates done, treat as having content
                if (matched && (matched.status === 'done' || matched.status === 'completed' || matched.status === 'READY' || matched.status === 'READY'.toLowerCase())) {
                    hasContent = true;
                }
            }

            return hasStatus && !hasContent;
        })
    );

    return (
        <button
            onClick={() => handleSlotClick(slot)}
            disabled={!matched && inventorySearchQuery}
            className={`h-full w-full min-h-[140px] rounded-[2rem] flex flex-col items-center justify-center relative group transition-all duration-500 animate-in zoom-in-90 fade-in fill-mode-both p-4
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
                    {boxData?.id && (
                        <div className="space-y-1 w-full flex flex-col items-center">
                            <p className="text-[11px] font-black uppercase tracking-tighter truncate max-w-full text-center bg-white/80 dark:bg-black/60 backdrop-blur-md rounded-xl px-3 py-1 shadow-sm text-slate-800 dark:text-white border border-white/20">
                                {boxData.id}
                            </p>
                            <p className="text-[9px] font-bold opacity-40 uppercase tracking-widest">{status}</p>
                        </div>
                    )}
                    {matched && inventorySearchQuery && (
                        <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-[10px] px-3 py-1 rounded-full font-black shadow-xl animate-bounce pointer-events-none whitespace-nowrap z-20 ring-4 ring-indigo-500/20">SEARCH MATCH</div>
                    )}
                    {isOcrProcessing && (
                        <div className="absolute -top-4 -right-4 bg-amber-500 text-white p-1.5 rounded-full shadow-lg animate-pulse z-30" title="Sedang memproses dokumen (OCR)">
                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        </div>
                    )}
                </div>
            ) : (
                <div className="flex flex-col items-center gap-2 opacity-40 group-hover:opacity-100 transition-all">
                    <Plus size={40} className="text-slate-300 dark:text-slate-600 group-hover:text-indigo-400 group-hover:rotate-90 transition-all duration-500" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Kosong</span>
                </div>
            )}
        </button>
    );
});

export default function InventoryGrid({
    TOTAL_SLOTS,
    inventory,
    docList = [],
    handleSlotClick,
    getStatusStyle,
    isMatch,
    inventorySearchQuery,
    currentPage = 1,
    itemsPerPage = 25
}) {
    // Determine which slots to show
    const startIdx = (currentPage - 1) * itemsPerPage;
    const endIdx = startIdx + itemsPerPage;

    // Filter which slots actually match the query
    let allDisplaySlots = [];
    if (inventorySearchQuery) {
        for (let i = 1; i <= TOTAL_SLOTS; i++) {
            const slot = inventory.find(s => Number(s.id) === i) || { id: i, status: 'EMPTY' };
            if (isMatch(slot)) allDisplaySlots.push(i);
        }
    } else {
        for (let i = 1; i <= TOTAL_SLOTS; i++) {
            allDisplaySlots.push(i);
        }
    }

    // Slice for pagination
    const visibleSlotIds = allDisplaySlots.slice(startIdx, endIdx);

    return (
        <div className="w-full min-h-[500px]">
            {visibleSlotIds.length > 0 ? (
                <div className="grid grid-cols-5 gap-4 auto-rows-fr">
                    {visibleSlotIds.map(slotId => {
                        const slot = inventory.find(s => Number(s.id) === slotId) || { id: slotId, status: 'EMPTY' };
                        return (
                            <div key={slotId} className="h-full">
                                <Cell
                                    slotId={slotId}
                                    slot={slot}
                                    docList={docList}
                                    handleSlotClick={handleSlotClick}
                                    getStatusStyle={getStatusStyle}
                                    isMatch={isMatch}
                                    inventorySearchQuery={inventorySearchQuery}
                                />
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="w-full h-[300px] flex items-center justify-center text-gray-400 font-medium">
                    Tidak ada slot yang ditemukan.
                </div>
            )}
        </div>
    );
}
