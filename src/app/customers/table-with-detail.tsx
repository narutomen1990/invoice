"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/thai/number";
import { formatThaiDateShort } from "@/lib/thai/date";
import { Pencil, Plus, Trash2, Printer } from "lucide-react";

export type CustomerRow = {
  id: number;
  code: string;
  name: string;
  taxId: string | null;
  branch: string | null;
  province: string | null;
  tel: string | null;
  address1: string | null;
  address2: string | null;
  address3: string | null;
  defaultSalemanName: string | null;
  invoiceCount: number;
  invoiceTotal: number;
  lastInvoiceDate: string | null;
  lastProductName: string | null;
};

export function CustomerTableWithDetail({ rows }: { rows: CustomerRow[] }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<number | null>(
    rows[0]?.id ?? null,
  );
  const selected = rows.find((r) => r.id === selectedId) ?? rows[0] ?? null;

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_220px]">
      {/* LEFT: table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">รายชื่อผู้ประกอบการในระบบ</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-zinc-500">
              ไม่พบลูกค้าตามเงื่อนไข
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-sky-100 text-left text-xs text-sky-900">
                  <tr>
                    <th className="px-3 py-2.5 font-medium">รหัสลูกค้า</th>
                    <th className="px-3 py-2.5 font-medium">รายชื่อลูกค้า</th>
                    <th className="px-3 py-2.5 font-medium">ที่อยู่ลูกค้า1</th>
                    <th className="px-3 py-2.5 font-medium">ที่อยู่ลูกค้า2</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((r) => {
                    const isSel = r.id === selectedId;
                    return (
                      <tr
                        key={r.id}
                        onClick={() => setSelectedId(r.id)}
                        onDoubleClick={() => router.push(`/customers/${r.id}`)}
                        title="ดับเบิลคลิกเพื่อดูรายละเอียด"
                        className={`cursor-pointer ${
                          isSel ? "bg-sky-100" : "hover:bg-sky-50"
                        }`}
                      >
                        <td className="px-3 py-2 font-mono text-xs">
                          {r.code}
                        </td>
                        <td className="px-3 py-2 max-w-xs truncate" title={r.name}>
                          {r.name}
                        </td>
                        <td
                          className="px-3 py-2 max-w-[260px] truncate text-zinc-600"
                          title={r.address1 ?? ""}
                        >
                          {r.address1 ?? "-"}
                        </td>
                        <td
                          className="px-3 py-2 max-w-[200px] truncate text-zinc-600"
                          title={r.address2 ?? ""}
                        >
                          {r.address2 ?? "-"}
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
          <Link href={`/customers/${selected.id}/edit`} className="block">
            <Button className="w-full justify-start bg-emerald-500 text-white hover:bg-emerald-600">
              <Pencil className="h-4 w-4" />
              Edit แก้ไข
            </Button>
          </Link>
        )}
        <Link href="/customers/new" className="block">
          <Button className="w-full justify-start bg-emerald-500 text-white hover:bg-emerald-600">
            <Plus className="h-4 w-4" />
            Add รายการเพิ่ม
          </Button>
        </Link>
        <Button
          type="button"
          disabled={!selected}
          onClick={() => {
            if (!selected) return;
            if (confirm(`ลบลูกค้า ${selected.code} – ${selected.name}?`)) {
              alert("ฟีเจอร์ลบลูกค้ายังไม่เปิดใช้งาน — โปรดติดต่อผู้ดูแล");
            }
          }}
          className="w-full justify-start bg-rose-500 text-white hover:bg-rose-600"
        >
          <Trash2 className="h-4 w-4" />
          ลบ Record ปัจจุบัน
        </Button>

        <Button
          type="button"
          onClick={() => window.print()}
          className="mt-3 w-full justify-start bg-cyan-500 text-white hover:bg-cyan-600"
        >
          <Printer className="h-4 w-4" />
          พิมพ์รายชื่อ
        </Button>
        <Link href="/" className="block">
          <Button className="w-full justify-start bg-blue-700 text-white hover:bg-blue-800">
            ESC ออก
          </Button>
        </Link>
      </div>

      {/* Detail bar — spans both columns */}
      {selected && (
        <div className="lg:col-span-2">
          <DetailPanel cust={selected} />
        </div>
      )}
    </div>
  );
}

function DetailPanel({ cust }: { cust: CustomerRow }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_360px]">
      {/* LEFT: customer info (cyan) */}
      <div className="overflow-hidden rounded border border-cyan-300 bg-cyan-50 text-[12px]">
        <div className="grid grid-cols-[88px_120px_70px_1fr] gap-x-2 px-3 py-2">
          <div className="text-cyan-800">รหัส</div>
          <div className="font-mono text-zinc-900">{cust.code}</div>
          <div className="text-cyan-800">สาขาที่</div>
          <div className="font-mono text-zinc-800">
            {cust.branch ?? "-"}
          </div>

          <div className="text-cyan-800">เลขผู้เสียภาษี</div>
          <div className="col-span-3 font-mono text-zinc-800">
            {cust.taxId ?? "-"}
          </div>

          <div className="text-cyan-800">รายชื่อลูกค้า</div>
          <div className="col-span-3 font-medium text-zinc-900">
            {cust.name}
          </div>

          <div className="text-cyan-800">ที่อยู่ 1</div>
          <div className="col-span-3 text-zinc-700">
            {cust.address1 ?? "-"}
          </div>

          <div className="text-cyan-800">ที่อยู่ 2</div>
          <div className="col-span-3 text-zinc-700">
            {cust.address2 ?? "-"}
          </div>

          <div className="text-cyan-800">ที่อยู่ 3</div>
          <div className="col-span-3 text-zinc-700">
            {cust.address3 ?? "-"}
          </div>
        </div>
      </div>

      {/* RIGHT: latest order summary (rose border) */}
      <div className="overflow-hidden rounded border-2 border-rose-400 bg-white text-[12px]">
        <div className="grid grid-cols-[110px_1fr] gap-x-2 gap-y-1.5 border-b border-rose-200 bg-rose-50 px-3 py-2">
          <div className="text-rose-700">รายการสินค้า</div>
          <div className="font-medium text-zinc-900">
            {cust.lastProductName ?? "-"}
          </div>
          <div className="text-rose-700">ชื่อผู้ขาย</div>
          <div className="text-zinc-900">{cust.defaultSalemanName ?? "-"}</div>
          <div className="text-rose-700">โทรศัพท์</div>
          <div className="font-mono text-zinc-900">{cust.tel ?? "-"}</div>
        </div>
        <div className="grid grid-cols-2 gap-x-2 gap-y-1 px-3 py-2">
          <div className="text-zinc-600">ใบกำกับทั้งหมด</div>
          <div className="text-right tabular-nums text-zinc-900">
            {cust.invoiceCount.toLocaleString()} ใบ
          </div>
          <div className="text-zinc-600">ยอดรวมสะสม</div>
          <div className="text-right tabular-nums text-zinc-900">
            {formatMoney(cust.invoiceTotal)}
          </div>
          <div className="text-zinc-600">ใบล่าสุด</div>
          <div className="text-right tabular-nums text-zinc-700">
            {cust.lastInvoiceDate
              ? formatThaiDateShort(cust.lastInvoiceDate)
              : "-"}
          </div>
        </div>
      </div>
    </div>
  );
}
