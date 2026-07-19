"use client";

import { useEffect, useState } from "react";
import { X, FileSearch, Copy, Check } from "lucide-react";
import {
  getMissingDocNosAction,
  type MissingDocNoGroup,
} from "@/app/invoices/actions";

function periodKey(g: { yearBe: string; month: string }): string {
  return `${g.yearBe}-${g.month}`;
}

export function MissingDocNoDialog({ onClose }: { onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [groups, setGroups] = useState<MissingDocNoGroup[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getMissingDocNosAction()
      .then((res) => {
        if (cancelled) return;
        setGroups(res.groups);
        // most recent period first
        const last = res.groups[res.groups.length - 1];
        if (last) setSelectedPeriod(periodKey(last));
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const periods = [...groups].reverse(); // most recent first, for the dropdown
  const selected = groups.find((g) => periodKey(g) === selectedPeriod) ?? null;
  const total = selected?.missing.length ?? 0;

  function copyAll() {
    if (!selected) return;
    const text = selected.missing.join("\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-300 bg-gradient-to-b from-zinc-200 to-zinc-100 px-4 py-2.5">
          <div className="flex items-center gap-2 text-base font-bold text-zinc-800">
            <FileSearch className="h-5 w-5" />
            รายงานเลขที่เอกสารที่เว้นข้ามไป
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading && (
            <div className="py-8 text-center text-sm text-zinc-500">
              กำลังตรวจสอบ...
            </div>
          )}
          {error && (
            <div className="py-8 text-center text-sm text-rose-600">
              เกิดข้อผิดพลาด: {error}
            </div>
          )}
          {!loading && !error && groups.length === 0 && (
            <div className="py-8 text-center text-sm text-emerald-700">
              ไม่พบเลขที่เอกสารที่เว้นข้ามไป — เลขทุกใบต่อเนื่องกัน
            </div>
          )}
          {!loading && !error && groups.length > 0 && (
            <div className="space-y-3">
              <label className="block text-[12px] font-medium text-zinc-700">
                เลือกเดือนที่ต้องการตรวจสอบ
                <select
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                  className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 font-mono text-[13px]"
                >
                  {periods.map((g) => (
                    <option key={periodKey(g)} value={periodKey(g)}>
                      {g.month}/{g.yearBe} — ขาด {g.missing.length} เลข
                    </option>
                  ))}
                </select>
              </label>

              {selected && (
                <div className="rounded border border-amber-300 bg-amber-50">
                  <div className="flex items-center justify-between border-b border-amber-200 px-3 py-1.5 text-[12px] text-amber-900">
                    <span className="font-semibold">
                      เดือน {selected.month}/{selected.yearBe}
                    </span>
                    <span className="font-mono text-zinc-600">
                      {selected.min} – {selected.max}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 px-3 py-2">
                    {selected.missing.map((docNo) => (
                      <span
                        key={docNo}
                        className="rounded border border-rose-300 bg-white px-2 py-0.5 font-mono text-[12px] text-rose-700"
                      >
                        {docNo}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-zinc-200 px-4 py-2.5">
          <span className="text-[12px] text-zinc-600">
            {total > 0 ? `เดือนนี้ขาดหาย ${total} เลข` : ""}
          </span>
          <div className="flex gap-2">
            {total > 0 && (
              <button
                type="button"
                onClick={copyAll}
                className="flex items-center gap-1.5 rounded-md border border-sky-300 bg-sky-50 px-3 py-1.5 text-[12px] font-semibold text-sky-800 hover:bg-sky-100"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {copied ? "คัดลอกแล้ว" : "คัดลอกรายการ"}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-blue-800 bg-gradient-to-b from-blue-700 to-blue-900 px-4 py-1.5 text-[12px] font-bold text-white hover:from-blue-800 hover:to-blue-950"
            >
              ปิด
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
