"use client";

import { Printer, X, FileText, FileDown } from "lucide-react";

/**
 * Picker dialog for the 50-ทวิ withholding certificate.
 * The print page renders 4 copies across 2 A4-landscape sheets — this
 * dialog lets the user choose which sheet (or all of them) to print.
 */
export function WithholdingPrintPickerDialog({
  docNo,
  id,
  onClose,
}: {
  docNo: string;
  id: number;
  onClose: () => void;
}) {
  function open(copies: "12" | "34" | "all") {
    const url =
      copies === "all"
        ? `/withholding/${id}/print`
        : `/withholding/${id}/print?copies=${copies}`;
    window.open(url, "_blank");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white shadow-xl">
        {/* Title bar */}
        <div className="border-b border-zinc-300 bg-gradient-to-b from-zinc-200 to-zinc-100 px-4 py-2.5">
          <div className="flex items-center gap-2 text-base font-bold text-zinc-800">
            <Printer className="h-5 w-5" />
            พิมพ์เอกสารลงกระดาษ A4
          </div>
        </div>

        {/* Header strip with doc no */}
        <div className="flex items-center justify-between border-b border-sky-300 bg-gradient-to-b from-sky-200 to-sky-100 px-4 py-2.5">
          <div className="flex flex-col leading-tight">
            <span className="text-[12px] font-bold text-blue-900">
              หนังสือรับรองการหักภาษี ณ ที่จ่าย
            </span>
            <span className="text-[10px] italic text-blue-900">
              50 ทวิ — ตามมาตรา 50 ทวิ แห่งประมวลรัษฎากร
            </span>
          </div>
          <div className="text-right">
            <div className="text-[12px] font-semibold text-rose-700">
              หมายเลขเอกสารที่เลือกพิมพ์
            </div>
            <div className="mt-0.5 inline-block rounded border border-rose-200 bg-white px-3 py-1 font-mono text-base font-bold text-rose-700">
              {docNo}
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="grid flex-1 grid-cols-[1fr_220px] gap-4 p-4">
          <div>
            <h3 className="mb-3 text-sm font-bold text-blue-900">
              เลือกแบบเอกสารที่ต้องการพิมพ์ลงกระดาษ A4
            </h3>

            <div className="grid grid-cols-3 gap-6">
              <PrintCard
                title={"แผ่นที่ 1\nฉบับที่ 1+2"}
                subtitle="สำหรับผู้ถูกหักภาษี"
                onClick={() => open("12")}
              />
              <PrintCard
                title={"แผ่นที่ 2\nฉบับที่ 3+4"}
                subtitle="ใช้แนบ + สำเนาติดเล่ม"
                onClick={() => open("34")}
              />
              <PrintCard
                title={"พิมพ์ทั้งหมด\n4 ฉบับ (2 แผ่น)"}
                subtitle="ทุกฉบับ"
                primary
                onClick={() => open("all")}
              />
            </div>
          </div>

          <div className="flex flex-col rounded-md border border-sky-300 bg-sky-100 p-3">
            <p className="text-[12px] leading-relaxed text-sky-900">
              เลือกแผ่นที่ต้องการพิมพ์ — แต่ละแผ่น A4 แนวนอน บรรจุ 2 ฉบับ
            </p>

            <div className="mt-3 border-t border-sky-300 pt-3">
              <div className="mb-1.5 text-[11px] font-semibold text-sky-900">
                ดาวน์โหลดเพื่อส่งอีเมล
              </div>
              <a
                href={`/api/withholding/${id}/pdf?download=1`}
                download={`${docNo.replace(/[\/\\]/g, "_")}.pdf`}
                title="ดาวน์โหลดไฟล์ PDF (ทุกฉบับ)"
                className="group flex items-center justify-center gap-2 rounded-md border border-rose-300 bg-white px-3 py-2 text-rose-700 shadow-sm transition hover:border-rose-500 hover:bg-rose-50"
              >
                <FileDown className="h-5 w-5" />
                <span className="text-[12px] font-bold">PDF (ทุกฉบับ)</span>
              </a>
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
  subtitle,
  onClick,
  primary,
}: {
  title: string;
  subtitle?: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col items-center gap-1.5"
    >
      <div
        className={
          "relative flex h-32 w-28 flex-col items-center justify-center rounded border-2 shadow-md transition group-hover:scale-105 group-hover:shadow-lg " +
          (primary
            ? "border-amber-400 bg-amber-50 group-hover:border-amber-600"
            : "border-zinc-300 bg-white group-hover:border-sky-500")
        }
        style={{
          backgroundImage:
            "linear-gradient(135deg, transparent 0%, transparent 85%, rgba(0,0,0,0.08) 85%, rgba(0,0,0,0.08) 100%)",
        }}
      >
        <FileText
          className={
            "mt-2 h-7 w-7 " +
            (primary ? "text-amber-700" : "text-zinc-400")
          }
        />
        <span
          className={
            "mt-2 whitespace-pre-line text-center text-[11px] font-semibold " +
            (primary ? "text-amber-900" : "text-zinc-800")
          }
        >
          {title}
        </span>
      </div>
      {subtitle && (
        <span className="text-center text-[10px] text-zinc-500">{subtitle}</span>
      )}
    </button>
  );
}
