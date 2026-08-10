// ── Template Mapping PDF (Ekstraksi berbasis sampel) ──
// Sampel dokumen dipetakan (label → field id, tabel dinamis → kolom), disimpan sebagai
// template, lalu dipakai untuk mengekstrak PDF asli secara otomatis.
// Ekstraksi memakai posisi teks (pdfjs) sehingga tabel dinamis bisa dipetakan per kolom.
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const Y_TOLERANCE = 4;            // ambang pengelompokan baris (satuan pdf point)
const TABLE_TERMINATORS = ['subtotal', 'total', 'ppn', 'uang masuk', 'dibuat oleh', 'grand total', 'jumlah', 'ttd', 'disetujui', 'halaman'];

const norm = (s) => String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

// Bersihkan nilai: buang titik dua / spasi / koma di awal (mis. ": PT. AMESU UTAMA" → "PT. AMESU UTAMA")
const cleanValue = (s) => String(s || '').replace(/^[\s:：,;]+/, '').trim();

// Token mata uang yang berdiri sendiri (IDR / Rp) — tidak bermakna sebagai isi sel
const CURRENCY_TOKENS = new Set(['idr', 'rp']);

// ── Ekstrak item teks berposisi dari semua halaman PDF ──
export async function extractPdfItems(buffer) {
    // pdfjs menolak Buffer (meski subclass Uint8Array) → salin eksplisit ke Uint8Array
    const data = new Uint8Array(buffer);
    const doc = await getDocument({ data, useSystemFonts: true, isEvalSupported: false }).promise;
    const pages = [];
    try {
        for (let p = 1; p <= doc.numPages; p++) {
            const page = await doc.getPage(p);
            const vp = page.getViewport({ scale: 1 });
            const tc = await page.getTextContent();
            const items = (tc.items || [])
                .map(it => ({
                    str: it.str,
                    x: it.transform[4],
                    y: it.transform[5],
                    w: it.width || 0,
                }))
                .filter(i => i.str && i.str.trim());
            pages.push({ page: p, width: vp.width, height: vp.height, items });
        }
    } finally {
        try { await doc.destroy(); } catch { /* ignore */ }
    }
    return pages;
}

// ── Kelompokkan item menjadi baris teks per halaman (atas → bawah) ──
export function groupLines(pages) {
    return pages.map(pg => {
        const sorted = [...pg.items].sort((a, b) => b.y - a.y);
        const lines = [];
        for (const it of sorted) {
            // Cari baris yang sudah ada dengan y dekat (baris yang sama)
            let line = null;
            for (let i = lines.length - 1; i >= 0; i--) {
                if (Math.abs(lines[i].y - it.y) <= Y_TOLERANCE) { line = lines[i]; break; }
            }
            if (line) {
                line.items.push(it);
            } else {
                lines.push({ y: it.y, items: [it] });
            }
        }
        for (const l of lines) l.items.sort((a, b) => a.x - b.x);
        lines.sort((a, b) => b.y - a.y);
        return { ...pg, lines };
    });
}

// Gabungkan item baris menjadi teks (spasi cerdas berdasarkan celah x)
export function lineText(line) {
    if (!line || !line.items || !line.items.length) return '';
    let out = '';
    let prevEnd = -Infinity;
    for (const it of line.items) {
        if (prevEnd > -Infinity && it.x > prevEnd + 1) out += ' ';
        out += it.str;
        prevEnd = it.x + it.w;
    }
    return out;
}

// Teks semua halaman (untuk regex / deteksi label)
export function allLineTexts(pagesLines) {
    const out = [];
    for (const pg of pagesLines) {
        for (const l of pg.lines) out.push({ page: pg.page, y: l.y, text: lineText(l) });
    }
    return out;
}

// Cari baris yang mengandung label (case-insensitive, toleran titik/spasi)
export function findLabelLine(pagesLines, label) {
    const n = norm(label);
    if (!n) return null;
    for (const pg of pagesLines) {
        for (const l of pg.lines) {
            const lt = norm(lineText(l));
            if (lt.includes(n)) return { page: pg.page, line: l, lineText: lineText(l) };
        }
    }
    return null;
}

