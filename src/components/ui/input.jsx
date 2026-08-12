import * as React from 'react';
import { cn } from '@/lib/utils';

// ── Komponen Input terpusat — gaya glass seragam di semua form ──
const Input = React.forwardRef(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        'flex w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800/60 backdrop-blur-xl px-4 py-3 text-sm text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = 'Input';

export { Input };
