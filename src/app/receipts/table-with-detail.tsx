"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Printer } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/thai/number";
import { formatThaiDateShort } from "@/lib/thai/date";
import { deleteBillingSlipAction } from "@/app/receipts/actions";
import { BillingPrintPickerDialog } from "@/components/forms/billing-print-picker";

export type ReceiptRow = {
  id: number;
  docNo: string;
  docDate: string;
  documentType: "billing_slip" | "receipt";
  customerCode: string | null;
  customerName: string | null;
  customerTaxId: string | null;
  customerAddress: string | null;
  customerTel: string | null;
  salemanName: string | null;
  memo: string | null;
  referenceDocNo: string | null;
  amountBeforeVat: number;
  vatAmount: number;
  total: number;
  netTotal: number;
  status: string;
  arStatus: string;
  createdAt: string;
  updatedAt: string;
};

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

function thaiMonthShort(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String((d.getFullYear() + 543) % 100).padStart(2, "0");
  return `${mm}/${yy}`;
}

function arStatusMeta(s: string) {
  const map: Record<string, { th: string; cls: string }> = {
    pending: { th: "รอชำระ", cls: "bg-amber-100 text-amber-700" },
    partial: { th: "ชำระบางส่วน", cls: "bg-amber-100 text-amber-700" },
    paid: { th: "ชำระแล้ว", cls: "bg-green-100 text-green-700" },
    overdue: { th: "เกินกำหนด", cls: "bg-red-100 text-red-700" },
    cancelled: { th: "ยกเลิก", cls: "bg-zinc-100 text-zinc-600" },
  };
  return map[s] ?? { th: s, cls: "bg-zinc-100" };
}

export function ReceiptTableWithDetail({
  rows,
  searchSlot,
  topActions,
}: {
  rows: ReceiptRow[];
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
        `ต้องการลบ ${selected.docNo} (${selected.customerName ?? ""}) ออกจากระบบ?\nการลบนี้ไม่สามารถย้อนกลับได้`,
      )
    )
      return;
    startTransition(async () => {
      const res = await deleteBillingSlipAction(selected.id);
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
                ? `ลบ ${selected.docNo} ออกจากระบบ`
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
        <BillingPrintPickerDialog
          docNo={selected.docNo}
          id={selected.id}
          onClose={() => setPrintOpen(false)}
        />
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">รายการใบวางบิล / ใบเสร็จรับเงิน</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-zinc-500">
              ยังไม่มีใบวางบิล / ใบเสร็จรับเงิน
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b bg-sky-100 text-left text-xs text-sky-900">
                <tr>
                  <th className="px-3 py-2.5 font-medium">รหัส / เลขผู้เสียภาษี</th>
                  <th className="px-3 py-2.5 font-medium">รายชื่อผู้ประกอบการ</th>
                  <th className="px-3 py-2.5 font-medium">เลขที่ใบวางบิล</th>
                  <th className="px-3 py-2.5 font-medium">วันที่วางบิล</th>
                  <th className="px-3 py-2.5 font-medium">เดือนปี อ้างถึงเอกสาร</th>
                  <th className="px-3 py-2.5 font-medium">พนักงานขาย</th>
                  <th className="px-3 py-2.5 text-right font-medium">รวมยอดใบวางบิล</th>
                  <th className="px-3 py-2.5 font-medium">เลขที่ใบเสร็จรับเงิน</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => {
                  const isSel = r.id === selectedId;
                  return (
                    <tr
                      key={r.id}
                      onClick={() => setSelectedId(r.id)}
                      className={`cursor-pointer ${
                        isSel ? "bg-sky-100" : "hover:bg-sky-50"
                      }`}
                    >
                      <td className="px-3 py-2 font-mono text-xs">
                        {r.customerCode ?? r.customerTaxId ?? "-"}
                      </td>
                      <td
                        className="px-3 py-2 max-w-xs truncate cursor-pointer hover:text-blue-700 hover:underline"
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          router.push(`/receipts/${r.id}/edit`);
                        }}
                        title="ดับเบิลคลิกเพื่อแก้ไข"
                      >
                        {r.customerName ?? "-"}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {r.documentType === "billing_slip" ? r.docNo : "-"}
                      </td>
                      <td className="px-3 py-2 text-zinc-600">
                        {formatThaiDateShort(r.docDate)}
                      </td>
                      <td className="px-3 py-2 text-zinc-600 font-mono text-xs">
                        {thaiMonthShort(r.docDate)}
                      </td>
                      <td className="px-3 py-2 text-zinc-600">
                        {r.salemanName ?? "-"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatMoney(r.total)}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {r.documentType === "receipt" ? r.docNo : "-"}
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

      {selected && <DetailPanel r={selected} />}
    </div>
  );
}

