import Link from "next/link";
import { LogOut, KeyRound } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { logoutAction } from "@/app/login/actions";
import { SideNav } from "@/components/side-nav";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  return (
    <div className="flex min-h-screen bg-zinc-100">
      <aside className="w-64 shrink-0 border-r border-zinc-200 bg-zinc-100">
        <div className="flex h-14 items-center gap-2 border-b border-zinc-200 bg-zinc-100 px-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/uploads/vm-logo.jpg"
            alt="VM Camera Pro"
            className="h-8 w-8 rounded border border-zinc-300 bg-white object-contain"
          />
          <span className="text-sm font-bold tracking-tight text-zinc-700">
            VM Camera Pro Invoice
          </span>
        </div>
        <SideNav />
      </aside>

      <main className="flex flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-zinc-200 bg-white px-6">
          <div className="text-sm text-zinc-500">ระบบใบกำกับภาษี</div>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1 text-zinc-600">
              <span className="font-medium">{session?.fullName || session?.username || "-"}</span>
              {session?.role === "admin" && (
                <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] uppercase text-zinc-500">
                  admin
                </span>
              )}
            </div>
            <Link
              href="/account/change-password"
              className="flex items-center gap-1 text-zinc-500 hover:text-zinc-900"
              title="เปลี่ยนรหัสผ่าน"
            >
              <KeyRound className="h-4 w-4" />
            </Link>
            <form action={logoutAction}>
              <button
                type="submit"
                className="flex items-center gap-1 text-zinc-500 hover:text-zinc-900"
                title="ออกจากโปรแกรม"
              >
                <LogOut className="h-4 w-4" /> ออก
              </button>
            </form>
          </div>
        </header>
        <div className="flex-1 overflow-auto bg-zinc-100 p-6">{children}</div>
      </main>
    </div>
  );
}
