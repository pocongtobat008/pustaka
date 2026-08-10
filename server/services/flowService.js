import { sendMail } from './mailer.js';

// Event yang bisa di-route ke penanggung jawab flow.
export const FLOW_EVENTS = {
    invoice_created: 'Invoice Dibuat',
    proforma_pending: 'Pengajuan Proforma Dibuat (menunggu approval)',
    proforma_approved: 'Proforma Disetujui',
    proforma_sent_back: 'Proforma Dikirim Balik (Sendback)',
    proforma_rejected: 'Proforma Ditolak (Reject)',
    tax_requested: 'Request Faktur ke Tax',
    tax_approved: 'Faktur Pajak Disetujui',
    settled: 'Proforma Settled / Selesai',
};

export const FLOW_ASSIGNEE_TYPES = ['all', 'role', 'user', 'division'];

// Token yang bisa dipakai di template email (subject & body).
export const EMAIL_TOKENS = [
    ['{{event}}', 'Nama event (mis. "Proforma Disetujui")'],
    ['{{no_proforma}}', 'Nomor proforma (atau "Belum ada")'],
    ['{{requester}}', 'Yang mengajukan / melakukan aksi'],
    ['{{dealer}}', 'Nama dealer'],
    ['{{no_po}}', 'Nomor PO'],
    ['{{total}}', 'Total nominal (format Rupiah)'],
    ['{{notes}}', 'Alasan / catatan (sendback atau reject)'],
    ['{{rows}}', 'Daftar invoice (tag <ul>/<li>)'],
];

const round2 = (n) => Math.round((parseFloat(n) || 0) * 100) / 100;

const fmtRp = (n) => 'Rp ' + new Intl.NumberFormat('id-ID').format(round2(n ?? 0));

// Default subject per event (dipakai bila template belum dikustomisasi).
export const DEFAULT_EMAIL_SUBJECTS = Object.fromEntries(
    Object.keys(FLOW_EVENTS).map(ev => [ev, `[Alur Invoice] ${FLOW_EVENTS[ev]}`])
);

// Body default per event. Struktur sama, hanya judul event yang beda.
export function buildDefaultBody(event) {
    return `
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1e293b;line-height:1.6">
            <h3 style="margin:0 0 12px;color:#4f46e5">Notifikasi Alur Invoice</h3>
            <p style="margin:0 0 8px"><b>{{event}}</b></p>
            <p style="margin:0 0 8px">No Proforma: {{no_proforma}} • Diajukan oleh: {{requester}} • Total: {{total}}</p>
            <ul style="margin:0 0 8px;padding-left:20px">{{rows}}</ul>
            <p style="margin:0">Silakan buka aplikasi untuk memproses.</p>
        </div>
    `.replace(/\n\s*/g, ' ');
}

// Ganti token {{xxx}} pada template dengan nilai yang tersedia.
export function renderTemplate(str, vars) {
    return String(str || '').replace(/\{\{\s*([\w.]+)\s*\}\}/g, (m, key) => {
        const v = vars[key];
        return v != null && v !== '' ? String(v) : m;
    });
}

// Ambil template email dari DB; fallback ke default bila belum dikustomisasi.
export async function getEmailTemplate(knex, event) {
    try {
        const row = await knex('email_templates').where({ event }).first();
        if (row) return { subject: row.subject, body_html: row.body_html, custom: true };
    } catch { /* ignore db error, pakai default */ }
    return { subject: DEFAULT_EMAIL_SUBJECTS[event], body_html: buildDefaultBody(event), custom: false };
}

