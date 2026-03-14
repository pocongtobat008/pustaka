import React from 'react';
import { CheckCircle2 } from 'lucide-react';

export default function AuditStepTracker({ AUDIT_STEPS, selectedAudit, activeStep, setActiveStep }) {
    return (
        <div className="hidden md:flex items-center justify-between relative px-4">
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-gray-200 dark:bg-slate-700 -z-10" />
            {AUDIT_STEPS.map((step, index) => {
                const sData = selectedAudit.steps?.[step.id - 1] || {};
                const isDone = sData.status === 'Done';
                const isActive = activeStep === step.id;

                return (
                    <div key={step.id} className="relative flex flex-col items-center group cursor-pointer" onClick={() => setActiveStep(step.id)}>
                        {index < AUDIT_STEPS.length - 1 && (
                            <div
                                className={`absolute left-1/2 top-1/2 -translate-y-1/2 h-1 w-full -z-10 transition-all duration-500 ${isDone ? 'bg-emerald-500' : 'bg-transparent'}`}
                                style={{ width: 'calc(100% + 2rem)' }}
                            />
                        )}

                        <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center border-4 transition-all duration-300 z-10
                    ${isDone
                                    ? 'bg-emerald-500 border-emerald-100 dark:border-emerald-900/50 text-white scale-100 shadow-md shadow-emerald-500/20'
                                    : isActive
                                        ? 'bg-indigo-600 border-indigo-100 dark:border-indigo-900/50 text-white scale-110 shadow-lg shadow-indigo-500/30'
                                        : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-400 dark:text-gray-500'}`}
                        >
                            {isDone ? <CheckCircle2 size={18} /> : <span className="text-sm font-bold">{step.id}</span>}
                        </div>

                        <div className="absolute top-12 w-32 text-center transition-all duration-300">
                            <p className={`text-xs font-bold mb-0.5 ${isActive ? 'text-indigo-600 scale-105' : isDone ? 'text-emerald-600' : 'text-gray-400'}`}>
                                {step.title}
                            </p>
                            <p className={`text-[10px] ${isActive ? 'text-indigo-400' : 'text-gray-400 hidden group-hover:block'}`}>
                                {sData.status || 'Pending'}
                            </p>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}