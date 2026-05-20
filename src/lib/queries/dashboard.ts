import { db } from "@/db/client";
import { sql } from "drizzle-orm";

export type DashboardStats = {
  totals: {
    documents: number;
    customers: number;
    products: number;
    grandTotal: number;
  };
  current: {
    monthLabel: string;
    monthStart: string;
    count: number;
    total: number;
    vat: number;
  };
  previous: {
    count: number;
    total: number;
  };
  monthly: { ym: string; count: number; total: number }[];
  yearly: { y: string; count: number; total: number }[];
  topCustomers: { name: string; taxId: string | null; count: number; total: number }[];
  topProducts: { code: string | null; name: string | null; qty: number; total: number }[];
  recent: {
    id: number;
    docNo: string;
    docDate: string;
    customer: string;
    total: number;
  }[];
};

const THAI_MONTHS = [
  "",
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

export async function getDashboardStats(): Promise<DashboardStats> {
  // ===== latest doc date (treat as "current month") =====
  const [latest] = await db.execute<{ d: string | null }>(
    sql`SELECT MAX(doc_date)::text AS d FROM documents WHERE document_type = 'invoice'`,
  );
  const latestDate = latest?.d ?? null;

  // ===== totals =====
  const [tot] = await db.execute<{
    docs: string;
    cust: string;
    prod: string;
    grand: string;
  }>(sql`
    SELECT
      (SELECT COUNT(*) FROM documents WHERE document_type='invoice')::text  AS docs,
      (SELECT COUNT(*) FROM customers WHERE deleted_at IS NULL)::text       AS cust,
      (SELECT COUNT(*) FROM products WHERE deleted_at IS NULL)::text        AS prod,
      (SELECT COALESCE(SUM(total),0) FROM documents WHERE document_type='invoice')::text AS grand
  `);

  // ===== current month + previous month =====
  let curRow = { count: 0, total: 0, vat: 0, monthStart: "", monthLabel: "" };
  let prevRow = { count: 0, total: 0 };
  if (latestDate) {
    const [y, m] = latestDate.split("-");
    const monthStart = `${y}-${m}-01`;
    curRow.monthStart = monthStart;
    curRow.monthLabel = `${THAI_MONTHS[parseInt(m!, 10)]} ${y}`;

    const [cur] = await db.execute<{ n: string; t: string; v: string }>(sql`
      SELECT COUNT(*)::text n,
             COALESCE(SUM(total),0)::text t,
             COALESCE(SUM(vat_amount),0)::text v
        FROM documents
       WHERE document_type='invoice'
         AND doc_date >= ${monthStart}::date
         AND doc_date < (${monthStart}::date + INTERVAL '1 month')
    `);
    curRow.count = Number(cur.n);
    curRow.total = Number(cur.t);
    curRow.vat = Number(cur.v);

    const [prev] = await db.execute<{ n: string; t: string }>(sql`
      SELECT COUNT(*)::text n, COALESCE(SUM(total),0)::text t
        FROM documents
       WHERE document_type='invoice'
         AND doc_date >= (${monthStart}::date - INTERVAL '1 month')
         AND doc_date <  ${monthStart}::date
    `);
    prevRow.count = Number(prev.n);
    prevRow.total = Number(prev.t);
  }

  // ===== monthly (12 months back from latest) =====
  const monthlyRaw = await db.execute<{ ym: string; n: string; t: string }>(sql`
    SELECT to_char(doc_date, 'YYYY-MM') AS ym,
           COUNT(*)::text AS n,
           COALESCE(SUM(total),0)::text AS t
      FROM documents
     WHERE document_type='invoice'
       AND doc_date >= (
         (SELECT MAX(doc_date) FROM documents WHERE document_type='invoice')
          - INTERVAL '11 months'
       )
     GROUP BY ym
     ORDER BY ym
  `);
  const monthly = monthlyRaw.map((r) => ({
    ym: r.ym,
    count: Number(r.n),
    total: Number(r.t),
  }));

  // ===== yearly =====
  const yearlyRaw = await db.execute<{ y: string; n: string; t: string }>(sql`
    SELECT to_char(doc_date, 'YYYY') AS y,
           COUNT(*)::text AS n,
           COALESCE(SUM(total),0)::text AS t
      FROM documents
     WHERE document_type='invoice'
     GROUP BY y
     ORDER BY y
  `);
  const yearly = yearlyRaw.map((r) => ({
    y: r.y,
    count: Number(r.n),
    total: Number(r.t),
  }));

  // ===== top customers (this year) =====
  const yearStart = latestDate ? `${latestDate.slice(0, 4)}-01-01` : "1900-01-01";
  const topCustomersRaw = await db.execute<{
    name: string;
    tax_id: string | null;
    n: string;
    t: string;
  }>(sql`
    SELECT customer_name_snapshot AS name,
           customer_tax_id_snapshot AS tax_id,
           COUNT(*)::text AS n,
           COALESCE(SUM(total),0)::text AS t
      FROM documents
     WHERE document_type='invoice'
       AND doc_date >= ${yearStart}::date
     GROUP BY name, tax_id
     ORDER BY SUM(total) DESC NULLS LAST
     LIMIT 10
  `);
  const topCustomers = topCustomersRaw.map((r) => ({
    name: r.name ?? "-",
    taxId: r.tax_id,
    count: Number(r.n),
    total: Number(r.t),
  }));

  // ===== top products (this year) =====
  const topProductsRaw = await db.execute<{
    code: string | null;
    name: string | null;
    qty: string;
    t: string;
  }>(sql`
    SELECT i.product_code_snapshot AS code,
           i.description AS name,
           COALESCE(SUM(i.quantity),0)::text AS qty,
           COALESCE(SUM(i.amount),0)::text AS t
      FROM document_items i
      JOIN documents d ON d.id = i.document_id
     WHERE d.document_type='invoice'
       AND d.doc_date >= ${yearStart}::date
     GROUP BY code, name
     ORDER BY SUM(i.amount) DESC NULLS LAST
     LIMIT 10
  `);
  const topProducts = topProductsRaw.map((r) => ({
    code: r.code,
    name: r.name,
    qty: Number(r.qty),
    total: Number(r.t),
  }));

  // ===== recent invoices =====
  const recentRaw = await db.execute<{
    id: number;
    doc_no: string;
    doc_date: string;
    customer_name_snapshot: string | null;
    total: string;
  }>(sql`
    SELECT id, doc_no, doc_date::text, customer_name_snapshot, total::text
      FROM documents
     WHERE document_type='invoice'
     ORDER BY doc_date DESC, doc_no DESC
     LIMIT 10
  `);
  const recent = recentRaw.map((r) => ({
    id: Number(r.id),
    docNo: r.doc_no,
    docDate: r.doc_date,
    customer: r.customer_name_snapshot ?? "-",
    total: Number(r.total),
  }));

  return {
    totals: {
      documents: Number(tot.docs),
      customers: Number(tot.cust),
      products: Number(tot.prod),
      grandTotal: Number(tot.grand),
    },
    current: curRow,
    previous: prevRow,
    monthly,
    yearly,
    topCustomers,
    topProducts,
    recent,
  };
}
