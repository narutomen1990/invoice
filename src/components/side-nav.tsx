"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isPathAllowedForRole } from "@/lib/auth/access";
import {
  FileSpreadsheet,
  FileText,
  FileMinus,
  Receipt,
  ReceiptText,
  Users,
  Package,
  Building2,
  BarChart3,
  Wrench,
  Shield,
  Archive,
  LayoutDashboard,
  Settings,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

const MENU = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/quotations", label: "บันทึกรายการใบเสนอราคา", icon: FileSpreadsheet },
  { href: "/billing", label: "บันทึกรายการใบแจ้งหนี้", icon: Receipt },
  { href: "/invoices", label: "บันทึกรายการใบกำกับภาษีขาย", icon: FileText },
  { href: "/credit-notes", label: "บันทึกรายการใบลดหนี้", icon: FileMinus },
  { href: "/withholding", label: "หนังสือรับรองหัก ณ ที่จ่าย", icon: ReceiptText },
  { href: "/customers", label: "บันทึกรายชื่อลูกค้า", icon: Users },
  { href: "/products", label: "บันทึกรายการสินค้า/บริการ", icon: Package },
  { href: "/settings", label: "บันทึกข้อมูลกิจการ", icon: Building2 },
  { href: "/reports/tax-monthly", label: "รายงานภาษีขาย", icon: BarChart3 },
  { href: "/reports/service-center", label: "รายงานภาษีงานซ่อม", icon: Wrench },
] as const;

// Admin-only — grouped under "ตั้งค่าระบบ" in the sidebar.
const SYSTEM_SETTINGS_MENU = [
  { href: "/users", label: "ระบบรักษาความปลอดภัย", icon: Shield },
  { href: "/backup", label: "สำรองข้อมูล ( BackUp )", icon: Archive },
] as const;

export function SideNav({ role }: { role?: string }) {
  const pathname = usePathname();
  const isAdmin = role === "admin";
  const menu = MENU.filter((it) => !role || isPathAllowedForRole(role, it.href));

  function isActive(href: string): boolean {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  }

  const inSystemSettings = SYSTEM_SETTINGS_MENU.some((it) => isActive(it.href));
  const [settingsOpen, setSettingsOpen] = useState(inSystemSettings);

  return (
    <nav className="space-y-1 p-3 text-sm">
      {menu.map((it) => {
        const Icon = it.icon;
        const active = isActive(it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            className={
              active
                ? "flex items-center gap-2.5 rounded-md border border-blue-700 bg-gradient-to-b from-blue-500 to-blue-600 px-3 py-2 font-semibold text-white shadow-sm"
                : "flex items-center gap-2.5 rounded-md border border-transparent bg-white px-3 py-2 text-zinc-700 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50"
            }
          >
            <Icon
              className={`h-4 w-4 ${active ? "text-white" : "text-zinc-500"}`}
            />
            <span className="truncate">{it.label}</span>
          </Link>
        );
      })}

      {isAdmin && (
        <div>
          <button
            type="button"
            onClick={() => setSettingsOpen((v) => !v)}
            className={
              inSystemSettings && !settingsOpen
                ? "flex w-full items-center gap-2.5 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 font-semibold text-blue-700 shadow-sm"
                : "flex w-full items-center gap-2.5 rounded-md border border-transparent bg-white px-3 py-2 text-zinc-700 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50"
            }
          >
            <Settings className="h-4 w-4 text-zinc-500" />
            <span className="flex-1 truncate text-left">ตั้งค่าระบบ</span>
            {settingsOpen ? (
              <ChevronDown className="h-4 w-4 text-zinc-400" />
            ) : (
              <ChevronRight className="h-4 w-4 text-zinc-400" />
            )}
          </button>
          {settingsOpen && (
            <div className="mt-1 space-y-1 pl-4">
              {SYSTEM_SETTINGS_MENU.map((it) => {
                const Icon = it.icon;
                const active = isActive(it.href);
                return (
                  <Link
                    key={it.href}
                    href={it.href}
                    className={
                      active
                        ? "flex items-center gap-2.5 rounded-md border border-blue-700 bg-gradient-to-b from-blue-500 to-blue-600 px-3 py-2 font-semibold text-white shadow-sm"
                        : "flex items-center gap-2.5 rounded-md border border-transparent bg-white px-3 py-2 text-zinc-700 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50"
                    }
                  >
                    <Icon
                      className={`h-4 w-4 ${active ? "text-white" : "text-zinc-500"}`}
                    />
                    <span className="truncate">{it.label}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}
    </nav>
  );
}
