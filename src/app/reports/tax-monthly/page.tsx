import Link from "next/link";
import {
  ArrowLeft,
  FileSpreadsheet,
  Download,
  FileText,
  FileSignature,
  FileMinus,
  Receipt,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  getTaxMonthly,
  normalizeDocType,
  type ReportDocType,
  type TaxMonthlyRow,
} from "@/lib/queries/reports";
import { formatMoney } from "@/lib/thai/number";
import { formatThaiDateShort, THAI_MONTHS_FULL } from "@/lib/thai/date";

export const dynamic = "force-dynamic";

const TABS: {
  type: ReportDocType;
  label: string;
  icon: typeof FileText;
  hasTax: boolean;
}[] = [
  { type: "invoice", label: "ใบกำกับภาษีขาย", icon: Receipt, hasTax: true },
  {
    type: "quotation",
    label: "ใบเสนอราคา",
    icon: FileSignature,
    hasTax: false,
  },
  {
    type: "billing_slip",
    label: "ใบแจ้งหนี้",
    icon: FileText,
    hasTax: false,
  },
];

function branchLabel(code: string | null): string {
  if (!code) return "";
  const c = code.trim();
  if (!c || c === "00000") return "สำนักงานใหญ่";
  const n = parseInt(c, 10);
  if (n === 0) return "สำนักงานใหญ่";
  if (Number.isNaN(n)) return c;
  return `สาขา ${n}`;
}

function detailHrefForRow(docType: ReportDocType, row: TaxMonthlyRow): string {
  if (row.kind === "credit_note") return `/credit-notes/${row.id}`;
  switch (docType) {
    case "invoice":
      return `/invoices/${row.id}`;
    case "quotation":
      return `/quotations/${row.id}`;
    case "billing_slip":
      return `/billing/${row.id}`;
  }
}

