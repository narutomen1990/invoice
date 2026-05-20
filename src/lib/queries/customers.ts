import { db } from "@/db/client";
import { sql } from "drizzle-orm";

export type CustomerListRow = {
  id: number;
  code: string;
  name: string;
  taxId: string | null;
  branch: string | null;
  province: string | null;
  tel: string | null;
  address1: string | null;
  address2: string | null;
  address3: string | null;
  defaultSalemanName: string | null;
  invoiceCount: number;
  invoiceTotal: number;
  lastInvoiceDate: string | null;
  lastProductName: string | null;
};

export type CustomerListResult = {
  rows: CustomerListRow[];
  total: number;
  page: number;
  perPage: number;
  lastPage: number;
};

export async function getCustomerList(opts: {
  q?: string;
  page?: number;
  perPage?: number;
}): Promise<CustomerListResult> {
  const page = Math.max(1, opts.page ?? 1);
  const perPage = Math.min(200, Math.max(10, opts.perPage ?? 50));
  const offset = (page - 1) * perPage;

  const conds = [sql`c.deleted_at IS NULL`];
  if (opts.q) {
    const like = `%${opts.q}%`;
    conds.push(sql`(c.code ILIKE ${like} OR c.name ILIKE ${like} OR c.tax_id ILIKE ${like})`);
  }
  const whereSql = sql.join(conds, sql` AND `);

  const rowsRaw = await db.execute<{
    id: number;
    code: string;
    name: string;
    tax_id: string | null;
    default_branch_code: string | null;
    province: string | null;
    tel: string | null;
    address1: string | null;
    address2: string | null;
    address3: string | null;
    default_saleman_name: string | null;
    n: string;
    t: string;
    last_d: string | null;
    last_product: string | null;
  }>(sql`
    SELECT c.id, c.code, c.name, c.tax_id, c.default_branch_code, c.province, c.tel,
           c.address1, c.address2, c.address3, c.default_saleman_name,
           COALESCE(d.n,0)::text AS n,
           COALESCE(d.t,0)::text AS t,
           d.last_d::text AS last_d,
           lp.last_product
      FROM customers c
      LEFT JOIN (
        SELECT customer_id,
               COUNT(*) AS n,
               SUM(total) AS t,
               MAX(doc_date) AS last_d
          FROM documents
         WHERE document_type='invoice' AND customer_id IS NOT NULL
         GROUP BY customer_id
      ) d ON d.customer_id = c.id
      LEFT JOIN LATERAL (
        SELECT COALESCE(di.description, di.product_code_snapshot) AS last_product
          FROM documents doc
          JOIN document_items di ON di.document_id = doc.id
         WHERE doc.document_type='invoice'
           AND doc.customer_id = c.id
         ORDER BY doc.doc_date DESC, doc.id DESC, di.line_no ASC
         LIMIT 1
      ) lp ON TRUE
     WHERE ${whereSql}
     ORDER BY c.code DESC
     LIMIT ${perPage} OFFSET ${offset}
  `);

  const [agg] = await db.execute<{ n: string }>(
    sql`SELECT COUNT(*)::text AS n FROM customers c WHERE ${whereSql}`,
  );
  const total = Number(agg.n);

  return {
    rows: rowsRaw.map((r) => ({
      id: Number(r.id),
      code: r.code,
      name: r.name,
      taxId: r.tax_id,
      branch: r.default_branch_code,
      province: r.province,
      tel: r.tel,
      address1: r.address1,
      address2: r.address2,
      address3: r.address3,
      defaultSalemanName: r.default_saleman_name,
      invoiceCount: Number(r.n),
      invoiceTotal: Number(r.t),
      lastInvoiceDate: r.last_d,
      lastProductName: r.last_product,
    })),
    total,
    page,
    perPage,
    lastPage: Math.max(1, Math.ceil(total / perPage)),
  };
}

