import nodemailer from 'nodemailer';

const cfg = {
    host: process.env.MAIL_HOST || '',
    port: Number(process.env.MAIL_PORT || 587),
    secure: String(process.env.MAIL_SECURE || '').toLowerCase() === 'true',
    user: process.env.MAIL_USER || '',
    pass: process.env.MAIL_PASS || '',
    from: process.env.MAIL_FROM || process.env.MAIL_USER || 'noreply@localhost',
};

export const isMailConfigured = () => Boolean(cfg.host && cfg.user && cfg.pass);

// Ringkasan konfigurasi SMTP yang aman ditampilkan ke UI (TANPA password).
export const getMailInfo = () => ({
    configured: isMailConfigured(),
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    from: cfg.from,
    hasPass: Boolean(cfg.pass),
});

let transporter = null;

function getTransporter() {
    if (!isMailConfigured()) return null;
    if (!transporter) {
        transporter = nodemailer.createTransport({
            host: cfg.host,
            port: cfg.port,
            secure: cfg.secure,
            auth: { user: cfg.user, pass: cfg.pass },
        });
    }
    return transporter;
}

// Kirim email. Jika SMTP belum dikonfigurasi, email disimulasikan ke console
// agar alur (tombol + endpoint) tetap bisa diuji.
export async function sendMail({ to, subject, html, text }) {
    const info = { simulated: true, to, messageId: null };
    if (!isMailConfigured()) {
        console.log(`[mailer] SIMULASI EMAIL (SMTP belum dikonfigurasi). To: ${to} | Subject: ${subject}`);
        console.log(`[mailer] Isi: ${(html || text || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500)}`);
        return info;
    }
    const t = getTransporter();
    const result = await t.sendMail({
        from: cfg.from,
        to,
        subject,
        html,
        text: text || (html ? html.replace(/<[^>]+>/g, ' ') : ''),
    });
    info.simulated = false;
    info.messageId = result.messageId;
    console.log(`[mailer] Email terkirim ke ${to} (${result.messageId})`);
    return info;
}
