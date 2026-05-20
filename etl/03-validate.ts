/**
 * ETL Step 3: Validation
 * เปรียบเทียบ count + sum ระหว่าง DBF (JSON intermediate) vs Postgres
 *
 * ใช้:
 *   npm run etl:verify
 */
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "../src/db/client";
import { documents, documentItems, customers, products } from "../src/db/schema";
import { eq, sql } from "drizzle-orm";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "output");

type DbfFile<T = Record<string, unknown>> = {
  source: string;
  encoding: string;
  records: T[];
};

async function loadJson<T>(name: string): Promise<DbfFile<T>> {
  return JSON.parse(await readFile(join(OUT_DIR, `${name}.json`), "utf-8"));
}

function n(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  const num = Number(v);
  return Number.isNaN(num) ? 0 : num;
}

function fmtMoney(x: number): string {
  return x.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function ok(label: string, expect: number | string, got: number | string): boolean {
  const pass = String(expect) === String(got);
  const mark = pass ? "✓" : "✗";
  console.log(`  ${mark} ${label.padEnd(40)} expect=${String(expect).padStart(15)}  got=${String(got).padStart(15)}`);
  return pass;
}

async function main() {
  console.log("=".repeat(70));
  console.log("ETL Step 3: Validation (DBF vs Postgres)");
  console.log("=".repeat(70));

  let allPass = true;

  // ----- counts -----
  console.log("\nCounts:");

  const dbfCustomers = await loadJson("Customer");
  const dbCustomers = await db.$count(customers);
  // count valid customer rows in DBF (with NAME + INVARNAME)
  const dbfCustomerValid = dbfCustomers.records.filter((r: any) => r.NAME && r.INVARNAME).length;
  allPass = ok("customers", dbfCustomerValid, dbCustomers) && allPass;

  const dbfProducts = await loadJson("cProduct");
  const dbProducts = await db.$count(products);
  const dbfProductValid = dbfProducts.records.filter((r: any) => r.PDID && r.PDETAIL1).length;
  allPass = ok("products", dbfProductValid, dbProducts) && allPass;

  const dbfInvoices = await loadJson("Invoice");
  const dbDocs = await db.$count(documents);
  const dbfInvValid = dbfInvoices.records.filter((r: any) => r.DATE && (r.INVOICE || r.RUNNING)).length;
  allPass = ok("documents (invoices)", dbfInvValid, dbDocs) && allPass;

  // ----- sums -----
  console.log("\nSums (Invoice.DBF vs documents):");

  let sumVat = 0,
    sumTotal = 0,
    sumNet = 0;
  for (const r of dbfInvoices.records as any[]) {
    if (!r.DATE || !(r.INVOICE || r.RUNNING)) continue;
    sumVat += n(r.VAT);
    sumTotal += n(r.TOTAL);
    sumNet += n(r.NETTOTAL);
  }

  const dbSums = await db.execute<{ vat: string; total: string; net: string }>(sql`
    SELECT
      COALESCE(SUM(vat_amount),0)::text as vat,
      COALESCE(SUM(total),0)::text as total,
      COALESCE(SUM(net_total),0)::text as net
    FROM documents
    WHERE document_type = 'invoice'
  `);

  allPass = ok("SUM(VAT)", fmtMoney(sumVat), fmtMoney(Number(dbSums[0].vat))) && allPass;
  allPass = ok("SUM(TOTAL)", fmtMoney(sumTotal), fmtMoney(Number(dbSums[0].total))) && allPass;
  allPass = ok("SUM(NETTOTAL)", fmtMoney(sumNet), fmtMoney(Number(dbSums[0].net))) && allPass;

  // ----- items -----
  console.log("\nLine items:");
  let dbfItems = 0;
  for (const r of dbfInvoices.records as any[]) {
    if (!r.DATE) continue;
    for (let k = 1; k <= 15; k++) {
      const desc = r[`LINE${k}`];
      const qty = n(r[`QUAN${k}`]);
      const price = n(r[`PRICE${k}`]);
      const amt = n(r[`AMT${k}`]);
      const pd = r[`PD${k}`];
      if ((desc && String(desc).trim()) || qty || price || amt || (pd && String(pd).trim())) {
        dbfItems++;
      }
    }
  }
  const dbItems = await db.$count(documentItems);
  allPass = ok("document_items", dbfItems, dbItems) && allPass;

  // ----- date range -----
  console.log("\nDate range:");
  const dr = await db.execute<{ min: string; max: string }>(sql`
    SELECT MIN(doc_date)::text as min, MAX(doc_date)::text as max FROM documents
  `);
  console.log(`  documents: ${dr[0].min}  →  ${dr[0].max}`);

  // ----- spot check 5 random invoices -----
  console.log("\nSpot check 5 random invoices:");
  const sample = await db.execute<any>(sql`
    SELECT doc_no, doc_date, customer_name_snapshot, total
    FROM documents
    WHERE document_type='invoice'
    ORDER BY random()
    LIMIT 5
  `);
  for (const r of sample) {
    console.log(`  ${r.doc_no}  ${r.doc_date}  ${(r.customer_name_snapshot||"").slice(0,30).padEnd(30)}  ${fmtMoney(Number(r.total))}`);
  }

  console.log("\n" + "=".repeat(70));
  console.log(allPass ? "✓ All checks passed" : "✗ SOME CHECKS FAILED");
  console.log("=".repeat(70));

  process.exit(allPass ? 0 : 1);
}

main().catch((err) => {
  console.error("✗ Validation error:", err);
  process.exit(1);
});