export type CustomerDetail = {
  id: number;
  code: string;
  name: string;
  nameEn: string | null;
  taxId: string | null;
  defaultBranchCode: string | null;
  province: string | null;
  address1: string | null;
  address2: string | null;
  address3: string | null;
  tel: string | null;
  fax: string | null;
  email: string | null;
  website: string | null;
  contactName: string | null;
  contactNick: string | null;
  contactMobile: string | null;
  contactEmail: string | null;
  defaultSalemanName: string | null;
  defaultSalemanTel: string | null;
  defaultSalemanEmail: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  stats: {
    invoiceCount: number;
    invoiceTotal: number;
    invoiceVat: number;
    firstDate: string | null;
    lastDate: string | null;
    arPending: number;
    arPaid: number;
  };
  recentInvoices: {
    id: number;
    docNo: string;
    docDate: string;
    total: number;
    arStatus: string;
  }[];
  yearlyStats: { y: string; count: number; total: number }[];
};

export async function getCustomerById(id: number): Promise<CustomerDetail | null> {
  const cRaw = await db.execute<any>(sql`
    SELECT * FROM customers WHERE id = ${id} AND deleted_at IS NULL LIMIT 1
  `);
  const c = cRaw[0];
  if (!c) return null;

  const [stats] = await db.execute<{
    n: string;
    t: string;
    v: string;
    first_d: string | null;
    last_d: string | null;
    pending: string;
    paid: string;
  }>(sql`
    SELECT COUNT(*)::text AS n,
           COALESCE(SUM(total),0)::text AS t,
           COALESCE(SUM(vat_amount),0)::text AS v,
           MIN(doc_date)::text AS first_d,
           MAX(doc_date)::text AS last_d,
           COALESCE(SUM(CASE WHEN ar_status IN ('pending','overdue','partial') THEN total ELSE 0 END),0)::text AS pending,
           COALESCE(SUM(CASE WHEN ar_status='paid' THEN total ELSE 0 END),0)::text AS paid
      FROM documents
     WHERE document_type='invoice' AND customer_id = ${id}
  `);

  const recent = await db.execute<any>(sql`
    SELECT id, doc_no, doc_date::text, total::text, ar_status::text
      FROM documents
     WHERE document_type='invoice' AND customer_id = ${id}
     ORDER BY doc_date DESC, doc_no DESC
     LIMIT 20
  `);

  const yearly = await db.execute<{ y: string; n: string; t: string }>(sql`
    SELECT to_char(doc_date,'YYYY') AS y,
           COUNT(*)::text AS n,
           COALESCE(SUM(total),0)::text AS t
      FROM documents
     WHERE document_type='invoice' AND customer_id = ${id}
     GROUP BY y ORDER BY y DESC
  `);

  return {
    id: Number(c.id),
    code: c.code,
    name: c.name,
    nameEn: c.name_en,
    taxId: c.tax_id,
    defaultBranchCode: c.default_branch_code,
    province: c.province,
    address1: c.address1,
    address2: c.address2,
    address3: c.address3,
    tel: c.tel,
    fax: c.fax,
    email: c.email,
    website: c.website,
    contactName: c.contact_name,
    contactNick: c.contact_nick,
    contactMobile: c.contact_mobile,
    contactEmail: c.contact_email,
    defaultSalemanName: c.default_saleman_name,
    defaultSalemanTel: c.default_saleman_tel,
    defaultSalemanEmail: c.default_saleman_email,
    notes: c.notes,
    isActive: c.is_active,
    createdAt: c.created_at,
    stats: {
      invoiceCount: Number(stats.n),
      invoiceTotal: Number(stats.t),
      invoiceVat: Number(stats.v),
      firstDate: stats.first_d,
      lastDate: stats.last_d,
      arPending: Number(stats.pending),
      arPaid: Number(stats.paid),
    },
    recentInvoices: recent.map((r) => ({
      id: Number(r.id),
      docNo: r.doc_no,
      docDate: r.doc_date,
      total: Number(r.total),
      arStatus: r.ar_status,
    })),
    yearlyStats: yearly.map((r) => ({
      y: r.y,
      count: Number(r.n),
      total: Number(r.t),
    })),
  };
}