// Susun variabel untuk template dari konteks event.
export function buildEmailVars(event, ctx) {
    const total = ctx.total ?? (ctx.proforma ? ctx.proforma.total_nominal : (ctx.invoice ? ctx.invoice.total_invoice : null));
    const rowsHtml = (ctx.invoices || []).map(inv =>
        `<li>Invoice #${inv.id} • ${inv.dealer_name || '-'} • PO ${inv.no_po || '-'} • ${fmtRp(inv.total_invoice)}</li>`
    ).join('') || (ctx.invoice ? `<li>Invoice #${ctx.invoice.id} • ${ctx.invoice.dealer_name || '-'} • PO ${ctx.invoice.no_po || '-'} • ${fmtRp(ctx.invoice.total_invoice)}</li>` : '');
    const noProforma = ctx.proforma?.proforma_no || (ctx.proforma ? '#' + (ctx.proforma?.id || '') : ctx.invoice?.proforma_no || 'Belum ada');
    return {
        event: FLOW_EVENTS[event] || event,
        no_proforma: noProforma,
        requester: ctx.requester || '-',
        dealer: ctx.invoice?.dealer_name || (ctx.proforma?.dealer_name || '-'),
        no_po: ctx.invoice?.no_po || '-',
        total: fmtRp(total ?? 0),
        notes: ctx.notes || '',
        rows: rowsHtml || '<li>-</li>',
    };
}

// Parse daftar email custom (bisa berupa array, string pisah koma/baris, atau JSON string).
export function parseCustomEmails(input) {
    let parts = [];
    if (Array.isArray(input)) parts = input;
    else if (typeof input === 'string') {
        const trimmed = input.trim();
        try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) parts = parsed;
        } catch { /* bukan JSON */ }
        if (!parts.length && trimmed) parts = trimmed.split(/[\s,;]+/);
    }
    return [...new Set(parts.map(p => String(p || '').trim().toLowerCase()).filter(e => e && e.includes('@')))];
}

// Gabungkan penerima: user terdaftar (dari assignee) + email custom yang diketik manual.
export async function resolveRecipients(knex, step) {
    const users = await resolveAssignees(knex, step);
    const custom = parseCustomEmails(step.custom_emails).map(email => ({
        username: null,
        name: 'Email Custom',
        email,
        custom: true,
    }));
    return [...users, ...custom];
}

// Tentukan user yang menjadi penanggung jawab sebuah step flow.
export async function resolveAssignees(knex, step) {
    const type = step.assignee_type || 'all';
    const val = step.assignee_value;
    try {
        if (type === 'user') {
            return await knex('users').where('username', val).select('username', 'name', 'email');
        }
        if (type === 'role') {
            return await knex('users').where('role', val).select('username', 'name', 'email');
        }
        if (type === 'division') {
            return await knex('users').where('department', val).select('username', 'name', 'email');
        }
        return await knex('users').select('username', 'name', 'email');
    } catch {
        return [];
    }
}

// Route notifikasi (email + in-app) ke penanggung jawab step flow untuk event tertentu.
// Best-effort: error tidak mengganggu alur utama.
export async function notifyFlowEvent(knex, event, ctx = {}) {
    try {
        const steps = await knex('invoice_flow_steps').where({ event, is_active: true }).orderBy('step_no', 'asc');
        if (!steps.length) return { event, steps: 0, recipients: 0 };
        const tpl = await getEmailTemplate(knex, event);
        const vars = buildEmailVars(event, ctx);
        const subject = renderTemplate(tpl.subject, vars);
        const html = renderTemplate(tpl.body_html, vars);
        let recipients = 0;
        for (const s of steps) {
            const users = await resolveRecipients(knex, s);
            for (const u of users) {
                recipients++;
                const email = u.email ? String(u.email).trim() : '';
                if (email && s.notify_email) {
                    try {
                        await sendMail({ to: email, subject, html });
                    } catch (err) {
                        console.error('[flow] Gagal kirim email ke', email, err.message);
                    }
                }
                if (u.username) {
                    try {
                        await knex('notifications').insert({
                            title: subject,
                            message: `${FLOW_EVENTS[event] || event} — ${ctx.proforma?.proforma_no || ctx.invoice?.no_po || ''}`,
                            type: 'approval',
                            channel: 'system',
                            target_type: 'user',
                            target_value: u.username,
                            created_by: ctx.requester || 'System',
                            created_at: knex.fn.now(),
                        }).onConflict().ignore();
                    } catch { /* notif in-app opsional */ }
                }
            }
        }
        return { event, steps: steps.length, recipients };
    } catch (err) {
        console.error('[flow] notifyFlowEvent gagal:', err.message);
        return { event, steps: 0, recipients: 0 };
    }
}
