import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export default function OcrLaneStatus({ API_BASE }) {
  const [lanes, setLanes] = useState([]);
  const [total, setTotal] = useState(0);
  const [minimized, setMinimized] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function fetchLanes() {
      try {
        const res = await fetch(`${API_BASE}/ocr/lanes`, { credentials: 'include' });
        if (!res.ok) return;
        const json = await res.json();
        if (!mounted) return;
        setLanes(json.lanes || []);
        setTotal(json.totalWaitingActive || 0);
      } catch (e) { /* ignore */ }
    }
    fetchLanes();
    const id = setInterval(fetchLanes, 3000);
    return () => { mounted = false; clearInterval(id); };
  }, [API_BASE]);

  if (!lanes || lanes.length === 0) return null;

  return (
    <div className="fixed right-4 top-4 z-50 w-80 max-w-[90vw] p-2 bg-white/90 dark:bg-slate-900/80 rounded-xl shadow-lg border border-slate-100 dark:border-slate-800 backdrop-blur">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <div className="text-xs font-black uppercase">OCR Lanes</div>
          <div className="text-[11px] text-slate-500">Total {total}</div>
        </div>
        <button onClick={() => setMinimized(s => !s)} className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800">
          {minimized ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </button>
      </div>

      {!minimized && (
        <div className="space-y-2">
          {lanes.map(l => (
            <div key={l.name}>
              <div className="flex justify-between text-[11px] mb-1">
                <div className="truncate">{l.name}</div>
                <div className="font-black">{l.count}/{l.capacity}</div>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                <div style={{ width: `${Math.min(l.loadPct, 200)}%` }} className={`h-full ${l.loadPct >= 100 ? 'bg-red-500' : 'bg-emerald-500'} rounded-full`} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
