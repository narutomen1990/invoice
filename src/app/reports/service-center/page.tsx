import Link from "next/link";
import { ArrowLeft, FileSpreadsheet, Download } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getServiceCenterTaxMonthly } from "@/lib/queries/reports";
import { formatMoney } from "@/lib/thai/number";
import { formatThaiDateShort, THAI_MONTHS_FULL } from "@/lib/thai/date";

export const dynamic = "force-dynamic";

function branchLabel(code: string | null): string {
  if (!code) return "";
  const c = code.trim();
  if (!c || c === "00000") return "สำนักงานใหญ่";
  const n = parseInt(c, 10);
  if (n === 0) return "สำนักงานใหญ่";
  if (Number.isNaN(n)) return c;
  return `สาขา ${n}`;
}

function statusMeta(s: string) {
  const map: Record<string, { th: string; cls: string }> = {
    draft: { th: "ร่าง", cls: "bg-orange-100 text-orange-700" },
    issued: { th: "ออกแล้ว", cls: "bg-green-100 text-green-700" },
    cancelled: { th: "ยกเลิก", cls: "bg-zinc-100 text-zinc-600" },
    voided: { th: "โมฆะ", cls: "bg-zinc-100 text-zinc-600" },
  };
  return map[s] ?? { th: s, cls: "bg-zinc-100" };
}

export default async function ServiceCenterTaxPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const result = await getServiceCenterTaxMonthly({ year: sp.year, month: sp.month });
  const isFiltered = !!(sp.year && sp.month);

  const xlsxHref =
    sp.year && sp.month
      ? `/api/reports/service-center.xlsx?year=${sp.year}&month=${sp.month}`
      : "#";

  return (
    <AppShell>
      <div className="space-y-4">
        {/* Page header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/reports">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                รายงานภาษีงานซ่อม รายเดือน
              </h1>
              <p className="text-sm text-zinc-500">
                {isFiltered
                  ? `เฉพาะใบกำกับจาก service-center · ${
                      THAI_MONTHS_FULL[parseInt(sp.month!, 10)]
                    } ${sp.year}`
                  : "เฉพาะใบกำกับจาก service-center — เลือกปีและเดือนที่ต้องการ"}
              </p>
            </div>
          </div>
          {isFiltered && (
            <Link href={xlsxHref}>
              <Button>
                <Download className="h-4 w-4" />
                ดาวน์โหลด Excel
              </Button>
            </Link>
          )}
        </div>

        {/* Filter bar */}
        <Card>
          <CardContent className="p-4">
            <form className="grid grid-cols-12 gap-3" method="get">
              <Select
                name="year"
                defaultValue={sp.year ?? ""}
                className="col-span-4 md:col-span-3"
              >
                <option value="">เลือกปี</option>
                {result.years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </Select>
              <Select
                name="month"
                defaultValue={sp.month ?? ""}
                className="col-span-4 md:col-span-3"
              >
                <option value="">เลือกเดือน</option>
                {THAI_MONTHS_FULL.map((m, i) =>
                  i === 0 ? null : (
                    <option key={i} value={String(i).padStart(2, "0")}>
                      {m}
                    </option>
                  ),
                )}
              </Select>
              <Button
                type="submit"
                variant="search"
                className="col-span-4 md:col-span-2"
              >
                แสดง
              </Button>
            </form>
          </CardContent>
        </Card>

        {isFiltered && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Card>
                <CardContent className="p-4">
                  <div className="text-xs text-zinc-500">
                    ใบกำกับ ({result.summary.count})
                  </div>
                  <div className="text-xs text-zinc-400">ก่อน VAT</div>
                  <div className="text-xl font-bold">
                    {formatMoney(result.summary.amountBeforeVat)} บาท
                  </div>
                  <div className="mt-1 text-[11px] text-zinc-500">
                    VAT {formatMoney(result.summary.vatAmount)} บาท
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 ring-2 ring-emerald-500/50">
                  <div className="text-xs font-semibold text-emerald-700">
                    รวมทั้งสิ้น
                  </div>
                  <div className="text-2xl font-bold text-emerald-700">
                    {formatMoney(result.summary.total)} บาท
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Table */}
            <Card>
              <CardContent className="p-0">
                {result.rows.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <FileSpreadsheet className="mb-3 h-10 w-10 text-zinc-300" />
                    <p className="text-sm text-zinc-500">
                      ไม่มีใบกำกับจาก service-center ในเดือนนี้
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="border-b bg-zinc-50 text-left text-xs text-zinc-500">
                        <tr>
                          <th className="px-3 py-2.5 font-medium w-12 text-center">
                            ลำดับ
                          </th>
                          <th className="px-3 py-2.5 font-medium">สถานะ</th>
                          <th className="px-3 py-2.5 font-medium">วันที่</th>
                          <th className="px-3 py-2.5 font-medium">เลขที่</th>
                          <th className="px-3 py-2.5 font-medium">ชื่อลูกค้า</th>
                          <th className="px-3 py-2.5 font-medium">เลขผู้เสียภาษี</th>
                          <th className="px-3 py-2.5 font-medium">สาขา</th>
                          <th className="px-3 py-2.5 font-medium">
                            อ้างอิง service-center
                          </th>
                          <th className="px-3 py-2.5 font-medium text-right">
                            ก่อน VAT
                          </th>
                          <th className="px-3 py-2.5 font-medium text-right">
                            VAT
                          </th>
                          <th className="px-3 py-2.5 font-medium text-right">
                            รวม
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {result.rows.map((r, i) => {
                          const st = statusMeta(r.status);
                          return (
                            <tr key={r.id} className="hover:bg-zinc-50">
                              <td className="px-3 py-2 text-center text-zinc-500">
                                {i + 1}
                              </td>
                              <td className="px-3 py-2">
                                <span
                                  className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${st.cls}`}
                                >
                                  {st.th}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-zinc-600 whitespace-nowrap">
                                {formatThaiDateShort(r.docDate)}
                              </td>
                              <td className="px-3 py-2 font-mono text-xs">
                                <Link
                                  href={`/invoices/${r.id}`}
                                  className="text-blue-600 hover:underline"
                                >
                                  {r.docNo}
                                </Link>
                              </td>
                              <td
                                className="px-3 py-2 max-w-xs truncate"
                                title={r.customerName ?? ""}
                              >
                                {r.customerName ?? "-"}
                              </td>
                              <td className="px-3 py-2 font-mono text-xs text-zinc-500">
                                {r.customerTaxId ?? "-"}
                              </td>
                              <td className="px-3 py-2 text-zinc-600">
                                {branchLabel(r.customerBranch)}
                              </td>
                              <td className="px-3 py-2 font-mono text-xs text-zinc-500">
                                {r.externalRef ?? "-"}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums">
                                {formatMoney(r.amountBeforeVat)}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums">
                                {formatMoney(r.vatAmount)}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums font-medium">
                                {formatMoney(r.total)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="border-t bg-zinc-50 text-sm">
                        <tr className="font-semibold">
                          <td colSpan={8} className="px-3 py-2 text-right">
                            รวม {result.summary.count.toLocaleString()} ใบ
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {formatMoney(result.summary.amountBeforeVat)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {formatMoney(result.summary.vatAmount)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {formatMoney(result.summary.total)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppShell>
  );
}
