import React from 'react';

export const Card = ({ children, className = '', onClick }) => (
    <div
        onClick={onClick}
        className={`bg-white/40 dark:bg-slate-800/40 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-3xl p-6 shadow-2xl ring-1 ring-black/5 dark:ring-white/5 transition-all duration-300 ${onClick ? 'cursor-pointer hover:shadow-3xl hover:bg-white/50 dark:hover:bg-slate-700/50 transform hover:-translate-y-1' : ''} ${className}`}
    >
        {children}
    </div>
);

// StatCard / SummaryCard — satu desain konsisten (glass + gradient) untuk SEMUA menu.
// Props: title, value, subtext, icon, colorClass (ikon bg, backward-compatible),
//        gradient (gradient ikon), valueClass (ukuran angka), valuePrefix (mis. "Rp "),
//        action (node tambahan di kanan, mis. tombol salin).
export const SummaryCard = ({ title, value, subtext, icon: Icon, colorClass, gradient, valueClass = 'text-xl', valuePrefix = '', className = '', action }) => (
    <div
        className={`group relative overflow-hidden glass-card rounded-2xl p-4 flex items-center gap-4 transition-all duration-300 hover:-translate-y-0.5 ${className}`}
    >
        {/* Hiasan sudut gradient (soft, seragam di semua kartu) */}
        <div className={`absolute right-0 top-0 w-20 h-20 rounded-bl-[2rem] -mr-5 -mt-5 bg-gradient-to-br opacity-60 transition-all duration-300 group-hover:scale-110 group-hover:opacity-80 ${gradient ? gradient : 'from-indigo-500/15 to-purple-500/10'}`} />

        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-indigo-500/20 ${colorClass ? colorClass : `bg-gradient-to-br ${gradient || 'from-indigo-500 to-purple-600'} text-white`}`}>
            {Icon && <Icon size={22} />}
        </div>

        <div className="min-w-0 flex-1">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-0.5 truncate">{title}</div>
            <div className={`${valueClass} font-black leading-tight text-slate-800 dark:text-white tabular-nums truncate`}>{valuePrefix}{value}</div>
            {subtext && <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">{subtext}</div>}
        </div>

        {action && <div className="flex-shrink-0">{action}</div>}
    </div>
);

// SummaryRow — satu sumber kebenaran untuk baris kartu ringkasan (menghilangkan duplikasi markup grid).
// Props: cards (array objek yang sama dengan props SummaryCard + key), cols (2|3|4),
//        className (tambahan, mis. mb-5 / animate-in), children (node ekstra, mis. tombol tambah).
export const SummaryRow = ({ cards = [], cols = 4, className = '', children }) => {
    const colCls = {
        2: 'sm:grid-cols-2',
        3: 'sm:grid-cols-3',
        4: 'grid-cols-2 md:grid-cols-4',
    }[cols] || 'grid-cols-2 md:grid-cols-4';
    return (
        <div className={`grid ${colCls} gap-4 ${className}`}>
            {cards.map((c, i) => (
                <SummaryCard key={c.key ?? i} {...c} />
            ))}
            {children}
        </div>
    );
};

export const CardHeader = React.forwardRef(({ className = '', ...props }, ref) => (
    <div ref={ref} className={`flex flex-col space-y-1.5 ${className}`} {...props} />
));
CardHeader.displayName = "CardHeader";

export const CardTitle = React.forwardRef(({ className = '', ...props }, ref) => (
    <h3 ref={ref} className={`font-semibold leading-none tracking-tight ${className}`} {...props} />
));
CardTitle.displayName = "CardTitle";

export const CardDescription = React.forwardRef(({ className = '', ...props }, ref) => (
    <p ref={ref} className={`text-sm text-gray-500 dark:text-slate-400 ${className}`} {...props} />
));
CardDescription.displayName = "CardDescription";

export const CardContent = React.forwardRef(({ className = '', ...props }, ref) => (
    <div ref={ref} className={`pt-0 ${className}`} {...props} />
));
CardContent.displayName = "CardContent";

export const CardFooter = React.forwardRef(({ className = '', ...props }, ref) => (
    <div ref={ref} className={`flex items-center pt-0 ${className}`} {...props} />
));
CardFooter.displayName = "CardFooter";