export default async function TaxMonthlyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const docType = normalizeDocType(sp.type);
  const tab = TABS.find((t) => t.type === docType)!;

  const result = await getTaxMonthly({
    year: sp.year,
    month: sp.month,
    docType,
  });
  const isFiltered = !!(sp.year && sp.month);
  const showCnBreakdown = docType === "invoice";

  const xlsxHref =
    sp.year && sp.month
      ? `/api/reports/tax-monthly.xlsx?year=${sp.year}&month=${sp.month}&type=${docType}`
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
                รายงานภาษีขาย รายเดือน
              </h1>
              <p className="text-sm text-zinc-500">
                {isFiltered
                  ? `${tab.label} · ${
                      THAI_MONTHS_FULL[parseInt(sp.month!, 10)]
                    } ${sp.year}`
                  : `${tab.label} — เลือกปีและเดือนที่ต้องการ`}
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

        {/* Tabs */}
        <div className="flex gap-1 border-b border-zinc-200">
          {TABS.map((t) => {
            const Icon = t.icon;
            const isActive = t.type === docType;
            const params = new URLSearchParams();
            params.set("type", t.type);
            if (sp.year) params.set("year", sp.year);
            if (sp.month) params.set("month", sp.month);
            return (
              <Link
                key={t.type}
                href={`/reports/tax-monthly?${params.toString()}`}
                className={
                  "relative flex items-center gap-2 rounded-t-lg px-5 py-2.5 text-sm font-semibold transition " +
                  (isActive
                    ? "border border-b-0 border-zinc-200 bg-white text-blue-700 -mb-px"
                    : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800")
                }
              >
                <Icon
                  className={"h-4 w-4 " + (isActive ? "text-blue-600" : "")}
                />
                {t.label}
              </Link>
            );
          })}
        </div>

        {/* Filter bar */}
        <Card>
          <CardContent className="p-4">
            <form className="grid grid-cols-12 gap-3" method="get">
              <input type="hidden" name="type" value={docType} />
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
            {showCnBreakdown ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="text-xs text-zinc-500">
                      ใบกำกับภาษีขาย ({result.summary.invoice.count})
                    </div>
                    <div className="text-xs text-zinc-400">ก่อน VAT</div>
                    <div className="text-xl font-bold">
                      ฿{formatMoney(result.summary.invoice.amountBeforeVat)}
                    </div>
                    <div className="mt-1 text-[11px] text-zinc-500">
                      VAT ฿{formatMoney(result.summary.invoice.vatAmount)}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-xs text-rose-700">
                      หัก: ใบลดหนี้ ({result.summary.credit.count})
                    </div>
                    <div className="text-xs text-zinc-400">ก่อน VAT</div>
                    <div className="text-xl font-bold text-rose-700">
                      −฿{formatMoney(result.summary.credit.amountBeforeVat)}
                    </div>
                    <div className="mt-1 text-[11px] text-rose-700">
                      VAT −฿{formatMoney(result.summary.credit.vatAmount)}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 ring-2 ring-emerald-500/50">
                    <div className="text-xs font-semibold text-emerald-700">
                      สุทธิ (ยื่น ภพ.30)
                    </div>
                    <div className="text-xs text-zinc-400">ก่อน VAT</div>
                    <div className="text-xl font-bold text-emerald-700">
                      ฿{formatMoney(result.summary.net.amountBeforeVat)}
                    </div>
                    <div className="mt-1 text-[11px] text-emerald-700">
                      VAT ฿{formatMoney(result.summary.net.vatAmount)}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-xs text-zinc-500">รวมทั้งสิ้น</div>
                    <div className="text-2xl font-bold">
                      ฿{formatMoney(result.summary.net.total)}
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Card>
                  <CardContent className="p-4">
                    <div className="text-xs text-zinc-500">จำนวนใบ</div>
                    <div className="text-2xl font-bold">
                      {result.summary.count.toLocaleString()}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-xs text-zinc-500">รวมทั้งสิ้น</div>
                    <div className="text-2xl font-bold">
                      ฿{formatMoney(result.summary.invoice.total)}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Table */}
            <Card>
              <CardContent className="p-0">
                {result.rows.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <FileSpreadsheet className="mb-3 h-10 w-10 text-zinc-300" />
                    <p className="text-sm text-zinc-500">
                      ไม่มี{tab.label}ในเดือนนี้
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
                          {showCnBreakdown && (
                            <th className="px-3 py-2.5 font-medium w-20">
                              ประเภท
                            </th>
                          )}
                          <th className="px-3 py-2.5 font-medium">วันที่</th>
                          <th className="px-3 py-2.5 font-medium">เลขที่</th>
                          <th className="px-3 py-2.5 font-medium">ชื่อลูกค้า</th>
                          {tab.hasTax && (
                            <>
                              <th className="px-3 py-2.5 font-medium">
                                เลขผู้เสียภาษี
                              </th>
                              <th className="px-3 py-2.5 font-medium">สาขา</th>
                              <th className="px-3 py-2.5 font-medium text-right">
                                ก่อน VAT
                              </th>
                              <th className="px-3 py-2.5 font-medium text-right">
                                VAT
                              </th>
                            </>
                          )}
                          <th className="px-3 py-2.5 font-medium text-right">
                            รวม
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {result.rows.map((r, i) => {
                          const isCn = r.kind === "credit_note";
                          return (
                            <tr
                              key={`${r.kind}-${r.id}`}
                              className={
                                isCn
                                  ? "bg-rose-50/40 hover:bg-rose-100/60"
                                  : "hover:bg-zinc-50"
                              }
                            >
                              <td className="px-3 py-2 text-center text-zinc-500">
                                {i + 1}
                              </td>
                              {showCnBreakdown && (
                                <td className="px-3 py-2">
                                  {isCn ? (
                                    <span className="inline-flex items-center gap-1 rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">
                                      <FileMinus className="h-3 w-3" />
                                      ใบลดหนี้
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-zinc-500">
                                      ใบกำกับ
                                    </span>
                                  )}
                                </td>
                              )}
                              <td className="px-3 py-2 text-zinc-600 whitespace-nowrap">
                                {formatThaiDateShort(r.docDate)}
                              </td>
                              <td className="px-3 py-2 font-mono text-xs">
                                <Link
                                  href={detailHrefForRow(docType, r)}
                                  className={
                                    isCn
                                      ? "text-rose-700 hover:underline"
                                      : "text-blue-600 hover:underline"
                                  }
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
                              {tab.hasTax && (
                                <>
                                  <td className="px-3 py-2 font-mono text-xs text-zinc-500">
                                    {r.customerTaxId ?? "-"}
                                  </td>
                                  <td className="px-3 py-2 text-zinc-600">
                                    {branchLabel(r.customerBranch)}
                                  </td>
                                  <td
                                    className={
                                      "px-3 py-2 text-right tabular-nums " +
                                      (isCn ? "text-rose-700" : "")
                                    }
                                  >
                                    {isCn ? "−" : ""}
                                    {formatMoney(r.amountBeforeVat)}
                                  </td>
                                  <td
                                    className={
                                      "px-3 py-2 text-right tabular-nums " +
                                      (isCn ? "text-rose-700" : "")
                                    }
                                  >
                                    {isCn ? "−" : ""}
                                    {formatMoney(r.vatAmount)}
                                  </td>
                                </>
                              )}
                              <td
                                className={
                                  "px-3 py-2 text-right tabular-nums font-medium " +
                                  (isCn ? "text-rose-700" : "")
                                }
                              >
                                {isCn ? "−" : ""}
                                {formatMoney(r.total)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="border-t bg-zinc-50 text-sm">
                        {showCnBreakdown ? (
                          <>
                            <tr className="font-semibold">
                              <td
                                colSpan={tab.hasTax ? 7 : 5}
                                className="px-3 py-2 text-right text-zinc-700"
                              >
                                ยอดขายรวม ({result.summary.invoice.count} ใบ)
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums">
                                {formatMoney(
                                  result.summary.invoice.amountBeforeVat,
                                )}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums">
                                {formatMoney(result.summary.invoice.vatAmount)}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums">
                                {formatMoney(result.summary.invoice.total)}
                              </td>
                            </tr>
                            <tr className="font-semibold text-rose-700">
                              <td
                                colSpan={tab.hasTax ? 7 : 5}
                                className="px-3 py-2 text-right"
                              >
                                หัก: ใบลดหนี้ ({result.summary.credit.count} ใบ)
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums">
                                −
                                {formatMoney(
                                  result.summary.credit.amountBeforeVat,
                                )}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums">
                                −{formatMoney(result.summary.credit.vatAmount)}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums">
                                −{formatMoney(result.summary.credit.total)}
                              </td>
                            </tr>
                            <tr className="border-t-2 bg-emerald-50 font-bold text-emerald-800">
                              <td
                                colSpan={tab.hasTax ? 7 : 5}
                                className="px-3 py-2 text-right"
                              >
                                คงเหลือสุทธิ (ยอดที่ต้องนำส่ง ภพ.30)
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums">
                                {formatMoney(result.summary.net.amountBeforeVat)}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums">
                                {formatMoney(result.summary.net.vatAmount)}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums">
                                {formatMoney(result.summary.net.total)}
                              </td>
                            </tr>
                          </>
                        ) : (
                          <tr className="font-semibold">
                            <td
                              colSpan={tab.hasTax ? 6 : 4}
                              className="px-3 py-2 text-right"
                            >
                              รวม {result.summary.count.toLocaleString()} รายการ
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {formatMoney(result.summary.net.total)}
                            </td>
                          </tr>
                        )}
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