// ── Terapkan aturan label → nilai pada satu template field ──
// Kembalikan { value, page, x, y, w, h, confidence } bila ditemukan, null bila tidak.
// x/y/w/h adalah koordinat halaman PDF (pdf point, origin kiri-bawah), dipakai untuk overlay viewer.
export function locateFieldValue(pagesLines, field) {
    const pattern = String(field.pattern || field.field_label || '').trim();
    if (!pattern) return null;

    // Box teks sebuah baris: dari item pertama hingga item terakhir (kiri-bawah origin)
    const lineBox = (line) => {
        if (!line?.items?.length) return null;
        const items = [...line.items].sort((a, b) => a.x - b.x);
        const x0 = items[0].x;
        const x1 = items[items.length - 1].x + (items[items.length - 1].w || 0);
        // perkiraan tinggi teks ≈ 12 pt, baseline di y
        return { x: x0, y: line.y, w: Math.max(2, x1 - x0), h: 12 };
    };

    if (field.match_type === 'regex') {
        try {
            const re = new RegExp(pattern, 'i');
            for (const pg of pagesLines) {
                for (const l of pg.lines) {
                    const t = lineText(l);
                    const m = t.match(re);
                    if (m) {
                        const box = lineBox(l);
                        if (!box) continue;
                        return { value: (m[1] ?? m[0] ?? '').trim(), page: pg.page, ...box, confidence: 0.75 };
                    }
                }
            }
        } catch { /* regex invalid */ }
        return null;
    }

    // ── Label di dalam satu bagian (section) dokumen ──
    // field.anchor = judul bagian (mis. "KEPADA PENJUAL"); field.pattern = label (mis. "NAMA").
    // Mencari baris anchor dulu, lalu label pertama DI BAWAHNYA → nilai di baris yang sama.
    // Solusi untuk label kembar (mis. "NAMA"/"NPWP" milik PEMBELI vs KEPADA PENJUAL).
    if (field.match_type === 'label_after_anchor') {
        const anchor = String(field.anchor || '').trim();
        const aNorm = norm(anchor);
        const n = norm(pattern);
        if (!aNorm || !n) return null;
        for (const pg of pagesLines) {
            let anchorLine = null;
            for (const l of pg.lines) {
                if (norm(lineText(l)).includes(aNorm)) { anchorLine = l; break; }
            }
            if (!anchorLine) continue;
            // Baris di bawah anchor (urutan lines sudah atas → bawah)
            for (const l of pg.lines) {
                if (l.y >= anchorLine.y) continue;
                const lineItems = [...l.items].sort((a, b) => a.x - b.x);
                const lineStr = lineText(l);
                const labelIdx = lineItems.findIndex(it => norm(it.str) === n || (norm(it.str).length >= 3 && norm(lineStr).includes(n) && norm(it.str).includes(n)));
                if (labelIdx >= 0) {
                    const valItems = lineItems.slice(labelIdx + 1);
                    const val = cleanValue(valItems.map(i => i.str).join(' '));
                    if (val) {
                        const exact = norm(lineItems[labelIdx].str) === n;
                        const x0 = valItems[0].x;
                        const x1 = valItems[valItems.length - 1].x + (valItems[valItems.length - 1].w || 0);
                        return { value: val, page: pg.page, x: x0, y: l.y, w: Math.max(2, x1 - x0), h: 12, confidence: exact ? 0.97 : 0.9 };
                    }
                }
            }
        }
        return null;
    }

    const n = norm(pattern);
    for (const pg of pagesLines) {
        for (const l of pg.lines) {
            const lineItems = [...l.items].sort((a, b) => a.x - b.x);
            const lineStr = lineText(l);

            if (field.match_type === 'label_same_line') {
                const labelIdx = lineItems.findIndex(it => norm(it.str) === n || (norm(it.str).length >= 3 && norm(lineStr).includes(n) && norm(it.str).includes(n)));
                if (labelIdx >= 0) {
                    const valItems = lineItems.slice(labelIdx + 1);
                    const val = cleanValue(valItems.map(i => i.str).join(' '));
                    if (val) {
                        const exact = norm(lineItems[labelIdx].str) === n;
                        const x0 = valItems[0].x;
                        const x1 = valItems[valItems.length - 1].x + (valItems[valItems.length - 1].w || 0);
                        return { value: val, page: pg.page, x: x0, y: l.y, w: Math.max(2, x1 - x0), h: 12, confidence: exact ? 0.97 : 0.9 };
                    }
                }
                // Fallback: label di awal teks baris → ambil sisa setelah label
                const idx = lineStr.toLowerCase().indexOf(pattern.toLowerCase());
                if (idx >= 0) {
                    const rest = cleanValue(lineStr.slice(idx + pattern.length));
                    if (rest) {
                        const box = lineBox(l);
                        return { value: rest, page: pg.page, ...box, confidence: 0.8 };
                    }
                }
            }

            if (field.match_type === 'label_next_line') {
                if (norm(lineStr).includes(n) && lineStr.trim().length <= pattern.length * 1.6 + 8) {
                    const below = pg.lines
                        .filter(x => x.y < l.y - Y_TOLERANCE)
                        .sort((a, b) => b.y - a.y);
                    for (const bl of below) {
                        const t = lineText(bl).trim();
                        if (t) {
                            const box = lineBox(bl);
                            return { value: cleanValue(t), page: pg.page, ...box, confidence: 0.93 };
                        }
                    }
                }
            }
        }
    }
    return null;
}

