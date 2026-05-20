"use client";

import { useEffect, useState, useTransition } from "react";
import { Search, X, FileSpreadsheet } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  listQuotationsForPickerAction,
  getQuotationForPickerAction,
  type QuotationListItem,
  type QuotationPickerDetail,
} from "@/app/quotations/actions";
import { formatMoney } from "@/lib/thai/number";
import { formatThaiDateShort } from "@/lib/thai/date";

export function QuotationPickerDialog({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (q: QuotationPickerDetail) => void;
}) {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<QuotationListItem[]>([]);
  const [loading, startSearch] = useTransition();
  const [picking, startPick] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      startSearch(async () => {
        setError(null);
        try {
          const data = await listQuotationsForPickerAction(query);
          setRows(data);
        } catch (e: any) {
          setError(e?.message ?? "โหลดข้อมูลไม่สำเร็จ");
        }
      });
    }, 200);
    return () => clearTimeout(t);
  }, [query, open]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setRows([]);
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  function handlePick(id: number) {
    startPick(async () => {
      const detail = await getQuotationForPickerAction(id);
      if (!detail) {
        setError("ไม่พบข้อมูลใบเสนอราคา");
        return;
      }
      onPick(detail);
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-white shadow-xl">
        {/* TITLE BAR */}
        <div className="flex items-center justify-between border-b border-amber-300 bg-gradient-to-b from-amber-200 to-amber-100 px-4 py-2.5">
          <div className="flex items-center gap-2 text-base font-bold text-amber-900">
            <FileSpreadsheet className="h-5 w-5" />
            เลือกใบเสนอราคาเพื่อแปลงเป็นใบกำกับภาษี
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-amber-800 hover:bg-amber-200/60"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* SEARCH */}
        <div className="border-b bg-amber-50/30 px-4 py-2.5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-700" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="พิมพ์เลขที่ / ชื่อลูกค้า เพื่อค้นหา..."
              className="pl-9 bg-white"
            />
          </div>
          <p className="mt-1 text-[11px] text-zinc-500">
            คลิกแถวที่ต้องการเพื่อนำข้อมูลมาใส่ในใบกำกับภาษี
          </p>
        </div>

        {/* TABLE */}
        <div className="flex-1 overflow-auto">
          {error && (
            <div className="m-3 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
              {error}
            </div>
          )}
          {loading ? (
            <div className="px-4 py-12 text-center text-sm text-zinc-500">
              กำลังโหลด...
            </div>
          ) : rows.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-zinc-500">
              ไม่พบใบเสนอราคา
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 border-b bg-amber-100 text-left text-xs text-amber-900">
                <tr>
                  <th className="px-4 py-2 font-medium">เลขที่ใบเสนอราคา</th>
                  <th className="px-4 py-2 font-medium">วันที่</th>
                  <th className="px-4 py-2 font-medium">ลูกค้า</th>
                  <th className="px-4 py-2 text-right font-medium">รวม</th>
                  <th className="px-4 py-2 font-medium">สถานะ</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => handlePick(r.id)}
                    className="cursor-pointer hover:bg-amber-50"
                  >
                    <td className="px-4 py-2 font-mono text-xs text-amber-700">
                      {r.docNo}
                    </td>
                    <td className="px-4 py-2 text-zinc-600">
                      {formatThaiDateShort(r.docDate)}
                    </td>
                    <td className="px-4 py-2 max-w-xs truncate">
                      {r.customerName ?? "-"}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {formatMoney(r.total)}
                    </td>
                    <td className="px-4 py-2">
                      <span className="rounded bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-700">
                        ออกแล้ว
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Button
                        type="button"
                        size="sm"
                        className="bg-amber-600 hover:bg-amber-700"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePick(r.id);
                        }}
                        disabled={picking}
                      >
                        เลือก
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* FOOTER */}
        <div className="flex items-center justify-end gap-2 border-t bg-zinc-50 px-4 py-2.5">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            ปิด
          </Button>
        </div>
      </div>
    </div>
  );
}
