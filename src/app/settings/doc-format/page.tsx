import { Hash } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSession } from "@/lib/auth/session";
import { getDocNumberSummaryAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function DocFormatPage() {
  const session = await getSession();
  const isAdmin = session?.role === "admin";

  if (!isAdmin) {
    return (
      <AppShell>
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          หน้านี้สำหรับ admin เท่านั้น
        </div>
      </AppShell>
    );
  }

  const summary = await getDocNumberSummaryAction();

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-sm">
            <Hash className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
              กำหนดรูปแบบเอกสาร
            </h1>
            <p className="text-sm text-zinc-500">
              สรุปรูปแบบเลขที่เอกสารและเลขที่ถัดไป (เดือนนี้) ของเอกสารทั้งหมดในระบบ
            </p>
          </div>
        </div>

        {summary.error ? (
          <Card>
            <CardContent className="p-4 text-sm text-red-600">{summary.error}</CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">รูปแบบเลขที่เอกสารทั้งหมด</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="border-b bg-zinc-50 text-left text-xs text-zinc-500">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">ประเภทเอกสาร</th>
                    <th className="px-4 py-2.5 font-medium">Prefix</th>
                    <th className="px-4 py-2.5 font-medium">รูปแบบ</th>
                    <th className="px-4 py-2.5 font-medium">เลขที่ถัดไป (เดือนนี้)</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {summary.items?.map((it) => (
                    <tr key={it.documentType} className="hover:bg-zinc-50">
                      <td className="px-4 py-2">{it.label}</td>
                      <td className="px-4 py-2 font-mono text-xs text-zinc-600">{it.prefix}</td>
                      <td className="px-4 py-2 font-mono text-xs text-zinc-600">{it.formatExample}</td>
                      <td className="px-4 py-2 font-mono text-xs font-semibold text-blue-700">
                        {it.nextDocNo}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        <div className="rounded-md border border-zinc-200 bg-white p-4 text-xs leading-relaxed text-zinc-500">
          <p className="mb-1">
            <span className="font-semibold text-zinc-700">yy</span> = ปี พ.ศ. 2 หลัก (เช่น 2569 → 69),{" "}
            <span className="font-semibold text-zinc-700">mm</span> = เดือน 2 หลัก
          </p>
          <p>
            เลขวิ่ง (running number) จะรีเซตเป็น 1 ทุกต้นเดือนแยกตามประเภทเอกสาร —
            เลขที่ถัดไปที่แสดงด้านบนเป็นค่าที่คำนวณจากข้อมูลปัจจุบัน ไม่ใช่การจอง/ตัดเลขจริง
          </p>
        </div>
      </div>
    </AppShell>
  );
}
