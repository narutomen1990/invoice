import Link from "next/link";
import { Search, Plus, Package } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getProductList } from "@/lib/queries/products";
import { formatMoney } from "@/lib/thai/number";

export const dynamic = "force-dynamic";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const rows = await getProductList({ q: sp.q });

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">สินค้า / บริการ</h1>
            <p className="text-sm text-zinc-500">ทั้งหมด {rows.length.toLocaleString()} รายการ</p>
          </div>
          <Link href="/products/new">
            <Button>
              <Plus className="h-4 w-4" />
              เพิ่มสินค้า
            </Button>
          </Link>
        </div>

        <Card>
          <CardContent className="p-4">
            <form className="grid grid-cols-12 gap-3" method="get">
              <div className="relative col-span-10">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <Input
                  name="q"
                  defaultValue={sp.q ?? ""}
                  placeholder="ค้นหารหัส / ชื่อสินค้า"
                  className="pl-9"
                />
              </div>
              <Button type="submit" className="col-span-2">
                ค้นหา
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            {rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Package className="mb-3 h-10 w-10 text-zinc-300" />
                <p className="text-sm text-zinc-500">ไม่พบสินค้า</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-zinc-50 text-left text-xs text-zinc-500">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">รหัส</th>
                      <th className="px-4 py-2.5 font-medium">ชื่อสินค้า/บริการ</th>
                      <th className="px-4 py-2.5 font-medium">หน่วย</th>
                      <th className="px-4 py-2.5 font-medium text-right">ราคา</th>
                      <th className="px-4 py-2.5 font-medium text-right">ขายไปกี่ใบ</th>
                      <th className="px-4 py-2.5 font-medium text-right">ยอดขายรวม</th>
                      <th className="px-4 py-2.5 font-medium">สถานะ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {rows.map((r) => (
                      <tr key={r.id} className="hover:bg-zinc-50">
                        <td className="px-4 py-2 font-mono text-xs">
                          <Link
                            href={`/products/${r.id}`}
                            className="text-blue-600 hover:underline"
                          >
                            {r.code}
                          </Link>
                        </td>
                        <td className="px-4 py-2">
                          <Link href={`/products/${r.id}`} className="hover:underline">
                            {r.name}
                          </Link>
                        </td>
                        <td className="px-4 py-2 text-zinc-600">{r.unit ?? "-"}</td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {formatMoney(r.price)}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums text-zinc-600">
                          {r.salesCount.toLocaleString()}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {formatMoney(r.salesTotal)}
                        </td>
                        <td className="px-4 py-2">
                          {r.isActive ? (
                            r.isService ? (
                              <Badge variant="secondary">บริการ</Badge>
                            ) : (
                              <Badge variant="success">ใช้งาน</Badge>
                            )
                          ) : (
                            <Badge variant="outline">ปิด</Badge>
                          )}
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
