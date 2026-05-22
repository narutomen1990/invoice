import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import Link from "next/link";
import { db } from "@/db/client";
import { sql } from "drizzle-orm";
import { InvoiceTableWithDetail, type InvoiceRow } from "./table-with-detail";

export const dynamic = "force-dynamic";

const PER_PAGE = 20;

type SearchParams = Promise<Record<string, string | undefined>>;

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const offset = (page - 1) * PER_PAGE;
  const q = (sp.q ?? "").trim();
  const code = (sp.code ?? "").trim();
  const period = (sp.period ?? "").trim(); // 04/69 format
  const docNo = (sp.docNo ?? "").trim();
  const qLike = `%${q}%`;
  const codeLike = `%${code}%`;
  const docNoLike = `%${docNo}%`;

  // period filter parses MM/YY (BE)
  const [periodMM, periodYY] = period.split("/").map((s) => s.trim());

  const [countRow] = await db.execute<{ n: number }>(sql`
    SELECT COUNT(*)::int AS n
      FROM documents
     WHERE document_type = 'invoice'
       AND (${q} = '' OR customer_name_snapshot ILIKE ${qLike})
       AND (${code} = '' OR customer_code_snapshot ILIKE ${codeLike})
       AND (${docNo} = '' OR doc_no ILIKE ${docNoLike})
       AND (${period} = '' OR (
         to_char(doc_date, 'MM') = ${periodMM ?? ""} AND
         RIGHT((EXTRACT(YEAR FROM doc_date) + 543)::text, 2) = ${periodYY ?? ""}
       ))
  `);
  const total = Number(countRow?.n ?? 0);
  const lastPage = Math.max(1, Math.ceil(total / PER_PAGE));

  const rawRows = await db.execute<any>(sql`
    SELECT id, doc_no, internal_seq, doc_date::text,
           customer_code_snapshot, customer_name_snapshot,
           customer_tax_id_snapshot,
           customer_address_snapshot, customer_tel_snapshot,
           saleman_name, memo, reference_quotation_no,
           amount_before_vat::text, vat_amount::text, total::text,
           net_total::text, status::text, ar_status::text,
           created_at::text, updated_at::text
      FROM documents
     WHERE document_type = 'invoice'
       AND (${q} = '' OR customer_name_snapshot ILIKE ${qLike})
       AND (${code} = '' OR customer_code_snapshot ILIKE ${codeLike})
       AND (${docNo} = '' OR doc_no ILIKE ${docNoLike})
       AND (${period} = '' OR (
         to_char(doc_date, 'MM') = ${periodMM ?? ""} AND
         RIGHT((EXTRACT(YEAR FROM doc_date) + 543)::text, 2) = ${periodYY ?? ""}
       ))
     ORDER BY doc_date DESC, id DESC
     LIMIT ${PER_PAGE} OFFSET ${offset}
  `);

  const rows: InvoiceRow[] = rawRows.map((r: any) => ({
    id: Number(r.id),
    docNo: r.doc_no,
    internalSeq: r.internal_seq,
    docDate: r.doc_date,
    customerCode: r.customer_code_snapshot,
    customerName: r.customer_name_snapshot,
    customerTaxId: r.customer_tax_id_snapshot,
    customerAddress: r.customer_address_snapshot,
    customerTel: r.customer_tel_snapshot,
    salemanName: r.saleman_name,
    memo: r.memo,
    referenceQuotationNo: r.reference_quotation_no,
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
    if (code) params.set("code", code);
    if (period) params.set("period", period);
    if (docNo) params.set("docNo", docNo);
    const s = params.toString();
    return s ? `/invoices?${s}` : "/invoices";
  };

  const pageNumbers = buildPageNumbers(page, lastPage);

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-blue-900">
              ใบกำกับภาษีขาย{" "}
              <span className="italic">/ TAX Invoice B2S</span>
            </h1>
            <p className="text-xs text-zinc-500">
              ราคายังไม่รวมภาษีมูลค่าเพิ่ม ( VAT Exclude ) — ทั้งหมด{" "}
              {total.toLocaleString()} รายการ — หน้า {page} / {lastPage}
            </p>
          </div>
        </div>

        {/* Top search bar (4 fields like the legacy app) */}
        <form
          method="get"
          action="/invoices"
          className="grid grid-cols-1 gap-2 rounded-md border border-cyan-300 bg-cyan-50 px-3 py-2 md:grid-cols-[1.4fr_1fr_1fr_1fr_auto_auto]"
        >
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-cyan-700" />
            <Input
              name="q"
              defaultValue={q}
              placeholder="ค้นหารายการ (ชื่อลูกค้า)"
              className="h-8 bg-white pl-8 text-[12px]"
            />
          </div>
          <Input
            name="code"
            defaultValue={code}
            placeholder="รหัส"
            className="h-8 bg-white text-[12px]"
          />
          <Input
            name="period"
            defaultValue={period}
            placeholder="เดือนปีภาษี (04/69)"
            className="h-8 bg-white text-[12px]"
          />
          <Input
            name="docNo"
            defaultValue={docNo}
            placeholder="เลขที่ Invoice"
            className="h-8 bg-white font-mono text-[12px]"
          />
          <Button type="submit" size="sm" variant="search">
            ค้นหา
          </Button>
          {(q || code || period || docNo) && (
            <Link href="/invoices">
              <Button type="button" size="sm" variant="outline">
                ยกเลิกค้นหา
              </Button>
            </Link>
          )}
        </form>

        <InvoiceTableWithDetail rows={rows} />

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
