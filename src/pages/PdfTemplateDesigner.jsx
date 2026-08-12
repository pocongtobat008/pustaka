import React, { useState, useEffect, useCallback, useRef } from 'react';
import Handlebars from 'handlebars';
import {
    Plus, Save, Trash2, Copy, CheckCircle2, Eye, FileCode2,
    RefreshCw, Download, AlertTriangle, ImagePlus, PenLine,
} from 'lucide-react';
import { pdfTemplateService } from '../services/pdfTemplateService';
import { useLanguage } from '../contexts/LanguageContext';
import { SIGNATURE_PLACEHOLDER_PNG } from '../../server/services/signaturePlaceholder.js';

const btnPrimary = 'inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:opacity-95 text-white text-sm font-semibold shadow-lg shadow-indigo-500/25 transition-all disabled:opacity-50';
const btnSecondary = 'inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-200 text-sm font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all';
const btnGhost = 'inline-flex items-center justify-center rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all';
const panelCls = 'rounded-3xl bg-white/40 dark:bg-slate-800/40 backdrop-blur-xl border border-white/40 dark:border-white/10 shadow-2xl ring-1 ring-black/5 dark:ring-white/5';

// ── Helper render (sama dengan server) ──
const formatRupiah = (n) => {
    const num = parseFloat(n) || 0;
    const neg = num < 0;
    const abs = Math.abs(num);
    return `${neg ? '-' : ''}${Math.round(abs).toLocaleString('id-ID')}`;
};
const dateId = (d) => {
    if (!d) return '-';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return '-';
    return dt.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
};
Handlebars.registerHelper('formatRupiah', (n) => formatRupiah(n));
Handlebars.registerHelper('rupiah', (n) => formatRupiah(n));
Handlebars.registerHelper('dateId', (d) => dateId(d));
Handlebars.registerHelper('datetimeId', (d) => {
    if (!d) return '-';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return '-';
    return dt.toLocaleString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
});
Handlebars.registerHelper('uppercase', (s) => String(s == null ? '' : s).toUpperCase());
Handlebars.registerHelper('lowercase', (s) => String(s == null ? '' : s).toLowerCase());
const terbilang = (n) => {
    const angka = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas'];
    const num = Math.floor(Math.abs(parseFloat(n) || 0));
    if (num === 0) return 'nol';
    if (num < 12) return angka[num];
    if (num < 20) return `${angka[num - 10]} belas`;
    if (num < 100) return `${angka[Math.floor(num / 10)]} puluh ${num % 10 ? angka[num % 10] : ''}`.trim();
    if (num < 200) return `seratus ${num % 100 ? terbilang(num % 100) : ''}`.trim();
    if (num < 1000) return `${angka[Math.floor(num / 100)]} ratus ${num % 100 ? terbilang(num % 100) : ''}`.trim();
    if (num < 2000) return `seribu ${num % 1000 ? terbilang(num % 1000) : ''}`.trim();
    if (num < 1000000) return `${terbilang(Math.floor(num / 1000))} ribu ${num % 1000 ? terbilang(num % 1000) : ''}`.trim();
    if (num < 1000000000) return `${terbilang(Math.floor(num / 1000000))} juta ${num % 1000000 ? terbilang(num % 1000000) : ''}`.trim();
    if (num < 1000000000000) return `${terbilang(Math.floor(num / 1000000000))} miliar ${num % 1000000000 ? terbilang(num % 1000000000) : ''}`.trim();
    return `${terbilang(Math.floor(num / 1000000000000))} triliun ${num % 1000000000000 ? terbilang(num % 1000000000000) : ''}`.trim();
};
Handlebars.registerHelper('terbilang', (n) => terbilang(n));
Handlebars.registerHelper('terbilangRupiah', (n) => {
    const neg = (parseFloat(n) || 0) < 0;
    const s = terbilang(Math.abs(parseFloat(n) || 0));
    return `${neg ? 'Minus ' : ''}${s ? s.charAt(0).toUpperCase() + s.slice(1) : ''} Rupiah`;
});

