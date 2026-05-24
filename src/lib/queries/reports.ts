import { db } from "@/db/client";
import { sql } from "drizzle-orm";

export type TaxMonthlyRow = {
  id: number;
  /** invoice = ขาย, credit_note = ใบลดหนี้ที่ต้องนำมาหัก */
  kind: "invoice" | "credit_note";
  docNo: string;
  docDate: string;
  customerName: string | null;
  customerTaxId: string | null;
  customerBranch: string | null;
  amountBeforeVat: number;
  vatAmount: number;
  total: number;
};

type Bucket = { count: number; amountBeforeVat: number; vatAmount: number; total: number };

export type TaxMonthlySummary = {
  count: number;
  /** ยอดขายจากใบกำกับภาษีในเดือน */
  invoice: Bucket;
  /** ใบลดหนี้ที่ออกในเดือน (ตัวเลขเป็นบวก — เอาไปลบจาก invoice) */
  credit: Bucket;
  /** สุทธิหลังหักใบลดหนี้ = invoice − credit (สำหรับยื่น ภพ.30) */
  net: Bucket;
};

export type TaxMonthlyResult = {
  rows: TaxMonthlyRow[];
  summary: TaxMonthlySummary;
  years: string[];
};

export type ReportDocType = "invoice" | "quotation" | "billing_slip";

const VALID_DOC_TYPES: ReportDocType[] = ["invoice", "quotation", "billing_slip"];

export function normalizeDocType(v: string | undefined): ReportDocType {
  return (VALID_DOC_TYPES as string[]).includes(v ?? "")
    ? (v as ReportDocType)
    : "invoice";
}

const emptyBucket = (): Bucket => ({
  count: 0,
  amountBeforeVat: 0,
  vatAmount: 0,
  total: 0,
});

export async function getTaxMonthly(opts: {
  year?: string;
  month?: string;
  docType?: ReportDocType;
}): Promise<TaxMonthlyResult> {
  const docType = opts.docType ?? "invoice";

  // For the sales-VAT report (docType=invoice) we must also pull credit
  // notes from the same month — they reduce the output VAT. Other report
  // types stay single-type.
  const typeList =
    docType === "invoice"
      ? sql`('invoice', 'credit_note')`
      : sql`(${docType})`;

  const yearsRaw = await db.execute<{ y: string }>(sql`
    SELECT DISTINCT to_char(doc_date,'YYYY') AS y
      FROM documents WHERE document_type IN ${typeList}
     ORDER BY y DESC
  `);
  const years = yearsRaw.map((r) => r.y);

  if (!opts.year || !opts.month) {
    return {
      rows: [],
      summary: {
        count: 0,
        invoice: emptyBucket(),
        credit: emptyBucket(),
        net: emptyBucket(),
      },
      years,
    };
  }

  const m = String(parseInt(opts.month, 10)).padStart(2, "0");

  const rowsRaw = await db.execute<{
    id: number;
    document_type: string;
    doc_no: string;
    doc_date: string;
    customer_name_snapshot: string | null;
    customer_tax_id_snapshot: string | null;
    customer_branch_snapshot: string | null;
    amount_before_vat: string;
    vat_amount: string;
    total: string;
  }>(sql`
    SELECT id, document_type, doc_no, doc_date::text,
           customer_name_snapshot, customer_tax_id_snapshot, customer_branch_snapshot,
           amount_before_vat::text, vat_amount::text, total::text
      FROM documents
     WHERE document_type IN ${typeList}
       AND to_char(doc_date,'YYYY') = ${opts.year}
       AND to_char(doc_date,'MM') = ${m}
       AND status != 'cancelled'
     ORDER BY doc_date, doc_no
  `);

  const invoice = emptyBucket();
  const credit = emptyBucket();
  const rows: TaxMonthlyRow[] = rowsRaw.map((r) => {
    const kind: "invoice" | "credit_note" =
      r.document_type === "credit_note" ? "credit_note" : "invoice";
    const abv = Number(r.amount_before_vat);
    const vat = Number(r.vat_amount);
    const tot = Number(r.total);
    const b = kind === "credit_note" ? credit : invoice;
    b.count++;
    b.amountBeforeVat += abv;
    b.vatAmount += vat;
    b.total += tot;
    return {
      id: Number(r.id),
      kind,
      docNo: r.doc_no,
      docDate: r.doc_date,
      customerName: r.customer_name_snapshot,
      customerTaxId: r.customer_tax_id_snapshot,
      customerBranch: r.customer_branch_snapshot,
      amountBeforeVat: abv,
      vatAmount: vat,
      total: tot,
    };
  });

  const net: Bucket = {
    count: invoice.count + credit.count,
    amountBeforeVat: +(invoice.amountBeforeVat - credit.amountBeforeVat).toFixed(2),
    vatAmount: +(invoice.vatAmount - credit.vatAmount).toFixed(2),
    total: +(invoice.total - credit.total).toFixed(2),
  };

  return {
    rows,
    summary: {
      count: rows.length,
      invoice,
      credit,
      net,
    },
    years,
  };
}
