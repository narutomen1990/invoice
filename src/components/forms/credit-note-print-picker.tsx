"use client";

import { Printer, X, FileText } from "lucide-react";

export function CreditNotePrintPickerDialog({
  docNo,
  internalSeq,
  id,
  onClose,
}: {
  docNo: string;
  internalSeq?: string;
  id: number;
  onClose: () => void;
}) {
  function open(copy: boolean) {
    const qs = copy ? "?copy=1" : "";
    window.open(`/credit-notes/${id}/print${qs}`, "_blank");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white shadow-xl">
        {/* Title bar */}
        <div className="border-b border-sky-300 bg-gradient-to-b from-sky-200 to-sky-100 px-4 py-2.5">
          <div className="flex items-center gap-2 text-base font-bold text-sky-900">
            <Printer className="h-5 w-5" />
            พิมพ์เอกสารลงกระดาษ A4
          </div>
        </div>

        {/* Header bar (logo + doc number, like screenshot) */}
        <div className="flex items-center justify-between border-b border-sky-200 bg-sky-100/70 px-4 py-2.5">
          <div className="flex items-center gap-2 text-sky-900">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/uploads/vm-logo.jpg"
              alt="VM"
              className="h-10 w-10 rounded border border-sky-300 bg-white object-contain"
            />
            <div className="flex flex-col leading-tight">
              <span className="text-[12px] font-bold">
                บริษัท วี.เอ็ม. คาเมร่ากรุ๊ป จำกัด
              </span>
              <span className="text-[10px] italic text-blue-900">
                V.M. Camera Group Co., Ltd.
              </span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[12px] font-semibold text-sky-900">
              หมายเลขเอกสารที่เลือกพิมพ์
            </div>
            <div className="mt-0.5 inline-block rounded border border-rose-200 bg-white px-3 py-1 font-mono text-base font-bold text-rose-700">
              {internalSeq ?? docNo}
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="grid flex-1 grid-cols-[1fr_260px] gap-4 p-4">
          <div>
            <h3 className="mb-4 text-sm font-bold text-blue-900">
              เลือกแบบเอกสารที่ต้องการพิมพ์ลงกระดาษA4
            </h3>
            <div className="flex flex-col items-start gap-6 pl-4">
              <PrintCard
                label="ใบลดหนี้"
                sub="CreditNote"
                onClick={() => open(false)}
                copy={false}
              />
              <PrintCard
                label="ใบลดหนี้"
                sub="CreditNote"
                onClick={() => open(true)}
                copy={true}
              />
            </div>
          </div>

          <div className="flex flex-col rounded-md border border-sky-300 bg-sky-100 p-3">
            <p className="text-[12px] leading-relaxed text-sky-900">
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
  copy,
}: {
  label: string;
  sub?: string;
  onClick: () => void;
  copy: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col items-center gap-1.5"
    >
      <div
        className="relative flex h-32 w-24 flex-col items-center justify-center rounded border-2 border-zinc-300 bg-white shadow-md transition group-hover:border-sky-500 group-hover:scale-105 group-hover:shadow-lg"
        style={{
          backgroundImage:
            "linear-gradient(135deg, transparent 0%, transparent 85%, rgba(0,0,0,0.08) 85%, rgba(0,0,0,0.08) 100%)",
        }}
      >
        {copy && (
          <div className="absolute left-1/2 top-3 -translate-x-1/2 -rotate-6 text-[16px] font-extrabold tracking-wider text-rose-600">
            COPY
          </div>
        )}
        <FileText className="mt-3 h-7 w-7 text-zinc-400" />
        <span className="mt-2 text-[11px] font-semibold text-zinc-800">
          {label}
        </span>
        {sub && (
          <span className="text-[10px] italic text-zinc-500">{sub}</span>
        )}
      </div>
    </button>
  );
}