const buildShell = (html, css = '') => `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8" />
<style>
@page { size: A4; margin: 18mm 15mm 18mm 15mm; }
* { box-sizing: border-box; }
body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #111827; font-size: 12px; line-height: 1.45; margin: 0; }
table { border-collapse: collapse; width: 100%; }
.tabular { font-variant-numeric: tabular-nums; }
${css || ''}
</style>
</head>
<body>
${html}
</body>
</html>`;

const signatureCell = (label, width = '16.66%') => `<td style="width:${width};text-align:center;font-size:11px;vertical-align:top">
      <div style="font-weight:800;color:#800000">${label}</div>
      <div style="height:58px;display:flex;align-items:flex-end;justify-content:center">
        <img src="${SIGNATURE_PLACEHOLDER_PNG}" alt="ttd" style="max-width:95px;max-height:48px;height:auto" />
      </div>
      <div style="margin-top:2px">____________________</div>
      <div style="font-weight:800;margin-top:4px;font-size:11px">Nama</div>
      <div style="font-size:10px;color:#555">Jabatan</div>
    </td>`;

const SIGNATURE_BLOCK = `<br/>
<table width="100%" style="border-collapse:collapse;margin-top:44px">
  <tr>
    ${signatureCell('PLAN')}
    ${signatureCell('CHECKER')}
    ${signatureCell('CHECKER')}
    ${signatureCell('CHECKER')}
    ${signatureCell('ACKNOWLEDGE')}
    ${signatureCell('ACKNOWLEDGE')}
  </tr>
</table>`;

const FIELD_REFERENCE = [
    { group: 'Data Utama', fields: [
        ['{{proforma_no}}', 'No. Proforma'],
        ['{{dealer_name}}', 'Nama Dealer'],
        ['{{dealer_npwp}}', 'NPWP Dealer'],
        ['{{dealer_alamat}}', 'Alamat Dealer'],
        ['{{no_po}}', 'No. PO'],
        ['{{tgl_po_display}}', 'Tgl. PO (format id-ID)'],
        ['{{tgl_po}}', 'Tgl. PO (yyyy-mm-dd)'],
        ['{{tipe}}', 'Tipe (CBD/PP/PF)'],
        ['{{tipe_label}}', 'Label Tipe (lengkap)'],
        ['{{pp_type_label}}', 'DP / Pelunasan'],
        ['{{status_label}}', 'Label Status'],
        ['{{tgl_transaksi_display}}', 'Tgl. Transaksi'],
        ['{{created_by}}', 'Dibuat oleh'],
        ['{{created_at}}', 'Tanggal dibuat'],
    ]},
    { group: 'Nominal', fields: [
        ['{{subtotal}}', 'Subtotal'],
        ['{{ppn}}', 'PPN'],
        ['{{diskon}}', 'Diskon'],
        ['{{materai}}', 'Materai'],
        ['{{total_invoice}}', 'Total Invoice'],
        ['{{total_invoice_terbilang}}', 'Total Invoice (terbilang)'],
        ['{{terbilang total_invoice_raw}}', 'Helper terbilang (angka bebas)'],
        ['{{uang_masuk}}', 'Uang Masuk (DP)'],
        ['{{dp}}', 'DP yang ditulis'],
        ['{{full_amount}}', 'Total Full Amount'],
        ['{{dp_full_amount}}', 'Uang Masuk Full Amount (DP)'],
        ['{{pelunasan}}', 'Pelunasan'],
        ['{{sisa}}', 'Sisa (Total − Uang Masuk)'],
        ['{{item_count}}', 'Jumlah item'],
    ]},
    { group: 'Loop Item', fields: [
        ['{{#each items}}', 'Mulai loop item'],
        ['{{no}}', 'Nomor urut item'],
        ['{{model}}', 'Model barang'],
        ['{{item_description}}', 'Deskripsi item'],
        ['{{qty}}', 'Qty'],
        ['{{harga}}', 'Harga satuan'],
        ['{{subtotal}}', 'Subtotal item'],
        ['{{/each}}', 'Akhir loop item'],
    ]},
];

