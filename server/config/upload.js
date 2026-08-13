import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure uploads directory exists
// Adjusted path to point to server root/uploads
export const UPLOADS_DIR = path.join(__dirname, '../../uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Ekstensi berbahaya yang TIDAK boleh diunggah (mencegah malware/XSS via file)
const DANGEROUS_EXT = new Set([
    'exe', 'msi', 'bat', 'cmd', 'com', 'scr', 'ps1', 'vbs', 'js', 'mjs', 'cjs',
    'sh', 'bash', 'php', 'phtml', 'py', 'pl', 'rb', 'jar', 'class', 'apk', 'dll', 'so',
    'html', 'htm', 'xhtml', 'hta', 'swf', 'iso', 'app', 'bin', 'o', 'elf', 'wasm',
    'htaccess', 'htpasswd', 'ini', 'sql', 'reg', 'lnk', 'url', 'crt', 'pem', 'key',
]);

// Nama file aman: buang path traversal, karakter aneh, dan kontrol ekstensi
const sanitizeFilename = (originalName) => {
    const base = path.basename(String(originalName || '').replace(/[\x00-\x1f]/g, ''));
    const cleaned = base.replace(/[^\w.\- ]+/g, '_').replace(/\s+/g, '_').slice(0, 120);
    return cleaned || 'file';
};

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, UPLOADS_DIR);
    },
    filename: function (req, file, cb) {
        // Konsisten dengan logika lama (prefix timestamp) + nama aman
        cb(null, Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '-' + sanitizeFilename(file.originalname));
    }
});

export const upload = multer({
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname || '').slice(1).toLowerCase();
        if (DANGEROUS_EXT.has(ext)) {
            const e = new Error(`Tipe file .${ext} tidak diizinkan untuk diunggah.`);
            e.status = 400;
            return cb(e);
        }
        cb(null, true);
    },
});
