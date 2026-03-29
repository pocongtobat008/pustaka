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
 * Assess the quality of extracted text to detect garbage/invisible text layers.
 * Returns a score between 0 (garbage) and 1 (high quality readable text).
 */
function assessTextQuality(text) {
  if (!text || text.trim().length === 0) return 0;
  const trimmed = text.trim();
  // Ratio of alphanumeric characters (a-z, 0-9) to total
  const alnumCount = (trimmed.match(/[a-zA-Z0-9]/g) || []).length;
  const alnumRatio = alnumCount / trimmed.length;
  // Average word length
  const words = trimmed.split(/\s+/).filter(w => w.length > 0);
  const avgWordLen = words.length > 0 ? words.reduce((s, w) => s + w.length, 0) / words.length : 0;
  // Ratio of "real" words (2-20 chars, mostly alpha)
  const realWords = words.filter(w => w.length >= 2 && w.length <= 20 && /[a-zA-Z]/.test(w));
  const realWordRatio = words.length > 0 ? realWords.length / words.length : 0;
  // Penalty for too many non-printable / special chars
  const nonPrintable = (trimmed.match(/[^\x20-\x7E\xA0-\xFF]/g) || []).length;
  const nonPrintableRatio = nonPrintable / trimmed.length;
  // Composite score
  let score = (alnumRatio * 0.35) + (Math.min(avgWordLen / 8, 1) * 0.25) + (realWordRatio * 0.3) + ((1 - nonPrintableRatio) * 0.1);
  return Math.max(0, Math.min(1, score));
}

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

  if (images.length > 0) return images;

  // ── Strategy 3: PDF.js viewport rendering to raw pixel buffer (handles JBIG2, CCITT, etc.)
  // This is the most reliable fallback — it renders each page exactly as a PDF viewer would.
  console.log(`[OCR] Strategies 1 & 2 found no images. Using viewport rendering (Strategy 3)...`);
  for (let i = 1; i <= pages; i++) {
    try {
      const page = await pdf.getPage(i);
      const scale = 2.0; // 2x scale for better OCR accuracy
      const viewport = page.getViewport({ scale });
      const width = Math.floor(viewport.width);
      const height = Math.floor(viewport.height);

      // Skip unreasonably small pages
      if (width < 50 || height < 50) continue;

      // Try using node-canvas if available
      if (Canvas) {
        try {
          const canvas = Canvas.createCanvas(width, height);
          const ctx = canvas.getContext('2d');
          await page.render({ canvasContext: ctx, viewport }).promise;
          const pngBuf = canvas.toBuffer('image/png');
          if (pngBuf && pngBuf.length > 1000) {
            images.push({ page: i, buffer: pngBuf });
            console.log(`[OCR] Page ${i} rendered via node-canvas (${width}x${height})`);
            continue;
          }
        } catch (canvasErr) {
          // canvas render failed, try raw pixel approach below
        }
      }

      // Raw pixel buffer approach (no canvas dependency)
      // Create an RGBA buffer and a minimal canvas-like context for pdf.js
      const pixelBuf = Buffer.alloc(width * height * 4, 255); // white background
      const fakeCanvasContext = {
        canvas: { width, height },
        _pixelBuf: pixelBuf,
        // pdf.js uses putImageData to draw rendered content
        putImageData(imageData, dx, dy) {
          const srcData = imageData.data || imageData;
          const srcW = imageData.width || width;
          const srcH = imageData.height || height;
          for (let y = 0; y < srcH && (dy + y) < height; y++) {
            for (let x = 0; x < srcW && (dx + x) < width; x++) {
              const srcIdx = (y * srcW + x) * 4;
              const dstIdx = ((dy + y) * width + (dx + x)) * 4;
              pixelBuf[dstIdx] = srcData[srcIdx];
              pixelBuf[dstIdx + 1] = srcData[srcIdx + 1];
              pixelBuf[dstIdx + 2] = srcData[srcIdx + 2];
              pixelBuf[dstIdx + 3] = srcData[srcIdx + 3];
            }
          }
        },
        getImageData(sx, sy, sw, sh) {
          const out = new Uint8ClampedArray(sw * sh * 4);
          for (let y = 0; y < sh; y++) {
            for (let x = 0; x < sw; x++) {
              const srcIdx = ((sy + y) * width + (sx + x)) * 4;
              const dstIdx = (y * sw + x) * 4;
              out[dstIdx] = pixelBuf[srcIdx];
              out[dstIdx + 1] = pixelBuf[srcIdx + 1];
              out[dstIdx + 2] = pixelBuf[srcIdx + 2];
              out[dstIdx + 3] = pixelBuf[srcIdx + 3];
            }
          }
          return { data: out, width: sw, height: sh };
        },
        createImageData(w, h) {
          return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h };
        },
        // Stubs for other canvas context methods pdf.js might call
        save() { },
        restore() { },
        transform() { },
        setTransform() { },
        resetTransform() { },
        scale() { },
        rotate() { },
        translate() { },
        beginPath() { },
        closePath() { },
        moveTo() { },
        lineTo() { },
        rect() { },
        clip() { },
        fill() { },
        stroke() { },
        fillRect(x, y, w, h) {
          // Fill rectangle in pixel buffer (used for background)
          for (let py = Math.max(0, Math.floor(y)); py < Math.min(height, Math.floor(y + h)); py++) {
            for (let px = Math.max(0, Math.floor(x)); px < Math.min(width, Math.floor(x + w)); px++) {
              const idx = (py * width + px) * 4;
              pixelBuf[idx] = 255; pixelBuf[idx + 1] = 255; pixelBuf[idx + 2] = 255; pixelBuf[idx + 3] = 255;
            }
          }
        },
        strokeRect() { },
        clearRect() { },
        arc() { },
        arcTo() { },
        bezierCurveTo() { },
        quadraticCurveTo() { },
        drawImage() { },
        fillText() { },
        strokeText() { },
        measureText() { return { width: 0 }; },
        set fillStyle(v) { },
        get fillStyle() { return '#ffffff'; },
        set strokeStyle(v) { },
        get strokeStyle() { return '#000000'; },
        set lineWidth(v) { },
        get lineWidth() { return 1; },
        set lineCap(v) { },
        get lineCap() { return 'butt'; },
        set lineJoin(v) { },
        get lineJoin() { return 'miter'; },
        set miterLimit(v) { },
        get miterLimit() { return 10; },
        set globalAlpha(v) { },
        get globalAlpha() { return 1; },
        set globalCompositeOperation(v) { },
        get globalCompositeOperation() { return 'source-over'; },
        set font(v) { },
        get font() { return '10px sans-serif'; },
        set textAlign(v) { },
        get textAlign() { return 'start'; },
        set textBaseline(v) { },
        get textBaseline() { return 'alphabetic'; },
        setLineDash() { },
        getLineDash() { return []; },
        set imageSmoothingEnabled(v) { },
        get imageSmoothingEnabled() { return true; },
      };

      try {
        await page.render({ canvasContext: fakeCanvasContext, viewport }).promise;
        // Convert RGBA pixel buffer to PNG via sharp
        const pngBuf = await sharp(pixelBuf, { raw: { width, height, channels: 4 } })
          .png()
          .toBuffer();
        if (pngBuf && pngBuf.length > 1000) {
          images.push({ page: i, buffer: pngBuf });
          console.log(`[OCR] Page ${i} rendered via pixel buffer (${width}x${height})`);
        }
      } catch (renderErr) {
        console.warn(`[OCR] Page ${i} viewport render failed: ${renderErr.message}`);
      }
    } catch (pageErr) {
      console.warn(`[OCR] Strategy 3 page ${i} error: ${pageErr.message}`);
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

async function doOcrOnBuffer(worker, buffer, psmCandidates = ['3', '6', '11']) {
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
    try { const dec = decodeURIComponent(p); if (fs.existsSync(dec)) return dec; } catch (e) { }
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
  let numPages = 0;
  try {
    const pdfDoc = await PDFDocument.load(raw, { ignoreEncryption: true });
    numPages = pdfDoc.getPageCount();
  } catch (pdfLibErr) {
    console.warn(`[OCR] pdf-lib failed to parse PDF (${pdfLibErr.message}). Falling back to pdfjs-dist for page count.`);
    const loadingTask = pdfjsLib.getDocument({ ...PDFJS_OPTS, data: new Uint8Array(raw) });
    const pdf = await loadingTask.promise;
    numPages = pdf.numPages;
  }
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
      if (avg > 40) {
        // Additional quality check: many scanned PDFs have invisible/garbage OCR text layers
        // from scanner software. Check if the text is actually readable.
        const allText = texts.map(t => t.text).join(' ');
        const quality = assessTextQuality(allText);
        console.log(`[OCR] Text layer: avg=${Math.round(avg)} chars/page, quality=${quality.toFixed(2)}`);
        if (quality < 0.35) {
          console.log(`[OCR] Text layer quality too low (${quality.toFixed(2)} < 0.35) — treating as scanned PDF.`);
          return null; // Force OCR
        }
        return texts;
      }
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
    const combined = results.sort((a, b) => a.page - b.page).map(r => `--- Page ${r.page} (angle=${r.angle}, conf=${Math.round(r.confidence)}) ---\n${r.text}\n`).join('\n');
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
  if (images.length === 0) {
    console.error('[OCR] All 3 rendering strategies failed — no pages could be rendered.');
    throw new Error('No pages rendered — all rendering strategies exhausted (raw JPEG, operator-list, viewport render)');
  }

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

  try { await worker.terminate(); } catch (e) { }

  // restore console handlers and emit a concise warning/error summary
  try { console.warn = origWarn; console.error = origError; } catch (e) { /* ignore */ }
  const suppressed = (warnCount + errorCount) || 0;
  if (suppressed > 0) {
    const sample = [];
    for (const v of warnBuffer.values()) sample.push(v.join(' '));
    for (const v of errorBuffer.values()) sample.push(v.join(' '));
    sendProgress('warnings_summary', { message: `${suppressed} library warnings/errors suppressed`, sample: sample.slice(0, 3) });
  }

  // write combined text
  const combined = results.sort((a, b) => a.page - b.page).map(r => `--- Page ${r.page} (angle=${r.angle}, conf=${Math.round(r.confidence)}) ---\n${r.text}\n`).join('\n');
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
