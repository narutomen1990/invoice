import Link from "next/link";
import { Search, Plus, ReceiptText } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getWithholdingList } from "@/lib/queries/withholding";
import { whtFormLabel } from "@/lib/withholding/constants";
import { formatMoney } from "@/lib/thai/number";
import { formatThaiDateShort } from "@/lib/thai/date";
import { WhtRowActions } from "./row-actions";

export const dynamic = "force-dynamic";

export default async function WithholdingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const result = await getWithholdingList({ q: sp.q });

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              หนังสือรับรองหัก ณ ที่จ่าย
            </h1>
            <p className="text-sm text-zinc-500">
              50 ทวิ — ทั้งหมด {result.total.toLocaleString()} ฉบับ
            </p>
          </div>
          <Link href="/withholding/new">
            <Button variant="save">
              <Plus className="h-4 w-4" />
              สร้างใหม่
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
                  placeholder="ค้นหาเลขที่ / ผู้หักภาษี / ผู้ถูกหักภาษี"
                  className="pl-9"
                />
              </div>
              <Button type="submit" variant="search" className="col-span-2">
                ค้นหา
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Summary */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-zinc-500">จำนวนเอกสาร</div>
              <div className="text-2xl font-bold">
                {result.total.toLocaleString()}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-zinc-500">ยอดจ่ายรวม</div>
              <div className="text-2xl font-bold">
                ฿{formatMoney(result.sumPaid)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-zinc-500">ภาษีหักรวม</div>
              <div className="text-2xl font-bold">
                ฿{formatMoney(result.sumTax)}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="p-0">
            {result.rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <ReceiptText className="mb-3 h-10 w-10 text-zinc-300" />
                <p className="text-sm text-zinc-500">ยังไม่มีเอกสาร</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-zinc-50 text-left text-xs text-zinc-500">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">เลขที่</th>
                      <th className="px-4 py-2.5 font-medium">วันที่</th>
                      <th className="px-4 py-2.5 font-medium">แบบ</th>
                      <th className="px-4 py-2.5 font-medium">ผู้หักภาษี</th>
                      <th className="px-4 py-2.5 font-medium">ผู้ถูกหักภาษี</th>
                      <th className="px-4 py-2.5 font-medium text-right">
                        ยอดจ่าย
                      </th>
                      <th className="px-4 py-2.5 font-medium text-right">
                        ภาษีหัก
                      </th>
                      <th className="px-4 py-2.5 font-medium text-right">
                        จัดการ
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {result.rows.map((r) => (
                      <tr key={r.id} className="hover:bg-zinc-50">
                        <td className="px-4 py-2 font-mono text-xs">
                          <Link
                            href={`/withholding/${r.id}/edit`}
                            className="text-blue-600 hover:underline"
                          >
                            {r.docNo}
                          </Link>
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-zinc-600">
                          {formatThaiDateShort(r.issueDate)}
                        </td>
                        <td className="px-4 py-2">
                          <Badge variant="secondary">
                            {whtFormLabel(r.formType)}
                          </Badge>
                        </td>
                        <td
                          className="px-4 py-2 max-w-[200px] truncate"
                          title={r.payerName}
                        >
                          {r.payerName}
                        </td>
                        <td
                          className="px-4 py-2 max-w-[200px] truncate"
                          title={r.payeeName}
                        >
                          {r.payeeName}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {formatMoney(r.totalPaid)}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums font-medium">
                          {formatMoney(r.totalTax)}
                        </td>
                        <td className="px-4 py-2">
                          <WhtRowActions id={r.id} docNo={r.docNo} />
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
