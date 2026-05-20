import Link from "next/link";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getCustomerList } from "@/lib/queries/customers";
import { CustomerTableWithDetail, type CustomerRow } from "./table-with-detail";

export const dynamic = "force-dynamic";

const PER_PAGE = 20;

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const q = (sp.q ?? "").trim();
  const code = (sp.code ?? "").trim();

  const result = await getCustomerList({
    q: q || code || undefined,
    page,
    perPage: PER_PAGE,
  });

  const rows: CustomerRow[] = result.rows;

  const buildHref = (overrides: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams();
    const merged = { ...sp, ...overrides };
    for (const [k, v] of Object.entries(merged)) {
      if (v !== undefined && v !== "" && v !== null) params.set(k, String(v));
    }
    const s = params.toString();
    return s ? `/customers?${s}` : "/customers";
  };

  const pageNumbers = buildPageNumbers(page, result.lastPage);
  const offset = (page - 1) * PER_PAGE;

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-blue-900">
              บันทึกรายชื่อผู้ประกอบการ{" "}
              <span className="italic">/ Customers</span>
            </h1>
            <p className="text-xs text-zinc-500">
              ทั้งหมด {result.total.toLocaleString()} ราย — หน้า {page} /{" "}
              {result.lastPage}
            </p>
          </div>
        </div>

        {/* Top search bar (cyan, like /invoices) */}
        <form
          method="get"
          action="/customers"
          className="grid grid-cols-1 gap-2 rounded-md border border-cyan-300 bg-cyan-50 px-3 py-2 md:grid-cols-[1.6fr_1fr_auto_auto]"
        >
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-cyan-700" />
            <Input
              name="q"
              defaultValue={q}
              placeholder="ค้นหารายชื่อกิจการ / เลขผู้เสียภาษี"
              className="h-8 bg-white pl-8 text-[12px]"
            />
          </div>
          <Input
            name="code"
            defaultValue={code}
            placeholder="รหัสลูกค้า"
            className="h-8 bg-white font-mono text-[12px]"
          />
          <Button
            type="submit"
            size="sm"
            className="bg-amber-500 text-amber-950 hover:bg-amber-600"
          >
            ค้นหา
          </Button>
          {(q || code) && (
            <Link href="/customers">
              <Button type="button" size="sm" variant="outline">
                ยกเลิกค้นหา
              </Button>
            </Link>
          )}
        </form>

        <CustomerTableWithDetail rows={rows} />

        {result.lastPage > 1 && (
          <div className="flex items-center justify-between">
            <div className="text-xs text-zinc-500">
              แสดง {(offset + 1).toLocaleString()}–
              {Math.min(offset + rows.length, result.total).toLocaleString()}{" "}
              จาก {result.total.toLocaleString()} รายการ
            </div>
            <div className="flex items-center gap-1">
              <Link
                href={buildHref({ page: Math.max(1, page - 1) })}
                className={page === 1 ? "pointer-events-none opacity-40" : ""}
              >
                <Button variant="outline" size="sm">
                  <ChevronLeft className="h-4 w-4" />
                  ก่อนหน้า
                </Button>
              </Link>
              {pageNumbers.map((p, i) =>
                p === "…" ? (
                  <span key={`g${i}`} className="px-2 text-zinc-400">
                    …
                  </span>
                ) : (
                  <Link key={p} href={buildHref({ page: p })}>
                    <Button
                      variant={p === page ? "default" : "outline"}
                      size="sm"
                      className={
                        p === page ? "bg-blue-600 hover:bg-blue-700" : ""
                      }
                    >
                      {p}
                    </Button>
                  </Link>
                ),
              )}
              <Link
                href={buildHref({
                  page: Math.min(result.lastPage, page + 1),
                })}
                className={
                  page === result.lastPage
                    ? "pointer-events-none opacity-40"
                    : ""
                }
              >
                <Button variant="outline" size="sm">
                  ถัดไป
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function buildPageNumbers(current: number, last: number): (number | "…")[] {
  if (last <= 7) {
    return Array.from({ length: last }, (_, i) => i + 1);
  }
  const result: (number | "…")[] = [1];
  const start = Math.max(2, current - 2);
  const end = Math.min(last - 1, current + 2);
  if (start > 2) result.push("…");
  for (let i = start; i <= end; i++) result.push(i);
  if (end < last - 1) result.push("…");
  result.push(last);
  return result;
}
