import * as React from 'react';
import { cn } from '@/lib/utils';

// ── Komponen Textarea terpusat — gaya glass seragam (satu sumber dengan Input/Select) ──
const Textarea = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        'flex w-full rounded-xl border border-slate-200 dark:border-white/[0.06] bg-white/70 dark:bg-[#0d0d0d]/60 backdrop-blur-xl px-4 py-3 text-sm text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = 'Textarea';

export { Textarea };