export default function PdfTemplateDesigner({ currentUser, hasPermission, toast }) {
    const { language } = useLanguage();
    const isEnglish = language === 'en';
    const text = isEnglish ? {
        title: 'PDF Template Designer',
        subtitle: 'Custom Proforma Invoice template via HTML/CSS',
        newTemplate: 'New Template',
        save: 'Save',
        saving: 'Saving...',
        duplicate: 'Duplicate',
        activate: 'Activate',
        deactivate: 'Deactivate',
        delete: 'Delete',
        name: 'Template name',
        docType: 'Document type',
        active: 'Active',
        html: 'HTML',
        css: 'CSS',
        preview: 'Preview',
        previewPdf: 'Preview PDF',
        previewReal: 'Preview with real data',
        fieldRef: 'Field Reference',
        clickCopy: 'Click a field to copy',
        noTemplate: 'No template yet. Create one to replace the built-in PDF.',
        loadFailed: 'Failed to load templates',
        confirmDelete: 'Delete this template?',
        activeHint: 'Active template will be used for the Proforma Invoice PDF export.',
        renderError: 'Template compile error: ',
        pickInvoice: 'Choose invoice',
        refresh: 'Refresh',
        download: 'Download PDF',
        unsaved: 'Unsaved changes',
        insertImage: 'Insert Image',
        insertSignature: 'Signature Block',
        customSignature: 'Custom Signature (PNG)',
        imageSize: 'Image width',
        imgTooBig: 'Image too large. Max ',
        fileRequired: 'Image file required',
        sigReplaced: 'Digital signature replaced in template',
        sigNotFound: 'No placeholder signature found — signature inserted at cursor',
        docTypeProforma: 'Proforma Invoice (1 signature)',
        docTypeRequest: 'Pengajuan Proforma (6 signatures)',
        confirmDiscard: 'There are unsaved changes. Discard and continue?',
        previewBusy: 'Rendering...',
        deleteActiveWarn: ' (this template is ACTIVE for its document type — export will fall back to the built-in PDF)',
    } : {
        title: 'Desainer Template PDF',
        subtitle: 'Template Proforma Invoice custom via HTML/CSS',
        newTemplate: 'Template Baru',
        save: 'Simpan',
        saving: 'Menyimpan...',
        duplicate: 'Duplikat',
        activate: 'Aktifkan',
        deactivate: 'Nonaktifkan',
        delete: 'Hapus',
        name: 'Nama template',
        docType: 'Tipe dokumen',
        active: 'Aktif',
        html: 'HTML',
        css: 'CSS',
        preview: 'Pratinjau',
        previewPdf: 'Preview PDF',
        previewReal: 'Preview data asli',
        fieldRef: 'Referensi Field',
        clickCopy: 'Klik field untuk menyalin',
        noTemplate: 'Belum ada template. Buat satu untuk menggantikan PDF bawaan.',
        loadFailed: 'Gagal memuat template',
        confirmDelete: 'Hapus template ini?',
        activeHint: 'Template aktif akan dipakai untuk export PDF Proforma Invoice.',
        renderError: 'Error kompilasi template: ',
        pickInvoice: 'Pilih invoice',
        refresh: 'Muat ulang',
        download: 'Download PDF',
        unsaved: 'Ada perubahan yang belum disimpan',
        insertImage: 'Sisipkan Gambar',
        insertSignature: 'Kolom Penandatangan',
        customSignature: 'Tanda Tangan (PNG)',
        imageSize: 'Lebar gambar',
        imgTooBig: 'Gambar terlalu besar. Maks ',
        fileRequired: 'File gambar wajib diisi',
        sigReplaced: 'Tanda tangan digital diganti di template',
        sigNotFound: 'Placeholder tanda tangan tidak ditemukan — tanda tangan disisipkan di kursor',
        docTypeProforma: 'Proforma Invoice (1 tanda tangan)',
        docTypeRequest: 'Pengajuan Proforma (6 tanda tangan)',
        confirmDiscard: 'Ada perubahan yang belum disimpan. Buang dan lanjutkan?',
        previewBusy: 'Merender...',
        deleteActiveWarn: ' (template ini AKTIF untuk tipe dokumennya — export akan kembali ke PDF bawaan)',
    };

    const [templates, setTemplates] = useState([]);
    const [editing, setEditing] = useState(null); // {id|null, name, doc_type, html, css, is_active}
    const [isNew, setIsNew] = useState(false);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [sample, setSample] = useState(null);
    const [previewHtml, setPreviewHtml] = useState('');
    const [previewError, setPreviewError] = useState('');
    const [recentInvoices, setRecentInvoices] = useState([]);
    const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
    const [dirty, setDirty] = useState(false);
    const [imgWidth, setImgWidth] = useState('150');
    const [previewBusy, setPreviewBusy] = useState(false);
    const debounceRef = useRef(null);
    const htmlRef = useRef(null);
    const fileInputRef = useRef(null);
    const sigInputRef = useRef(null);

    const isAdmin = String(currentUser?.role || '').toLowerCase() === 'admin' || String(currentUser?.role || '').toLowerCase() === 'superadmin';

    // Konfirmasi bila ada perubahan yang belum disimpan
    const discardGuard = () => {
        if (!dirty) return true;
        return window.confirm(text.confirmDiscard);
    };

    useEffect(() => {
        const handler = (e) => {
            if (dirty) { e.preventDefault(); e.returnValue = ''; }
        };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [dirty]);

    const fetchTemplates = useCallback(async () => {
        setLoading(true);
        try {
            const rows = await pdfTemplateService.getAll();
            setTemplates(rows);
        } catch (e) {
            console.error(e);
            toast?.(text.loadFailed, 'error');
        } finally {
            setLoading(false);
        }
    }, [toast, text.loadFailed]);

    const fetchSample = useCallback(async () => {
        try {
            const s = await pdfTemplateService.getSample('proforma');
            setSample(s);
            if (!editing) {
                setEditing({ id: null, name: '', doc_type: 'proforma', html: s.html || '', css: s.css || '', is_active: false });
                setIsNew(true);
            }
        } catch (e) {
            console.error(e);
        }
    }, [editing]);

    // Muat template contoh sesuai tipe dokumen (untuk template baru)
    const loadSampleFor = async (docType) => {
        try {
            const s = await pdfTemplateService.getSample(docType);
            setSample(s);
            setEditing(prev => ({ ...prev, html: s.html || '', css: s.css || '' }));
        } catch (e) {
            console.error(e);
        }
    };

    const fetchInvoices = useCallback(async () => {
        try {
            const rows = await pdfTemplateService.getRecentInvoices();
            setRecentInvoices(rows || []);
            if (rows?.length && !selectedInvoiceId) setSelectedInvoiceId(String(rows[0].id));
        } catch (e) {
            console.error(e);
        }
    }, [selectedInvoiceId]);

    useEffect(() => {
        fetchTemplates();
        fetchSample();
        fetchInvoices();
    }, [fetchTemplates, fetchSample, fetchInvoices]);

    // Render preview (debounce) saat HTML/CSS berubah
    useEffect(() => {
        if (!editing || !sample) return;
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            try {
                const tpl = Handlebars.compile(editing.html || '');
                const body = tpl(sample.context);
                setPreviewHtml(buildShell(body, editing.css || ''));
                setPreviewError('');
            } catch (e) {
                setPreviewError(text.renderError + e.message);
            }
        }, 600);
        return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    }, [editing?.html, editing?.css, sample, text.renderError]);

    const startNew = () => {
        if (!discardGuard()) return;
        setEditing({ id: null, name: '', doc_type: 'proforma', html: sample?.html || '', css: sample?.css || '', is_active: false });
        setIsNew(true);
        setDirty(true);
    };

    const changeDocType = async (dt) => {
        if (dirty && !discardGuard()) return;
        setEditing(prev => ({ ...prev, doc_type: dt }));
        if (isNew || !editing?.id) await loadSampleFor(dt);
        setDirty(false);
    };

    const startEdit = (tpl) => {
        if (!discardGuard()) return;
        setEditing({ id: tpl.id, name: tpl.name, doc_type: tpl.doc_type, html: tpl.html, css: tpl.css, is_active: !!tpl.is_active });
        setIsNew(false);
        setDirty(false);
    };

    const duplicate = async (tpl) => {
        try {
            const row = await pdfTemplateService.create({
                doc_type: tpl.doc_type,
                name: `${tpl.name} (copy)`,
                html: tpl.html,
                css: tpl.css,
                is_active: false,
            });
            await fetchTemplates();
            startEdit(row);
            toast?.('Template digandakan', 'success');
        } catch (e) {
            toast?.(e.message, 'error');
        }
    };

    const activate = async (tpl) => {
        try {
            await pdfTemplateService.activate(tpl.id);
            await fetchTemplates();
            toast?.(tpl.is_active ? text.deactivate : text.activate, 'success');
        } catch (e) {
            toast?.(e.message, 'error');
        }
    };

    const remove = async (tpl) => {
        if (!discardGuard()) return;
        if (!window.confirm(text.confirmDelete + (tpl.is_active ? text.deleteActiveWarn : ''))) return;
        try {
            await pdfTemplateService.remove(tpl.id);
            if (editing?.id === tpl.id) { setEditing(null); setIsNew(false); }
            await fetchTemplates();
            toast?.('Template dihapus', 'success');
        } catch (e) {
            toast?.(e.message, 'error');
        }
    };

    const save = async () => {
        if (!editing?.name?.trim()) { toast?.(text.name + ' wajib diisi', 'error'); return; }
        setSaving(true);
        try {
            let row;
            if (isNew || !editing.id) {
                row = await pdfTemplateService.create({
                    doc_type: editing.doc_type || 'proforma',
                    name: editing.name,
                    html: editing.html,
                    css: editing.css,
                    is_active: editing.is_active,
                });
            } else {
                row = await pdfTemplateService.update(editing.id, {
                    name: editing.name,
                    html: editing.html,
                    css: editing.css,
                    is_active: editing.is_active,
                });
            }
            await fetchTemplates();
            setEditing({ id: row.id, name: row.name, doc_type: row.doc_type, html: row.html, css: row.css, is_active: !!row.is_active });
            setIsNew(false);
            setDirty(false);
            toast?.('Template disimpan', 'success');
        } catch (e) {
            toast?.(e.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    const downloadPdf = async () => {
        if (!editing) return;
        setPreviewBusy(true);
        try {
            await pdfTemplateService.openTestPdf({ html: editing.html, css: editing.css, context: sample?.context });
        } catch (e) {
            toast?.(e.message, 'error');
        } finally {
            setPreviewBusy(false);
        }
    };

    // Preview draft dengan data invoice ASLI (sesuai doc_type yang sedang diedit)
    const downloadRealPdf = async () => {
        if (!selectedInvoiceId) { toast?.(text.pickInvoice, 'error'); return; }
        if (!editing) return;
        setPreviewBusy(true);
        try {
            await pdfTemplateService.openTestPdfReal({ html: editing.html, css: editing.css, invoiceId: selectedInvoiceId });
        } catch (e) {
            toast?.(e.message, 'error');
        } finally {
            setPreviewBusy(false);
        }
    };

    const copyField = (token) => {
        navigator.clipboard?.writeText(token).then(() => {
            toast?.(`${token} ${text.clickCopy}`.replace(text.clickCopy, `— ${text.clickCopy}`), 'info');
        });
    };

    // Sisipkan teks HTML pada posisi kursor textarea HTML (atau di akhir jika tidak fokus)
    const insertAtCursor = (fragment) => {
        const ta = htmlRef.current;
        let next;
        if (ta) {
            const start = ta.selectionStart;
            const end = ta.selectionEnd;
            const val = ta.value || '';
            next = val.slice(0, start) + fragment + val.slice(end);
            requestAnimationFrame(() => {
                ta.focus();
                ta.selectionStart = ta.selectionEnd = start + fragment.length;
            });
        } else {
            next = (editing.html || '') + '\n' + fragment;
        }
        setEditing((prev) => ({ ...prev, html: next }));
        setDirty(true);
    };

    const insertSignature = () => insertAtCursor('\n' + SIGNATURE_BLOCK + '\n');

    const handleImageSelect = (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) { toast?.(text.fileRequired, 'error'); return; }
        const MAX = 2 * 1024 * 1024;
        if (file.size > MAX) {
            toast?.(`${text.imgTooBig}2 MB`, 'error');
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            const dataUrl = reader.result;
            const tag = `<img src="${dataUrl}" alt="gambar" style="max-width:${imgWidth}px;height:auto" />`;
            insertAtCursor('\n' + tag + '\n');
            toast?.('Gambar disisipkan', 'success');
        };
        reader.readAsDataURL(file);
    };

    // Custom tanda tangan digital: mengganti semua placeholder tanda tangan di HTML
    const handleSignatureSelect = (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) { toast?.(text.fileRequired, 'error'); return; }
        const MAX = 2 * 1024 * 1024;
        if (file.size > MAX) {
            toast?.(`${text.imgTooBig}2 MB`, 'error');
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            const dataUrl = reader.result;
            const cur = editing.html || '';
            const placeholder = SIGNATURE_PLACEHOLDER_PNG;
            if (cur.includes(placeholder)) {
                setEditing({ ...editing, html: cur.split(placeholder).join(dataUrl) });
                setDirty(true);
                toast?.(text.sigReplaced, 'success');
            } else {
                const tag = `<img src="${dataUrl}" alt="ttd" style="max-width:150px;max-height:60px;height:auto" />`;
                insertAtCursor('\n<!-- TANDA TANGAN DIGITAL -->\n' + tag + '\n');
                toast?.(text.sigNotFound, 'info');
            }
        };
        reader.readAsDataURL(file);
    };

    const activeCount = templates.filter(t => t.is_active).length;

    return (
        <div className="p-4 md:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-xl md:text-2xl font-bold">{text.title}</h1>
                    <p className="text-sm opacity-70">{text.subtitle}</p>
                    {dirty && (
                        <span className="inline-flex items-center gap-1 mt-1 text-xs font-semibold text-amber-500">
                            <AlertTriangle size={13} /> {text.unsaved}
                        </span>
                    )}
                </div>
                <div className="flex gap-2">
                    {isAdmin && (
                        <>
                            <button onClick={save} disabled={saving} className={btnPrimary}>
                                <Save size={16} /> {saving ? text.saving : text.save}
                            </button>
                            <button onClick={startNew} className={btnPrimary}>
                                <Plus size={16} /> {text.newTemplate}
                            </button>
                        </>
                    )}
                </div>
            </div>

            {!isAdmin && (
                <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
                    Hanya admin yang dapat mengelola template PDF.
                </div>
            )}

            <div className="grid lg:grid-cols-[280px_1fr] gap-4">
                {/* ── Daftar template ── */}
                <div className={`${panelCls} h-fit`}>
                    <div className="p-3 border-b flex items-center justify-between">
                        <span className="font-semibold text-sm">{isEnglish ? 'Templates' : 'Daftar Template'}</span>
                        <button onClick={fetchTemplates} className="opacity-60 hover:opacity-100"><RefreshCw size={15} /></button>
                    </div>
                    <div className="divide-y max-h-[420px] overflow-y-auto">
                        {loading && <div className="p-4 text-sm opacity-60">{isEnglish ? 'Loading...' : 'Memuat...'}</div>}
                        {!loading && templates.length === 0 && (
                            <div className="p-4 text-sm opacity-60">{text.noTemplate}</div>
                        )}
                        {templates.map(tpl => (
                            <div key={tpl.id} className={`p-3 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 ${editing?.id === tpl.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`} onClick={() => startEdit(tpl)}>
                                <div className="flex items-center gap-2">
                                    <FileCode2 size={16} className="shrink-0 opacity-60" />
                                    <span className="font-medium text-sm truncate flex-1">{tpl.name}</span>
                                    {tpl.is_active && <CheckCircle2 size={15} className="text-green-500 shrink-0" />}
                                </div>
                                <div className="flex items-center gap-2 mt-1.5">
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10">{tpl.doc_type}</span>
                                    <span className="text-[11px] opacity-50">{tpl.updated_by || '-'}</span>
                                    <span className="ml-auto flex gap-1">
                                        {isAdmin && (
                                            <>
                                                <button title={text.duplicate} aria-label={text.duplicate} onClick={(e) => { e.stopPropagation(); duplicate(tpl); }} className="opacity-50 hover:opacity-100"><Copy size={13} /></button>
                                                <button title={tpl.is_active ? text.deactivate : text.activate} aria-label={tpl.is_active ? text.deactivate : text.activate} onClick={(e) => { e.stopPropagation(); activate(tpl); }} className="opacity-50 hover:opacity-100 text-green-600"><CheckCircle2 size={13} /></button>
                                                <button title={text.delete} aria-label={text.delete} onClick={(e) => { e.stopPropagation(); remove(tpl); }} className="opacity-50 hover:opacity-100 text-red-500"><Trash2 size={13} /></button>
                                            </>
                                        )}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                    {activeCount > 0 && (
                        <div className="p-3 border-t text-[11px] opacity-70">
                            {activeCount} {isEnglish ? 'active' : 'aktif'} — {text.activeHint}
                        </div>
                    )}
                </div>

                {/* ── Editor ── */}
                <div className="space-y-4">
                    {editing && (
                        <div className={`${panelCls}`}>
                            <div className="p-4 grid md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold mb-1">{text.name}</label>
                                    <input
                                        value={editing.name}
                                        onChange={(e) => { setEditing({ ...editing, name: e.target.value }); setDirty(true); }}
                                        className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm"
                                        placeholder={text.name}
                                    />
                                </div>
                                <div className="flex items-end gap-3">
                                    <div className="flex-1">
                                        <label className="block text-xs font-semibold mb-1">{text.docType}</label>
                                        <select
                                            value={editing.doc_type}
                                            onChange={(e) => changeDocType(e.target.value)}
                                            className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm"
                                        >
                                            <option value="proforma">{text.docTypeProforma}</option>
                                            <option value="proforma_request">{text.docTypeRequest}</option>
                                        </select>
                                    </div>
                                    <label className="inline-flex items-center gap-2 text-sm pb-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={!!editing.is_active}
                                            onChange={(e) => { setEditing({ ...editing, is_active: e.target.checked }); setDirty(true); }}
                                        />
                                        {text.active}
                                    </label>
                                </div>
                            </div>

                            {previewError && (
                                <div className="mx-4 mb-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 px-3 py-2 text-xs text-red-600 dark:text-red-300">
                                    {previewError}
                                </div>
                            )}

                            <div className="px-4 pb-4 grid lg:grid-cols-2 gap-4">
                                <div className="flex flex-col">
                                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                                        <label className="text-xs font-semibold">{text.html}</label>
                                        <div className="flex items-center gap-2">
                                            <select
                                                value={imgWidth}
                                                onChange={(e) => setImgWidth(e.target.value)}
                                                className="rounded-lg border bg-transparent px-2 py-1 text-xs"
                                                title={text.imageSize}
                                            >
                                                {['80', '100', '120', '150', '200', '250', '300'].map(w => (
                                                    <option key={w} value={w}>{w}px</option>
                                                ))}
                                            </select>
                                            <input
                                                ref={fileInputRef}
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={handleImageSelect}
                                            />
                                            <button
                                                onClick={() => fileInputRef.current?.click()}
                                                className={`${btnSecondary} text-xs px-2.5 py-1`}
                                            >
                                                <ImagePlus size={13} /> {text.insertImage}
                                            </button>
                                            <input
                                                ref={sigInputRef}
                                                type="file"
                                                accept="image/png,image/*"
                                                className="hidden"
                                                onChange={handleSignatureSelect}
                                            />
                                            <button
                                                onClick={() => sigInputRef.current?.click()}
                                                className={`${btnSecondary} text-xs px-2.5 py-1 text-green-700 dark:text-green-400`}
                                                title={text.customSignature}
                                            >
                                                <PenLine size={13} /> {text.customSignature}
                                            </button>
                                            <button
                                                onClick={insertSignature}
                                                className={`${btnSecondary} text-xs px-2.5 py-1`}
                                            >
                                                <PenLine size={13} /> {text.insertSignature}
                                            </button>
                                        </div>
                                    </div>
                                    <textarea
                                        ref={htmlRef}
                                        value={editing.html}
                                        onChange={(e) => { setEditing({ ...editing, html: e.target.value }); setDirty(true); }}
                                        spellCheck={false}
                                        className="font-mono text-xs w-full h-[380px] rounded-lg border bg-transparent p-3 resize-none leading-relaxed"
                                    />
                                </div>
                                <div className="flex flex-col">
                                    <label className="text-xs font-semibold mb-1">{text.css}</label>
                                    <textarea
                                        value={editing.css}
                                        onChange={(e) => { setEditing({ ...editing, css: e.target.value }); setDirty(true); }}
                                        spellCheck={false}
                                        className="font-mono text-xs w-full h-[380px] rounded-lg border bg-transparent p-3 resize-none leading-relaxed"
                                    />
                                </div>
                            </div>

                            {/* ── Preview iframe + data asli ── */}
                            <div className="px-4 pb-4">
                                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                                    <span className="font-semibold text-sm">{text.preview}</span>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <select
                                            value={selectedInvoiceId}
                                            onChange={(e) => setSelectedInvoiceId(e.target.value)}
                                            className="rounded-lg border bg-transparent px-2 py-1.5 text-xs max-w-[220px]"
                                        >
                                            {recentInvoices.map(inv => (
                                                <option key={inv.id} value={inv.id}>
                                                    #{inv.id} — {inv.proforma_no} ({inv.dealer_name || '-'})
                                                </option>
                                            ))}
                                        </select>
                                        <button onClick={fetchInvoices} className={btnGhost} title={text.refresh} aria-label={text.refresh}><RefreshCw size={14} /></button>
                                        <button onClick={downloadRealPdf} disabled={previewBusy} className={`${btnSecondary} text-xs px-3 py-1.5`}>
                                            <Eye size={14} /> {previewBusy ? text.previewBusy : text.previewReal}
                                        </button>
                                        {isAdmin && (
                                            <button onClick={downloadPdf} disabled={previewBusy} className={`${btnSecondary} text-xs px-3 py-1.5`}>
                                                <Download size={14} /> {previewBusy ? text.previewBusy : text.previewPdf}
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <iframe
                                    title="pdf-preview"
                                    srcDoc={previewHtml}
                                    className="w-full bg-white rounded-lg border"
                                    style={{ height: 560 }}
                                />
                            </div>
                        </div>
                    )}

                    {/* ── Field Reference ── */}
                    <div className={`${panelCls}`}>
                        <div className="p-3 border-b flex items-center justify-between">
                            <span className="font-semibold text-sm">{text.fieldRef}</span>
                            <span className="text-[11px] opacity-50">{text.clickCopy}</span>
                        </div>
                        <div className="p-3 grid md:grid-cols-3 gap-4">
                            {FIELD_REFERENCE.map((grp) => (
                                <div key={grp.group}>
                                    <div className="text-xs font-bold mb-1.5 opacity-70">{grp.group}</div>
                                    <div className="space-y-1">
                                        {grp.fields.map(([token, label]) => (
                                            <button
                                                key={token + label}
                                                onClick={() => copyField(token)}
                                                className="w-full flex items-center justify-between gap-2 rounded-md px-2 py-1 text-left hover:bg-black/5 dark:hover:bg-white/10 text-[11px] font-mono"
                                                title={label}
                                            >
                                                <span className="truncate">{token}</span>
                                                <span className="opacity-50 shrink-0 ml-auto font-sans">{label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
