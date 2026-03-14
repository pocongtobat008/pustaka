import { createWorker } from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist';
// Import worker dynamically for Vite
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';

// Configure PDF.js Worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

/**
 * Main OCR/Text Extraction Function
 * @param {File} file - The file object to process
 * @param {Function} onProgress - Callback for progress updates (message, percentage)
 * @returns {Promise<string>} - Extracted text
 */
export const performAdvancedOCR = async (file, onProgress = (msg) => { }) => {
    const type = file.type;
    const name = file.name.toLowerCase();

    console.log(`Starting Advanced OCR for: ${name} (${type})`);

    try {
        // 1. IMAGES (JPG, JPEG, PNG, BMP, TIFF, WEBP, etc.)
        if (type.startsWith('image/') ||
            name.endsWith('.jpg') || name.endsWith('.jpeg') ||
            name.endsWith('.png') || name.endsWith('.bmp') ||
            name.endsWith('.tiff') || name.endsWith('.webp')) {
            return await extractFromImage(file, onProgress);
        }

        // 2. PDF (Scanned or Digital)
        if (type === 'application/pdf') {
            return await extractFromPDF(file, onProgress);
        }

        // 3. WORD (.docx)
        if (type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || name.endsWith('.docx')) {
            return await extractFromWord(file, onProgress);
        }

        // 4. EXCEL (.xlsx, .xls)
        if (type.includes('spreadsheet') || type.includes('excel') || name.endsWith('.xlsx') || name.endsWith('.xls')) {
            return await extractFromExcel(file, onProgress);
        }

        // 5. POWERPOINT (.pptx)
        if (type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' || name.endsWith('.pptx')) {
            return await extractFromPPTX(file, onProgress);
        }

        // 6. TEXT / CODE
        if (type.startsWith('text/') || name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.json')) {
            return await file.text();
        }

        return "Format file tidak didukung untuk ekstraksi teks otomatis.";

    } catch (error) {
        console.error("OCR Error:", error);
        throw new Error(`Gagal memproses file: ${error.message}`);
    }
};

// --- HELPER FUNCTIONS ---

async function extractFromImage(file, onProgress) {
    onProgress("Menginisialisasi OCR Engine...", 10);
    const worker = await createWorker('eng+ind', 1, {
        logger: m => {
            if (m.status === 'recognizing text') {
                onProgress(`Mengenali Teks: ${Math.round(m.progress * 100)}%`, 30 + (m.progress * 70));
            }
        }
    });

    onProgress("Membaca Teks Gambar...", 30);
    const { data: { text } } = await worker.recognize(file);
    await worker.terminate();

    return `[OCR GAMBAR]\n${text}`;
}

async function extractFromPDF(file, onProgress) {
    onProgress("Memuat Dokumen PDF...", 10);
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    let fullText = "";

    // Metadata
    const metadata = await pdf.getMetadata().catch(() => null);
    if (metadata?.info?.Title) fullText += `Judul: ${metadata.info.Title}\n`;
    fullText += `Total Halaman: ${pdf.numPages}\n\n`;

    // Process Pages
    for (let i = 1; i <= pdf.numPages; i++) {
        onProgress(`Memproses Halaman ${i} dari ${pdf.numPages}...`, Math.round((i / pdf.numPages) * 100));

        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        let pageText = textContent.items.map(item => item.str).join(' ');

        // HYBRID MODE: Check if page is likely Scanned (very little text)
        if (pageText.trim().length < 10) {
            onProgress(`Halaman ${i}: Teks sangat sedikit, mencoba OCR scan...`, Math.round((i / pdf.numPages) * 100));
            try {
                const viewport = page.getViewport({ scale: 2.5 });
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;

                await page.render({ canvasContext: context, viewport: viewport }).promise;

                const worker = await createWorker('eng+ind');
                const { data: { text } } = await worker.recognize(canvas);
                await worker.terminate();

                if (text.trim().length > pageText.trim().length) {
                    pageText = `[OCR HASIL SCAN]\n${text}`;
                }
            } catch (e) {
                console.warn(`OCR failed for page ${i}`, e);
            }
        }

        fullText += `--- Halaman ${i} ---\n${pageText}\n\n`;
    }

    return fullText;
}

async function extractFromWord(file, onProgress) {
    onProgress("Membaca File Word...", 30);
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return `[WORD CONTENT]\n${result.value}`;
}

async function extractFromExcel(file, onProgress) {
    onProgress("Membaca Spreadsheet...", 30);
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer);

    let result = "";
    workbook.SheetNames.forEach(sheetName => {
        const sheet = workbook.Sheets[sheetName];
        const text = XLSX.utils.sheet_to_txt(sheet);
        result += `--- Sheet: ${sheetName} ---\n${text}\n\n`;
    });

    return `[EXCEL CONTENT]\n${result}`;
}

async function extractFromPPTX(file, onProgress) {
    onProgress("Membongkar Slide PowerPoint...", 30);
    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);

    let fullText = "";
    let slideIndex = 1;

    // Loop through likely slide files (ppt/slides/slide1.xml, slide2.xml, etc.)
    const slideFiles = Object.keys(zip.files).filter(name => name.startsWith('ppt/slides/slide') && name.endsWith('.xml'));

    slideFiles.sort((a, b) => {
        const numA = parseInt(a.replace(/\D/g, ''));
        const numB = parseInt(b.replace(/\D/g, ''));
        return numA - numB;
    });

    for (const filename of slideFiles) {
        onProgress(`Membaca Slide ${slideIndex}...`, 50);
        const content = await zip.file(filename).async('text');

        // Simple XML regex parsing for text <a:t>...</a:t>
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(content, "text/xml");
        const textNodes = xmlDoc.getElementsByTagName("a:t");

        let slideText = "";
        for (let i = 0; i < textNodes.length; i++) {
            slideText += textNodes[i].textContent + " ";
        }

        fullText += `--- Slide ${slideIndex} ---\n${slideText}\n\n`;
        slideIndex++;
    }

    return `[POWERPOINT CONTENT]\n${fullText}`;
}
