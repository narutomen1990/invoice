import { AppShell } from "@/components/app-shell";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Download, RotateCcw } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { listBackupsAction, getBackupDirAction } from "./actions";
import { BACKUP_RETENTION_DAYS } from "@/lib/backup/core";
import {
  BackupActions,
  RestoreBackupButton,
  DeleteBackupButton,
  UploadBackupCard,
} from "./backup-actions";
import { ImportInvoicesCard } from "./import-invoices-card";

export const dynamic = "force-dynamic";

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(2)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export default async function BackupPage() {
  const session = await getSession();
  const isAdmin = session?.role === "admin";
  const backups = await listBackupsAction();
  const dir = await getBackupDirAction();

  return (
    <AppShell>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            สำรองข้อมูล (BackUp)
          </h1>
          <p className="text-sm text-zinc-500">
            จัดการการสำรองฐานข้อมูล และ นำเข้าใบกำกับจาก FoxPro
          </p>
        </div>

        <Tabs defaultValue="backup">
          <TabsList>
            <TabsTrigger value="backup">สำรองข้อมูล</TabsTrigger>
            <TabsTrigger value="import">นำเข้าข้อมูล</TabsTrigger>
          </TabsList>

          {/* ===== Tab 1: Backup ===== */}
          <TabsContent value="backup">
            <div className="space-y-4 pt-4">
              <Card>
                <CardContent className="p-4">
                  <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-3">
                    <div>
                      <div className="text-xs text-zinc-500">
                        โฟลเดอร์เก็บไฟล์
                      </div>
                      <div className="font-mono text-xs">{dir}</div>
                    </div>
                    <div>
                      <div className="text-xs text-zinc-500">จำนวนไฟล์</div>
                      <div className="text-lg font-bold">{backups.length}</div>
                    </div>
                    <div>
                      <div className="text-xs text-zinc-500">รวมขนาด</div>
                      <div className="text-lg font-bold">
                        {fmtBytes(backups.reduce((s, b) => s + b.size, 0))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs text-emerald-800">
                ระบบสำรองข้อมูลอัตโนมัติทำงานทุกวัน เวลา 00:30 น. (หลังเที่ยงคืน)
                และเก็บไฟล์ย้อนหลัง {BACKUP_RETENTION_DAYS} วัน —
                ไฟล์ที่เก่ากว่านั้นจะถูกลบทิ้งโดยอัตโนมัติ
              </div>

              {isAdmin ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">
                      สร้างไฟล์สำรองใหม่
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <BackupActions
                      items={backups.map((b) => ({
                        name: b.name,
                        size: fmtBytes(b.size),
                        createdAt: b.createdAt,
                      }))}
                    />
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="p-4 text-sm text-amber-700">
                    การสร้าง/ลบไฟล์สำรอง ทำได้โดย admin เท่านั้น
                  </CardContent>
                </Card>
              )}

              {isAdmin && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">
                      อัปโหลดไฟล์ backup จากคอมพิวเตอร์
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <UploadBackupCard />
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">
                    รายการไฟล์ ({backups.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {backups.length === 0 ? (
                    <p className="px-5 py-8 text-center text-sm text-zinc-400">
                      ยังไม่มีไฟล์สำรอง
                    </p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="border-b bg-zinc-50 text-left text-xs text-zinc-500">
                        <tr>
                          <th className="px-4 py-2.5 font-medium">ชื่อไฟล์</th>
                          <th className="px-4 py-2.5 font-medium">ขนาด</th>
                          <th className="px-4 py-2.5 font-medium">
                            วันที่สร้าง
                          </th>
                          {isAdmin && (
                            <th className="px-4 py-2.5 font-medium text-right">
                              จัดการ
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {backups.map((b) => (
                          <tr key={b.name} className="hover:bg-zinc-50">
                            <td className="px-4 py-2 font-mono text-xs">
                              {b.name}
                            </td>
                            <td className="px-4 py-2 tabular-nums text-zinc-600">
                              {fmtBytes(b.size)}
                            </td>
                            <td className="px-4 py-2 text-zinc-500">
                              {new Date(b.createdAt).toLocaleString("th-TH")}
                            </td>
                            {isAdmin && (
                              <td className="px-4 py-2">
                                <div className="flex items-center justify-end gap-1">
                                  <a
                                    href={`/api/backup/${encodeURIComponent(b.name)}`}
                                    title="ดาวน์โหลดไฟล์"
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
                                  >
                                    <Download className="h-4 w-4" />
                                  </a>
                                  <RestoreBackupButton filename={b.name} />
                                  <DeleteBackupButton filename={b.name} />
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 text-xs leading-relaxed text-zinc-500">
                  {isAdmin && (
                    <p className="mb-3 rounded-md border border-amber-200 bg-amber-50 p-2.5 text-amber-800">
                      กด <RotateCcw className="inline h-3 w-3 align-[-1px]" />{" "}
                      ที่แถวไฟล์ในตารางด้านบนเพื่อ restore ได้โดยตรงจากหน้านี้
                      — คำสั่ง CLI ด้านล่างไว้ใช้กรณีย้าย server เท่านั้น
                    </p>
                  )}
                  <p className="mb-2 font-semibold text-zinc-700">
                    วิธี restore (CLI):
                  </p>
                  <pre className="overflow-x-auto rounded bg-zinc-100 p-3 font-mono text-zinc-800">
{`# จาก server เดิม:
PGPASSWORD=xxx pg_restore -h localhost -U invoice_app -d invoice_db -c <filename>.dump

# หรือสร้าง DB ใหม่แล้ว restore:
createdb -h localhost -U postgres invoice_db
PGPASSWORD=xxx pg_restore -h localhost -U invoice_app -d invoice_db <filename>.dump`}
                  </pre>
                  <p className="mt-3">
                    ระบบสร้างไฟล์สำรองให้อัตโนมัติทุกวันอยู่แล้ว (ดูด้านบน)
                    ไม่ต้องตั้ง Task Scheduler/cron เพิ่มเอง
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ===== Tab 2: Import ===== */}
          <TabsContent value="import">
            <div className="space-y-4 pt-4">
              {isAdmin ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">
                      นำเข้าใบกำกับใหม่จาก FoxPro (Invoice.DBF)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ImportInvoicesCard />
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="p-4 text-sm text-amber-700">
                    การนำเข้าข้อมูลจาก FoxPro ทำได้โดย admin เท่านั้น
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
