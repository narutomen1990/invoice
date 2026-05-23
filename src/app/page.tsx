import Link from "next/link";
import {
  FileText,
  Users,
  Package,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MonthlyBarChart } from "@/components/charts/monthly-bar";
import { getDashboardStats } from "@/lib/queries/dashboard";
import { formatMoney } from "@/lib/thai/number";
import { formatThaiDateShort } from "@/lib/thai/date";

export const dynamic = "force-dynamic";

function Trend({ cur, prev }: { cur: number; prev: number }) {
  if (prev === 0) {
    return <span className="text-xs text-zinc-500">— เทียบเดือนก่อนไม่ได้</span>;
  }
  const diff = cur - prev;
  const pct = (diff / prev) * 100;
  const Icon = pct > 0 ? TrendingUp : pct < 0 ? TrendingDown : Minus;
  const color = pct > 0 ? "text-green-600" : pct < 0 ? "text-red-600" : "text-zinc-500";
  return (
    <span className={`flex items-center gap-1 text-xs ${color}`}>
      <Icon className="h-3 w-3" />
      {pct > 0 ? "+" : ""}
      {pct.toFixed(1)}% เทียบเดือนก่อน
    </span>
  );
}

export default async function HomePage() {
  const s = await getDashboardStats();

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-zinc-500">
            สรุปยอดล่าสุด ณ เดือน {s.current.monthLabel || "-"}
          </p>
        </div>

        {/* ===== Top KPI cards ===== */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-500">
                ยอดเดือนนี้
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="text-2xl font-bold">
                ฿{formatMoney(s.current.total)}
              </div>
              <div className="text-xs text-zinc-500">{s.current.count} ใบ</div>
              <Trend cur={s.current.total} prev={s.previous.total} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-500">
                VAT เดือนนี้
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">฿{formatMoney(s.current.vat)}</div>
              <div className="text-xs text-zinc-500">7%</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium text-zinc-500">
                ใบกำกับทั้งหมด
              </CardTitle>
              <FileText className="h-4 w-4 text-zinc-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {s.totals.documents.toLocaleString()}
              </div>
              <div className="text-xs text-zinc-500">
                ยอดสะสม ฿{formatMoney(s.totals.grandTotal)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium text-zinc-500">
                ลูกค้า / สินค้า
              </CardTitle>
              <Users className="h-4 w-4 text-zinc-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {s.totals.customers.toLocaleString()}
              </div>
              <div className="text-xs text-zinc-500 flex items-center gap-1">
                <Package className="h-3 w-3" />
                {s.totals.products} รายการสินค้า
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ===== Monthly chart ===== */}
        <Card>
          <CardHeader>
            <CardTitle>ยอดขาย 12 เดือนย้อนหลัง</CardTitle>
          </CardHeader>
          <CardContent>
            <MonthlyBarChart rows={s.monthly} />
          </CardContent>
        </Card>

        {/* ===== Yearly + Top customers ===== */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>ยอดรายปี</CardTitle>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-zinc-500">
                  <tr>
                    <th className="pb-2">ปี</th>
                    <th className="pb-2 text-right">ใบ</th>
                    <th className="pb-2 text-right">ยอดรวม (บาท)</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {s.yearly.slice(-10).reverse().map((r) => (
                    <tr key={r.y}>
                      <td className="py-1.5 font-medium">{r.y}</td>
                      <td className="py-1.5 text-right text-zinc-600">
                        {r.count.toLocaleString()}
                      </td>
                      <td className="py-1.5 text-right tabular-nums">
                        {formatMoney(r.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top 10 ลูกค้า (ปี {s.current.monthStart?.slice(0, 4) || "-"})</CardTitle>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-zinc-500">
                  <tr>
                    <th className="pb-2">ลูกค้า</th>
                    <th className="pb-2 text-right">ใบ</th>
                    <th className="pb-2 text-right">ยอด (บาท)</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {s.topCustomers.map((c, i) => (
                    <tr key={i}>
                      <td className="py-1.5 max-w-0 truncate" title={c.name}>
                        {c.name}
                      </td>
                      <td className="py-1.5 text-right text-zinc-600">{c.count}</td>
                      <td className="py-1.5 text-right tabular-nums">
                        {formatMoney(c.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>

        {/* ===== Recent + Top products ===== */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>ใบกำกับล่าสุด</CardTitle>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-zinc-500">
                  <tr>
                    <th className="pb-2">เลขที่</th>
                    <th className="pb-2">วันที่</th>
                    <th className="pb-2">ลูกค้า</th>
                    <th className="pb-2 text-right">รวม (บาท)</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {s.recent.map((r) => (
                    <tr key={r.id}>
                      <td className="py-1.5 font-mono text-xs">
                        <Link
                          href={`/invoices/${r.id}`}
                          className="text-blue-600 hover:underline"
                        >
                          {r.docNo}
                        </Link>
                      </td>
                      <td className="py-1.5 text-zinc-600">
                        {formatThaiDateShort(r.docDate)}
                      </td>
                      <td className="py-1.5 max-w-0 truncate" title={r.customer}>
                        {r.customer}
                      </td>
                      <td className="py-1.5 text-right tabular-nums">
                        {formatMoney(r.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top 10 สินค้า (ปีนี้)</CardTitle>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-zinc-500">
                  <tr>
                    <th className="pb-2">สินค้า</th>
                    <th className="pb-2 text-right">ยอด</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {s.topProducts.map((p, i) => (
                    <tr key={i}>
                      <td className="py-1.5 max-w-0 truncate" title={p.name ?? ""}>
                        <div className="font-medium">{p.name || "-"}</div>
                        {p.code && (
                          <div className="text-[10px] text-zinc-400">{p.code}</div>
                        )}
                      </td>
                      <td className="py-1.5 text-right tabular-nums">
                        {formatMoney(p.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
