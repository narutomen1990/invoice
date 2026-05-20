"use client";

import { useState } from "react";
import { Printer, X, FileText, Search } from "lucide-react";

type FormKind = "notice" | "billing";

export function BillingFormPrintPickerDialog({
  docNo,
  internalSeq,
  id,
  onClose,
}: {
  docNo: string;
  internalSeq?: string | null;
  id: number;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");

  function open(kind: FormKind, copy: boolean) {
    const params = new URLSearchParams();
    if (kind !== "notice") params.set("form", kind);
    if (copy) params.set("copy", "1");
    const qs = params.toString();
    const url = `/billing/${id}/print${qs ? `?${qs}` : ""}`;
    window.open(url, "_blank");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg bg-white shadow-xl">
        {/* Title bar with search box on right */}
        <div className="flex items-center justify-between border-b border-zinc-300 bg-gradient-to-b from-zinc-200 to-zinc-100 px-4 py-2.5">
          <div className="flex items-center gap-2 text-base font-bold text-zinc-800">
            <Printer className="h-5 w-5" />
            พิมพ์เอกสารลงกระดาษ A4
          </div>
          <div className="relative flex w-72 items-center">
            <Search className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-zinc-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder=""
              className="h-8 w-full rounded-full border border-zinc-300 bg-white pl-8 pr-3 text-[12px] focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-200"
            />
          </div>
        </div>

        {/* Header strip with logo */}
        <div className="border-b border-sky-300 bg-gradient-to-b from-sky-200 to-sky-100 px-4 py-2.5">
          <div className="flex items-center gap-2 text-sky-900">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/uploads/vm-logo.jpg"
              alt="VM"
              className="h-10 w-10 rounded border border-sky-300 bg-white object-contain"
            />
            <div className="flex flex-col leading-tight">
              <span className="text-[12px] font-bold text-blue-900">
                บริษัท วี.เอ็ม. คาเมร่ากรุ๊ป จำกัด
              </span>
              <span className="text-[10px] italic text-blue-900">
                V.M. Camera Group Co., Ltd.
              </span>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="grid flex-1 grid-cols-[1fr_260px] gap-4 p-4">
          <div>
            <h3 className="mb-4 text-sm font-bold text-blue-900">
              เลือกแบบเอกสารที่ต้องการพิมพ์ลงกระดาษA4
            </h3>

            <div className="grid grid-cols-3 gap-x-6 gap-y-6">
              <PrintCard
                title="ใบแจ้งหนี้"
                onClick={() => open("notice", false)}
                copy={false}
              />
              <PrintCard
                title={"ใบแจ้งหนี้\n/ใบวางบิล"}
                onClick={() => open("billing", false)}
                copy={false}
              />
              <div />

              <PrintCard
                title="ใบแจ้งหนี้"
                onClick={() => open("notice", true)}
                copy={true}
              />
              <PrintCard
                title={"ใบแจ้งหนี้\n/ใบวางบิล"}
                onClick={() => open("billing", true)}
                copy={true}
              />
            </div>
          </div>

          <div className="flex flex-col rounded-md border border-sky-300 bg-sky-100 p-3">
            <div className="text-center text-sm font-bold text-rose-700">
              หมายเลขเอกสารที่เลือกพิมพ์
            </div>
            <div className="mt-1 rounded bg-white px-3 py-1.5 text-center font-mono text-base font-bold text-rose-700">
              {internalSeq || docNo}
            </div>
            <p className="mt-3 text-[12px] leading-relaxed text-sky-900">
              เลือกแบบเอกสารที่ต้องการพิมพ์ลงกระดาษA4
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
  title,
  onClick,
  copy,
}: {
  title: string;
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
          <div className="absolute left-2 top-2 -rotate-6 text-[15px] font-extrabold tracking-wider text-rose-600">
            COPY
          </div>
        )}
        <FileText className="mt-3 h-7 w-7 text-zinc-400" />
        <span className="mt-2 whitespace-pre-line text-center text-[11px] font-semibold text-zinc-800">
          {title}
        </span>
      </div>
    </button>
  );
}

