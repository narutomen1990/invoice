"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Trash2, Printer, X, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/thai/number";
import { formatThaiDateShort } from "@/lib/thai/date";
import { deleteQuotationAction } from "@/app/quotations/actions";

export type QuotationRow = {
  id: number;
  docNo: string;
  docDate: string;
  customerCode: string | null;
  customerName: string | null;
  customerAddress: string | null;
  customerTel: string | null;
  salemanName: string | null;
  memo: string | null;
  referenceQuotationNo: string | null;
  amountBeforeVat: number;
  vatAmount: number;
  total: number;
  status: string;
  validityDays: number | null;
  createdAt: string;
  updatedAt: string;
};

function statusMeta(status: string) {
  const map: Record<string, { th: string; cls: string }> = {
    issued: { th: "ออกแล้ว", cls: "bg-green-100 text-green-700" },
    draft: { th: "ร่าง", cls: "bg-zinc-100 text-zinc-600" },
    cancelled: { th: "ยกเลิก", cls: "bg-red-100 text-red-700" },
    voided: { th: "void", cls: "bg-red-100 text-red-700" },
  };
  return map[status] ?? { th: status, cls: "bg-zinc-100" };
}

function formatThaiDateTime(iso: string | null): string {
  if (!iso) return "-";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "-";
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yy = String((d.getFullYear() + 543) % 100).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    const ss = String(d.getSeconds()).padStart(2, "0");
    return `${dd}/${mm}/${yy} ${hh}:${mi}:${ss}`;
  } catch {
    return "-";
  }
}

