"use client";

import { Printer, X, FileText } from "lucide-react";

export function BillingPrintPickerDialog({
  docNo,
  id,
  onClose,
}: {
  docNo: string;
  id: number;
  onClose: () => void;
}) {
  function open(type: "billing" | "receipt", copy: boolean) {
    const params = new URLSearchParams();
    if (copy) params.set("copy", "1");
    const qs = params.toString();
    // billing → dedicated /billing/[id]/print template
    // receipt → existing /receipts/[id]/print?type=receipt
    if (type === "receipt") params.set("type", "receipt");
    const finalQs = params.toString();
    const url =
      type === "billing"
        ? `/billing/${id}/print${qs ? `?${qs}` : ""}`
        : `/receipts/${id}/print${finalQs ? `?${finalQs}` : ""}`;
    window.open(url, "_blank");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-sky-300 bg-gradient-to-b from-sky-200 to-sky-100 px-4 py-2.5">
          <div className="flex items-center gap-2 text-base font-bold text-sky-900">
            <Printer className="h-5 w-5" />
            พิมพ์เอกสารลงกระดาษ แบบรวม A4, A5
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-sky-800 hover:bg-sky-200/60"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid flex-1 grid-cols-[1fr_280px] gap-4 p-4">
          <div>
            <div className="mb-3">
              <h3 className="text-sm font-bold text-blue-900">
                เลือกแบบเอกสารที่ต้องการพิมพ์ลงกระดาษ
              </h3>
            </div>

            <div className="grid grid-cols-2 gap-x-10 gap-y-6">
              <div>
                <div className="mb-3 text-sm font-bold text-blue-900">
                  ใบวางบิล
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <PrintCard
                    label="ใบวางบิล"
                    sub="BillingSlip"
                    onClick={() => open("billing", false)}
                    accent="amber"
                    copy={false}
                  />
                  <PrintCard
                    label="ใบวางบิล"
                    sub="BillingSlip"
                    onClick={() => open("billing", true)}
                    accent="rose"
                    copy={true}
                  />
                </div>
              </div>

              <div>
                <div className="mb-3 text-sm font-bold text-blue-900">
                  ใบเสร็จรับเงิน
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <PrintCard
                    label="ใบเสร็จรับเงิน"
                    onClick={() => open("receipt", false)}
                    accent="amber"
                    copy={false}
                  />
                  <PrintCard
                    label="ใบเสร็จรับเงิน"
                    onClick={() => open("receipt", true)}
                    accent="rose"
                    copy={true}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col rounded-md border border-sky-300 bg-gradient-to-b from-sky-100 to-sky-200 p-3">
            <div className="text-center text-sm font-bold text-rose-700">
              หมายเลขเอกสารที่เลือกพิมพ์
            </div>
            <div className="mt-1 rounded bg-white px-3 py-1.5 text-center font-mono text-base font-bold text-rose-700">
              {docNo}
            </div>
            <p className="mt-3 text-[12px] leading-relaxed text-sky-900">
              เลือกแบบเอกสารที่ต้องการพิมพ์ลงกระดาษ A4
              โดยคลิกที่รูปเอกสารตามที่ต้องการ
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-auto flex h-10 items-center justify-center gap-1.5 rounded-md border border-blue-800 bg-gradient-to-b from-blue-700 to-blue-900 text-base font-bold italic text-white shadow-sm transition active:translate-y-px hover:from-blue-800 hover:to-blue-950"
            >
              <X className="h-4 w-4" />
              ESC ออก
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PrintCard({
  label,
  sub,
  onClick,
  accent,
  copy,
}: {
  label: string;
  sub?: string;
  onClick: () => void;
  accent: "amber" | "rose";
  copy: boolean;
}) {
  const accentCls =
    accent === "amber"
      ? "border-amber-300 hover:border-amber-500"
      : "border-rose-300 hover:border-rose-500";
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col items-center gap-2"
    >
      <div
        className={`relative flex h-32 w-24 flex-col items-center justify-center rounded border-2 bg-white shadow-md transition group-hover:scale-105 group-hover:shadow-lg ${accentCls}`}
        style={{
          backgroundImage:
            "linear-gradient(135deg, transparent 0%, transparent 85%, rgba(0,0,0,0.08) 85%, rgba(0,0,0,0.08) 100%)",
        }}
      >
        {copy && (
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 -rotate-12 rounded bg-rose-600 px-2 py-0.5 text-[11px] font-bold text-white shadow">
            COPY
          </div>
        )}
        <FileText className="h-9 w-9 text-zinc-400" />
        <span className="mt-1 text-[10px] font-medium text-zinc-700">
          {label}
        </span>
        {sub && <span className="text-[9px] italic text-zinc-500">{sub}</span>}
      </div>
    </button>
  );
}
