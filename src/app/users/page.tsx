import { db } from "@/db/client";
import { users } from "@/db/schema";
import { desc } from "drizzle-orm";
import { ShieldCheck, Users as UsersIcon } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { getSession } from "@/lib/auth/session";
import { UserManagement } from "./user-management";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
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

  const list = await db.select().from(users).orderBy(desc(users.id));
  const activeCount = list.filter((u) => u.isActive).length;

  return (
    <AppShell>
      <div className="space-y-5">
        {/* Page header */}
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-sm">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
              ระบบรักษาความปลอดภัย
            </h1>
            <p className="text-sm text-zinc-500">
              จัดการผู้ใช้ — เพิ่ม / ลบ / รีเซ็ตรหัส / กำหนดสิทธิ์
            </p>
          </div>
        </div>

        {/* Main card */}
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-zinc-200 bg-gradient-to-b from-zinc-50 to-white px-5 py-3.5">
            <div className="flex items-center gap-2 text-sm font-semibold text-zinc-800">
              <UsersIcon className="h-4 w-4 text-blue-600" />
              ผู้ใช้ทั้งหมด
              <span className="ml-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700">
                {list.length}
              </span>
              <span className="ml-1 text-xs font-normal text-zinc-500">
                · เปิดใช้งาน {activeCount} คน
              </span>
            </div>
          </div>

          <UserManagement
            currentUserId={session!.userId}
            users={list.map((u) => ({
              id: u.id,
              username: u.username,
              fullName: u.fullName ?? "",
              role: u.role,
              isActive: u.isActive,
              mustChangePassword: u.mustChangePassword,
              lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
              isLegacy: u.passwordHash.startsWith("legacy:"),
            }))}
          />
        </div>
      </div>
    </AppShell>
  );
}
