import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil, FileText } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getCustomerById } from "@/lib/queries/customers";
import { formatMoney } from "@/lib/thai/number";
import { formatThaiDateShort } from "@/lib/thai/date";

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

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numId = parseInt(id, 10);
  if (Number.isNaN(numId)) notFound();
  const c = await getCustomerById(numId);
  if (!c) notFound();

  const address = [c.address1, c.address2, c.address3, c.province].filter(Boolean).join(" ");

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/customers">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold">{c.name}</h1>
                {!c.isActive && <Badge variant="outline">ปิดใช้งาน</Badge>}
              </div>
              <p className="text-sm text-zinc-500 font-mono">รหัส {c.code}</p>
            </div>
          </div>
          <Link href={`/customers/${c.id}/edit`}>
            <Button variant="outline" size="sm">
              <Pencil className="h-4 w-4" />
              แก้ไข
            </Button>
          </Link>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-zinc-500">ใบกำกับทั้งหมด</div>
              <div className="text-2xl font-bold">{c.stats.invoiceCount.toLocaleString()}</div>
              <div className="text-xs text-zinc-500">
                {c.stats.firstDate && c.stats.lastDate
                  ? `${formatThaiDateShort(c.stats.firstDate)} - ${formatThaiDateShort(c.stats.lastDate)}`
                  : "-"}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-zinc-500">ยอดขายรวม</div>
              <div className="text-2xl font-bold">฿{formatMoney(c.stats.invoiceTotal)}</div>
              <div className="text-xs text-zinc-500">VAT ฿{formatMoney(c.stats.invoiceVat)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-zinc-500">ลูกหนี้คงค้าง</div>
              <div className="text-2xl font-bold text-amber-600">
                ฿{formatMoney(c.stats.arPending)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-zinc-500">ชำระแล้ว</div>
              <div className="text-2xl font-bold text-green-600">
                ฿{formatMoney(c.stats.arPaid)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Profile + Yearly */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>ข้อมูลลูกค้า</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <Field label="ชื่อ (ไทย)" value={c.name} />
              <Field label="ชื่อ (อังกฤษ)" value={c.nameEn} />
              <Field label="เลขผู้เสียภาษี" value={c.taxId} mono />
              <Field label="สาขา" value={branchLabel(c.defaultBranchCode)} />
              <Field label="ที่อยู่" value={address} colSpan />
              <Field label="โทรศัพท์" value={c.tel} />
              <Field label="แฟกซ์" value={c.fax} />
              <Field label="อีเมล" value={c.email} />
              <Field label="เว็บไซต์" value={c.website} />
              <Field label="ผู้ติดต่อ" value={c.contactName} />
              <Field label="ชื่อเล่น" value={c.contactNick} />
              <Field label="มือถือผู้ติดต่อ" value={c.contactMobile} />
              <Field label="อีเมลผู้ติดต่อ" value={c.contactEmail} />
              {c.notes && <Field label="หมายเหตุ" value={c.notes} colSpan />}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>ยอดรายปี</CardTitle>
            </CardHeader>
            <CardContent>
              {c.yearlyStats.length === 0 ? (
                <p className="text-sm text-zinc-400">ยังไม่มีใบกำกับ</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-zinc-500">
                    <tr>
                      <th className="pb-2">ปี</th>
                      <th className="pb-2 text-right">ใบ</th>
                      <th className="pb-2 text-right">ยอด</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {c.yearlyStats.map((y) => (
                      <tr key={y.y}>
                        <td className="py-1.5 font-medium">{y.y}</td>
                        <td className="py-1.5 text-right">{y.count}</td>
                        <td className="py-1.5 text-right tabular-nums">
                          {formatMoney(y.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent invoices */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              ใบกำกับล่าสุด (สูงสุด 20 ใบ)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {c.recentInvoices.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-zinc-400">ยังไม่มีใบกำกับ</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b bg-zinc-50 text-left text-xs text-zinc-500">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">เลขที่</th>
                    <th className="px-4 py-2.5 font-medium">วันที่</th>
                    <th className="px-4 py-2.5 font-medium">สถานะ</th>
                    <th className="px-4 py-2.5 font-medium text-right">ยอดรวม</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {c.recentInvoices.map((inv) => {
                    const st = AR_STATUS_LABEL[inv.arStatus] ?? {
                      th: inv.arStatus,
                      variant: "secondary" as const,
                    };
                    return (
                      <tr key={inv.id} className="hover:bg-zinc-50">
                        <td className="px-4 py-2 font-mono text-xs">
                          <Link
                            href={`/invoices/${inv.id}`}
                            className="text-blue-600 hover:underline"
                          >
                            {inv.docNo}
                          </Link>
                        </td>
                        <td className="px-4 py-2 text-zinc-600">
                          {formatThaiDateShort(inv.docDate)}
                        </td>
                        <td className="px-4 py-2">
                          <Badge variant={st.variant}>{st.th}</Badge>
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {formatMoney(inv.total)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function Field({
  label,
  value,
  colSpan = false,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  colSpan?: boolean;
  mono?: boolean;
}) {
  return (
    <div className={colSpan ? "col-span-2" : ""}>
      <div className="text-xs text-zinc-400">{label}</div>
      <div className={mono ? "font-mono text-sm" : "text-sm"}>{value || "-"}</div>
    </div>
  );
}
