import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Loader2 } from 'lucide-react';

// PDF.js worker setup
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export default function PdfViewer({ src, className = '' }) {
    const containerRef = useRef(null);
    const canvasRef = useRef(null);
    const [pdfDoc, setPdfDoc] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const [scale, setScale] = useState(1.2);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const renderTaskRef = useRef(null);

    // Load PDF document
    useEffect(() => {
        if (!src) return;
        setLoading(true);
        setError(null);
        setPdfDoc(null);
        setCurrentPage(1);

        let cancelled = false;

        const loadPdf = async () => {
            try {
                console.log('[PdfViewer] Loading PDF from:', typeof src === 'string' ? src.substring(0, 100) : 'ArrayBuffer');

                const loadingTask = pdfjsLib.getDocument(
                    typeof src === 'string'
                        ? { url: src, withCredentials: false }
                        : { data: src instanceof ArrayBuffer ? src.slice(0) : src }
                );
                const pdf = await loadingTask.promise;

                if (cancelled) return;
                console.log('[PdfViewer] PDF loaded, pages:', pdf.numPages);
                setPdfDoc(pdf);
                setTotalPages(pdf.numPages);
                setLoading(false);
            } catch (e) {
                if (cancelled) return;
                console.error('[PdfViewer] Load error:', e);
                setError(e.message || 'Gagal memuat PDF');
                setLoading(false);
            }
        };

        loadPdf();
        return () => { cancelled = true; };
    }, [src]);

    // Render current page
    const renderPage = useCallback(async () => {
        if (!pdfDoc || !canvasRef.current) return;

        try {
            // Cancel any pending render
            if (renderTaskRef.current) {
                renderTaskRef.current.cancel();
                renderTaskRef.current = null;
            }

            const page = await pdfDoc.getPage(currentPage);
            const viewport = page.getViewport({ scale });
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');

            // Set canvas dimensions
            const outputScale = window.devicePixelRatio || 1;
            canvas.width = Math.floor(viewport.width * outputScale);
            canvas.height = Math.floor(viewport.height * outputScale);
            canvas.style.width = Math.floor(viewport.width) + 'px';
            canvas.style.height = Math.floor(viewport.height) + 'px';

            const transform = outputScale !== 1
                ? [outputScale, 0, 0, outputScale, 0, 0]
                : null;

            const renderContext = {
                canvasContext: ctx,
                transform,
                viewport,
            };

            const task = page.render(renderContext);
            renderTaskRef.current = task;
            await task.promise;
            renderTaskRef.current = null;
        } catch (e) {
            if (e?.name !== 'RenderingCancelledException') {
                console.error('[PdfViewer] Render error:', e);
            }
        }
    }, [pdfDoc, currentPage, scale]);

    useEffect(() => {
        renderPage();
    }, [renderPage]);

    // Auto-fit scale to container width
    useEffect(() => {
        if (!pdfDoc || !containerRef.current) return;
        const fitToWidth = async () => {
            const page = await pdfDoc.getPage(1);
            const viewport = page.getViewport({ scale: 1 });
            const containerWidth = containerRef.current.clientWidth - 32; // padding
            const fitScale = Math.min(containerWidth / viewport.width, 2.5);
            setScale(Math.max(fitScale, 0.5));
        };
        fitToWidth();
    }, [pdfDoc]);

    if (loading) {
        return (
            <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
                <Loader2 size={32} className="text-indigo-500 animate-spin" />
                <p className="text-sm font-bold text-slate-500 animate-pulse">Memuat PDF...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className={`flex flex-col items-center justify-center gap-3 text-center p-8 ${className}`}>
                <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-2xl flex items-center justify-center">
                    <span className="text-2xl">📄</span>
                </div>
                <p className="text-sm font-bold text-red-500">Gagal memuat PDF</p>
                <p className="text-xs text-slate-400 max-w-xs">{error}</p>
            </div>
        );
    }

    return (
        <div ref={containerRef} className={`flex flex-col h-full ${className}`}>
            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-2 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-700 rounded-t-2xl shrink-0">
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage <= 1}
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors"
                    >
                        <ChevronLeft size={16} />
                    </button>
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300 min-w-[80px] text-center">
                        {currentPage} / {totalPages}
                    </span>
                    <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage >= totalPages}
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors"
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setScale(s => Math.max(0.3, s - 0.2))}
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        <ZoomOut size={16} />
                    </button>
                    <span className="text-[10px] font-bold text-slate-400 min-w-[40px] text-center">
                        {Math.round(scale * 100)}%
                    </span>
                    <button
                        onClick={() => setScale(s => Math.min(3, s + 0.2))}
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        <ZoomIn size={16} />
                    </button>
                </div>
            </div>

            {/* Canvas Area */}
            <div className="flex-1 overflow-auto bg-slate-200 dark:bg-slate-950 flex justify-center p-4 rounded-b-2xl">
                <canvas ref={canvasRef} className="shadow-2xl rounded-lg" />
            </div>
        </div>
    );
}
