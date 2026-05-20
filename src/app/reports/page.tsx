import Link from "next/link";
import { BarChart3, FileSpreadsheet, Receipt, Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function ReportsIndex() {
  const reports = [
    {
      href: "/reports/tax-monthly",
      icon: FileSpreadsheet,
      title: "รายงานภาษีขาย รายเดือน",
      desc: "สรุปยอดขาย+VAT แยกรายเดือน ส่ง Excel ตามรูปแบบสรรพากร",
    },
    {
      href: "#",
      icon: Receipt,
      title: "รายงานภาษีขาย รายปี",
      desc: "รวมรายงาน 12 เดือนใน 1 ปี (เร็วๆ นี้)",
      disabled: true,
    },
    {
      href: "#",
      icon: Users,
      title: "ยอดขายตามลูกค้า",
      desc: "เรียงตามยอดสูงสุด พร้อมจำนวนใบ (เร็วๆ นี้)",
      disabled: true,
    },
    {
      href: "#",
      icon: BarChart3,
      title: "ยอดขายตามสินค้า / พนักงานขาย",
      desc: "วิเคราะห์ยอดขาย (เร็วๆ นี้)",
      disabled: true,
    },
  ];

  return (
    <AppShell>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">รายงาน</h1>
          <p className="text-sm text-zinc-500">เลือกประเภทรายงานที่ต้องการ</p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {reports.map((r) => {
            const Icon = r.icon;
            const card = (
              <Card
                className={`transition ${r.disabled ? "opacity-50" : "cursor-pointer hover:shadow-md"}`}
              >
                <CardHeader>
                  <div className="flex items-start gap-3">
                    <div className="rounded-md bg-blue-50 p-2 text-blue-600">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-base">{r.title}</CardTitle>
                      <CardDescription className="mt-1">{r.desc}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            );
            return r.disabled ? (
              <div key={r.title}>{card}</div>
            ) : (
              <Link key={r.title} href={r.href}>
                {card}
              </Link>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
