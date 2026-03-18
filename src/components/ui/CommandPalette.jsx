import React, { useEffect, useMemo, useState } from 'react';
import { Search, CornerDownLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';

const isTypingElement = (target) => {
  if (!(target instanceof HTMLElement)) return false;

  if (target.isContentEditable) return true;

  const tagName = target.tagName;
  if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') {
    return true;
  }

  return Boolean(target.closest('[contenteditable="true"], [data-ignore-command-palette="true"]'));
};

const CommandPalette = ({ items = [], onSelect, quickActions = [], disabled = false }) => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.defaultPrevented || event.isComposing) return;
      if (disabled) return;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        if (isTypingElement(event.target)) return;
        event.preventDefault();
        setOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [disabled]);

  useEffect(() => {
    if (disabled && open) {
      setOpen(false);
    }
  }, [disabled, open]);

  const groupedItems = useMemo(() => {
    return items.reduce((acc, item) => {
      const group = item.group || 'Navigasi';
      if (!acc[group]) acc[group] = [];
      acc[group].push(item);
      return acc;
    }, {});
  }, [items]);

  const shortcutHint = useMemo(() => {
    const platform = typeof navigator !== 'undefined' ? navigator.platform : '';
    return platform.toUpperCase().includes('MAC') ? 'CMD+K' : 'CTRL+K';
  }, []);

  const handleSelect = (item) => {
    setOpen(false);
    if (disabled) return;
    if (onSelect) onSelect(item);
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="h-10 rounded-2xl border-slate-200 bg-white/80 px-3 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-white dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300"
      >
        <Search size={14} />
        <span>Search</span>
        <kbd className="rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
          {shortcutHint}
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <motion.div
          initial={{ opacity: 0, y: -16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.18 }}
        >
          <Command className="w-full">
            <CommandInput autoFocus placeholder="Cari modul, fitur, atau aksi..." />

            <CommandList className="max-h-[420px] overflow-y-auto p-2">
              <CommandEmpty className="p-6 text-center text-sm text-slate-500">
                Tidak ada hasil. Coba kata kunci lain.
              </CommandEmpty>

              {quickActions.length > 0 && (
                <>
                  <CommandGroup heading="Aksi Cepat" className="px-1 py-1 text-xs font-semibold text-slate-400">
                    {quickActions.map((action) => {
                      const Icon = action.icon;
                      return (
                        <CommandItem
                          key={action.id}
                          value={`${action.label} ${action.keywords || ''}`}
                          onSelect={() => handleSelect(action)}
                          className={cn(
                            'flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-700 outline-none aria-selected:bg-slate-100 dark:text-slate-200 dark:aria-selected:bg-slate-800'
                          )}
                        >
                          {Icon && <Icon size={16} className="text-slate-500" />}
                          <div className="flex-1">
                            <p className="font-medium">{action.label}</p>
                            {action.description && <p className="text-xs text-slate-500">{action.description}</p>}
                          </div>
                          <CornerDownLeft size={14} className="text-slate-400" />
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                  <CommandSeparator className="my-1 h-px bg-slate-200 dark:bg-slate-800" />
                </>
              )}

              {Object.entries(groupedItems).map(([groupName, groupItems]) => (
                <CommandGroup key={groupName} heading={groupName} className="px-1 py-1 text-xs font-semibold text-slate-400">
                  {groupItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <CommandItem
                        key={item.id}
                        value={`${item.label} ${item.keywords || ''}`}
                        onSelect={() => handleSelect(item)}
                        className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-700 outline-none aria-selected:bg-slate-100 dark:text-slate-200 dark:aria-selected:bg-slate-800"
                      >
                        {Icon && <Icon size={16} className="text-slate-500" />}
                        <div className="flex-1">
                          <p className="font-medium">{item.label}</p>
                          {item.description && <p className="text-xs text-slate-500">{item.description}</p>}
                        </div>
                        <CornerDownLeft size={14} className="text-slate-400" />
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </motion.div>
      </CommandDialog>
    </>
  );
};

export default CommandPalette;
