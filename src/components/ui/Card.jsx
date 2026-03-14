import React from 'react';

export const Card = ({ children, className = '', onClick }) => (
    <div
        onClick={onClick}
        className={`bg-white/40 dark:bg-slate-800/40 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-3xl p-6 shadow-2xl ring-1 ring-black/5 dark:ring-white/5 transition-all duration-300 ${onClick ? 'cursor-pointer hover:shadow-3xl hover:bg-white/50 dark:hover:bg-slate-700/50 transform hover:-translate-y-1' : ''} ${className}`}
    >
        {children}
    </div>
);

export const SummaryCard = ({ title, value, subtext, icon: Icon, colorClass }) => (
    <Card className="flex items-center gap-4 relative overflow-hidden">
        <div className={`p-3 rounded-xl ${colorClass}`}>
            <Icon size={24} />
        </div>
        <div>
            <div className="text-sm text-gray-500 dark:text-slate-400 font-medium">{title}</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{value}</div>
            {subtext && <div className="text-xs text-gray-400 mt-0.5">{subtext}</div>}
        </div>
    </Card>
);
