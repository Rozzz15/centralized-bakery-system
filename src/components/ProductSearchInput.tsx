import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";

type Props = {
  value: string;
  onChange: (value: string) => void;
  catalog: string[];
  usedProducts?: Set<string>;
  onAddNew?: (name: string) => void;
  placeholder?: string;
};

export default function ProductSearchInput({ value, onChange, catalog, usedProducts, onAddNew, placeholder = "Search product…" }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => { setQuery(value); }, [value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const inside = containerRef.current?.contains(target) || dropdownRef.current?.contains(target);
      if (!inside) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const dropdownRefCb = useCallback((el: HTMLDivElement | null) => {
    dropdownRef.current = el;
  }, []);

  const filtered = query.trim()
    ? catalog.filter(p => p.toLowerCase().includes(query.toLowerCase()) && (usedProducts ? !usedProducts.has(p) || p === value : true))
    : [];

  const showAddNew = query.trim() && onAddNew && !catalog.some(p => p.toLowerCase() === query.toLowerCase());

  const rect = inputRef.current?.getBoundingClientRect();
  const dropdownStyle: React.CSSProperties = rect ? {
    position: "fixed",
    left: rect.left,
    top: rect.bottom + 4,
    width: rect.width,
  } : {};

  return (
    <div ref={containerRef} className="relative">
      <input
        ref={inputRef}
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-[13px] outline-none focus:border-zinc-400"
      />
      {open && (filtered.length > 0 || showAddNew) && rect && createPortal(
        <div ref={dropdownRefCb} style={dropdownStyle} className="z-[100] max-h-48 overflow-auto rounded-xl border border-zinc-200 bg-white shadow-lg">
          {filtered.map(p => (
            <button
              key={p}
              type="button"
              className={`flex w-full items-center px-3 py-2 text-left text-[13px] transition-colors hover:bg-zinc-50 ${p === value ? "bg-zinc-100 font-medium text-zinc-900" : "text-zinc-700"}`}
              onClick={() => { setQuery(p); onChange(p); setOpen(false); }}
            >
              {catalog.indexOf(p) !== -1 && usedProducts?.has(p) && p !== value && <span className="mr-2 text-[10px] text-zinc-300">(already added)</span>}
              {p}
            </button>
          ))}
          {showAddNew && (
            <button
              type="button"
              className="flex w-full items-center gap-1.5 border-t border-dashed border-zinc-200 px-3 py-2 text-left text-[13px] text-zinc-500 transition-colors hover:bg-zinc-50"
              onClick={() => { onAddNew(query.trim()); setQuery(query.trim()); onChange(query.trim()); setOpen(false); }}
            >
              <span className="text-zinc-400">+</span> Add &quot;{query.trim()}&quot;
            </button>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
