import { db } from "@/db/client";
import { sql } from "drizzle-orm";

export type TaxMonthlyRow = {
  id: number;
  docNo: string;
  docDate: string;
  customerName: string | null;
  customerTaxId: string | null;
  customerBranch: string | null;
  amountBeforeVat: number;
  vatAmount: number;
  total: number;
};

export type TaxMonthlyResult = {
  rows: TaxMonthlyRow[];
  summary: { count: number; amountBeforeVat: number; vatAmount: number; total: number };
  years: string[];
};

export type ReportDocType = "invoice" | "quotation" | "billing_slip";

const VALID_DOC_TYPES: ReportDocType[] = ["invoice", "quotation", "billing_slip"];

export function normalizeDocType(v: string | undefined): ReportDocType {
  return (VALID_DOC_TYPES as string[]).includes(v ?? "")
    ? (v as ReportDocType)
    : "invoice";
}

export async function getTaxMonthly(opts: {
  year?: string;
  month?: string;
  docType?: ReportDocType;
}): Promise<TaxMonthlyResult> {
  const docType = opts.docType ?? "invoice";

  const yearsRaw = await db.execute<{ y: string }>(sql`
    SELECT DISTINCT to_char(doc_date,'YYYY') AS y
      FROM documents WHERE document_type = ${docType}
     ORDER BY y DESC
  `);
  const years = yearsRaw.map((r) => r.y);

  if (!opts.year || !opts.month) {
    return {
      rows: [],
      summary: { count: 0, amountBeforeVat: 0, vatAmount: 0, total: 0 },
      years,
    };
  }

  const m = String(parseInt(opts.month, 10)).padStart(2, "0");

  const rowsRaw = await db.execute<{
    id: number;
    doc_no: string;
    doc_date: string;
    customer_name_snapshot: string | null;
    customer_tax_id_snapshot: string | null;
    customer_branch_snapshot: string | null;
    amount_before_vat: string;
    vat_amount: string;
    total: string;
  }>(sql`
    SELECT id, doc_no, doc_date::text,
           customer_name_snapshot, customer_tax_id_snapshot, customer_branch_snapshot,
           amount_before_vat::text, vat_amount::text, total::text
      FROM documents
     WHERE document_type = ${docType}
       AND to_char(doc_date,'YYYY') = ${opts.year}
       AND to_char(doc_date,'MM') = ${m}
       AND status != 'cancelled'
     ORDER BY doc_date, doc_no
  `);

  let count = 0,
    abv = 0,
    vat = 0,
    tot = 0;
  const rows = rowsRaw.map((r) => {
    count++;
    abv += Number(r.amount_before_vat);
    vat += Number(r.vat_amount);
    tot += Number(r.total);
    return {
      id: Number(r.id),
      docNo: r.doc_no,
      docDate: r.doc_date,
      customerName: r.customer_name_snapshot,
      customerTaxId: r.customer_tax_id_snapshot,
      customerBranch: r.customer_branch_snapshot,
      amountBeforeVat: Number(r.amount_before_vat),
      vatAmount: Number(r.vat_amount),
      total: Number(r.total),
    };
  });

  return {
    rows,
    summary: { count, amountBeforeVat: abv, vatAmount: vat, total: tot },
    years,
  };
}
