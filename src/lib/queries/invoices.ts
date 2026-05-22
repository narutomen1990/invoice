import { db } from "@/db/client";
import { sql } from "drizzle-orm";

export type InvoiceListFilters = {
  q?: string;        // search doc_no / customer name / tax_id
  year?: string;     // 'YYYY' (BE)
  month?: string;    // '01'..'12'
  status?: string;   // ar_status
  customerId?: string;
  page?: number;
  perPage?: number;
};

export type InvoiceListRow = {
  id: number;
  docNo: string;
  docDate: string;
  customerName: string | null;
  customerTaxId: string | null;
  amountBeforeVat: number;
  vatAmount: number;
  total: number;
  arStatus: string;
  status: string;
};

export type InvoiceListResult = {
  rows: InvoiceListRow[];
  total: number;
  page: number;
  perPage: number;
  lastPage: number;
  sumTotal: number;
  sumVat: number;
  years: string[];
};

export async function getInvoiceList(f: InvoiceListFilters): Promise<InvoiceListResult> {
  const page = Math.max(1, f.page ?? 1);
  const perPage = Math.min(200, Math.max(10, f.perPage ?? 50));
  const offset = (page - 1) * perPage;

  // build dynamic WHERE
  const conds = [sql`document_type = 'invoice'`];
  if (f.q) {
    const like = `%${f.q}%`;
    conds.push(
      sql`(doc_no ILIKE ${like} OR customer_name_snapshot ILIKE ${like} OR customer_tax_id_snapshot ILIKE ${like})`,
    );
  }
  if (f.year) {
    conds.push(sql`to_char(doc_date, 'YYYY') = ${f.year}`);
  }
  if (f.month) {
    const m = String(parseInt(f.month, 10)).padStart(2, "0");
    conds.push(sql`to_char(doc_date, 'MM') = ${m}`);
  }
  if (f.status) {
    conds.push(sql`ar_status = ${f.status}::ar_status`);
  }
  if (f.customerId) {
    conds.push(sql`customer_id = ${parseInt(f.customerId, 10)}`);
  }
  const whereSql = sql.join(conds, sql` AND `);

  // paginated rows
  const rowsRaw = await db.execute<{
    id: number;
    doc_no: string;
    doc_date: string;
    customer_name_snapshot: string | null;
    customer_tax_id_snapshot: string | null;
    amount_before_vat: string;
    vat_amount: string;
    total: string;
    ar_status: string;
    status: string;
  }>(sql`
    SELECT id, doc_no, doc_date::text,
           customer_name_snapshot, customer_tax_id_snapshot,
           amount_before_vat::text, vat_amount::text, total::text,
           ar_status::text, status::text
      FROM documents
     WHERE ${whereSql}
     ORDER BY doc_date DESC, doc_no DESC
     LIMIT ${perPage} OFFSET ${offset}
  `);

  // count + sums (single query)
  const [agg] = await db.execute<{ n: string; t: string; v: string }>(sql`
    SELECT COUNT(*)::text AS n,
           COALESCE(SUM(total),0)::text AS t,
           COALESCE(SUM(vat_amount),0)::text AS v
      FROM documents
     WHERE ${whereSql}
  `);

  // distinct years (for filter dropdown)
  const yearsRaw = await db.execute<{ y: string }>(sql`
    SELECT DISTINCT to_char(doc_date, 'YYYY') AS y
      FROM documents WHERE document_type='invoice'
     ORDER BY y DESC
  `);

  const total = Number(agg.n);
  return {
    rows: rowsRaw.map((r) => ({
      id: Number(r.id),
      docNo: r.doc_no,
      docDate: r.doc_date,
      customerName: r.customer_name_snapshot,
      customerTaxId: r.customer_tax_id_snapshot,
      amountBeforeVat: Number(r.amount_before_vat),
      vatAmount: Number(r.vat_amount),
      total: Number(r.total),
      arStatus: r.ar_status,
      status: r.status,
    })),
    total,
    page,
    perPage,
    lastPage: Math.max(1, Math.ceil(total / perPage)),
    sumTotal: Number(agg.t),
    sumVat: Number(agg.v),
    years: yearsRaw.map((r) => r.y),
  };
}

