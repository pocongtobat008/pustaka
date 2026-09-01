import puppeteer from 'puppeteer';
import Handlebars from 'handlebars';
import { knex } from '../db.js';
import { SIGNATURE_PLACEHOLDER_PNG } from './signaturePlaceholder.js';

const round2 = (n) => Math.round((parseFloat(n) || 0) * 100) / 100;

export const formatRupiah = (n) => {
    const num = parseFloat(n) || 0;
    const neg = num < 0;
    const abs = Math.abs(num);
    const s = Math.round(abs).toLocaleString('id-ID');
    return `${neg ? '-' : ''}${s}`;
};

export const dateId = (d) => {
    if (!d) return '-';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return '-';
    return dt.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export const terbilang = (n) => {
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

export const terbilangRupiah = (n) => {
    const neg = (parseFloat(n) || 0) < 0;
    const s = terbilang(Math.abs(parseFloat(n) || 0));
    return `${neg ? 'Minus ' : ''}${s ? s.charAt(0).toUpperCase() + s.slice(1) : ''} Rupiah`;
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
Handlebars.registerHelper('terbilang', () => '');
Handlebars.registerHelper('terbilang', (n) => terbilang(n));
Handlebars.registerHelper('terbilangRupiah', (n) => terbilangRupiah(n));

const TIPE_LABELS = {
    CBD: 'Cash Before Delivery',
    PF: 'Proforma First',
    PP: 'Partial Payment',
};
const STATUS_LABELS = {
    submitted: 'Submitted',
    sent_back: 'Sent Back',
    proforma: 'Proforma',
    tax_requested: 'Tax Requested',
    sent_back_tax: 'Sent Back Tax',
    tax: 'Tax',
    settled: 'Settled',
    cancelled: 'Cancelled',
};

export async function getActiveTemplate(docType = 'proforma') {
    const row = await knex('pdf_templates')
        .where('doc_type', docType)
        .where('is_active', true)
        .orderBy('updated_at', 'desc')
        .first();
    return row || null;
}

export function buildContext(invoice, items, parentInvoice = null) {
    const totalInvoice = round2(invoice.total_invoice);
    const uangMasuk = round2(invoice.uang_masuk);
    const ppTypeLabel = invoice.pp_type === 'pelunasan' ? 'Pelunasan' : (invoice.pp_type === 'dp' ? 'DP' : '');

    // ── Hitung nilai DP & Pelunasan untuk kolom PDF ──
    let dpVal = '';
    let pelunasanVal = '';
    if (invoice.pp_type === 'dp') {
        // DP type: tampilkan uang_masuk sebagai DP, sisa sebagai pelunasan kosong
        dpVal = formatRupiah(uangMasuk);
        pelunasanVal = '';
    } else if (invoice.pp_type === 'pelunasan') {
        // Pelunasan type: DP dari parent, pelunasan = uang masuk saat ini
        const parentDp = parentInvoice ? round2(parentInvoice.uang_masuk) : round2(totalInvoice - uangMasuk);
        dpVal = formatRupiah(parentDp);
        pelunasanVal = formatRupiah(uangMasuk);
    }

    return {
        id: invoice.id,
        proforma_no: invoice.proforma_no || '',
        dealer_name: invoice.dealer_name || '',
        dealer_npwp: invoice.dealer_npwp || '',
        dealer_alamat: invoice.dealer_alamat || '',
        no_po: invoice.no_po || '',
        tgl_po: invoice.tgl_po ? String(invoice.tgl_po).slice(0, 10) : '',
        tgl_po_display: dateId(invoice.tgl_po),
        tipe: invoice.tipe || '',
        tipe_label: TIPE_LABELS[invoice.tipe] || invoice.tipe || '',
        pp_type: invoice.pp_type || '',
        pp_type_label: ppTypeLabel,
        status: invoice.status || '',
        status_label: STATUS_LABELS[invoice.status] || invoice.status || '',
        tgl_transaksi: invoice.tgl_transaksi ? String(invoice.tgl_transaksi).slice(0, 10) : '',
        tgl_transaksi_display: dateId(invoice.tgl_transaksi),
        tgl_uang_masuk: invoice.tgl_uang_masuk ? String(invoice.tgl_uang_masuk).slice(0, 10) : '',
        tgl_uang_masuk_display: dateId(invoice.tgl_uang_masuk),
        subtotal: formatRupiah(invoice.subtotal),
        ppn: formatRupiah(invoice.ppn),
        ppn_raw: round2(invoice.ppn),
        ppn_rate: invoice.ppn_rate != null ? invoice.ppn_rate : 0.11,
        diskon: formatRupiah(invoice.diskon),
        materai: formatRupiah(invoice.materai),
        total_invoice: formatRupiah(totalInvoice),
        total_invoice_raw: totalInvoice,
        total_invoice_terbilang: terbilangRupiah(totalInvoice),
        uang_masuk: formatRupiah(uangMasuk),
        uang_masuk_raw: uangMasuk,
        sisa: formatRupiah(totalInvoice - uangMasuk),
        sisa_raw: round2(totalInvoice - uangMasuk),
        dp: dpVal,
        dp_raw: invoice.pp_type === 'dp' ? uangMasuk : (invoice.pp_type === 'pelunasan' && parentInvoice ? round2(parentInvoice.uang_masuk) : 0),
        pelunasan: pelunasanVal,
        pelunasan_raw: invoice.pp_type === 'pelunasan' ? uangMasuk : 0,
        created_by: invoice.created_by || '',
        created_at: dateId(invoice.created_at),
        item_count: items.length,
        items: (items || []).map((it, i) => ({
            no: i + 1,
            model: it.model || '',
            item_description: it.item_description || '',
            qty: it.qty || 1,
            harga: formatRupiah(it.harga),
            harga_raw: round2(it.harga),
            subtotal: formatRupiah(it.subtotal),
            subtotal_raw: round2(it.subtotal),
        })),
        company: {
            name: 'YANMAR', // brand, warna maroon di CSS
            address: '',
            phone: '',
        },
    };
}

export function compileHtml(html, context) {
    try {
        const template = Handlebars.compile(html || '');
        return template(context);
    } catch (e) {
        throw new Error(`Gagal mengkompilasi template: ${e.message}`);
    }
}

export function buildPdfShell(html, css = '') {
    return `<!DOCTYPE html>
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
}

let _browserPromise = null;

async function getBrowser() {
    if (_browserPromise) {
        try {
            const b = await _browserPromise;
            if (b && b.isConnected()) return b;
        } catch { /* relaunch below */ }
    }
    _browserPromise = puppeteer.launch({
        headless: 'new',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
        ],
    });
    return _browserPromise;
}

export async function renderHtmlToPdf(html, { waitFor = 200 } = {}) {
    const browser = await getBrowser();
    const page = await browser.newPage();
    try {
        await page.setContent(html, { waitUntil: 'networkidle0', timeout: 15000 });
        if (waitFor > 0) await new Promise((r) => setTimeout(r, waitFor));
        const buf = await page.pdf({
            format: 'A4',
            printBackground: true,
            preferCSSPageSize: true,
        });
        return Buffer.from(buf);
    } finally {
        await page.close().catch(() => {});
    }
}

export async function renderInvoicePdf(invoiceId, docType = 'proforma') {
    const invoice = await knex('proforma_invoices').where('id', invoiceId).first();
    if (!invoice) throw new Error('Invoice tidak ditemukan');
    const items = await knex('proforma_invoice_items').where('invoice_id', invoiceId).orderBy('id', 'asc');
    const tpl = await getActiveTemplate(docType);
    if (!tpl) throw new Error('TIDAK_ADA_TEMPLATE');
    // Untuk pelunasan, fetch parent DP invoice
    let parentInvoice = null;
    if (invoice.pp_type === 'pelunasan' && invoice.pelunasan_of_id) {
        parentInvoice = await knex('proforma_invoices').where('id', invoice.pelunasan_of_id).first();
    }
    const context = buildContext(invoice, items, parentInvoice);
    const html = compileHtml(tpl.html, context);
    const shell = buildPdfShell(html, tpl.css);
    return renderHtmlToPdf(shell);
}

// Data contoh untuk preview di designer
export function buildSampleContext() {
    const sampleInvoice = {
        id: 1,
        proforma_no: 'PI202608031234500001',
        dealer_name: 'CV Maju Jaya Motor',
        dealer_npwp: '01.234.567.8-901.000',
        dealer_alamat: 'Jl. Raya Industri No. 45, Surabaya, Jawa Timur',
        no_po: 'PO-2026-0001',
        tgl_po: '2026-08-01',
        tipe: 'PP',
        pp_type: 'dp',
        status: 'submitted',
        tgl_transaksi: '2026-08-03',
        tgl_uang_masuk: '2026-08-03',
        subtotal: 9000000,
        ppn: 990000,
        ppn_rate: 0.11,
        diskon: 50000,
        materai: 10000,
        total_invoice: 9950000,
        uang_masuk: 2000000,
        created_by: 'admin',
        created_at: new Date(),
    };
    const sampleItems = [
        { model: 'YAMAR-X1', item_description: 'Excavator Kompak 1.2 ton', qty: 2, harga: 3000000, subtotal: 6000000 },
        { model: 'YAMAR-X2', item_description: 'Loader Mini 0.8 ton', qty: 1, harga: 3000000, subtotal: 3000000 },
    ];
    return buildContext(sampleInvoice, sampleItems);
}

const signatureCell = (label, width = '33.33%') => `<td style="width:${width};text-align:center;font-size:11px;vertical-align:top">
      <div style="font-weight:800;color:#800000">${label}</div>
      <div style="height:58px;display:flex;align-items:flex-end;justify-content:center">
        <img src="${SIGNATURE_PLACEHOLDER_PNG}" alt="ttd" style="max-width:95px;max-height:48px;height:auto" />
      </div>
      <div style="margin-top:2px">____________________</div>
      <div style="font-weight:800;margin-top:4px;font-size:11px">Nama</div>
      <div style="font-size:10px;color:#555">Jabatan</div>
    </td>`;

// ── Bagian bersama (header, dealer, item, ringkasan) untuk kedua laporan ──
const PAGE_HEADER = `<table width="100%" style="border-collapse:collapse">
  <tr>
    <td style="text-align:center;vertical-align:top;padding-bottom:6px">
      <div style="font-size:26px;font-weight:900;color:#800000;letter-spacing:2px">{{company.name}}</div>
    </td>
  </tr>
</table>

<table width="100%" style="border-collapse:collapse">
  <tr>
    <td style="width:50%;vertical-align:top">
      <div style="font-size:15px;font-weight:800;color:#800000;letter-spacing:1px">PROFORMA INVOICE</div>
      <div style="font-size:11px;color:#555;margin-top:2px">No. {{proforma_no}}</div>
    </td>
    <td style="width:50%;text-align:right;vertical-align:top;font-size:10px;color:#333;line-height:1.5">
      <div style="font-weight:800;color:#800000">PT. Yanmar Diesel Indonesia</div>
      <div>Jl. Raya Jakarta - Bogor Km. 34,8, Sukamaju</div>
      <div>Cilodong, Depok, Jawa Barat 16415</div>
      <div>Telp: +62-21-8741558</div>
      <div>Fax: +62-21-8741550(A) / 8741559(M) / 8741610(P)</div>
    </td>
  </tr>
</table>

<hr style="border:none;border-top:2px solid #800000;margin:12px 0" />

<table style="font-size:12px">
  <tr><td style="width:160px;color:#555">Nama Dealer</td><td><b>{{dealer_name}}</b></td></tr>
  <tr><td style="color:#555">NPWP</td><td>{{dealer_npwp}}</td></tr>
  <tr><td style="color:#555">Alamat</td><td>{{dealer_alamat}}</td></tr>
  <tr><td style="color:#555">No. PO</td><td>{{no_po}}</td></tr>
  <tr><td style="color:#555">Tgl. PO</td><td>{{tgl_po_display}}</td></tr>
  <tr><td style="color:#555">Tipe</td><td>{{tipe}} ({{tipe_label}})</td></tr>
  <tr><td style="color:#555">Tgl. Transaksi</td><td>{{tgl_transaksi_display}}</td></tr>
</table>`;

const ITEMS_TABLE = `<h3 style="margin:18px 0 8px;font-size:13px;color:#800000">DETAIL BARANG</h3>
<table style="font-size:11px;border-collapse:collapse;width:100%">
  <thead>
    <tr style="background:#800000;color:#fff">
      <th style="padding:6px;text-align:center;width:30px">NO</th>
      <th style="padding:6px;text-align:left">DESKRIPSI</th>
      <th style="padding:6px;text-align:right">QTY</th>
      <th style="padding:6px;text-align:right">UNIT PRICE</th>
      <th style="padding:6px;text-align:right">TOTAL PRICE</th>
    </tr>
  </thead>
  <tbody>
    {{#each items}}
    <tr style="border-bottom:1px solid #e5e7eb">
      <td style="padding:6px;text-align:center">{{no}}</td>
      <td style="padding:6px"><b>{{model}}</b>{{#if item_description}}<br/><span style="color:#444;font-size:10px">{{item_description}}</span>{{/if}}</td>
      <td style="padding:6px;text-align:right" class="tabular">{{qty}}</td>
      <td style="padding:6px;text-align:right" class="tabular">{{harga}}</td>
      <td style="padding:6px;text-align:right" class="tabular">{{subtotal}}</td>
    </tr>
    {{/each}}
  </tbody>
</table>`;

const SUMMARY_BORDERED = `<table style="font-size:12px;margin-top:14px;width:100%;border-collapse:collapse">
  <tr>
    <td style="width:55%;vertical-align:top;font-size:11px;color:#555;padding:8px;border:1px solid #800000">
      Terbilang : <b style="color:#111">{{total_invoice_terbilang}}</b>
    </td>
    <td style="width:45%;border:1px solid #800000">
      <table style="width:100%;border-collapse:collapse">
        <tr><td style="padding:4px 8px;color:#555;border-bottom:1px solid #800000">Subtotal</td><td style="padding:4px 8px;text-align:right;border-left:1px solid #800000;border-bottom:1px solid #800000" class="tabular">{{subtotal}}</td></tr>
        <tr><td style="padding:4px 8px;color:#555;border-bottom:1px solid #800000">PPN</td><td style="padding:4px 8px;text-align:right;border-left:1px solid #800000;border-bottom:1px solid #800000" class="tabular">{{ppn}}</td></tr>
        <tr><td style="padding:4px 8px;color:#555;border-bottom:1px solid #800000">Diskon</td><td style="padding:4px 8px;text-align:right;border-left:1px solid #800000;border-bottom:1px solid #800000" class="tabular">{{diskon}}</td></tr>
        <tr><td style="padding:4px 8px;color:#555;border-bottom:1px solid #800000">Materai</td><td style="padding:4px 8px;text-align:right;border-left:1px solid #800000;border-bottom:1px solid #800000" class="tabular">{{materai}}</td></tr>
        <tr style="background:#fbe9e7"><td style="padding:6px 8px;font-weight:800;color:#800000;border-bottom:1px solid #800000">TOTAL INVOICE</td><td style="padding:6px 8px;text-align:right;font-weight:800;color:#800000;border-left:1px solid #800000;border-bottom:1px solid #800000" class="tabular">{{total_invoice}}</td></tr>
        <tr><td style="padding:4px 8px;color:#555;border-bottom:1px solid #800000">Uang Masuk</td><td style="padding:4px 8px;text-align:right;font-weight:700;border-left:1px solid #800000;border-bottom:1px solid #800000" class="tabular">{{uang_masuk}}</td></tr>
        <tr><td style="padding:4px 8px;color:#555">Sisa</td><td style="padding:4px 8px;text-align:right;font-weight:700;border-left:1px solid #800000" class="tabular">{{sisa}}</td></tr>
      </table>
    </td>
  </tr>
</table>`;

const PAGE_FOOTER = `<div style="margin-top:18px;font-size:11px;color:#555">Dibuat oleh: {{created_by}} &nbsp;•&nbsp; {{created_at}}</div>`;

// ── Laporan 1: PROFORMA INVOICE (setelah no proforma dibuat) — 1 tanda tangan ──
export const DEFAULT_TEMPLATE_HTML = `${PAGE_HEADER}

${ITEMS_TABLE}

${SUMMARY_BORDERED}

<table width="100%" style="border-collapse:collapse;margin-top:48px">
  <tr>
    <td style="width:50%;text-align:center;font-size:11px">
      <div style="color:#555">Dibuat Oleh,</div>
      <div style="height:70px;display:flex;align-items:flex-end;justify-content:center">
        <img src="${SIGNATURE_PLACEHOLDER_PNG}" alt="ttd" style="max-width:110px;max-height:55px;height:auto" />
      </div>
      <div style="margin-top:2px">______________________</div>
      <div style="font-weight:800;margin-top:6px;font-size:12px">{{created_by}}</div>
      <div style="font-size:11px;color:#555">Jabatan</div>
    </td>
  </tr>
</table>

${PAGE_FOOTER}`;

// ── Laporan 2: PENGAJUAN PROFORMA — 6 tanda tangan berjejer 1 baris ──
export const REQUEST_TEMPLATE_HTML = `${PAGE_HEADER}

${ITEMS_TABLE}

${SUMMARY_BORDERED}

<table width="100%" style="border-collapse:collapse;margin-top:44px">
  <tr>
    ${signatureCell('PLAN', '16.66%')}
    ${signatureCell('CHECKER', '16.66%')}
    ${signatureCell('CHECKER', '16.66%')}
    ${signatureCell('CHECKER', '16.66%')}
    ${signatureCell('ACKNOWLEDGE', '16.66%')}
    ${signatureCell('ACKNOWLEDGE', '16.66%')}
  </tr>
</table>

${PAGE_FOOTER}`;

export const DEFAULT_TEMPLATE_CSS = `/* Warna brand: merah marun (maroon) #800000.
   Token data: {{dealer_name}}, {{total_invoice}}, {{#each items}}...{{/each}}, dst.
   Lihat panel "Field Reference". */
`;

export const REQUEST_TEMPLATE_CSS = DEFAULT_TEMPLATE_CSS;

export function getDefaultTemplate(docType = 'proforma') {
    if (docType === 'proforma_request') {
        return { html: REQUEST_TEMPLATE_HTML, css: REQUEST_TEMPLATE_CSS };
    }
    return { html: DEFAULT_TEMPLATE_HTML, css: DEFAULT_TEMPLATE_CSS };
}
