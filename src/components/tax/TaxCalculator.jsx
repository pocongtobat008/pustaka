import React, { useState, useEffect, useRef } from 'react';
import { Calculator, RefreshCw, Copy, Check, Keyboard, Wallet, Info, Book, Sparkles } from 'lucide-react';
import { Card } from '../ui/Card';

export default function TaxCalculator({
    title = "Simulasi Perhitungan PPh",
    onCalculate,
    className = "",
    initialDpp = '',
    initialRate = '',
    initialDiscount = '',
    initialMarkupMode = 'none',
    initialIsPph21BukanPegawai = false,
    initialUsePpn = true,
    onCopy,
    isReadOnly = false
}) {
    const [dpp, setDpp] = useState(initialDpp || '');
    const [rate, setRate] = useState(initialRate || '');
    const [discount, setDiscount] = useState(initialDiscount || '');
    const [markupMode, setMarkupMode] = useState(initialMarkupMode);
    const [isPph21BukanPegawai, setIsPph21BukanPegawai] = useState(initialIsPph21BukanPegawai);
    const [usePpn, setUsePpn] = useState(initialUsePpn);
    const [pph, setPph] = useState(0);
    const [ppn, setPpn] = useState(0);
    const [dppNet, setDppNet] = useState(0);
    const [totalPayable, setTotalPayable] = useState(0);
    const [copied, setCopied] = useState(null); // 'pph', 'ppn', 'total', 'dppNet'
    const [isCalcMode, setIsCalcMode] = useState(false);

    // UI Reactive state for detailed breakdown
    const [displayGross, setDisplayGross] = useState(0);
    const [displayNet, setDisplayNet] = useState(0);
    const [displayPph, setDisplayPph] = useState(0);
    const [displayPpn, setDisplayPpn] = useState(0);
    const [displayTotalDibukukan, setDisplayTotalDibukukan] = useState(0);

    // Track last values emitted to prevent feedback loops overwriting manual input
    const lastEmitted = useRef({ dpp: initialDpp, rate: initialRate, calculationDpp: 0, totalDibukukan: 0 });

    useEffect(() => {
        // Only sync from props if they actually changed for reasons other than our own calculation
        if (initialDpp !== undefined && initialDpp !== '' && String(initialDpp) !== String(lastEmitted.current.dpp)) {
            setDpp(initialDpp);
        }
        if (initialRate !== undefined && initialRate !== '' && String(initialRate) !== String(lastEmitted.current.rate)) {
            setRate(initialRate);
        }
        if (initialDiscount !== undefined && initialDiscount !== '' && String(initialDiscount) !== String(lastEmitted.current.discount)) {
            setDiscount(initialDiscount);
        }
        if (initialMarkupMode !== undefined && initialMarkupMode !== markupMode) {
            setMarkupMode(initialMarkupMode);
        }
        if (initialIsPph21BukanPegawai !== undefined && initialIsPph21BukanPegawai !== isPph21BukanPegawai) {
            setIsPph21BukanPegawai(initialIsPph21BukanPegawai);
        }
        if (initialUsePpn !== undefined && initialUsePpn !== usePpn) {
            setUsePpn(initialUsePpn);
        }
    }, [initialDpp, initialRate, initialDiscount, initialMarkupMode, initialIsPph21BukanPegawai, initialUsePpn]);

    useEffect(() => {
        let dppValue = 0;

        if (isCalcMode) {
            // 1.000.000 -> 1000000
            const raw = dpp.toString().replace(/\./g, '');

            try {
                const sanitized = raw.replace(/[^0-9+\-*/().\s]/g, '');
                if (sanitized) {
                    // eslint-disable-next-line no-new-func
                    const result = new Function('return ' + sanitized)();
                    if (isFinite(result)) {
                        dppValue = result;
                    }
                }
            } catch (e) {
                // ignore
            }
        } else {
            dppValue = parseFloat(dpp) || 0;
        }

        const rateValue = parseFloat(rate) || 0;
        const discountValue = parseFloat(discount.toString().replace(/\./g, '')) || 0;
        const ppnRateMultiplier = 0.12; // 12% PPN rate (2025+)
        const pphRateFactor = rateValue / 100;

        let calculationDpp = dppValue;

        // Progressive Pasal 17 Brackets
        const calculateProgressivePph = (taxableValue) => {
            let tax = 0;
            let tempTaxable = taxableValue;
            if (tempTaxable > 5000000000) {
                tax += (tempTaxable - 5000000000) * 0.35;
                tempTaxable = 5000000000;
            }
            if (tempTaxable > 500000000) {
                tax += (tempTaxable - 500000000) * 0.30;
                tempTaxable = 500000000;
            }
            if (tempTaxable > 250000000) {
                tax += (tempTaxable - 250000000) * 0.25;
                tempTaxable = 250000000;
            }
            if (tempTaxable > 60000000) {
                tax += (tempTaxable - 60000000) * 0.15;
                tempTaxable = 60000000;
            }
            tax += tempTaxable * 0.05;
            return Math.ceil(tax);
        };

        const solveGrossUpPph21BukanPegawai = (target) => {
            let low = target;
            let high = target * 2;
            let bestMid = target;

            const effectiveUsePpn = usePpn || markupMode === 'ppn';
            for (let i = 0; i < 40; i++) {
                let mid = (low + high) / 2;
                let dppTax = 0.5 * (mid - discountValue);
                if (dppTax < 0) dppTax = 0;
                let midPph = calculateProgressivePph(dppTax);

                let midPpn = 0;
                if (effectiveUsePpn) {
                    midPpn = Math.ceil((11 / 12) * (mid - discountValue) * 0.12);
                }

                let currentNet = 0;
                if (markupMode === 'pph') currentNet = mid - midPph;
                else if (markupMode === 'ppn') currentNet = mid + midPpn;

                if (currentNet < target) {
                    low = mid;
                } else {
                    high = mid;
                }
                bestMid = mid;
            }
            return bestMid;
        };

        // Breakdown logic for formula components (addends)
        let breakdown = [];
        if (isCalcMode && dpp.toString().includes('+')) {
            const raw = dpp.toString().replace(/\./g, '');
            if (/^[0-9+\s]+$/.test(raw)) {
                const parts = raw.split('+').map(p => p.trim()).filter(p => p !== '');
                parts.forEach(part => {
                    const val = parseFloat(part);
                    if (!isNaN(val) && val > 0) {
                        const partPph = isPph21BukanPegawai ? calculateProgressivePph(0.5 * val) : Math.ceil(val * pphRateFactor);
                        const partPpn = usePpn ? Math.ceil((11 / 12) * val * 0.12) : 0;
                        breakdown.push({ label: part, value: val, pph: partPph, ppn: partPpn });
                    }
                });
            }
        }

        const totalBreakdown = breakdown.reduce((acc, item) => ({
            value: acc.value + item.value,
            pph: acc.pph + item.pph,
            ppn: acc.ppn + item.ppn
        }), { value: 0, pph: 0, ppn: 0 });

        const effectiveUsePpn = usePpn || markupMode === 'ppn';
        const effectivePpnMultiplier = 1 + (11 / 12 * 0.12); // ~1.11 effective (mathematical consistency)

        if (isPph21BukanPegawai) {
            if (markupMode !== 'none') {
                calculationDpp = solveGrossUpPph21BukanPegawai(dppValue);
            }
        } else {
            if (markupMode === 'pph' && pphRateFactor < 1) {
                calculationDpp = dppValue / (1 - pphRateFactor);
            } else if (markupMode === 'ppn') {
                calculationDpp = dppValue / effectivePpnMultiplier;
            }
        }

        const dppNet = effectiveUsePpn ? (11 / 12) * (calculationDpp - discountValue) : 0;
        let calculatedPph = 0;

        if (isPph21BukanPegawai) {
            const dppTax = 0.5 * (calculationDpp - discountValue);
            calculatedPph = calculateProgressivePph(dppTax > 0 ? dppTax : 0);
        } else {
            calculatedPph = Math.ceil(calculationDpp * pphRateFactor);
        }

        const calculatedPpn = effectiveUsePpn ? Math.ceil(dppNet * 0.12) : 0;
        const calculatedTotal = Math.ceil((calculationDpp - discountValue) + calculatedPpn - calculatedPph);
        const totalDibukukan = Math.ceil(calculatedTotal + calculatedPph);

        setPph(calculatedPph);
        setPpn(calculatedPpn);
        setDppNet(dppNet);
        setTotalPayable(calculatedTotal);

        // Update display state for breakdown UI
        setDisplayGross(calculationDpp);
        setDisplayNet(calculatedTotal);
        setDisplayPph(calculatedPph);
        setDisplayPpn(calculatedPpn);
        setDisplayTotalDibukukan(totalDibukukan);

        // Update guard ref before emitting
        lastEmitted.current = { dpp: dppValue, rate: rateValue, discount: discountValue, dppNet: dppNet, markupMode: markupMode, isPph21BukanPegawai, usePpn, totalDibukukan, calculationDpp };

        if (onCalculate) {
            onCalculate({
                dpp: dppValue,
                rate: rateValue,
                pph: calculatedPph,
                ppn: calculatedPpn,
                totalPayable: calculatedTotal,
                totalDibukukan: totalDibukukan,
                discount: discountValue,
                dppNet: dppNet,
                markupMode: markupMode,
                isPph21BukanPegawai,
                usePpn,
                calculationDpp: calculationDpp,
                breakdown: breakdown,
                totalBreakdown: totalBreakdown
            });
        }
    }, [dpp, rate, discount, markupMode, isPph21BukanPegawai, usePpn, isCalcMode, onCalculate]);

    const getPph21Breakdown = (val) => {
        if (val === undefined || val === null) return { dppTax: 0, brackets: [], totalTax: 0 };
        const dppValue = parseFloat(val.toString().replace(/\./g, '')) || 0;
        const dppTax = 0.5 * dppValue;

        let remaining = dppTax;
        const brackets = [];

        const bracketConfigs = [
            { limit: 60000000, rate: 0.05 },
            { limit: 190000000, rate: 0.15 }, // 250M - 60M
            { limit: 250000000, rate: 0.25 }, // 500M - 250M
            { limit: 4500000000, rate: 0.30 }, // 5B - 500M
            { limit: Infinity, rate: 0.35 }
        ];

        let totalTax = 0;
        bracketConfigs.forEach(b => {
            if (remaining > 0) {
                const taxable = Math.min(remaining, b.limit);
                const tax = taxable * b.rate;
                brackets.push({ taxable, rate: b.rate * 100, tax });
                totalTax += tax;
                remaining -= taxable;
            }
        });

        return { dppTax, brackets, totalTax };
    };

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(value);
    };

    const copyToClipboard = (val, type) => {
        const numericVal = Math.floor(parseFloat(val) || 0);
        if (onCopy) onCopy(numericVal, type === 'total' ? "Total Bayar" : type);
        else navigator.clipboard.writeText(numericVal.toString());
        setCopied(type);
        setTimeout(() => setCopied(null), 2000);
    };

    const handleReset = () => {
        setDpp('');
        setRate('');
        setDiscount('');
        setPph(0);
        setPpn(0);
        setDppNet(0);
        setTotalPayable(0);
    };

    const evaluateExpression = () => {
        try {
            const raw = dpp.toString().replace(/\./g, '');
            const sanitized = raw.replace(/[^0-9+\-*/().\s]/g, '');

            if (!sanitized) return;

            // eslint-disable-next-line no-new-func
            const result = new Function('return ' + sanitized)();

            if (isFinite(result)) {
                const formattedResult = Math.floor(result).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
                setDpp(formattedResult);
            }
        } catch (e) {
            console.error("Invalid expression");
        }
    };

    const handleKeyDown = (e) => {
        if (isCalcMode && e.key === 'Enter') {
            e.preventDefault();
            evaluateExpression();
        }
    };

    const formatDisplayValue = (val) => {
        if (!val) return '';
        if (!isNaN(val) && !val.toString().includes('+') && !val.toString().includes('-') && !val.toString().includes('*') && !val.toString().includes('/')) {
            return val.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
        }
        return val;
    };

    const handleDppChange = (e) => {
        let val = e.target.value;
        if (isCalcMode) {
            const raw = val.replace(/\./g, '');
            const formatted = raw.replace(/\d+/g, (match) => {
                return match.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
            });
            setDpp(formatted);
        } else {
            const cleanVal = val.replace(/\./g, '').replace(/[^0-9]/g, '');
            setDpp(cleanVal);
        }
    };

    return (
        <Card className={className}>
            <div className="flex justify-between items-center mb-6 border-b pb-2 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                    {title}
                </h3>

                {!isReadOnly && (
                    <div className="flex flex-wrap items-center gap-3">
                        <button
                            onClick={() => setIsPph21BukanPegawai(!isPph21BukanPegawai)}
                            className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-lg border transition-all flex items-center gap-1.5 ${isPph21BukanPegawai ? 'bg-amber-500 border-amber-600 text-white shadow-lg' : 'bg-gray-100 dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-500 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-700'}`}
                            title="Aktifkan perhitungan PPh 21 Bukan Pegawai (50% Bruto - Progresif)"
                        >
                            {isPph21BukanPegawai ? 'Mode: Bukan Pegawai ON' : 'PPH 21 Bukan Pegawai?'}
                        </button>

                        <button
                            onClick={() => setUsePpn(!usePpn)}
                            className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-lg border transition-all flex items-center gap-1.5 ${usePpn ? 'bg-indigo-600 border-indigo-700 text-white shadow-lg' : 'bg-gray-100 dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-500 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-700'}`}
                            title="Aktifkan/Nonaktifkan perhitungan PPN (12%)"
                        >
                            {usePpn ? 'Gunakan PPN: ON' : 'Gunakan PPN: OFF'}
                        </button>

                        <div className="flex bg-gray-100 dark:bg-slate-800 p-0.5 rounded-lg border dark:border-slate-700 shadow-sm overflow-hidden relative">
                            {[
                                { id: 'none', label: 'Normal' },
                                { id: 'pph', label: 'PPh' },
                                { id: 'ppn', label: 'PPN' }
                            ].map((mode) => (
                                <button
                                    key={mode.id}
                                    onClick={() => {
                                        setMarkupMode(mode.id);
                                        if (mode.id === 'ppn') {
                                            setUsePpn(false);
                                        } else if (mode.id === 'none' || mode.id === 'pph') {
                                            setUsePpn(true);
                                        }
                                    }}
                                    className={`px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider rounded-md transition-all ${markupMode === mode.id ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20 scale-105' : 'text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300'}`}
                                >
                                    {mode.label}
                                </button>
                            ))}
                        </div>

                        {markupMode !== 'none' && (
                            <div className="flex items-center gap-1.5 px-2 py-1 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 rounded-lg animate-pulse shadow-sm">
                                <Sparkles size={10} className="text-indigo-600 dark:text-indigo-400" />
                                <span className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-tighter">Mode GROSS AKTIF</span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="space-y-6">
                <div>
                    <div className="flex justify-between items-center mb-1">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                            Dasar Pengenaan Pajak (DPP)
                        </label>
                        {!isReadOnly && (
                            <button
                                onClick={() => setIsCalcMode(!isCalcMode)}
                                className={`text-xs flex items-center gap-1 px-2 py-1 rounded-md transition-all ${isCalcMode ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 font-bold' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                            >
                                {isCalcMode ? <Keyboard size={14} /> : <Calculator size={14} />}
                                {isCalcMode ? 'Mode Input' : 'Mode Rumus'}
                            </button>
                        )}
                    </div>
                    <div className="relative">
                        {!isCalcMode && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 font-medium">Rp</span>}
                        <input
                            type="text"
                            value={isCalcMode ? dpp : formatDisplayValue(dpp)}
                            onChange={handleDppChange}
                            onKeyDown={handleKeyDown}
                            disabled={isReadOnly}
                            className={`w-full ${isCalcMode ? 'pl-4 font-mono text-indigo-600 dark:text-indigo-400' : 'pl-10'} pr-4 py-3 rounded-xl border ${isCalcMode ? 'border-indigo-300 dark:border-indigo-800 ring-2 ring-indigo-500/20' : 'border-slate-200 dark:border-slate-700'} bg-white dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:cursor-not-allowed`}
                            placeholder={isCalcMode ? "Ketik rumus lalu ENTER" : "0"}
                        />
                        {isCalcMode && !isReadOnly && (
                            <button onClick={evaluateExpression} className="absolute right-2 top-1/2 -translate-y-1/2 text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-indigo-700 transition-colors">
                                HITUNG
                            </button>
                        )}
                    </div>
                </div>

                {isPph21BukanPegawai && (
                    <div className="mt-2 p-5 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-100 dark:border-amber-800/50 space-y-4 animate-in fade-in slide-in-from-top-2">
                        <div className="flex justify-between items-center pb-2 border-b border-amber-200 dark:border-amber-800">
                            <span className="text-xs font-black text-amber-800 dark:text-amber-200 uppercase tracking-widest flex items-center gap-2">
                                <Info size={14} /> Detail Perhitungan PMK 168/2023
                            </span>
                            <div className="bg-amber-500 text-white text-[9px] px-2 py-1 rounded-full font-bold uppercase tracking-widest">Bukan Pegawai</div>
                        </div>

                        {/* Bracket Reference Table */}
                        <div className="bg-white/50 dark:bg-slate-900/50 rounded-xl p-3 border border-amber-200/50 dark:border-amber-800/50">
                            <h5 className="text-[10px] font-bold text-amber-800 dark:text-amber-300 uppercase mb-2 flex items-center gap-1">
                                <Book size={12} /> Tabel Tarif Progresif (Pasal 17)
                            </h5>
                            <div className="space-y-1">
                                {[
                                    { range: "0 s.d. 60jt", rate: "5%" },
                                    { range: ">60jt s.d. 250jt", rate: "15%" },
                                    { range: ">250jt s.d. 500jt", rate: "25%" },
                                    { range: ">500jt s.d. 5M", rate: "30%" },
                                    { range: ">5M", rate: "35%" }
                                ].map((t, i) => (
                                    <div key={i} className="flex justify-between text-[10px] py-0.5 border-b border-amber-100 dark:border-amber-800/30 last:border-0 italic">
                                        <span className="text-amber-700 dark:text-amber-500">{t.range}</span>
                                        <span className="font-bold text-amber-900 dark:text-amber-200">{t.rate}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2.5">
                            <div className="flex justify-between text-xs items-center bg-amber-100/50 dark:bg-amber-900/20 p-2 rounded-lg">
                                <span className="text-amber-700 dark:text-amber-400 font-bold tracking-tight">DPP Pajak (50% x Bruto)</span>
                                <span className="font-black text-amber-900 dark:text-amber-100 text-sm">{formatCurrency(0.5 * displayGross)}</span>
                            </div>

                            <div className="space-y-1.5 pl-3 border-l-2 border-amber-500/30">
                                {getPph21Breakdown(displayGross).brackets.length > 0 ? (
                                    <>
                                        {getPph21Breakdown(displayGross).brackets.map((b, i) => (
                                            <div key={i} className="flex justify-between text-[10px] text-amber-600 dark:text-amber-500 font-mono">
                                                <span>Lapis {i + 1}: {formatCurrency(b.taxable)} x {b.rate}%</span>
                                                <span className="font-bold">{formatCurrency(b.tax)}</span>
                                            </div>
                                        ))}

                                    </>
                                ) : (
                                    <div className="text-[10px] text-amber-400 italic">Masukkan nilai DPP untuk melihat simulasi...</div>
                                )}
                            </div>

                            <div className="flex justify-between text-xs pt-1 border-t border-amber-500/20 items-end">
                                <span className="text-amber-800 dark:text-amber-200 font-bold uppercase tracking-tighter">PPh Terutang (Total Lapis)</span>
                                <span className="font-black text-amber-600 dark:text-amber-100 text-base leading-none">{formatCurrency(displayPph)}</span>
                            </div>
                        </div>

                        <div className="bg-amber-600/5 dark:bg-amber-900/40 p-4 rounded-xl text-[10px] text-amber-800 dark:text-amber-400 leading-relaxed border border-amber-500/10 shadow-inner">
                            <p className="font-bold mb-2 text-amber-900 dark:text-amber-200 uppercase tracking-widest flex items-center gap-2 border-b border-amber-500/10 pb-1">
                                <RefreshCw size={10} className="animate-spin-slow" /> Langkah Kalkulasi Real-time:
                            </p>
                            <div className="space-y-3 font-medium">
                                <div className="space-y-1">
                                    <p className="flex justify-between items-center bg-white/40 dark:bg-slate-900/40 px-2 py-1.5 rounded">
                                        <span>1. <span className="font-bold">Penghasilan Bruto</span></span>
                                        <span className="font-mono font-bold text-amber-900 dark:text-amber-100">{formatCurrency(displayGross)}</span>
                                    </p>
                                    <p className="flex justify-between items-center bg-white/40 dark:bg-slate-900/40 px-2 py-1.5 rounded">
                                        <span>2. <span className="font-bold">DPP Pajak (50% Bruto)</span></span>
                                        <span className="font-mono font-bold text-amber-700 dark:text-amber-300">50% × {formatCurrency(displayGross)} = {formatCurrency(0.5 * displayGross)}</span>
                                    </p>
                                </div>

                                <div className="space-y-1 bg-amber-500/5 p-2 rounded-lg border border-amber-500/10">
                                    <p className="font-bold text-[9px] uppercase tracking-tighter text-amber-900/60 dark:text-amber-300/60 mb-1">3. Penerapan Tarif Pasal 17 (Progressive):</p>
                                    {getPph21Breakdown(displayGross).brackets.length > 0 ? (
                                        <div className="space-y-1 pl-2 border-l border-amber-500/20 font-mono text-[9px]">
                                            {getPph21Breakdown(displayGross).brackets.map((b, i) => (
                                                <p key={i} className="flex justify-between">
                                                    <span>Lapis {i + 1} ({b.rate}%):</span>
                                                    <span>{formatCurrency(b.taxable)} × {b.rate}% = <span className="font-bold text-amber-700 dark:text-amber-300">{formatCurrency(b.tax)}</span></span>
                                                </p>
                                            ))}
                                            <p className="pt-1 mt-1 border-t border-amber-500/10 flex justify-between italic opacity-80">
                                                <span>Total Potongan PPh:</span>
                                                <span>{getPph21Breakdown(displayGross).brackets.map(b => formatCurrency(b.tax)).join(' + ')} = <span className="font-bold">{formatCurrency(displayPph)}</span></span>
                                            </p>
                                        </div>
                                    ) : (
                                        <p className="italic opacity-50 pl-2">Nilai DPP masih 0...</p>
                                    )}
                                </div>

                                <p className="bg-amber-600 text-white px-3 py-2 rounded-lg font-bold flex justify-between items-center shadow-lg shadow-amber-600/20">
                                    <span>HASIL PPh TERUTANG:</span>
                                    <span className="text-sm font-black">{formatCurrency(displayPph)}</span>
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* 2. Gross Up Explanations */}
                {markupMode !== 'none' && (
                    <div className="mt-2 p-4 bg-indigo-50 dark:bg-indigo-900/10 rounded-2xl border border-indigo-100 dark:border-indigo-800/50 space-y-3 animate-in fade-in slide-in-from-top-2">
                        <div className="flex items-center gap-2 pb-2 border-b border-indigo-200 dark:border-indigo-800">
                            <Book size={14} className="text-indigo-600" />
                            <span className="text-xs font-black text-indigo-800 dark:text-indigo-200 uppercase tracking-widest">Penjelasan Gross Up (Mark-up)</span>
                        </div>
                        <div className="text-[10px] space-y-2 text-indigo-700/80 dark:text-indigo-400/80 leading-relaxed font-medium">
                            {markupMode === 'pph' && (
                                <p>Sistem mencari nilai Bruto agar setelah dipotong PPh, vendor menerima angka target secara penuh. <br />
                                    <span className="font-bold">Rumus:</span> Target / (1 - Tarif%)</p>
                            )}
                            {markupMode === 'ppn' && (
                                <p>Sistem mencari nilai Bruto dasar agar setelah ditambah PPN 12%, total tagihan sesuai dengan target yang diinginkan. <br />
                                    <span className="font-bold">Rumus:</span> Target / 1.12</p>
                            )}
                            {markupMode === 'both' && (
                                <p>Sistem melakukan kalkulasi simultan mencari nilai Bruto agar vendor menerima target bersih, sementara PPh & PPN tetap terhitung dari nilai Bruto baru tersebut. <br />
                                    <span className="font-bold text-indigo-800 dark:text-indigo-200 italic">Note: PPN 12% dan PPh {isPph21BukanPegawai ? 'Progresif' : rate + '%'} diterapkan.</span></p>
                            )}
                        </div>
                    </div>
                )}

                {!isPph21BukanPegawai && (
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex justify-between">
                            <span>Persentase Tarif (%)</span>
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                value={rate}
                                onChange={(e) => setRate(e.target.value)}
                                readOnly={isReadOnly}
                                disabled={isReadOnly}
                                className="w-full pl-4 pr-10 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white disabled:bg-gray-100 dark:disabled:bg-slate-800 disabled:cursor-not-allowed"
                                placeholder="0"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 font-bold text-gray-500">%</span>
                        </div>
                    </div>
                )}

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Potongan Harga</label>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">Rp</span>
                        <input
                            type="text"
                            value={formatDisplayValue(discount)}
                            onChange={(e) => setDiscount(e.target.value.replace(/\./g, '').replace(/[^0-9]/g, ''))}
                            disabled={isReadOnly}
                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white disabled:bg-gray-100 dark:disabled:bg-slate-800 disabled:cursor-not-allowed"
                            placeholder="0"
                        />
                    </div>
                </div>

                <div className="pt-4 border-t dark:border-gray-700 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="p-4 bg-slate-50 dark:bg-slate-900/20 rounded-xl border border-slate-100 dark:border-slate-800">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">DPP Net</span>
                                <button onClick={() => copyToClipboard(dppNet, 'dppNet')} className="text-slate-400 hover:text-slate-600 transition-colors">
                                    {copied === 'dppNet' ? <Check size={14} /> : <Copy size={14} />}
                                </button>
                            </div>
                            <p className="text-lg font-black text-slate-700 dark:text-slate-300">{formatCurrency(dppNet)}</p>
                        </div>

                        <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">PPh Terutang</span>
                                <button onClick={() => copyToClipboard(pph, 'pph')} className="text-indigo-400 hover:text-indigo-600 transition-colors">
                                    {copied === 'pph' ? <Check size={14} /> : <Copy size={14} />}
                                </button>
                            </div>
                            <p className="text-lg font-black text-indigo-700 dark:text-indigo-300">{formatCurrency(pph)}</p>
                        </div>

                        <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-100 dark:border-emerald-800">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">PPN (12%)</span>
                                <button onClick={() => copyToClipboard(ppn, 'ppn')} className="text-emerald-400 hover:text-emerald-600 transition-colors">
                                    {copied === 'ppn' ? <Check size={14} /> : <Copy size={14} />}
                                </button>
                            </div>
                            <p className="text-lg font-black text-emerald-700 dark:text-emerald-300">{formatCurrency(ppn)}</p>
                        </div>
                    </div>

                    <div className={`p-6 rounded-2xl border transition-all ${markupMode !== 'none' ? 'bg-indigo-600 border-indigo-500 shadow-indigo-200/50 shadow-xl' : 'bg-slate-900 border-slate-800 shadow-slate-200/50 shadow-xl'}`}>
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h4 className="text-white/60 text-[10px] font-bold uppercase tracking-widest mb-1">
                                    {markupMode !== 'none' ? 'Total yang Harus Diterima (Net)' : 'Total Tagihan (Payable)'}
                                </h4>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-white text-3xl font-black">{formatDisplayValue(totalPayable)}</span>
                                    <span className="text-white/40 text-sm font-bold tracking-tighter">IDR</span>
                                </div>
                            </div>
                            <button onClick={() => copyToClipboard(totalPayable, 'total')} className="p-2.5 hover:bg-white/10 rounded-xl transition-all text-white/60 hover:text-white hover:scale-110 active:scale-95">
                                <Copy size={18} />
                            </button>
                            {copied === 'total' && <span className="text-[10px] font-bold bg-emerald-500 text-white px-3 py-1 rounded-full animate-in fade-in slide-in-from-right-2 ml-2">Tersalin!</span>}
                        </div>

                        {markupMode !== 'none' && (
                            <div className="mt-4 pt-4 border-t border-white/10 flex justify-between items-center group">
                                <div>
                                    <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Total yang Harus Dibukukan (Gross + PPN)</p>
                                    <div className="flex items-center gap-3">
                                        <p className="text-white text-lg font-black">{formatCurrency(lastEmitted.current.totalDibukukan || 0)}</p>
                                        <button
                                            onClick={() => copyToClipboard(lastEmitted.current.totalDibukukan || 0, 'dibukukan')}
                                            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white/40 hover:text-white/80"
                                            title="Copy Nilai Angka"
                                        >
                                            {copied === 'dibukukan' ? <Check size={14} /> : <Copy size={14} />}
                                        </button>
                                    </div>
                                </div>
                                <div className="bg-white/10 px-2 py-1 rounded text-[9px] font-bold text-white uppercase opacity-0 group-hover:opacity-100 transition-opacity">
                                    Net + PPh
                                </div>
                            </div>
                        )}

                        <p className="text-[10px] text-indigo-100/60 mt-4 font-medium italic">
                            Rumus: {isPph21BukanPegawai ? '(50% x Bruto) x Progresif Pasal 17' : '(DPP - Potongan) + PPN 12% - PPh Terutang (Rounding Up)'}
                        </p>
                        {markupMode !== 'none' && (
                            <p className="text-[10px] text-indigo-200 mt-1 font-bold">
                                * {markupMode === 'pph' && (isPph21BukanPegawai ? "Vendor menerima target net (Gross - PPh Progresif)." : "Vendor menerima Net DPP secara penuh.")}
                                {markupMode === 'ppn' && "Total Tagihan (DPP+PPN) sesuai target."}
                                {markupMode === 'both' && "Total Akhir (PPh & PPN) sesuai target secara penuh."}
                            </p>
                        )}
                        {isPph21BukanPegawai && (
                            <p className="text-[10px] text-indigo-300 mt-1 font-medium bg-white/10 px-2 py-1 rounded inline-block">
                                <span className="font-black">PMK 168/2023:</span> Terdiri dari DPP 50% & Tarif Progresif Pasal 17.
                            </p>
                        )}
                    </div>
                </div>

                {!isReadOnly && (
                    <div className="flex justify-end pt-2">
                        <button onClick={handleReset} className="px-4 py-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
                            <RefreshCw size={16} /> Reset
                        </button>
                    </div>
                )}
            </div>
        </Card >
    );
}
