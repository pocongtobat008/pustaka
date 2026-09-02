import React from 'react';

export const Card = ({ children, className = '', onClick, ...rest }) => (
    <div
        onClick={onClick}
        {...rest}
        className={`bg-white/60 dark:bg-white/[0.04] backdrop-blur-sm border border-stone-200/50 dark:border-white/[0.06] rounded-2xl p-6 transition-all duration-200 ${onClick ? 'cursor-pointer hover:shadow-lg hover:bg-white/80 dark:hover:bg-white/[0.06] transform hover:-translate-y-0.5' : ''} ${className}`}
    >
        {children}
    </div>
);

// StatCard / SummaryCard — satu desain konsisten (glass + gradient) untuk SEMUA menu.
// Props: title, value, subtext, icon, colorClass (ikon bg, backward-compatible),
//        gradient (gradient ikon), valueClass (ukuran angka), valuePrefix (mis. "Rp "),
//        action (node tambahan di kanan, mis. tombol salin).
export const SummaryCard = ({ title, value, subtext, icon: Icon, colorClass, valueClass = 'text-xl', valuePrefix = '', className = '', action }) => (
    <div
        className={`group relative bg-white/50 dark:bg-white/[0.03] border border-stone-200/60 dark:border-white/[0.06] rounded-2xl px-5 py-4 flex items-center gap-4 transition-all duration-200 hover:border-blue-300/50 dark:hover:border-blue-400/20 hover:shadow-md hover:shadow-blue-500/[0.04] ${className}`}
    >
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${colorClass ? colorClass : `bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400`}`}>
            {Icon && <Icon size={20} strokeWidth={1.8} />}
        </div>

        <div className="min-w-0 flex-1">
            <div className="text-[11px] font-medium text-stone-400 dark:text-white/40 mb-0.5 truncate">{title}</div>
            <div className={`${valueClass} font-bold leading-tight text-stone-800 dark:text-white tabular-nums truncate`}>{valuePrefix}{value}</div>
            {subtext && <div className="text-[11px] text-stone-400 dark:text-white/35 mt-0.5 truncate">{subtext}</div>}
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
        4: 'grid-cols-2 lg:grid-cols-4',
    }[cols] || 'grid-cols-2 lg:grid-cols-4';
    return (
        <div className={`grid ${colCls} gap-3 ${className}`}>
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
    <h3 ref={ref} className={`font-semibold leading-tight ${className}`} {...props} />
));
CardTitle.displayName = "CardTitle";

export const CardDescription = React.forwardRef(({ className = '', ...props }, ref) => (
    <p ref={ref} className={`text-sm text-stone-500 dark:text-white/40 ${className}`} {...props} />
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