export function QuotationTableWithDetail({
  rows,
  searchSlot,
  topActions,
}: {
  rows: QuotationRow[];
  searchSlot?: React.ReactNode;
  topActions?: React.ReactNode;
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<number | null>(
    rows[0]?.id ?? null,
  );
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<string | null>(null);
  const [printOpen, setPrintOpen] = useState(false);
  const selected = rows.find((r) => r.id === selectedId) ?? rows[0] ?? null;

  function handleDelete() {
    if (!selected) return;
    if (
      !confirm(
        `ต้องการลบใบเสนอราคา ${selected.docNo} (${selected.customerName ?? ""}) ออกจากระบบ?\nการลบนี้ไม่สามารถย้อนกลับได้`,
      )
    )
      return;
    startTransition(async () => {
      const res = await deleteQuotationAction(selected.id);
      if (res?.error) {
        alert(`ลบไม่สำเร็จ: ${res.error}`);
        return;
      }
      setToast(`ลบ ${selected.docNo} เรียบร้อยแล้ว`);
      setTimeout(() => setToast(null), 1800);
      setSelectedId(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {toast && (
        <div className="fixed left-1/2 top-6 z-[60] -translate-x-1/2 rounded-lg border border-green-300 bg-green-50 px-5 py-3 text-sm font-semibold text-green-800 shadow-lg">
          {toast}
        </div>
      )}

      {(topActions || rows.length > 0) && (
        <div className="flex items-center gap-2">
          {topActions}
          <button
            type="button"
            onClick={handleDelete}
            disabled={pending || !selected}
            title={
              selected
                ? `ลบใบเสนอราคา ${selected.docNo} ออกจากระบบ`
                : "เลือกแถวในตารางก่อน"
            }
            className="flex items-center gap-1 rounded-md border border-rose-700 bg-gradient-to-b from-rose-500 to-rose-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition active:translate-y-px hover:from-rose-600 hover:to-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            ลบ Record
          </button>
          <button
            type="button"
            onClick={() => {
              if (!selected) return;
              setPrintOpen(true);
            }}
            disabled={!selected}
            title={
              selected
                ? `เลือกแบบฟอร์มเพื่อพิมพ์ ${selected.docNo}`
                : "เลือกแถวในตารางก่อน"
            }
            className="flex items-center gap-1 rounded-md border border-amber-700 bg-gradient-to-b from-amber-400 to-amber-500 px-3 py-1.5 text-sm font-semibold text-amber-950 shadow-sm transition active:translate-y-px hover:from-amber-500 hover:to-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Printer className="h-4 w-4" />
            พิมพ์ กระดาษ A4
          </button>
        </div>
      )}

      {printOpen && selected && (
        <PrintPickerDialog
          docNo={selected.docNo}
          id={selected.id}
          onClose={() => setPrintOpen(false)}
        />
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">รายการใบเสนอราคาในระบบ</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-zinc-500">
              ยังไม่มีใบเสนอราคา —{" "}
              <Link
                href="/quotations/new"
                className="text-amber-600 underline"
              >
                สร้างใบแรก
              </Link>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b bg-zinc-50 text-left text-xs text-zinc-500">
                <tr>
                  <th className="px-4 py-2.5 font-medium">รหัสลูกค้า</th>
                  <th className="px-4 py-2.5 font-medium">รายชื่อผู้ประกอบการ</th>
                  <th className="px-4 py-2.5 font-medium">เลขที่</th>
                  <th className="px-4 py-2.5 font-medium">วันที่</th>
                  <th className="px-4 py-2.5 font-medium">พนักงาน</th>
                  <th className="px-4 py-2.5 text-right font-medium">รวม</th>
                  <th className="px-4 py-2.5 font-medium">สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => {
                  const isSel = r.id === selectedId;
                  const st = statusMeta(r.status);
                  return (
                    <tr
                      key={r.id}
                      onClick={() => setSelectedId(r.id)}
                      className={`cursor-pointer ${
                        isSel ? "bg-amber-50" : "hover:bg-zinc-50"
                      }`}
                    >
                      <td className="px-4 py-2 font-mono text-xs">
                        <Link
                          href={`/quotations/${r.id}/edit`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-amber-700 hover:underline"
                        >
                          {r.customerCode ?? "-"}
                        </Link>
                      </td>
                      <td className="px-4 py-2 max-w-xs truncate">
                        {r.customerName ?? "-"}
                      </td>
                      <td className="px-4 py-2 font-mono text-xs">
                        <Link
                          href={`/quotations/${r.id}/edit`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-amber-700 hover:underline"
                        >
                          {r.docNo}
                        </Link>
                      </td>
                      <td className="px-4 py-2 text-zinc-600">
                        {formatThaiDateShort(r.docDate)}
                      </td>
                      <td className="px-4 py-2 text-zinc-600">
                        {r.salemanName ?? "-"}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {formatMoney(r.total)}
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`rounded px-2 py-0.5 text-[11px] font-medium ${st.cls}`}
                        >
                          {st.th}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {searchSlot}

      {selected && <DetailPanel q={selected} />}
    </div>
  );
}

function DetailPanel({ q }: { q: QuotationRow }) {
  const addrLine = (q.customerAddress ?? "").replace(/\n/g, " ");
  const validityLabel = q.validityDays
    ? `${String(new Date(q.docDate).getMonth() + 1).padStart(2, "0")}/${String(
        (new Date(q.docDate).getFullYear() + 543) % 100,
      ).padStart(2, "0")}`
    : "-";

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_360px]">
      {/* LEFT: customer info (cyan) */}
      <div className="overflow-hidden rounded border border-cyan-300 bg-cyan-50 text-[12px]">
        <div className="grid grid-cols-[88px_1fr] gap-x-2 px-3 py-2">
          <div className="text-cyan-800">เลขที่</div>
          <div className="font-mono text-zinc-800">{q.customerCode ?? "-"}</div>

          <div className="text-cyan-800">รายชื่อ</div>
          <div className="font-medium text-zinc-900">
            {q.customerName ?? "-"}
          </div>

          <div className="text-cyan-800">ที่อยู่</div>
          <div className="text-zinc-700">{addrLine || "-"}</div>

          <div className="text-cyan-800">หมายเหตุ</div>
          <div className="text-zinc-700">{q.memo ?? "-"}</div>
        </div>
        <div className="border-t border-cyan-200 px-3 py-1.5 text-[11px] text-zinc-600">
          วันเดือนปี เวลา ที่สร้างเอกสาร{" "}
          <span className="font-mono text-zinc-800">
            {formatThaiDateTime(q.createdAt)}
          </span>
        </div>
        <div className="border-t border-cyan-200 px-3 py-1.5 text-[11px] text-zinc-600">
          วันเดือนปี เวลา ที่แก้ไขล่าสุด{" "}
          <span className="font-mono text-zinc-800">
            {formatThaiDateTime(q.updatedAt)}
          </span>
        </div>
      </div>

      {/* RIGHT: amounts (red border) */}
      <div className="overflow-hidden rounded border-2 border-rose-400 bg-white text-[12px]">
        <div className="grid grid-cols-[1fr_1fr] gap-x-3 gap-y-1 border-b border-rose-200 bg-rose-50 px-3 py-2">
          <div>
            <div className="text-[10px] text-rose-700">Quotation :</div>
            <div className="font-mono font-bold text-rose-900">{q.docNo}</div>
          </div>
          <div>
            <div className="text-[10px] text-rose-700">Invoice No</div>
            <div className="font-mono font-medium text-zinc-800">
              {q.referenceQuotationNo ?? "-"}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-rose-700">วันที่ในใบกำกับ</div>
            <div className="font-mono text-zinc-800">
              {formatThaiDateShort(q.docDate)}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-rose-700">พนักงานขาย</div>
            <div className="text-zinc-800">{q.salemanName ?? "-"}</div>
          </div>
          <div>
            <div className="text-[10px] text-rose-700">เตือนยืนราคา</div>
            <div className="font-mono text-zinc-800">{validityLabel}</div>
          </div>
        </div>
        <div className="space-y-1 px-3 py-2">
          <div className="flex justify-between text-zinc-700">
            <span>รวมเป็นเงิน</span>
            <span className="tabular-nums">{formatMoney(q.amountBeforeVat)}</span>
          </div>
          <div className="flex justify-between text-zinc-700">
            <span>ภาษีมูลค่าเพิ่ม</span>
            <span className="tabular-nums">{formatMoney(q.vatAmount)}</span>
          </div>
          <div className="flex justify-between border-t pt-1 text-base font-bold text-rose-700">
            <span>รวมเงินทั้งสิ้น</span>
            <span className="tabular-nums">{formatMoney(q.total)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function PrintPickerDialog({
  docNo,
  id,
  onClose,
}: {
  docNo: string;
  id: number;
  onClose: () => void;
}) {
  function open(copy: boolean) {
    const url = copy
      ? `/quotations/${id}/print?copy=1`
      : `/quotations/${id}/print`;
    window.open(url, "_blank");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white shadow-xl">
        {/* title bar */}
        <div className="flex items-center justify-between border-b border-sky-300 bg-gradient-to-b from-sky-200 to-sky-100 px-4 py-2.5">
          <div className="flex items-center gap-2 text-base font-bold text-sky-900">
            <Printer className="h-5 w-5" />
            พิมพ์เอกสารลงกระดาษ A4
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-sky-800 hover:bg-sky-200/60"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* body */}
        <div className="grid flex-1 grid-cols-[1fr_280px] gap-4 p-4">
          {/* left: pick form */}
          <div>
            <h3 className="mb-3 text-sm font-bold text-blue-900">
              เลือกแบบเอกสารที่ต้องการพิมพ์ลงกระดาษ A4
            </h3>
            <div className="grid grid-cols-2 gap-6">
              <PrintCardOption
                title="ใบเสนอราคา"
                onClick={() => open(false)}
                accent="amber"
                copy={false}
              />
              <PrintCardOption
                title="สำเนาใบเสนอราคา"
                onClick={() => open(true)}
                accent="rose"
                copy={true}
              />
            </div>
          </div>

          {/* right: doc info + esc */}
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

function PrintCardOption({
  title,
  onClick,
  accent,
  copy,
}: {
  title: string;
  onClick: () => void;
  accent: "amber" | "rose";
  copy: boolean;
}) {
  const accentCls =
    accent === "amber"
      ? "border-amber-300 hover:border-amber-500 hover:shadow-amber-200/60"
      : "border-rose-300 hover:border-rose-500 hover:shadow-rose-200/60";
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
        <FileText className="h-10 w-10 text-zinc-400" />
        <span className="mt-1 text-[10px] font-medium text-zinc-700">
          ใบเสนอราคา
        </span>
      </div>
      <span className="text-sm font-semibold text-zinc-700 group-hover:text-blue-700">
        {title}
      </span>
    </button>
  );
}
