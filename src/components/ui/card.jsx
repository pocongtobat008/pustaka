import * as React from 'react';
import { cn } from '@/lib/utils';

const Card = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('rounded-2xl border border-slate-200/60 p-5 sm:p-7 dark:border-slate-800/60 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] transition-all duration-300', className)} {...props} />
));
Card.displayName = 'Card';

const CardHeader = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('flex flex-col space-y-1.5 mb-4', className)} {...props} />
));
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef(({ className, ...props }, ref) => (
  <h3 ref={ref} className={cn('text-2xl font-bold leading-tight tracking-tight', className)} {...props} />
));
CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef(({ className, ...props }, ref) => (
  <p ref={ref} className={cn('text-sm text-slate-500 dark:text-slate-400', className)} {...props} />
));
CardDescription.displayName = 'CardDescription';

const CardContent = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('', className)} {...props} />
));
CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('flex items-center mt-4', className)} {...props} />
));
CardFooter.displayName = 'CardFooter';

const SummaryCard = ({ title, value, icon: Icon, colorClass, subtitle }) => {
  return (
    <Card className={cn("overflow-hidden border-none text-white relative !p-6 sm:!p-8", colorClass)}>
      {/* Decorative background glow/gradient */}
      <div className="absolute top-0 right-0 p-12 opacity-10 pointer-events-none mix-blend-overlay">
        <div className="w-32 h-32 rounded-full bg-white blur-3xl transform translate-x-12 -translate-y-12"></div>
      </div>
      <CardContent className="relative z-10">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm sm:text-base font-medium opacity-90 uppercase tracking-widest">{title}</p>
            <h3 className="text-3xl sm:text-4xl font-extrabold tracking-tight drop-shadow-sm">{value}</h3>
            {subtitle && <p className="text-sm opacity-80 font-medium mt-1">{subtitle}</p>}
          </div>
          {Icon && (
            <div className="p-3 sm:p-4 bg-white/20 dark:bg-black/20 rounded-2xl shadow-inner backdrop-blur-md">
              <Icon size={32} strokeWidth={1.5} className="text-white drop-shadow-sm" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, SummaryCard };
