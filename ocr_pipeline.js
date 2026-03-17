"use strict";

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pathToFileURL } from 'url';
import { createWorker } from 'tesseract.js';
import sharp from 'sharp';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { PDFDocument } from 'pdf-lib';

// Optional canvas for rendering (dynamic import)
let Canvas = null;
try { Canvas = (await import('canvas')).default; } catch (e) { Canvas = null; }

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// PDF.js standard fonts path — prevents hanging when PDFs reference embedded fonts
const _standardFontsDir = path.resolve(path.dirname(__filename), 'node_modules/pdfjs-dist/standard_fonts/');
const _standardFontDataUrl = fs.existsSync(_standardFontsDir)
  ? pathToFileURL(_standardFontsDir).href + '/'
  : undefined;

// PDF.js shared options to prevent font-fetch hangs
const PDFJS_OPTS = {
  standardFontDataUrl: _standardFontDataUrl,
  disableFontFace: true,
  useWorkerFetch: false,
  isEvalSupported: false,
};

/**
 * Extract raw JPEG streams embedded in a PDF binary.
 * Most scanner-produced PDFs store each page as a JPEG XObject.
 * This approach is reliable and needs no canvas or PDF renderer.
 */
function extractRawJpegsFromPdf(pdfBuffer) {
  const buf = Buffer.isBuffer(pdfBuffer) ? pdfBuffer : Buffer.from(pdfBuffer);
  const images = [];
  let offset = 0;
  while (offset < buf.length - 3) {
    // JPEG SOI: FF D8 FF
    if (buf[offset] === 0xFF && buf[offset + 1] === 0xD8 && buf[offset + 2] === 0xFF) {
      const start = offset;
      // Find JPEG EOI: FF D9
      let end = -1;
      for (let j = offset + 2; j < buf.length - 1; j++) {
        if (buf[j] === 0xFF && buf[j + 1] === 0xD9) { end = j + 2; break; }
      }
      if (end > start) {
        const jpeg = buf.slice(start, end);
        // Skip thumbnails and tiny icons; full-page scans are typically > 50 KB
        if (jpeg.length > 50000) images.push(jpeg);
        offset = end;
      } else {
        offset++;
      }
    } else {
      offset++;
    }
  }
  return images;
}

async function renderPdfToImages(pdfPath, maxPages = 50) {
  const data = fs.readFileSync(pdfPath);

  // ── Strategy 1: Direct raw JPEG extraction (fastest, works for all scanner PDFs)
  const rawJpegs = extractRawJpegsFromPdf(data);
  if (rawJpegs.length > 0) {
    console.log(`[OCR] Found ${rawJpegs.length} raw JPEG stream(s) in PDF — using direct extraction.`);
    const images = [];
    for (let i = 0; i < Math.min(rawJpegs.length, maxPages); i++) {
      try {
        const buffer = await sharp(rawJpegs[i])
          .resize({ width: 1654, withoutEnlargement: false })
          .png()
          .toBuffer();
        images.push({ page: i + 1, buffer });
      } catch (e) {
        console.warn(`[OCR] JPEG ${i + 1} sharp convert failed: ${e.message}`);
      }
    }
    if (images.length > 0) return images;
  }

  // ── Strategy 2: PDF.js operator-list image extraction (no canvas required)
  const loadingTask = pdfjsLib.getDocument({ ...PDFJS_OPTS, data: new Uint8Array(data) });
  const pdf = await loadingTask.promise;
  const pages = Math.min(pdf.numPages, maxPages);
  const images = [];

  for (let i = 1; i <= pages; i++) {
    const page = await pdf.getPage(i);

    // Fallback: coba ekstrak image embedded dari operator list (image-only scanned PDFs)
    try {
      const operatorList = await page.getOperatorList();
      for (let j = 0; j < operatorList.fnArray.length; j++) {
        const fn = operatorList.fnArray[j];
        if (fn === pdfjsLib.OPS.paintImageXObject || fn === pdfjsLib.OPS.paintInlineImageXObject) {
          const args = operatorList.argsArray[j] || [];
          const objId = args[0];
          try {
            const img = await page.objs.get(objId);
            if (img && img.width && img.height && img.data) {
              const channels = Math.floor(img.data.length / (img.width * img.height)) || 1;
              const buffer = await sharp(Buffer.from(img.data), {
                raw: { width: img.width, height: img.height, channels }
              })
                .resize(img.width * 2)
                .grayscale()
                .png()
                .toBuffer();
              images.push({ page: i, buffer });
            }
          } catch (e) {
            // ignore per-image errors
          }
        }
      }
    } catch (e) {
      // ignore operator extraction errors
    }
  }
  return images;
}

