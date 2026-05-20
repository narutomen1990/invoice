import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil, Package } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getProductById } from "@/lib/queries/products";
import { formatMoney } from "@/lib/thai/number";
import { formatThaiDateShort } from "@/lib/thai/date";

export const dynamic = "force-dynamic";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numId = parseInt(id, 10);
  if (Number.isNaN(numId)) notFound();
  const p = await getProductById(numId);
  if (!p) notFound();

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/products">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold">{p.name}</h1>
                {p.isService && <Badge variant="secondary">บริการ</Badge>}
                {!p.isActive && <Badge variant="outline">ปิดใช้งาน</Badge>}
              </div>
              <p className="text-sm text-zinc-500 font-mono">รหัส {p.code}</p>
            </div>
          </div>
          <Link href={`/products/${p.id}/edit`}>
            <Button variant="outline" size="sm">
              <Pencil className="h-4 w-4" />
              แก้ไข
            </Button>
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-zinc-500">ราคาขาย</div>
              <div className="text-2xl font-bold">฿{formatMoney(p.price)}</div>
              <div className="text-xs text-zinc-500">{p.unit ?? "-"}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-zinc-500">ยอดขายสะสม</div>
              <div className="text-2xl font-bold">฿{formatMoney(p.stats.totalAmount)}</div>
              <div className="text-xs text-zinc-500">
                {formatMoney(p.stats.totalSold, 2)} {p.unit ?? ""}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-zinc-500">จำนวนใบกำกับ</div>
              <div className="text-2xl font-bold">
                {p.stats.distinctInvoices.toLocaleString()}
              </div>
              <div className="text-xs text-zinc-500">ใบ</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-zinc-500">ขายล่าสุด</div>
              <div className="text-base font-bold">
                {p.stats.lastSold ? formatThaiDateShort(p.stats.lastSold) : "-"}
              </div>
              <div className="text-xs text-zinc-500">
                ครั้งแรก{" "}
                {p.stats.firstSold ? formatThaiDateShort(p.stats.firstSold) : "-"}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Profile + Yearly */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>ข้อมูลสินค้า</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div>
                <div className="text-xs text-zinc-400">ชื่อ (ไทย)</div>
                <div>{p.name}</div>
              </div>
              <div>
                <div className="text-xs text-zinc-400">ชื่อ (อังกฤษ)</div>
                <div>{p.nameEn ?? "-"}</div>
              </div>
              <div>
                <div className="text-xs text-zinc-400">รหัส</div>
                <div className="font-mono">{p.code}</div>
              </div>
              <div>
                <div className="text-xs text-zinc-400">หน่วย</div>
                <div>{p.unit ?? "-"}</div>
              </div>
              <div>
                <div className="text-xs text-zinc-400">ราคา</div>
                <div className="tabular-nums">฿{formatMoney(p.price)}</div>
              </div>
              <div>
                <div className="text-xs text-zinc-400">ประเภท</div>
                <div>{p.isService ? "บริการ" : "สินค้า"}</div>
              </div>
              {p.notes && (
                <div className="col-span-2">
                  <div className="text-xs text-zinc-400">หมายเหตุ</div>
                  <div className="whitespace-pre-line">{p.notes}</div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>ยอดรายปี</CardTitle>
            </CardHeader>
            <CardContent>
              {p.yearly.length === 0 ? (
                <p className="text-sm text-zinc-400">ยังไม่มียอดขาย</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-zinc-500">
                    <tr>
                      <th className="pb-2">ปี</th>
                      <th className="pb-2 text-right">จำนวน</th>
                      <th className="pb-2 text-right">ยอด</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {p.yearly.map((y) => (
                      <tr key={y.y}>
                        <td className="py-1.5 font-medium">{y.y}</td>
                        <td className="py-1.5 text-right tabular-nums text-zinc-600">
                          {formatMoney(y.qty, 0)}
                        </td>
                        <td className="py-1.5 text-right tabular-nums">
                          {formatMoney(y.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent sales */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              การขายล่าสุด (สูงสุด 30 ครั้ง)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {p.recent.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-zinc-400">ยังไม่มีการขาย</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-zinc-50 text-left text-xs text-zinc-500">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">เลขที่</th>
                      <th className="px-4 py-2.5 font-medium">วันที่</th>
                      <th className="px-4 py-2.5 font-medium">ลูกค้า</th>
                      <th className="px-4 py-2.5 font-medium text-right">จำนวน</th>
                      <th className="px-4 py-2.5 font-medium text-right">ราคา/หน่วย</th>
                      <th className="px-4 py-2.5 font-medium text-right">รวม</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {p.recent.map((r) => (
                      <tr key={`${r.invoiceId}-${r.docNo}`} className="hover:bg-zinc-50">
                        <td className="px-4 py-2 font-mono text-xs">
                          <Link
                            href={`/invoices/${r.invoiceId}`}
                            className="text-blue-600 hover:underline"
                          >
                            {r.docNo}
                          </Link>
                        </td>
                        <td className="px-4 py-2 text-zinc-600">
                          {formatThaiDateShort(r.docDate)}
                        </td>
                        <td className="px-4 py-2 max-w-xs truncate" title={r.customer ?? ""}>
                          {r.customer ?? "-"}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {formatMoney(r.quantity, 2)}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums text-zinc-600">
                          {formatMoney(r.unitPrice)}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {formatMoney(r.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
