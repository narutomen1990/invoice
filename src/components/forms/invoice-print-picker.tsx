"use client";

import { Printer, X, FileText, FileDown, FileCode2 } from "lucide-react";

type FormKind = "notice" | "tax" | "receipt" | "billing";

export function InvoicePrintPickerDialog({
  docNo,
  internalSeq,
  id,
  stampEnabled = true,
  onClose,
}: {
  docNo: string;
  internalSeq?: string | null;
  id: number;
  stampEnabled?: boolean;
  onClose: () => void;
}) {
  function open(kind: FormKind, copy: boolean) {
    const params = new URLSearchParams();
    if (kind !== "tax") params.set("form", kind);
    if (copy) params.set("copy", "1");
    if (!stampEnabled) params.set("stamp", "0");
    const qs = params.toString();
    const url = `/invoices/${id}/print${qs ? `?${qs}` : ""}`;
    window.open(url, "_blank");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg bg-white shadow-xl">
        {/* Title bar */}
        <div className="border-b border-zinc-300 bg-gradient-to-b from-zinc-200 to-zinc-100 px-4 py-2.5">
          <div className="flex items-center gap-2 text-base font-bold text-zinc-800">
            <Printer className="h-5 w-5" />
            พิมพ์เอกสารลงกระดาษ A4
          </div>
        </div>

        {/* Header strip with logo + doc no */}
        <div className="flex items-center justify-between border-b border-sky-300 bg-gradient-to-b from-sky-200 to-sky-100 px-4 py-2.5">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/uploads/vm-logo.jpg"
              alt="VM"
              className="h-10 w-10 rounded border border-sky-400 bg-white object-contain"
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
          <div className="text-right">
            <div className="text-[12px] font-semibold text-rose-700">
              หมายเลขเอกสารที่เลือกพิมพ์
            </div>
            <div className="mt-0.5 inline-block rounded border border-rose-200 bg-white px-3 py-1 font-mono text-base font-bold text-rose-700">
              {internalSeq || docNo}
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="grid flex-1 grid-cols-[1fr_240px] gap-4 p-4">
          <div>
            <h3 className="mb-3 text-sm font-bold text-blue-900">
              เลือกแบบเอกสารที่ต้องการพิมพ์ลงกระดาษA4
            </h3>

            {/* Originals row */}
            <div className="grid grid-cols-4 gap-6">
              <PrintCard
                title="ใบแจ้งหนี้"
                onClick={() => open("notice", false)}
                copy={false}
              />
              <PrintCard
                title="ใบกำกับภาษี"
                onClick={() => open("tax", false)}
                copy={false}
              />
              <PrintCard
                title={"ใบส่งสินค้า\n/DELIVERY ORDER"}
                onClick={() => open("receipt", false)}
                copy={false}
              />
              <PrintCard
                title={"ใบกำกับภาษี\n/ใบเสร็จรับเงิน\n/ใบส่งสินค้า"}
                onClick={() => open("billing", false)}
                copy={false}
              />
            </div>

            {/* COPY row */}
            <div className="mt-6 grid grid-cols-4 gap-6">
              <PrintCard
                title="ใบแจ้งหนี้"
                onClick={() => open("notice", true)}
                copy={true}
              />
              <PrintCard
                title="ใบกำกับภาษี"
                onClick={() => open("tax", true)}
                copy={true}
              />
              <PrintCard
                title={"ใบส่งสินค้า\n/DELIVERY ORDER"}
                onClick={() => open("receipt", true)}
                copy={true}
              />
              <PrintCard
                title={"ใบกำกับภาษี\n/ใบเสร็จรับเงิน\n/ใบส่งสินค้า"}
                onClick={() => open("billing", true)}
                copy={true}
              />
            </div>
          </div>

          <div className="flex flex-col rounded-md border border-sky-300 bg-sky-100 p-3">
            <p className="text-[12px] leading-relaxed text-sky-900">
              เลือกแบบเอกสารที่ต้องการพิมพ์ลงกระดาษ A4
              โดยคลิกที่รูปเอกสารตามที่ต้องการ
            </p>

            <div className="mt-3 border-t border-sky-300 pt-3">
              <div className="mb-1.5 text-[11px] font-semibold text-sky-900">
                ดาวน์โหลดเพื่อส่งอีเมล
              </div>
              <div className="flex gap-2">
                <a
                  href={`/api/invoices/${id}/pdf?download=1${stampEnabled ? "" : "&stamp=0"}`}
                  download={`${(internalSeq || docNo).replace(/[\/\\]/g, "_")}.pdf`}
                  title="ดาวน์โหลดไฟล์ PDF"
                  className="group flex flex-1 flex-col items-center gap-1 rounded-md border border-rose-300 bg-white px-2 py-2 text-rose-700 shadow-sm transition hover:border-rose-500 hover:bg-rose-50"
                >
                  <FileDown className="h-6 w-6" />
                  <span className="text-[11px] font-bold">PDF</span>
                </a>
                <a
                  href={`/api/invoices/${id}/xml`}
                  download={`${(internalSeq || docNo).replace(/[\/\\]/g, "_")}.xml`}
                  title="ดาวน์โหลดไฟล์ XML (e-Tax UBL 2.1)"
                  className="group flex flex-1 flex-col items-center gap-1 rounded-md border border-emerald-300 bg-white px-2 py-2 text-emerald-700 shadow-sm transition hover:border-emerald-500 hover:bg-emerald-50"
                >
                  <FileCode2 className="h-6 w-6" />
                  <span className="text-[11px] font-bold">XML</span>
                </a>
              </div>
            </div>

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
