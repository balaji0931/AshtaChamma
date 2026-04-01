// ============================================================================
// InfoTip — Clickable ? icon with popover explanation
// ============================================================================

import { useState, useRef, useEffect } from 'react';

interface InfoTipProps {
  title: string;
  children: React.ReactNode;
}

export function InfoTip({ title, children }: InfoTipProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <span className="relative inline-flex ml-1.5" ref={ref}>
      <button
        type="button"
        className="w-4 h-4 rounded-full bg-stone-200 text-stone-500 text-[9px] font-black flex items-center justify-center hover:bg-amber-200 hover:text-amber-700 transition-colors shrink-0"
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        aria-label={`Info about ${title}`}
      >
        ?
      </button>

      {open && (
        <>
          {/* Backdrop for mobile */}
          <div className="fixed inset-0 bg-black/10 z-40 sm:hidden" onClick={() => setOpen(false)} />

          <div className="absolute z-50 left-1/2 -translate-x-1/2 top-7 w-64 sm:w-72 bg-white rounded-xl shadow-xl shadow-stone-200/50 border border-stone-100 p-3.5 animate-in fade-in zoom-in-95 duration-150">
            {/* Arrow */}
            <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-l border-t border-stone-100 rotate-45" />

            <p className="text-[11px] font-bold text-stone-700 mb-1.5">{title}</p>
            <div className="text-[11px] text-stone-500 leading-relaxed space-y-1.5">
              {children}
            </div>

            <button
              className="mt-2 text-[10px] font-bold text-amber-600 uppercase tracking-wider hover:text-amber-800"
              onClick={() => setOpen(false)}
            >
              Got it
            </button>
          </div>
        </>
      )}
    </span>
  );
}