async function preprocessBuffer(buffer) {
  // adjustable pipeline: resize, denoise, normalize, binarize
  return sharp(buffer)
    .resize({ width: 1654, withoutEnlargement: false })
    .grayscale()
    .normalize()
    .sharpen()
    .median(1)
    .threshold(150)
    .png()
    .toBuffer();
}

async function doOcrOnBuffer(worker, buffer, psmCandidates = ['1','3','6','11']) {
  let best = { text: '', confidence: -1, psm: null };
  for (const psm of psmCandidates) {
    await worker.setParameters({ tessedit_pageseg_mode: psm });
    const ret = await worker.recognize(buffer);
    let conf = -1;
    if (ret?.data?.confidence) conf = ret.data.confidence;
    else if (ret?.data?.tsv) {
      const lines = ret.data.tsv.split('\n');
      let sum = 0, cnt = 0;
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split('\t');
        const c = parseInt(cols[9]);
        if (!isNaN(c)) { sum += c; cnt++; }
      }
      if (cnt > 0) conf = sum / cnt;
    }
    if (conf > best.confidence) best = { text: ret.data?.text || '', confidence: conf, psm };
  }
  return best;
}

async function ocrPdf(pdfPath, outDir, options = {}) {
  // options: { cleanup: boolean, deleteCombined: boolean, onProgress: fn }
  const { cleanup = false, deleteCombined = false, onProgress = null } = options;
  outDir = outDir || path.join(process.cwd(), 'uploads', 'ocr-results');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const sendProgress = (stage, details = {}) => {
    const payload = { stage, timestamp: new Date().toISOString(), ...details };
    if (typeof onProgress === 'function') {
      try { onProgress(payload); } catch (e) { /* ignore callback errors */ }
    } else {
      const percent = details.percent != null ? ` ${Math.round(details.percent)}%` : '';
      console.log(`[OCR] ${payload.timestamp} | ${stage}${percent} — ${details.message || ''}`);
    }
  };

  sendProgress('start', { message: `Loading ${path.basename(pdfPath)}` });
  // resolve input path with some fallbacks if file not found
  function resolveInputPath(p) {
    if (fs.existsSync(p)) return p;
    // try decodeURIComponent
    try { const dec = decodeURIComponent(p); if (fs.existsSync(dec)) return dec; } catch (e) {}
    // replace %20 with space
    const sp = p.replace(/%20/g, ' ');
    if (fs.existsSync(sp)) return sp;
    // try relative to uploads folder
    const uploadsDir = path.join(process.cwd(), 'uploads');
    const base = path.basename(p).replace(/%20/g, ' ');
    if (fs.existsSync(path.join(uploadsDir, base))) return path.join(uploadsDir, base);
    // fuzzy search in uploads for a file containing the base name (case-insensitive)
    if (fs.existsSync(uploadsDir)) {
      const files = fs.readdirSync(uploadsDir);
      const lowBase = base.toLowerCase();
      for (const f of files) {
        if (f.toLowerCase().includes(lowBase) || lowBase.includes(path.parse(f).name.toLowerCase())) {
          const cand = path.join(uploadsDir, f);
          if (fs.existsSync(cand)) return cand;
        }
      }
    }
    return null;
  }

  const resolved = resolveInputPath(pdfPath);
  if (!resolved) throw new Error(`File not found: ${pdfPath}`);

  // prefer pdf-lib to read metadata or check number of pages quickly
  const raw = fs.readFileSync(resolved);
  const pdfDoc = await PDFDocument.load(raw);
  const numPages = pdfDoc.getPageCount();
  const baseName = path.basename(pdfPath).replace(/\.[^.]+$/, '');
  const outFile = path.join(outDir, `${baseName}.txt`);

  // Fast path: try extracting embedded text layer (much faster than OCR for digital PDFs)
  async function tryExtractText(rawData, maxPages = 50) {
    try {
      const loadingTask = pdfjsLib.getDocument({ ...PDFJS_OPTS, data: new Uint8Array(rawData) });
      const pdf = await loadingTask.promise;
      const pages = Math.min(pdf.numPages, maxPages);
      const texts = [];
      let totalChars = 0;
      for (let i = 1; i <= pages; i++) {
        const page = await pdf.getPage(i);
        const txt = await page.getTextContent();
        const s = (txt.items || []).map(it => it.str || '').join(' ').replace(/\s+/g, ' ').trim();
        texts.push({ page: i, text: s });
        totalChars += s.length;
      }
      const avg = pages ? (totalChars / pages) : 0;
      // heuristic: if average chars per page > 40, treat as digital text PDF
      if (avg > 40) return texts;
      return null;
    } catch (e) {
      return null;
    }
  }

  sendProgress('checking_text_layer', { message: 'Checking for embedded text layer' });
  const extracted = await tryExtractText(raw, numPages);
  if (extracted && extracted.length > 0) {
    sendProgress('text_layer_found', { message: 'Digital text layer detected — extracting without OCR' });
    const results = extracted.map(r => ({ page: r.page, text: r.text || '', confidence: 100, psm: null, angle: 0 }));
    const combined = results.sort((a,b)=>a.page-b.page).map(r=>`--- Page ${r.page} (angle=${r.angle}, conf=${Math.round(r.confidence)}) ---\n${r.text}\n`).join('\n');
    fs.writeFileSync(outFile, combined, 'utf8');
    sendProgress('saved_combined', { message: `Saved extracted text to ${outFile}`, percent: 100 });
    return { outFile, results };
  }

  // render pages to images (use resolved path)
  sendProgress('rendering', { message: `Rendering pages (max ${numPages})` });

  // Temporarily capture/suppress noisy library warnings and errors to keep logs concise.
  const warnBuffer = new Map();
  let warnCount = 0;
  const errorBuffer = new Map();
  let errorCount = 0;
  const origWarn = console.warn;
  const origError = console.error;
  // ignore specific noisy tesseract messages entirely
  const ignorePatterns = [
    /osd\.traineddata/i,
    /TESSDATA_PREFIX/i,
    /Failed loading language/i,
    /Tesseract couldn't load any languages/i,
    /Auto orientation and script detection requested/i,
    /Invalid resolution/gi
  ];

  function matchesIgnore(args) {
    try {
      const joined = args.map(a => (typeof a === 'string' ? a : String(a))).join(' ');
      return ignorePatterns.some(rx => rx.test(joined));
    } catch (e) { return false; }
  }

  console.warn = (...args) => {
    try {
      if (matchesIgnore(args)) return; // skip counting or storing
      warnCount++;
      const key = args.map(a => (typeof a === 'string' ? a : String(a))).join(' ');
      if (!warnBuffer.has(key) && warnBuffer.size < 20) warnBuffer.set(key, args);
    } catch (e) { /* ignore */ }
  };
  console.error = (...args) => {
    try {
      if (matchesIgnore(args)) return; // skip counting or storing
      errorCount++;
      const key = args.map(a => (typeof a === 'string' ? a : String(a))).join(' ');
      if (!errorBuffer.has(key) && errorBuffer.size < 20) errorBuffer.set(key, args);
    } catch (e) { /* ignore */ }
  };

  const images = await renderPdfToImages(resolved, numPages);
  if (images.length === 0) throw new Error('No pages rendered');

  // init tesseract worker (createWorker returns a Promise-resolved worker)
  const worker = await createWorker('ind+eng');
  await worker.setParameters({ tessjs_create_tsv: '1', preserve_interword_spaces: '1' });

  const results = [];
  for (const img of images) {
    sendProgress('preprocess_page', { message: `Preprocessing page ${img.page}`, percent: (img.page / numPages) * 100 });
    const pre = await preprocessBuffer(img.buffer);

    // try rotations if needed
    const rotations = [0, 90, 180, 270];
    let bestOverall = { text: '', confidence: -1, psm: null, angle: 0 };

    for (const angle of rotations) {
      const rotated = angle === 0 ? pre : await sharp(pre).rotate(angle).png().toBuffer();
      const res = await doOcrOnBuffer(worker, rotated);
      if (res.confidence > bestOverall.confidence) bestOverall = { ...res, angle };
    }

    // if still low, try small-angle search
    if (bestOverall.confidence < 60) {
      for (let a = -5; a <= 5; a++) {
        const rotated = await sharp(pre).rotate(a).png().toBuffer();
        const res = await doOcrOnBuffer(worker, rotated);
        if (res.confidence > bestOverall.confidence) bestOverall = { ...res, angle: a };
      }
    }

    const cleaned = (bestOverall.text || '')
      .replace(/[^\S\n]+/g, ' ')
      .replace(/[^\w\s\p{P}\p{N}]+/gu, '')
      .trim();

    sendProgress('page_result', { message: `Page ${img.page} finished (angle=${bestOverall.angle} psm=${bestOverall.psm} conf=${Math.round(bestOverall.confidence)})`, percent: (img.page / numPages) * 100, page: img.page, confidence: bestOverall.confidence, angle: bestOverall.angle });

    results.push({ page: img.page, text: cleaned || bestOverall.text, confidence: bestOverall.confidence, psm: bestOverall.psm, angle: bestOverall.angle });
  }

  try { await worker.terminate(); } catch (e) {}

  // restore console handlers and emit a concise warning/error summary
  try { console.warn = origWarn; console.error = origError; } catch (e) { /* ignore */ }
  const suppressed = (warnCount + errorCount) || 0;
  if (suppressed > 0) {
    const sample = [];
    for (const v of warnBuffer.values()) sample.push(v.join(' '));
    for (const v of errorBuffer.values()) sample.push(v.join(' '));
    sendProgress('warnings_summary', { message: `${suppressed} library warnings/errors suppressed`, sample: sample.slice(0,3) });
  }

  // write combined text
  const combined = results.sort((a,b)=>a.page-b.page).map(r=>`--- Page ${r.page} (angle=${r.angle}, conf=${Math.round(r.confidence)}) ---\n${r.text}\n`).join('\n');
  fs.writeFileSync(outFile, combined, 'utf8');
  sendProgress('saved_combined', { message: `Saved OCR text to ${outFile}`, percent: 100 });

  // also save per-page raw images for inspection
  const createdFiles = [];
  for (const r of results) {
    const imgOut = path.join(outDir, `${baseName}_page${r.page}_angle${r.angle}.txt`);
    fs.writeFileSync(imgOut, r.text || '', 'utf8');
    createdFiles.push(imgOut);
  }
  createdFiles.push(outFile);

  // cleanup generated files if requested
  if (cleanup) {
    // match files that start with baseName
    const escapeRegExp = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp('^' + escapeRegExp(baseName));
    try {
      const files = fs.readdirSync(outDir);
      for (const f of files) {
        if (re.test(f)) {
          const full = path.join(outDir, f);
          // skip deleting combined file unless explicitly requested
          if (!deleteCombined && full === outFile) continue;
          try { fs.unlinkSync(full); } catch (e) { /* ignore unlink errors */ }
        }
      }
    } catch (e) {
      // ignore cleanup errors
    }
  }

  sendProgress('done', { message: `OCR process completed for ${baseName}`, percent: 100 });
  return { outFile: cleanup && !deleteCombined ? outFile : (deleteCombined ? null : outFile), results };
}

// CLI
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const arg = process.argv[2] || path.join(__dirname, 'dokumen_scan.pdf');
  ocrPdf(arg).catch(err => { console.error(err); process.exitCode = 1; });
}

export { ocrPdf };
