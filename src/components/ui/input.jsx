import * as React from 'react';
import { cn } from '@/lib/utils';

// ── Komponen Input terpusat — gaya glass seragam di semua form ──
const Input = React.forwardRef(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        'flex w-full rounded-xl border border-stone-200 dark:border-white/[0.06] bg-white/70 dark:bg-[#0d0d0d]/60 backdrop-blur-xl px-4 py-3 text-sm text-stone-800 dark:text-white placeholder:text-stone-400 dark:placeholder:text-stone-500 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = 'Input';

export { Input };