function DetailPanel({ r }: { r: ReceiptRow }) {
  const addrLine = (r.customerAddress ?? "").replace(/\n/g, " ");
  const ar = arStatusMeta(r.arStatus);
  const isPaid = r.arStatus === "paid";
  const paidAmount = isPaid ? r.netTotal || r.total : 0;
  const remaining = Math.max(0, (r.total || 0) - paidAmount);

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_440px]">
      {/* LEFT: customer info (cyan) */}
      <div className="overflow-hidden rounded border border-cyan-300 bg-cyan-50 text-[12px]">
        <div className="grid grid-cols-[88px_1fr] gap-x-2 px-3 py-2">
          <div className="text-cyan-800">เลขที่</div>
          <div className="font-mono text-zinc-800">
            {r.customerCode ?? r.customerTaxId ?? "-"}
          </div>

          <div className="text-cyan-800">รายชื่อ</div>
          <div className="font-medium text-zinc-900">
            {r.customerName ?? "-"}
          </div>

          <div className="text-cyan-800">ที่อยู่</div>
          <div className="text-zinc-700">{addrLine || "-"}</div>

          <div className="text-cyan-800">หมายเหตุ2</div>
          <div className="text-zinc-700">{r.memo ?? "-"}</div>
        </div>
        <div className="border-t border-cyan-200 px-3 py-1.5 text-[11px] text-zinc-600">
          วันเดือนปี เวลา ที่สร้างเอกสาร{" "}
          <span className="font-mono text-zinc-800">
            {formatThaiDateTime(r.createdAt)}
          </span>
        </div>
        <div className="border-t border-cyan-200 px-3 py-1.5 text-[11px] text-zinc-600">
          วันเดือนปี เวลา ที่แก้ไขล่าสุด{" "}
          <span className="font-mono text-zinc-800">
            {formatThaiDateTime(r.updatedAt)}
          </span>
        </div>
      </div>

      {/* RIGHT: billing/receipt amounts (red border) */}
      <div className="overflow-hidden rounded border-2 border-rose-400 bg-white text-[12px]">
        <div className="grid grid-cols-[1fr_1fr] gap-x-3 gap-y-1.5 border-b border-rose-200 bg-rose-50 px-3 py-2">
          <div>
            <div className="text-[10px] text-rose-700">Billing Slip :</div>
            <div className="font-mono font-bold text-rose-900">
              {r.documentType === "billing_slip" ? r.docNo : "-"}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-rose-700">Receipt No. :</div>
            <div className="font-mono font-bold text-rose-900">
              {r.documentType === "receipt" ? r.docNo : "-"}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-rose-700">วันที่ใบวางบิล</div>
            <div className="font-mono text-zinc-800">
              {formatThaiDateShort(r.docDate)}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-rose-700">อ้างถึงเอกสาร</div>
            <div className="font-mono text-zinc-800">
              {r.referenceDocNo ?? "-"}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-rose-700">เดือนปีภาษี</div>
            <div className="font-mono text-zinc-800">{thaiMonthShort(r.docDate)}</div>
          </div>
          <div>
            <div className="text-[10px] text-rose-700">พนักงานขาย</div>
            <div className="text-zinc-800">{r.salemanName ?? "-"}</div>
          </div>
          <div className="col-span-2">
            <span
              className={`inline-block rounded px-2 py-0.5 text-[11px] font-medium ${ar.cls}`}
            >
              {ar.th}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 px-3 py-2">
          <div className="flex justify-between text-zinc-700">
            <span>รวมเป็นเงิน</span>
            <span className="tabular-nums">{formatMoney(r.amountBeforeVat)}</span>
          </div>
          <div className="flex justify-between text-zinc-700">
            <span>รวมค้างชำระ</span>
            <span className="tabular-nums">{formatMoney(remaining)}</span>
          </div>
          <div className="flex justify-between text-zinc-700">
            <span>ภาษีมูลค่าเพิ่ม</span>
            <span className="tabular-nums">{formatMoney(r.vatAmount)}</span>
          </div>
          <div className="flex justify-between text-zinc-700">
            <span>รวมยอดชำระ</span>
            <span className="tabular-nums font-bold">
              {formatMoney(paidAmount)}
            </span>
          </div>
          <div className="flex justify-between border-t pt-1 text-base font-bold text-rose-700">
            <span>รวมเงินทั้งสิ้น</span>
            <span className="tabular-nums">{formatMoney(r.total)}</span>
          </div>
          <div className="flex justify-between border-t pt-1 text-zinc-700">
            <span>รวมยอดใบเสร็จรับเงิน</span>
            <span className="tabular-nums">
              {r.documentType === "receipt"
                ? formatMoney(r.netTotal || r.total)
                : "0.00"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