// Terapkan aturan label → nilai (kompatibel: kembalikan string saja)
export function applyFieldRule(pagesLines, field) {
    return locateFieldValue(pagesLines, field)?.value || '';
}

// ── Parsing tabel dinamis dari baris berposisi ──
// tableDef: { columns: [{key, label}], terminator?: string[], groupBy?: {key, label, pattern} }
// groupBy = kolom yang nilainya ada pada baris DI ATAS baris data (mis. no faktur di atas item),
// diwariskan ke semua baris data di bawahnya sampai ada nilai grup baru.
export function extractTable(pagesLines, tableDef) {
    const cols = (tableDef?.columns || []).filter(c => c.label || c.key);
    if (!cols.length) return { found: false, rows: [], headerPage: null };

    const groupBy = tableDef?.groupBy || null;
    let groupRe = null;
    let groupPlain = '';
    if (groupBy?.pattern) {
        try { groupRe = new RegExp(groupBy.pattern); } catch { groupRe = null; }
        if (!groupRe) groupPlain = String(groupBy.pattern).toLowerCase();
    }
    const isGroupLine = (t) => {
        if (!t) return false;
        if (groupRe) return groupRe.test(t);
        return groupPlain ? t.toLowerCase().includes(groupPlain) : false;
    };

    // Gabung item dari baris yang berdekatan (header bisa terpecah 2 baris)
    const HEADER_MERGE_Y = 12;
    const mergedHeaderItems = (pg, anchorLine) => {
        const out = [...anchorLine.items];
        for (const l of pg.lines) {
            if (l === anchorLine) continue;
            if (Math.abs(l.y - anchorLine.y) <= HEADER_MERGE_Y) out.push(...l.items);
        }
        return out.sort((a, b) => a.x - b.x);
    };

    // 1) Cari baris header: berisi hampir semua label kolom (bisa terpecah 2 baris)
    let headerHit = null; // { page, lineIdx, colXs }
    outer:
    for (const pg of pagesLines) {
        const lines = pg.lines;
        for (let i = 0; i < lines.length; i++) {
            const l = lines[i];
            const items = mergedHeaderItems(pg, l);
            const matched = [];
            for (const c of cols) {
                const nc = norm(c.label || c.key);
                if (!nc) continue;
                const it = items.find(ix => {
                    const nit = norm(ix.str);
                    if (!nit) return false; // item kosong (mis. ":") jangan ikut cocok
                    return nit.includes(nc) || nc.includes(nit);
                });
                matched.push({ col: c, item: it || null });
            }
            const hitCount = matched.filter(m => m.item).length;
            if (hitCount >= Math.max(2, Math.ceil(cols.length * 0.6))) {
                const colXs = matched.map(m => {
                    if (m.item) return { key: m.col.key, label: m.col.label, x: m.item.x, w: m.item.w || 0 };
                    return null;
                }).filter(Boolean);
                headerHit = { page: pg.page, lineIdx: i, line: l, colXs };
                break outer;
            }
        }
    }
    if (!headerHit) return { found: false, rows: [], headerPage: null };

    // Pita vertikal baris header (dipakai untuk melewati baris label header tambahan
    // seperti "DIKEMBALIKAN" yang terpisah baris tapi masih bagian dari header).
    // Pita MENGIKUTI halaman: dihitung ulang dari header berulang tiap halaman lanjutan,
    // sehingga baris data yang kebetulan di Y yang sama di halaman lain TIDAK ikut terbuang.
    const initialBand = { top: headerHit.line.y + HEADER_MERGE_Y, bottom: headerHit.line.y - HEADER_MERGE_Y };
    let currentBand = initialBand;
    const inHeaderBand = (l) => currentBand != null && l.y <= currentBand.top && l.y >= currentBand.bottom;

    const colXs = [...headerHit.colXs].sort((a, b) => a.x - b.x);

    const termWords = (tableDef?.terminator || TABLE_TERMINATORS).map(w => norm(w)).filter(Boolean);

    const rows = [];
    const rowYs = [];
    const pendingRows = []; // baris data mentah — di-assign setelah boundary berbasis data dihitung
    const headerKeys = colXs.map(c => norm(c.label || c.key));
    let currentGroup = '';

    // 2) Ambil baris data: pada halaman yang sama di bawah header, lanjut ke halaman berikutnya
    const pgIndex = pagesLines.findIndex(p => p.page === headerHit.page);
    let cursor = headerHit.lineIdx + 1;
    let currentPg = pgIndex;

    // Cari ulang header tabel pada halaman berikutnya (blok header dokumen berulang dilewati)
    const findHeaderIdxOnPage = (pg) => {
        for (let i = 0; i < pg.lines.length; i++) {
            const items = mergedHeaderItems(pg, pg.lines[i]);
            const hit = cols.filter(c => {
                const nc = norm(c.label || c.key);
                if (!nc) return false;
                return items.some(ix => {
                    const nit = norm(ix.str);
                    if (!nit) return false;
                    return nit.includes(nc) || nc.includes(nit);
                });
            }).length;
            if (hit >= Math.max(2, Math.ceil(cols.length * 0.6))) return i;
        }
        return -1;
    };

    for (let guard = 0; guard < 500; guard++) {
        const pg = pagesLines[currentPg];
        if (!pg) break;
        if (cursor >= pg.lines.length) {
            // lanjut ke halaman berikutnya (tabel bisa bersambung) — lewati header berulang
            if (currentPg < pagesLines.length - 1) {
                currentPg++;
                const hIdx = findHeaderIdxOnPage(pagesLines[currentPg]);
                cursor = hIdx >= 0 ? hIdx + 1 : 0;
                // Perbarui pita header utk halaman baru: pakai Y header berulang halaman itu;
                // bila tak ada header berulang (tabel lanjut tanpa header), kosongkan pita.
                if (hIdx >= 0) {
                    const hl = pagesLines[currentPg].lines[hIdx];
                    currentBand = { top: hl.y + HEADER_MERGE_Y, bottom: hl.y - HEADER_MERGE_Y };
                } else {
                    currentBand = null;
                }
                continue;
            }
            break;
        }
        const l = pg.lines[cursor];
        cursor++;
        const t = lineText(l).trim();
        if (!t) continue;
        const nt = norm(t);
        // berhenti pada baris total/summary
        if (termWords.some(w => w && nt.includes(w))) break;
        // baris grup (mis. no faktur di atas data) → set nilai grup, bukan baris data
        if (isGroupLine(t)) {
            currentGroup = t.replace(/^['’]+/, '').trim();
            continue;
        }
        // lewati baris yang masih bagian dari pita header (mis. label "DIKEMBALIKAN" di baris terpisah)
        if (inHeaderBand(l)) continue;
        // lewati baris yang mirip header berulang
        const itemNorms = l.items.map(ix => norm(ix.str));
        const headerLike = headerKeys.filter(hk => hk && itemNorms.some(in2 => in2.includes(hk) || hk.includes(in2))).length;
        if (headerLike >= Math.max(2, Math.ceil(colXs.length * 0.5))) continue;
        // lewati baris yang hanya berisi satu kata pendek (bukan data)
        if (l.items.length === 1 && l.items[0].str.trim().length <= 2) continue;

        pendingRows.push({ items: l.items, groupVal: currentGroup, y: l.y });
    }

    // ── Boundary kolom: dari header, lalu DIKOREKSI oleh posisi data ──
    // Label header bisa terpusat jauh dari data (mis. "NAMA BARANG" di x=153 padahal data mulai
    // x=72), sehingga item nama yang sempit (mis. "CAM, FUEL" w=41) pusatnya jatuh ke kiri boundary
    // dan salah masuk kolom NO. Solusi: cari CELAH TERBESAR antar pusat item pada zona antar label
    // header → boundary yang benar (data-driven).
    const computeDataBoundary = (c0, c1) => {
        const z0 = c0.x - 20, z1 = c1.x + 20;
        const centers = [];
        for (const pr of pendingRows) {
            for (const it of pr.items) {
                if (CURRENCY_TOKENS.has(norm(it.str))) continue;
                const cx = it.x + (it.w || 0) / 2;
                if (cx >= z0 && cx <= z1) centers.push(cx);
            }
        }
        centers.sort((a, b) => a - b);
        let best = null;
        for (let i = 1; i < centers.length; i++) {
            const gap = centers[i] - centers[i - 1];
            if (gap >= 10 && (!best || gap > best.gap)) best = { gap, b: (centers[i] + centers[i - 1]) / 2 };
        }
        return best ? best.b : null;
    };
    const boundaries = colXs.map((c, i) => {
        if (i === colXs.length - 1) return Infinity;
        const d = computeDataBoundary(colXs[i], colXs[i + 1]);
        // Fallback: titik tengah tepi kanan header i → tepi kiri header i+1
        return d != null ? d : (c.x + c.w + colXs[i + 1].x) / 2;
    });

    const assign = (items, groupVal) => {
        const cells = {};
        for (const c of colXs) cells[c.key] = '';
        if (groupBy) cells[groupBy.key] = groupVal || '';
        for (const it of items) {
            // Token mata uang berdiri sendiri (IDR/Rp) bukan isi sel
            if (CURRENCY_TOKENS.has(norm(it.str))) continue;
            // Lewati item di kiri kolom pertama (biasanya nomor urut baris / teks pinggir)
            if (it.x + it.w < colXs[0].x - 15) continue;
            let ci = 0;
            for (let i = 0; i < colXs.length; i++) {
                if (it.x + it.w / 2 <= boundaries[i] || i === colXs.length - 1) { ci = i; break; }
            }
            const key = colXs[ci].key;
            cells[key] = cells[key] ? cells[key] + ' ' + it.str : it.str;
        }
        return cells;
    };

    for (const pr of pendingRows) {
        const cells = assign(pr.items, pr.groupVal);
        if (Object.values(cells).some(v => v)) {
            rows.push(cells);
            rowYs.push(pr.y);
        }
    }

    return {
        found: true,
        rows,
        headerPage: headerHit.page,
        headerY: headerHit.line.y,
        rowYs,
        columns: colXs.map(c => ({ key: c.key, label: c.label, x: Math.round(c.x + (c.w || 0) / 2) })),
    };
}

// ── Terapkan seluruh template ke SATU segmen dokumen (header fields + tabel) ──
// pl: pagesLines hasil groupLines (bisa segmen dari PDF bulk)
function extractDocumentSegment(pl, fields) {
    const data = {};
    const regions = [];
    const headerFields = fields.filter(f => f.group !== 'table');
    for (const f of headerFields) {
        if (!f.field_key || !f.field_label) continue;
        if (f.field_key in data) continue;
        const hit = locateFieldValue(pl, f);
        if (hit && hit.value) {
            data[f.field_key] = hit.value;
            regions.push({
                key: f.field_key,
                label: f.field_label,
                value: hit.value,
                page: hit.page,
                x: Math.round(hit.x),
                y: Math.round(hit.y),
                w: Math.round(hit.w),
                h: Math.round(hit.h),
                confidence: Math.round(hit.confidence * 100) / 100,
            });
        }
    }

    const tableFields = fields.filter(f => f.group === 'table');
    let items = [];
    let table = null;
    if (tableFields.length) {
        const groupField = tableFields.find(f => f.is_group);
        const cols = tableFields
            .filter(f => !f.is_group)
            .map(f => ({ key: f.field_key, label: f.field_label || f.pattern }))
            .filter(c => c.key);
        const tb = extractTable(pl, {
            columns: cols,
            terminator: TABLE_TERMINATORS,
            groupBy: groupField ? {
                key: groupField.field_key,
                label: groupField.field_label || groupField.field_key,
                pattern: groupField.pattern,
            } : null,
        });
        items = tb.rows;
        if (tb.found) {
            table = {
                found: true,
                page: tb.headerPage,
                headerY: Math.round(tb.headerY),
                rowYs: (tb.rowYs || []).map(y => Math.round(y)),
                columns: tb.columns.map(c => ({ key: c.key, label: c.label, x: Math.round(c.x) })),
            };
        } else {
            table = { found: false, page: null, headerY: null, rowYs: [], columns: [] };
        }
    }

    return { data, items, regions, table };
}

// ── Cari SEMUA baris yang memuat label (untuk segmentasi dokumen bulk) ──
// Kembalikan [{ pgIdx, li, y, value, page }] terurut posisi (atas → bawah, halaman → halaman).
// value = teks setelah label di baris yang sama (identitas dokumen, mis. nomor nota retur).
function findAllMarkerValues(pl, pattern) {
    const n = norm(pattern);
    if (!n) return [];
    const out = [];
    for (let pgIdx = 0; pgIdx < pl.length; pgIdx++) {
        const pg = pl[pgIdx];
        for (let li = 0; li < pg.lines.length; li++) {
            const l = pg.lines[li];
            const lineItems = [...l.items].sort((a, b) => a.x - b.x);
            const lineStr = lineText(l);
            // Utamakan item yang PERSIS sama dgn label (mis. "NOMOR"); cocok-sebagian
            // (mis. "NOMOR FAKTUR") hanya dianggap marker bila ada NILAI setelahnya —
            // mencegah header/kolom berlabel mirip jadi batas dokumen palsu.
            let labelIdx = lineItems.findIndex(it => norm(it.str) === n);
            if (labelIdx < 0) {
                labelIdx = lineItems.findIndex(it => {
                    const nit = norm(it.str);
                    if (nit.length < 3) return false;
                    if (!nit.includes(n) || !norm(lineStr).includes(n)) return false;
                    const after = lineItems.filter(x => x.x > it.x);
                    return cleanValue(after.map(x => x.str).join(' ')).length > 0;
                });
            }
            if (labelIdx >= 0) {
                const valItems = lineItems.slice(labelIdx + 1);
                const value = cleanValue(valItems.map(i => i.str).join(' '));
                out.push({ pgIdx, li, y: l.y, page: pg.page, value });
            }
        }
    }
    return out;
}

// Potong pagesLines menjadi segmen [start.pgIdx..end.pgIdx] dengan rentang baris
function slicePages(pl, start, end) {
    const out = [];
    for (let pgIdx = start.pgIdx; pgIdx <= end.pgIdx; pgIdx++) {
        const pg = pl[pgIdx];
        if (!pg) break;
        const li0 = pgIdx === start.pgIdx ? start.li : 0;
        const li1 = pgIdx === end.pgIdx ? end.li : pg.lines.length;
        const lines = pg.lines.slice(li0, li1);
        if (!lines.length) continue;
        out.push({ ...pg, lines });
    }
    return out;
}

// ── Segmentasi PDF bulk menjadi banyak dokumen ──
// splitPattern: label awal tiap dokumen (mis. "NOMOR"). Baris dengan nilai identitas SAMA
// digabung (satu dokumen bersambung ke beberapa halaman); nilai BERBEDA → dokumen baru.
// Kembalikan [{ value, segPl, pageStart, pageEnd }]
function splitIntoDocuments(pl, fields, splitPattern, splitKey) {
    const markers = findAllMarkerValues(pl, splitPattern);
    if (markers.length <= 1) return [{ value: markers[0]?.value || null, segPl: pl, pageStart: pl[0]?.page || 1, pageEnd: pl[pl.length - 1]?.page || 1 }];

    // Jika marker tidak membawa nilai (mis. split_pattern = judul "NOTA RETUR"),
    // pakai nilai field split_key (mis. nomor_nota_retur) di dekat marker sbg identitas.
    const keyField = fields.find(f => f.group !== 'table' && f.field_key === splitKey);
    const identityOf = (m) => {
        if (m.value) return m.value;
        if (keyField) {
            // cari nilai field pada halaman yang sama, di bawah marker (maks 12 baris)
            const pg = pl[m.pgIdx];
            const win = { ...pg, lines: pg.lines.slice(m.li, m.li + 12) };
            const hit = locateFieldValue([win], keyField);
            if (hit?.value) return hit.value;
        }
        return null;
    };

    // Kelompokkan marker berurutan dgn nilai identitas sama → satu dokumen
    const docs = [];
    for (const m of markers) {
        const id = identityOf(m);
        const last = docs[docs.length - 1];
        if (!last || last.value !== id) {
            // Mulai segmen dari baris 0 halaman marker — field header yang posisinya
            // DI ATAS marker (di halaman yang sama) tetap terekstrak, bukan hilang.
            docs.push({ value: id, start: { pgIdx: m.pgIdx, li: 0 } });
        }
    }
    // Tentukan akhir tiap dokumen: mulai dari marker dokumen berikutnya (atau akhir halaman)
    const out = [];
    for (let i = 0; i < docs.length; i++) {
        const start = docs[i].start;
        const end = i + 1 < docs.length
            ? { pgIdx: docs[i + 1].start.pgIdx, li: docs[i + 1].start.li }
            : { pgIdx: pl.length - 1, li: pl[pl.length - 1].lines.length };
        const segPl = slicePages(pl, start, end);
        out.push({
            value: docs[i].value,
            segPl,
            pageStart: segPl[0]?.page || 1,
            pageEnd: segPl[segPl.length - 1]?.page || segPl[0]?.page || 1,
        });
    }
    return out;
}

// ── Terapkan seluruh template ke satu PDF (bisa berisi BANYAK dokumen) ──
// fields: daftar { group, group_key, field_key, field_label, match_type, pattern, col_x }
// options: { splitPattern, splitKey } — segmentasi PDF bulk (beberapa dokumen per file).
// return { data, items, pages, regions, table, documents: [{value, data, items, regions, table, pageStart, pageEnd}] }
export async function applyTemplate(buffer, fields, options = {}) {
    const pages = await extractPdfItems(buffer);
    const pl = groupLines(pages);
    const { splitPattern, splitKey } = options || {};

    const segments = (splitPattern && String(splitPattern).trim())
        ? splitIntoDocuments(pl, fields, String(splitPattern).trim(), splitKey || null)
        : [{ value: null, segPl: pl, pageStart: pl[0]?.page || 1, pageEnd: pl[pl.length - 1]?.page || 1 }];

    const documents = segments.map((seg, idx) => {
        const doc = extractDocumentSegment(seg.segPl, fields);
        return {
            value: seg.value,
            docIndex: idx,
            pageStart: seg.pageStart,
            pageEnd: seg.pageEnd,
            ...doc,
        };
    });

    const first = documents[0] || { data: {}, items: [], regions: [], table: null };
    return {
        data: first.data,
        items: first.items,
        pages: pages.length,
        regions: first.regions || [],
        table: first.table || null,
        documents,
        split: segments.length > 1,
    };
}

// ── Deteksi template yang paling cocok dengan isi PDF ──
// templates: [{id, name, doc_type, fields}]
export async function detectTemplate(pagesLines, templates) {
    let best = { template: null, score: 0, found: 0, total: 0 };
    for (const t of templates) {
        const headerFields = (t.fields || []).filter(f => f.group !== 'table');
        const tableFields = (t.fields || []).filter(f => f.group === 'table');
        let found = 0, total = 0;
        for (const f of headerFields) {
            total++;
            const v = applyFieldRule(pagesLines, f);
            if (v) found++;
        }
        if (tableFields.length) {
            total++;
            const groupField = tableFields.find(f => f.is_group);
            const cols = tableFields
                .filter(f => !f.is_group)
                .map(f => ({ key: f.field_key, label: f.field_label || f.pattern }));
            const tb = extractTable(pagesLines, {
                columns: cols,
                groupBy: groupField ? {
                    key: groupField.field_key,
                    label: groupField.field_label || groupField.field_key,
                    pattern: groupField.pattern,
                } : null,
            });
            if (tb.found) found++;
        }
        const score = total ? found / total : 0;
        if (score > best.score) best = { template: t, score, found, total };
    }
    return best.score >= 0.5 ? best : { template: null, score: 0, found: 0, total: 0 };
}

// ── Validasi mapping terhadap satu sampel (untuk training iteratif) ──
// options: { splitPattern, splitKey } — bila diisi, lapor berapa dokumen terdeteksi dalam sampel.
export async function validateFieldsOnBuffer(buffer, fields, options = {}) {
    const pages = await extractPdfItems(buffer);
    const pl = groupLines(pages);
    const result = {};

    // Segmentasi (PDF bulk): validasi per dokumen agar mengikuti template split
    const splitPattern = options?.splitPattern ? String(options.splitPattern).trim() : '';
    const segments = splitPattern
        ? splitIntoDocuments(pl, fields, splitPattern, options?.splitKey || null)
        : [{ value: null, segPl: pl }];
    result['__doc_count__'] = segments.length;

    const seg = segments[0]; // validasi field di segmen pertama (mewakili)
    for (const f of fields.filter(x => x.group !== 'table')) {
        const v = applyFieldRule(seg.segPl, f);
        result[f.field_key || f.field_label] = { found: !!v, value: v || '', label: f.field_label || f.field_key, match_type: f.match_type };
    }
    const tableFields = fields.filter(f => f.group === 'table');
    if (tableFields.length) {
        const groupField = tableFields.find(f => f.is_group);
        const cols = tableFields
            .filter(f => !f.is_group)
            .map(f => ({ key: f.field_key, label: f.field_label || f.pattern }));
        const tb = extractTable(seg.segPl, {
            columns: cols,
            groupBy: groupField ? {
                key: groupField.field_key,
                label: groupField.field_label || groupField.field_key,
                pattern: groupField.pattern,
            } : null,
        });
        result['__table__'] = { found: tb.found, rows: tb.rows.length };
    }
    return result;
}
