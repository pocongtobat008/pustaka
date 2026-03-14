import React, { useMemo } from 'react';
import { Card } from './ui/Card';
import {
    LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { FileBarChart, PieChart as PieChartIcon, TrendingUp, Activity } from 'lucide-react';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function TaxAnalytics({ taxSummaries = [], taxAudits = [] }) {

    // --- DATA PROCESSING ---
    const chartData = useMemo(() => {
        const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

        // Group by Month+Year
        const grouped = {};

        taxSummaries.forEach(record => {
            const key = `${record.month} ${record.year}`;
            if (!grouped[key]) {
                grouped[key] = {
                    name: key,
                    monthIndex: months.indexOf(record.month),
                    year: record.year,
                    pphTotal: 0,
                    ppnIn: 0,
                    ppnOut: 0,
                    netPpn: 0
                };
            }

            // Calculate PPh Total
            if ((record.type || 'PPH') === 'PPH') {
                // Sum all numeric fields in data.pph
                const pphValues = Object.values(record.data?.pph || {}).reduce((a, b) => a + (Number(b) || 0), 0);
                grouped[key].pphTotal += pphValues;
            }

            // Calculate PPN
            if (record.type === 'PPN') {
                const ppnIn = Object.values(record.data?.ppnIn || {}).reduce((a, b) => a + (Number(b) || 0), 0);
                const ppnOut = Object.values(record.data?.ppnOut || {}).reduce((a, b) => a + (Number(b) || 0), 0);
                grouped[key].ppnIn += ppnIn;
                grouped[key].ppnOut += ppnOut;
                grouped[key].netPpn += (ppnOut - ppnIn); // Positive = KB, Negative = LB
            }
        });

        // Sort by Year then Month
        return Object.values(grouped).sort((a, b) => {
            if (a.year !== b.year) return a.year - b.year;
            return a.monthIndex - b.monthIndex;
        });

    }, [taxSummaries]);

    const auditStatusData = useMemo(() => {
        const statusCounts = {};
        taxAudits.forEach(audit => {
            const status = audit.status || 'Unknown';
            statusCounts[status] = (statusCounts[status] || 0) + 1;
        });
        return Object.keys(statusCounts).map(status => ({
            name: status,
            value: statusCounts[status]
        }));
    }, [taxAudits]);

    if (chartData.length === 0 && auditStatusData.length === 0) {
        return null; // Don't render if no data
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-700">
            {/* 1. Tax Trend (Line/Area Chart) */}
            <Card className="lg:col-span-2">
                <div className="flex items-center gap-2 mb-6">
                    <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                        <TrendingUp size={20} className="text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-900 dark:text-white">Tren Perpajakan</h3>
                        <p className="text-xs text-gray-500">PPh Terutang vs PPN Netto (KB/LB)</p>
                    </div>
                </div>
                <div className="h-[300px] w-full relative">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                        <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorPPh" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="colorPPN" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2} />
                                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e5e5" />
                            <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                            <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `${(val / 1000000).toFixed(0)}M`} />
                            <Tooltip
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                formatter={(value) => `Rp ${value.toLocaleString()}`}
                            />
                            <Legend />
                            <Area type="monotone" dataKey="pphTotal" name="Total PPh" stroke="#6366f1" fillOpacity={1} fill="url(#colorPPh)" />
                            <Area type="monotone" dataKey="netPpn" name="Net PPN (Out-In)" stroke="#f59e0b" fillOpacity={1} fill="url(#colorPPN)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </Card>

            {/* 2. Audit Status (Pie Chart) */}
            <Card>
                <div className="flex items-center gap-2 mb-6">
                    <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                        <Activity size={20} className="text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-900 dark:text-white">Status Pemeriksaan</h3>
                        <p className="text-xs text-gray-500">Distribusi status audit pajak berjalan</p>
                    </div>
                </div>
                <div className="h-[300px] w-full flex items-center justify-center relative">
                    {auditStatusData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                            <PieChart>
                                <Pie
                                    data={auditStatusData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {auditStatusData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend verticalAlign="bottom" height={36} />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="text-center text-gray-400">
                            <p>Belum ada data audit.</p>
                        </div>
                    )}
                </div>
            </Card>

            {/* 3. PPN Breakdown (Bar Chart) */}
            <Card className="lg:col-span-3">
                <div className="flex items-center gap-2 mb-6">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                        <FileBarChart size={20} className="text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-900 dark:text-white">Komparasi PPN Bulanan</h3>
                        <p className="text-xs text-gray-500">Perbandingan PPN Masukan (Input) vs Keluaran (Output)</p>
                    </div>
                </div>
                <div className="h-[250px] w-full relative">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                        <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e5e5" />
                            <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                            <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `${(val / 1000000).toFixed(0)}M`} />
                            <Tooltip
                                cursor={{ fill: 'transparent' }}
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                formatter={(value) => `Rp ${value.toLocaleString()}`}
                            />
                            <Legend />
                            <Bar dataKey="ppnIn" name="PPN Masukan" fill="#10b981" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="ppnOut" name="PPN Keluaran" fill="#ef4444" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </Card>
        </div>
    );
}
