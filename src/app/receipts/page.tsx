import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, ChevronLeft, ChevronRight, Search } from "lucide-react";
import Link from "next/link";
import { db } from "@/db/client";
import { sql } from "drizzle-orm";
import { ReceiptTableWithDetail, type ReceiptRow } from "./table-with-detail";

export const dynamic = "force-dynamic";

const PER_PAGE = 20;

type SearchParams = Promise<Record<string, string | undefined>>;

export default async function ReceiptsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const offset = (page - 1) * PER_PAGE;
  const q = (sp.q ?? "").trim();
  const like = `%${q}%`;

  const [countRow] = await db.execute<{ n: number }>(sql`
    SELECT COUNT(*)::int AS n
      FROM documents
     WHERE document_type IN ('billing_slip', 'receipt')
       AND (${q} = '' OR
            customer_name_snapshot ILIKE ${like} OR
            customer_code_snapshot ILIKE ${like} OR
            doc_no ILIKE ${like})
  `);
  const total = Number(countRow?.n ?? 0);
  const lastPage = Math.max(1, Math.ceil(total / PER_PAGE));

  const rawRows = await db.execute<any>(sql`
    SELECT id, doc_no, doc_date::text, document_type::text,
           customer_code_snapshot, customer_name_snapshot,
           customer_tax_id_snapshot,
           customer_address_snapshot, customer_tel_snapshot,
           saleman_name, memo, reference_quotation_no,
           amount_before_vat::text, vat_amount::text, total::text,
           net_total::text, status::text, ar_status::text,
           created_at::text, updated_at::text
      FROM documents
     WHERE document_type IN ('billing_slip', 'receipt')
       AND (${q} = '' OR
            customer_name_snapshot ILIKE ${like} OR
            customer_code_snapshot ILIKE ${like} OR
            doc_no ILIKE ${like})
     ORDER BY doc_date DESC, id DESC
     LIMIT ${PER_PAGE} OFFSET ${offset}
  `);

  const rows: ReceiptRow[] = rawRows.map((r: any) => ({
    id: Number(r.id),
    docNo: r.doc_no,
    docDate: r.doc_date,
    documentType: r.document_type,
    customerCode: r.customer_code_snapshot,
    customerName: r.customer_name_snapshot,
    customerTaxId: r.customer_tax_id_snapshot,
    customerAddress: r.customer_address_snapshot,
    customerTel: r.customer_tel_snapshot,
    salemanName: r.saleman_name,
    memo: r.memo,
    referenceDocNo: r.reference_quotation_no,
    amountBeforeVat: Number(r.amount_before_vat ?? 0),
    vatAmount: Number(r.vat_amount ?? 0),
    total: Number(r.total ?? 0),
    netTotal: Number(r.net_total ?? 0),
    status: r.status,
    arStatus: r.ar_status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));

  const hrefForPage = (p: number) => {
    const params = new URLSearchParams();
    if (p > 1) params.set("page", String(p));
    if (q) params.set("q", q);
    const s = params.toString();
    return s ? `/receipts?${s}` : "/receipts";
  };

  const pageNumbers = buildPageNumbers(page, lastPage);

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-blue-900">
              ใบวางบิล / ใบเสร็จรับเงิน{" "}
              <span className="italic">(Billing Slip)</span>
            </h1>
            <p className="text-xs text-zinc-500">
              ราคายังไม่รวมภาษีมูลค่าเพิ่ม ( VAT Exclude ) — ทั้งหมด{" "}
              {total.toLocaleString()} รายการ — หน้า {page} / {lastPage}
            </p>
          </div>
        </div>

        <ReceiptTableWithDetail
          rows={rows}
          topActions={
            <Link href="/receipts/new">
              <Button className="bg-emerald-600 hover:bg-emerald-700">
                <Plus className="h-4 w-4" />
                Add ใบวางบิล
              </Button>
            </Link>
          }
          searchSlot={
            <form
              method="get"
              action="/receipts"
              className="flex items-center gap-2 rounded-md border border-cyan-300 bg-cyan-50 px-3 py-2"
            >
              <Search className="h-4 w-4 shrink-0 text-cyan-700" />
              <label
                htmlFor="q"
                className="shrink-0 text-[12px] font-medium text-cyan-900"
              >
                ค้นหารายการจากรายชื่อลูกค้า :
              </label>
              <Input
                id="q"
                name="q"
                defaultValue={q}
                placeholder="พิมพ์ชื่อลูกค้า / รหัส / เลขที่..."
                className="h-8 max-w-sm bg-white"
              />
              <Button type="submit" size="sm" className="bg-cyan-600 hover:bg-cyan-700">
                ค้นหา
              </Button>
              {q && (
                <Link href="/receipts">
                  <Button type="button" variant="outline" size="sm">
                    ล้าง
                  </Button>
                </Link>
              )}
            </form>
          }
        />

        {lastPage > 1 && (
          <div className="flex items-center justify-between">
            <div className="text-xs text-zinc-500">
              แสดง {(offset + 1).toLocaleString()}–
              {Math.min(offset + rows.length, total).toLocaleString()} จาก{" "}
              {total.toLocaleString()} รายการ
            </div>
            <div className="flex items-center gap-1">
              <Link
                href={hrefForPage(Math.max(1, page - 1))}
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
                  <Link key={p} href={hrefForPage(p)}>
                    <Button
                      variant={p === page ? "default" : "outline"}
                      size="sm"
                      className={p === page ? "bg-blue-600 hover:bg-blue-700" : ""}
                    >
                      {p}
                    </Button>
                  </Link>
                ),
              )}
              <Link
                href={hrefForPage(Math.min(lastPage, page + 1))}
                className={
                  page === lastPage ? "pointer-events-none opacity-40" : ""
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
