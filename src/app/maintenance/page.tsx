import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { db } from "@/db/client";
import { sql } from "drizzle-orm";
import { Database, Activity, Box } from "lucide-react";

export const dynamic = "force-dynamic";

function fmtBytes(n: number): string {
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(2)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export default async function MaintenancePage() {
  const tableSizes = await db.execute<{
    table_name: string;
    rows: number;
    total_bytes: number;
    table_bytes: number;
    index_bytes: number;
  }>(sql`
    SELECT C.relname AS table_name,
           COALESCE(S.n_live_tup, 0)::int AS rows,
           pg_total_relation_size(C.oid)::bigint AS total_bytes,
           pg_relation_size(C.oid)::bigint AS table_bytes,
           pg_indexes_size(C.oid)::bigint AS index_bytes
      FROM pg_class C
      JOIN pg_namespace N ON N.oid = C.relnamespace
      LEFT JOIN pg_stat_user_tables S ON S.relid = C.oid
     WHERE N.nspname = 'public' AND C.relkind = 'r'
     ORDER BY pg_total_relation_size(C.oid) DESC
  `);

  const [dbSize] = await db.execute<{ size: string }>(
    sql`SELECT pg_size_pretty(pg_database_size(current_database())) AS size`,
  );

  const [version] = await db.execute<{ version: string }>(sql`SELECT version()`);

  const totalRows = tableSizes.reduce((s, t) => s + Number(t.rows), 0);
  const totalBytes = tableSizes.reduce((s, t) => s + Number(t.total_bytes), 0);

  return (
    <AppShell>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">ปรับปรุงข้อมูลและดัชนี</h1>
          <p className="text-sm text-zinc-500">
            ข้อมูลฐานข้อมูล PostgreSQL — บำรุงรักษาอัตโนมัติด้วย autovacuum
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="flex items-start justify-between p-4">
              <div>
                <div className="text-xs text-zinc-500">ขนาดฐานข้อมูล</div>
                <div className="text-2xl font-bold">{dbSize.size}</div>
              </div>
              <Database className="h-5 w-5 text-zinc-400" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-start justify-between p-4">
              <div>
                <div className="text-xs text-zinc-500">จำนวน rows ทั้งหมด</div>
                <div className="text-2xl font-bold">{totalRows.toLocaleString()}</div>
              </div>
              <Activity className="h-5 w-5 text-zinc-400" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-start justify-between p-4">
              <div>
                <div className="text-xs text-zinc-500">จำนวนตาราง</div>
                <div className="text-2xl font-bold">{tableSizes.length}</div>
              </div>
              <Box className="h-5 w-5 text-zinc-400" />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>ตารางใน database</CardTitle>
            <CardDescription>
              เรียงตามขนาดที่ใช้พื้นที่ (data + index รวม)
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b bg-zinc-50 text-left text-xs text-zinc-500">
                <tr>
                  <th className="px-4 py-2.5 font-medium">ตาราง</th>
                  <th className="px-4 py-2.5 text-right font-medium">Rows</th>
                  <th className="px-4 py-2.5 text-right font-medium">Data</th>
                  <th className="px-4 py-2.5 text-right font-medium">Index</th>
                  <th className="px-4 py-2.5 text-right font-medium">รวม</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {tableSizes.map((t) => (
                  <tr key={t.table_name} className="hover:bg-zinc-50">
                    <td className="px-4 py-2 font-mono text-xs">{t.table_name}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {Number(t.rows).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-zinc-600">
                      {fmtBytes(Number(t.table_bytes))}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-zinc-600">
                      {fmtBytes(Number(t.index_bytes))}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums font-medium">
                      {fmtBytes(Number(t.total_bytes))}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t bg-zinc-50 text-sm font-semibold">
                <tr>
                  <td className="px-4 py-2">รวม</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {totalRows.toLocaleString()}
                  </td>
                  <td colSpan={2}></td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {fmtBytes(totalBytes)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-4 text-sm">
            <div>
              <div className="text-xs text-zinc-500">PostgreSQL version</div>
              <div className="font-mono text-xs">{version.version}</div>
            </div>
            <div className="text-xs text-zinc-500 leading-relaxed">
              <strong>หมายเหตุ:</strong> PostgreSQL ทำ autovacuum + reindex อัตโนมัติ
              ไม่จำเป็นต้องสั่งด้วยมือเหมือน Visual FoxPro เดิม หากเจอปัญหา query ช้า
              ผิดปกติ สามารถสั่ง <code className="rounded bg-zinc-100 px-1">VACUUM ANALYZE;</code>{" "}
              จาก pgAdmin ได้ (พอร์ต 5050)
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
