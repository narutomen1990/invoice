import { db } from "@/db/client";
import { sql } from "drizzle-orm";

export type ProductListRow = {
  id: number;
  code: string;
  name: string;
  unit: string | null;
  price: number;
  isService: boolean;
  isActive: boolean;
  salesCount: number;
  salesTotal: number;
};

export async function getProductList(opts: { q?: string }): Promise<ProductListRow[]> {
  const conds = [sql`p.deleted_at IS NULL`];
  if (opts.q) {
    const like = `%${opts.q}%`;
    conds.push(sql`(p.code ILIKE ${like} OR p.name ILIKE ${like})`);
  }
  const whereSql = sql.join(conds, sql` AND `);

  const rows = await db.execute<{
    id: number;
    code: string;
    name: string;
    unit: string | null;
    price: string;
    is_service: boolean;
    is_active: boolean;
    n: string;
    t: string;
  }>(sql`
    SELECT p.id, p.code, p.name, p.unit, p.price::text, p.is_service, p.is_active,
           COALESCE(s.n,0)::text AS n, COALESCE(s.t,0)::text AS t
      FROM products p
      LEFT JOIN (
        SELECT i.product_id, COUNT(DISTINCT d.id) AS n, SUM(i.amount) AS t
          FROM document_items i
          JOIN documents d ON d.id = i.document_id
         WHERE d.document_type='invoice' AND i.product_id IS NOT NULL
         GROUP BY i.product_id
      ) s ON s.product_id = p.id
     WHERE ${whereSql}
     ORDER BY p.code
  `);

  return rows.map((r) => ({
    id: Number(r.id),
    code: r.code,
    name: r.name,
    unit: r.unit,
    price: Number(r.price),
    isService: r.is_service,
    isActive: r.is_active,
    salesCount: Number(r.n),
    salesTotal: Number(r.t),
  }));
}

export type ProductDetail = {
  id: number;
  code: string;
  name: string;
  nameEn: string | null;
  unit: string | null;
  price: number;
  isService: boolean;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  stats: {
    totalSold: number;
    totalAmount: number;
    distinctInvoices: number;
    firstSold: string | null;
    lastSold: string | null;
  };
  yearly: { y: string; qty: number; amount: number; invoices: number }[];
  recent: {
    invoiceId: number;
    docNo: string;
    docDate: string;
    customer: string | null;
    quantity: number;
    unitPrice: number;
    amount: number;
  }[];
};

export async function getProductById(id: number): Promise<ProductDetail | null> {
  const pRaw = await db.execute<any>(sql`
    SELECT * FROM products WHERE id = ${id} AND deleted_at IS NULL LIMIT 1
  `);
  const p = pRaw[0];
  if (!p) return null;

  const [stats] = await db.execute<{
    qty: string;
    amt: string;
    n: string;
    first_d: string | null;
    last_d: string | null;
  }>(sql`
    SELECT COALESCE(SUM(i.quantity),0)::text AS qty,
           COALESCE(SUM(i.amount),0)::text AS amt,
           COUNT(DISTINCT i.document_id)::text AS n,
           MIN(d.doc_date)::text AS first_d,
           MAX(d.doc_date)::text AS last_d
      FROM document_items i
      JOIN documents d ON d.id = i.document_id
     WHERE i.product_id = ${id} AND d.document_type='invoice'
  `);

  const yearly = await db.execute<{ y: string; qty: string; amt: string; n: string }>(sql`
    SELECT to_char(d.doc_date, 'YYYY') AS y,
           COALESCE(SUM(i.quantity),0)::text AS qty,
           COALESCE(SUM(i.amount),0)::text AS amt,
           COUNT(DISTINCT i.document_id)::text AS n
      FROM document_items i
      JOIN documents d ON d.id = i.document_id
     WHERE i.product_id = ${id} AND d.document_type='invoice'
     GROUP BY y ORDER BY y DESC
  `);

  const recent = await db.execute<any>(sql`
    SELECT d.id, d.doc_no, d.doc_date::text, d.customer_name_snapshot,
           i.quantity::text, i.unit_price::text, i.amount::text
      FROM document_items i
      JOIN documents d ON d.id = i.document_id
     WHERE i.product_id = ${id} AND d.document_type='invoice'
     ORDER BY d.doc_date DESC, d.doc_no DESC
     LIMIT 30
  `);

  return {
    id: Number(p.id),
    code: p.code,
    name: p.name,
    nameEn: p.name_en,
    unit: p.unit,
    price: Number(p.price),
    isService: p.is_service,
    isActive: p.is_active,
    notes: p.notes,
    createdAt: p.created_at,
    stats: {
      totalSold: Number(stats.qty),
      totalAmount: Number(stats.amt),
      distinctInvoices: Number(stats.n),
      firstSold: stats.first_d,
      lastSold: stats.last_d,
    },
    yearly: yearly.map((r) => ({
      y: r.y,
      qty: Number(r.qty),
      amount: Number(r.amt),
      invoices: Number(r.n),
    })),
    recent: recent.map((r) => ({
      invoiceId: Number(r.id),
      docNo: r.doc_no,
      docDate: r.doc_date,
      customer: r.customer_name_snapshot,
      quantity: Number(r.quantity),
      unitPrice: Number(r.unit_price),
      amount: Number(r.amount),
    })),
  };
}
