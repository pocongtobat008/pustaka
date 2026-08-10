// Bangun rantai reject lengkap dari relasi dua arah (rejected_from_id & replacement_id).
// Dipakai bersama oleh tabel invoice (Invoices.jsx) dan modal detail (SuperDetailModal.jsx).
export const buildRejectChain = (inv, invoices) => {
    if (!inv) return [];
    const byId = new Map();
    (invoices || []).forEach(i => byId.set(Number(i.id), i));
    const chain = [];
    const seen = new Set();
    let cur = inv;
    while (cur && !seen.has(Number(cur.id))) {
        seen.add(Number(cur.id));
        chain.unshift(cur);
        const prevId = cur.rejected_from_id;
        cur = prevId ? byId.get(Number(prevId)) : null;
    }
    cur = inv;
    while (cur) {
        const nextId = cur.replacement_id;
        const next = nextId ? byId.get(Number(nextId)) : null;
        if (!next || seen.has(Number(next.id))) break;
        seen.add(Number(next.id));
        chain.push(next);
        cur = next;
    }
    return chain;
};