// ============================================================
// Detail
// ============================================================
export type InvoiceDetail = {
  doc: {
    id: number;
    docNo: string;
    docDate: string;
    dueDate: string | null;
    paymentTermsDays: number;
    customerId: number | null;
    customerCode: string | null;
    customerName: string | null;
    customerTaxId: string | null;
    customerBranch: string | null;
    customerAddress: string | null;
    customerTel: string | null;
    customerProvince: string | null;
    referenceQuotationNo: string | null;
    salemanName: string | null;
    shippingMethod: string | null;
    subtotal: number;
    discount: number;
    amountBeforeVat: number;
    vatRate: number;
    vatAmount: number;
    total: number;
    withholdingTaxAmount: number;
    netTotal: number;
    totalInWordsTh: string | null;
    memo: string | null;
    remark1: string | null;
    remark2: string | null;
    arStatus: string;
    status: string;
    createdAt: string;
    updatedAt: string;
    legacyRunning: string | null;
  };
  items: {
    lineNo: number | null;
    productCode: string | null;
    description: string | null;
    quantity: number;
    unit: string | null;
    unitPrice: number;
    amount: number;
  }[];
  company: {
    nameTh: string;
    taxId: string | null;
    addressTh: string | null;
    tel: string | null;
  };
};

export async function getInvoiceById(id: number): Promise<InvoiceDetail | null> {
  const docRaw = await db.execute<any>(sql`
    SELECT * FROM documents WHERE id = ${id} LIMIT 1
  `);
  const d = docRaw[0];
  if (!d) return null;

  const itemsRaw = await db.execute<any>(sql`
    SELECT line_no, product_code_snapshot, description, quantity::text, unit,
           unit_price::text, amount::text
      FROM document_items
     WHERE document_id = ${id}
     ORDER BY id
  `);

  const compRaw = await db.execute<any>(sql`
    SELECT name_th, tax_id, address_th, tel
      FROM companies
     WHERE id = ${d.company_id}
     LIMIT 1
  `);
  const c = compRaw[0];

  return {
    doc: {
      id: Number(d.id),
      docNo: d.doc_no,
      docDate: d.doc_date,
      dueDate: d.due_date,
      paymentTermsDays: d.payment_terms_days,
      customerId: d.customer_id,
      customerCode: d.customer_code_snapshot,
      customerName: d.customer_name_snapshot,
      customerTaxId: d.customer_tax_id_snapshot,
      customerBranch: d.customer_branch_snapshot,
      customerAddress: d.customer_address_snapshot,
      customerTel: d.customer_tel_snapshot,
      customerProvince: d.customer_province_snapshot,
      referenceQuotationNo: d.reference_quotation_no,
      salemanName: d.saleman_name,
      shippingMethod: d.shipping_method,
      subtotal: Number(d.subtotal),
      discount: Number(d.discount),
      amountBeforeVat: Number(d.amount_before_vat),
      vatRate: Number(d.vat_rate),
      vatAmount: Number(d.vat_amount),
      total: Number(d.total),
      withholdingTaxAmount: Number(d.withholding_tax_amount),
      netTotal: Number(d.net_total),
      totalInWordsTh: d.total_in_words_th,
      memo: d.memo,
      remark1: d.remark1,
      remark2: d.remark2,
      arStatus: d.ar_status,
      status: d.status,
      createdAt: d.created_at,
      updatedAt: d.updated_at,
      legacyRunning: d.legacy_running,
    },
    items: itemsRaw.map((i) => ({
      lineNo: i.line_no == null ? null : Number(i.line_no),
      productCode: i.product_code_snapshot,
      description: i.description,
      quantity: Number(i.quantity),
      unit: i.unit,
      unitPrice: Number(i.unit_price),
      amount: Number(i.amount),
    })),
    company: {
      nameTh: c?.name_th ?? "",
      taxId: c?.tax_id ?? null,
      addressTh: c?.address_th ?? null,
      tel: c?.tel ?? null,
    },
  };
}
