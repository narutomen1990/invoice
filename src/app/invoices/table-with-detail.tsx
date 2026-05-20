"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Pencil, Plus, FileMinus, Trash2, Printer } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/thai/number";
import { formatThaiDateShort } from "@/lib/thai/date";
import { InvoicePrintPickerDialog } from "@/components/forms/invoice-print-picker";

export type InvoiceRow = {
  id: number;
  docNo: string;
  internalSeq: string | null;
  docDate: string;
  customerCode: string | null;
  customerName: string | null;
  customerTaxId: string | null;
  customerAddress: string | null;
  customerTel: string | null;
  salemanName: string | null;
  memo: string | null;
  referenceQuotationNo: string | null;
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

function thaiPeriod(iso: string | null): string {
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

export function InvoiceTableWithDetail({
  rows,
}: {
  rows: InvoiceRow[];
  /** @deprecated retained for API compat; right-side buttons are rendered internally */
  topActions?: React.ReactNode;
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<number | null>(
    rows[0]?.id ?? null,
  );
  const [printOpen, setPrintOpen] = useState(false);
  const selected = rows.find((r) => r.id === selectedId) ?? rows[0] ?? null;

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_220px]">
      {/* LEFT: table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">รายการใบกำกับภาษีขายในระบบ</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-zinc-500">
              ไม่พบใบกำกับภาษีขายตามเงื่อนไข
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-sky-100 text-left text-xs text-sky-900">
                  <tr>
                    <th className="px-3 py-2.5 font-medium">Document No.</th>
                    <th className="px-3 py-2.5 font-medium">รหัสลูกค้า</th>
                    <th className="px-3 py-2.5 font-medium">รายชื่อลูกค้า</th>
                    <th className="px-3 py-2.5 font-medium">TAX INVOICE</th>
                    <th className="px-3 py-2.5 font-medium">วันที่ในใบกำกับ</th>
                    <th className="px-3 py-2.5 font-medium">เดือนปี</th>
                    <th className="px-3 py-2.5 font-medium">เอกสารอ้างอิง</th>
                    <th className="px-3 py-2.5 font-medium">พนักงานขาย</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((r) => {
                    const isSel = r.id === selectedId;
                    return (
                      <tr
                        key={r.id}
                        onClick={() => setSelectedId(r.id)}
                        onDoubleClick={() =>
                          router.push(`/invoices/${r.id}/edit`)
                        }
                        title="ดับเบิลคลิกเพื่อแก้ไข"
                        className={`cursor-pointer ${
                          isSel ? "bg-sky-100" : "hover:bg-sky-50"
                        }`}
                      >
                        <td className="px-3 py-2 font-mono text-xs">
                          {r.internalSeq ?? "-"}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">
                          {r.customerCode ?? "-"}
                        </td>
                        <td className="px-3 py-2 max-w-xs truncate">
                          {r.customerName ?? "-"}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-blue-700">
                          {r.docNo}
                        </td>
                        <td className="px-3 py-2 text-zinc-600">
                          {formatThaiDateShort(r.docDate)}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-zinc-600">
                          {thaiPeriod(r.docDate)}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-zinc-600">
                          {r.referenceQuotationNo ?? "-"}
                        </td>
                        <td className="px-3 py-2 text-zinc-600">
                          {r.salemanName ?? "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* RIGHT: legacy-style action buttons */}
      <div className="space-y-2">
        {selected && (
          <Link href={`/invoices/${selected.id}/edit`} className="block">
            <Button className="w-full justify-start bg-emerald-500 text-white hover:bg-emerald-600">
              <Pencil className="h-4 w-4" />
              Edit แก้ไข
            </Button>
          </Link>
        )}
        <Link href="/invoices/new" className="block">
          <Button className="w-full justify-start bg-emerald-500 text-white hover:bg-emerald-600">
            <Plus className="h-4 w-4" />
            Add ใบกำกับขาย
          </Button>
        </Link>
        <Link
          href={
            selected
              ? `/credit-notes/new?fromInvoice=${selected.id}`
              : "/credit-notes/new"
          }
          className="block"
          title={
            selected
              ? `สร้างใบลดหนี้จาก ${selected.docNo}`
              : "สร้างใบลดหนี้ใบใหม่"
          }
        >
          <Button className="w-full justify-start bg-emerald-500 text-white hover:bg-emerald-600">
            <FileMinus className="h-4 w-4" />
            Add ใบลดหนี้
          </Button>
        </Link>
        <Button
          type="button"
          disabled={!selected}
          onClick={() => {
            if (!selected) return;
            if (
              confirm(
                `ลบใบกำกับ ${selected.docNo} ของ ${selected.customerName ?? ""}?`,
              )
            ) {
              alert("ฟีเจอร์ลบใบกำกับยังไม่เปิดใช้งาน — โปรดติดต่อผู้ดูแล");
            }
          }}
          className="w-full justify-start bg-rose-500 text-white hover:bg-rose-600"
        >
          <Trash2 className="h-4 w-4" />
          ลบ Record ปัจจุบัน
        </Button>

        <Button
          type="button"
          disabled={!selected}
          onClick={() => {
            if (!selected) return;
            setPrintOpen(true);
          }}
          title={
            selected
              ? `เลือกแบบฟอร์มเพื่อพิมพ์ ${selected.docNo}`
              : "เลือกแถวในตารางก่อน"
          }
          className="mt-3 w-full justify-start bg-cyan-500 text-white hover:bg-cyan-600 disabled:opacity-50"
        >
          <Printer className="h-4 w-4" />
          พิมพ์กระดาษ A4
        </Button>
        <Link href="/" className="block">
          <Button className="w-full justify-start bg-blue-700 text-white hover:bg-blue-800">
            ESC ออก
          </Button>
        </Link>
      </div>

      {/* Detail panel — spans both columns */}
      {selected && (
        <div className="lg:col-span-2">
          <DetailPanel inv={selected} />
        </div>
      )}

      {printOpen && selected && (
        <InvoicePrintPickerDialog
          docNo={selected.docNo}
          internalSeq={selected.internalSeq}
          id={selected.id}
          onClose={() => setPrintOpen(false)}
        />
      )}
    </div>
  );
}

function DetailPanel({ inv }: { inv: InvoiceRow }) {
  const addrLine = (inv.customerAddress ?? "").replace(/\n/g, " ");
  const ar = arStatusMeta(inv.arStatus);

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_440px]">
      {/* LEFT: customer info (cyan) */}
      <div className="overflow-hidden rounded border border-cyan-300 bg-cyan-50 text-[12px]">
        <div className="grid grid-cols-[88px_1fr] gap-x-2 px-3 py-2">
          <div className="text-cyan-800">เลขที่</div>
          <div className="font-mono text-zinc-800">
            {inv.internalSeq ?? "-"}
          </div>

          <div className="text-cyan-800">รายชื่อ</div>
          <div className="font-medium text-zinc-900">
            {inv.customerName ?? "-"}
          </div>

          <div className="text-cyan-800">ที่อยู่</div>
          <div className="text-zinc-700">{addrLine || "-"}</div>

          <div className="text-cyan-800">หมายเหตุ2</div>
          <div className="text-zinc-700">{inv.memo ?? "-"}</div>
        </div>
        <div className="border-t border-cyan-200 px-3 py-1.5 text-[11px] text-zinc-600">
          วันเดือนปี เวลา ที่สร้างเอกสาร{" "}
          <span className="font-mono text-zinc-800">
            {formatThaiDateTime(inv.createdAt)}
          </span>
        </div>
        <div className="border-t border-cyan-200 px-3 py-1.5 text-[11px] text-zinc-600">
          วันเดือนปี เวลา ที่แก้ไขล่าสุด{" "}
          <span className="font-mono text-zinc-800">
            {formatThaiDateTime(inv.updatedAt)}
          </span>
        </div>
      </div>

      {/* RIGHT: Invoice amounts (red border) */}
      <div className="overflow-hidden rounded border-2 border-rose-400 bg-white text-[12px]">
        <div className="grid grid-cols-[1fr_1fr] gap-x-3 gap-y-1.5 border-b border-rose-200 bg-rose-50 px-3 py-2">
          <div>
            <div className="text-[10px] text-rose-700">Invoice :</div>
            <div className="font-mono font-bold text-rose-900">{inv.docNo}</div>
          </div>
          <div>
            <div className="text-[10px] text-rose-700">เอกสารอ้างอิง</div>
            <div className="font-mono font-medium text-zinc-800">
              {inv.referenceQuotationNo ?? "-"}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-rose-700">วันที่ในใบกำกับ</div>
            <div className="font-mono text-zinc-800">
              {formatThaiDateShort(inv.docDate)}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-rose-700">พนักงานขาย</div>
            <div className="text-zinc-800">{inv.salemanName ?? "-"}</div>
          </div>
          <div>
            <div className="text-[10px] text-rose-700">เดือนปีภาษี</div>
            <div className="font-mono text-zinc-800">
              {thaiPeriod(inv.docDate)}
            </div>
          </div>
          <div>
            <span
              className={`inline-block rounded px-2 py-0.5 text-[11px] font-medium ${ar.cls}`}
            >
              {ar.th}
            </span>
          </div>
        </div>
        <div className="space-y-1 px-3 py-2">
          <div className="flex justify-between text-zinc-700">
            <span>รวมเป็นเงิน</span>
            <span className="tabular-nums">
              {formatMoney(inv.amountBeforeVat)}
            </span>
          </div>
          <div className="flex justify-between text-zinc-700">
            <span>ภาษีมูลค่าเพิ่ม</span>
            <span className="tabular-nums">{formatMoney(inv.vatAmount)}</span>
          </div>
          <div className="flex justify-between border-t pt-1 text-base font-bold text-rose-700">
            <span>รวมเงินทั้งสิ้น</span>
            <span className="tabular-nums">{formatMoney(inv.total)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
