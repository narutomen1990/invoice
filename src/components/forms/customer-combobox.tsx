"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X, ChevronDown } from "lucide-react";

export type CustomerOption = {
  id: number;
  code: string;
  name: string;
  taxId: string | null;
  defaultBranchCode: string | null;
  address1: string | null;
  address2: string | null;
  address3: string | null;
  province: string | null;
  tel: string | null;
};

const MAX_RESULTS = 50;

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFC");
}

function matchesQuery(c: CustomerOption, q: string): boolean {
  if (!q) return true;
  const nq = normalize(q);
  return (
    normalize(c.code).includes(nq) ||
    normalize(c.name).includes(nq) ||
    (c.taxId ? normalize(c.taxId).includes(nq) : false)
  );
}

export function CustomerCombobox({
  customers,
  selectedId,
  inputValue,
  onInputChange,
  onSelect,
  onClear,
  placeholder,
  className,
}: {
  customers: CustomerOption[];
  selectedId: number | null;
  inputValue: string;
  onInputChange: (v: string) => void;
  onSelect: (c: CustomerOption) => void;
  onClear: () => void;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const q = inputValue.trim();
    const matches = customers.filter((c) => matchesQuery(c, q));
    return matches.slice(0, MAX_RESULTS);
  }, [customers, inputValue]);

  // close on outside click
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // reset highlight when results change
  useEffect(() => setHighlight(0), [inputValue, open]);

  // scroll highlighted item into view
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-idx="${highlight}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [highlight]);

  function selectAt(idx: number) {
    const c = results[idx];
    if (!c) return;
    onSelect(c);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(h + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (open && results.length > 0) selectAt(highlight);
      else if (results.length === 1) selectAt(0);
      else setOpen(true);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={wrapRef} className={`relative ${className ?? ""}`}>
      <div className="flex">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => {
              onInputChange(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder={placeholder ?? "พิมพ์ รหัส / ชื่อ / TaxID"}
            className={`flex h-9 w-full rounded-md border border-zinc-300 bg-white pl-8 pr-16 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 ${
              selectedId ? "font-mono" : ""
            }`}
            autoComplete="off"
          />
          <div className="absolute right-1 top-1/2 flex -translate-y-1/2 gap-0.5">
            {selectedId && (
              <button
                type="button"
                onClick={() => {
                  onClear();
                  inputRef.current?.focus();
                }}
                title="ล้างค่า"
                className="rounded p-1 text-zinc-400 hover:text-red-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setOpen((v) => !v);
                inputRef.current?.focus();
              }}
              className="rounded p-1 text-zinc-400 hover:text-zinc-700"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {open && (
        <div
          ref={listRef}
          className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-md border border-zinc-200 bg-white shadow-lg"
        >
          {results.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-zinc-400">
              ไม่พบลูกค้าตามคำค้น &quot;{inputValue}&quot;
            </div>
          ) : (
            <>
              <div className="sticky top-0 border-b bg-zinc-50 px-3 py-1.5 text-[11px] text-zinc-500">
                พบ {results.length}
                {results.length === MAX_RESULTS ? `+ (แสดง ${MAX_RESULTS} รายการแรก)` : ""}{" "}
                · ↑↓ เลื่อน · Enter เลือก
              </div>
              {results.map((c, i) => {
                const isHi = i === highlight;
                return (
                  <button
                    key={c.id}
                    type="button"
                    data-idx={i}
                    onMouseEnter={() => setHighlight(i)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectAt(i)}
                    className={`flex w-full items-start gap-3 px-3 py-2 text-left text-sm ${
                      isHi ? "bg-blue-50" : "hover:bg-zinc-50"
                    }`}
                  >
                    <span className="font-mono text-xs text-blue-600">
                      {c.code}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-medium">{c.name}</div>
                      <div className="flex gap-3 text-[11px] text-zinc-500">
                        {c.taxId && <span className="font-mono">TaxID: {c.taxId}</span>}
                        {c.tel && <span>โทร {c.tel}</span>}
                        {c.province && <span>{c.province}</span>}
                      </div>
                    </div>
                  </button>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
