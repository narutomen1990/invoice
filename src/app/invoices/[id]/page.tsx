import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Printer, Pencil, Download } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CancelInvoiceButton } from "@/components/forms/cancel-invoice-button";
import { getInvoiceById } from "@/lib/queries/invoices";
import { formatMoney, bahtText } from "@/lib/thai/number";
import { formatThaiDateFull, formatThaiDateShort } from "@/lib/thai/date";

export const dynamic = "force-dynamic";

const AR_STATUS_LABEL: Record<string, { th: string; variant: "secondary" | "warning" | "success" | "danger" | "outline" }> = {
  pending: { th: "รอชำระ", variant: "warning" },
  partial: { th: "ชำระบางส่วน", variant: "secondary" },
  paid: { th: "ชำระแล้ว", variant: "success" },
  overdue: { th: "เกินกำหนด", variant: "danger" },
  cancelled: { th: "ยกเลิก", variant: "outline" },
};

function branchLabel(code: string | null): string {
  if (!code) return "";
  const c = code.trim();
  if (!c || c === "00000") return "สำนักงานใหญ่";
  const n = parseInt(c, 10);
  if (n === 0) return "สำนักงานใหญ่";
  if (Number.isNaN(n)) return c;
  return `สาขา ${n}`;
}

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numId = parseInt(id, 10);
  if (Number.isNaN(numId)) notFound();

  const data = await getInvoiceById(numId);
  if (!data) notFound();

  const { doc, items, company } = data;
  const status = AR_STATUS_LABEL[doc.arStatus] ?? {
    th: doc.arStatus,
    variant: "secondary" as const,
  };

  return (
    <AppShell>
      <div className="space-y-4">
        {/* Header bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/invoices">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-mono text-xl font-bold">{doc.docNo}</h1>
                <Badge variant={status.variant}>{status.th}</Badge>
                {doc.status === "cancelled" && <Badge variant="danger">ยกเลิก</Badge>}
              </div>
              <p className="text-sm text-zinc-500">
                ใบกำกับภาษี · {formatThaiDateFull(doc.docDate)}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {doc.status !== "cancelled" && (
              <>
                <Link href={`/invoices/${doc.id}/edit`}>
                  <Button variant="outline" size="sm">
                    <Pencil className="h-4 w-4" />
                    แก้ไข
                  </Button>
                </Link>
                <CancelInvoiceButton id={doc.id} docNo={doc.docNo} />
              </>
            )}
            <Link href={`/api/invoices/${doc.id}/pdf`} target="_blank">
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4" />
                PDF
              </Button>
            </Link>
            <Link href={`/invoices/${doc.id}/print`} target="_blank">
              <Button size="sm">
                <Printer className="h-4 w-4" />
                พิมพ์
              </Button>
            </Link>
          </div>
        </div>

        {/* Customer + dates */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-sm text-zinc-500">ลูกค้า</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              <div className="text-base font-semibold">{doc.customerName ?? "-"}</div>
              {doc.customerAddress && (
                <div className="whitespace-pre-line text-zinc-600">
                  {doc.customerAddress}
                </div>
              )}
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-2 text-xs text-zinc-500">
                <div>
                  <span className="text-zinc-400">รหัสลูกค้า:</span>{" "}
                  <span className="font-mono">{doc.customerCode ?? "-"}</span>
                </div>
                <div>
                  <span className="text-zinc-400">เลขผู้เสียภาษี:</span>{" "}
                  <span className="font-mono">{doc.customerTaxId ?? "-"}</span>
                </div>
                <div>
                  <span className="text-zinc-400">สาขา:</span>{" "}
                  {branchLabel(doc.customerBranch)}
                </div>
                <div>
                  <span className="text-zinc-400">โทร:</span>{" "}
                  {doc.customerTel ?? "-"}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-zinc-500">รายละเอียด</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              <Row label="วันที่เอกสาร" value={formatThaiDateShort(doc.docDate)} />
              <Row label="กำหนดชำระ" value={doc.dueDate ? formatThaiDateShort(doc.dueDate) : "-"} />
              <Row label="เครดิต" value={`${doc.paymentTermsDays} วัน`} />
              <Row label="พนักงานขาย" value={doc.salemanName ?? "-"} />
              <Row label="ขนส่ง" value={doc.shippingMethod ?? "-"} />
              <Row label="อ้างอิงใบเสนอ" value={doc.referenceQuotationNo ?? "-"} />
            </CardContent>
          </Card>
        </div>

        {/* Items */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-zinc-50 text-left text-xs text-zinc-500">
                  <tr>
                    <th className="px-4 py-2.5 w-12 font-medium text-center">#</th>
                    <th className="px-4 py-2.5 font-medium">รายการ</th>
                    <th className="px-4 py-2.5 w-24 font-medium text-right">จำนวน</th>
                    <th className="px-4 py-2.5 w-20 font-medium">หน่วย</th>
                    <th className="px-4 py-2.5 w-32 font-medium text-right">ราคา/หน่วย</th>
                    <th className="px-4 py-2.5 w-32 font-medium text-right">จำนวนเงิน</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-sm text-zinc-400">
                        ไม่มีรายการ
                      </td>
                    </tr>
                  ) : (
                    items.map((it, idx) => (
                      <tr key={idx} className="hover:bg-zinc-50">
                        <td className="px-4 py-2 text-center text-zinc-500">{it.lineNo ?? ""}</td>
                        <td className="px-4 py-2">
                          <div>{it.description ?? "-"}</div>
                          {it.productCode && (
                            <div className="text-[11px] text-zinc-400 font-mono">
                              {it.productCode}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {formatMoney(it.quantity, 2)}
                        </td>
                        <td className="px-4 py-2 text-zinc-600">{it.unit ?? "-"}</td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {formatMoney(it.unitPrice)}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {formatMoney(it.amount)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Totals + memo */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-sm text-zinc-500">หมายเหตุ</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {doc.memo && (
                <div>
                  <div className="text-xs text-zinc-400">บันทึก:</div>
                  <div className="whitespace-pre-line">{doc.memo}</div>
                </div>
              )}
              {doc.remark1 && (
                <div>
                  <div className="text-xs text-zinc-400">หมายเหตุ 1:</div>
                  <div className="whitespace-pre-line">{doc.remark1}</div>
                </div>
              )}
              {doc.remark2 && (
                <div>
                  <div className="text-xs text-zinc-400">หมายเหตุ 2:</div>
                  <div className="whitespace-pre-line">{doc.remark2}</div>
                </div>
              )}
              {!doc.memo && !doc.remark1 && !doc.remark2 && (
                <div className="text-xs text-zinc-400">— ไม่มีหมายเหตุ —</div>
              )}
              {doc.totalInWordsTh && (
                <div className="border-t pt-3">
                  <div className="text-xs text-zinc-400">จำนวนเงินตัวอักษร:</div>
                  <div className="font-medium">{doc.totalInWordsTh}</div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-2 p-5 text-sm">
              <SumRow label="รวมก่อน VAT" value={formatMoney(doc.amountBeforeVat)} />
              {doc.discount > 0 && (
                <SumRow label="ส่วนลด" value={`-${formatMoney(doc.discount)}`} />
              )}
              <SumRow
                label={`VAT ${doc.vatRate}%`}
                value={formatMoney(doc.vatAmount)}
              />
              <div className="my-2 border-t" />
              <SumRow label="รวมทั้งสิ้น" value={`฿${formatMoney(doc.total)}`} bold />
              {doc.withholdingTaxAmount > 0 && (
                <>
                  <SumRow
                    label="หัก ณ ที่จ่าย"
                    value={`-${formatMoney(doc.withholdingTaxAmount)}`}
                  />
                  <div className="my-2 border-t" />
                  <SumRow
                    label="ยอดสุทธิ"
                    value={`฿${formatMoney(doc.netTotal)}`}
                    bold
                  />
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Audit */}
        <div className="text-xs text-zinc-400">
          สร้างเมื่อ {new Date(doc.createdAt).toLocaleString("th-TH")}
          {doc.legacyRunning && ` · legacy seq ${doc.legacyRunning}`}
        </div>
      </div>
    </AppShell>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-zinc-400">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function SumRow({
  label,
  value,
  bold = false,
}: {
  label: string;
  value: React.ReactNode;
  bold?: boolean;
}) {
  return (
    <div className={`flex justify-between ${bold ? "text-base font-bold" : ""}`}>
      <span className={bold ? "" : "text-zinc-500"}>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
