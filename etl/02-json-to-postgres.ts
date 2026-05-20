/**
 * ETL Step 2: JSON → PostgreSQL
 * อ่าน JSON intermediate (จาก 01-dbf-to-json.py) → import เข้า Postgres
 *
 * ใช้:
 *   npm run etl:import
 */
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "../src/db/client";
import {
  companies,
  customers,
  products,
  documents,
  documentItems,
  users,
  migrationLog,
  counters,
} from "../src/db/schema";
import { sql, eq } from "drizzle-orm";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "output");

type DbfFile<T = Record<string, unknown>> = {
  source: string;
  encoding: string;
  fields: { name: string; type: string; length: number; decimal: number }[];
  records: T[];
};

function s(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const str = String(v).trim();
  return str === "" ? null : str;
}

function n(v: unknown): string {
  if (v === null || v === undefined || v === "") return "0";
  const num = Number(v);
  if (Number.isNaN(num)) return "0";
  return num.toString();
}

function i(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  const num = parseInt(String(v), 10);
  return Number.isNaN(num) ? 0 : num;
}

function b(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === "boolean") return v;
  const str = String(v).toLowerCase().trim();
  return str === "true" || str === "1" || str === "t" || str === "y";
}

function d(v: unknown): string | null {
  if (!v) return null;
  const str = String(v).trim();
  if (!str || str === "00000000") return null;
  // dbfread returns ISO already (date.isoformat())
  return str.slice(0, 10);
}

async function loadJson<T>(name: string): Promise<DbfFile<T>> {
  const path = join(OUT_DIR, `${name}.json`);
  const raw = await readFile(path, "utf-8");
  return JSON.parse(raw) as DbfFile<T>;
}

// ============================================================
// 1. Company
// ============================================================
async function migrateCompanies(): Promise<{ id: number }> {
  const data = await loadJson("Company");
  const r = data.records[0] as Record<string, unknown>;
  if (!r) throw new Error("Company.dbf empty");

  const addrTh = [1, 2, 3, 4, 5, 6, 7]
    .map((i) => s(r[`TADDR${i}`]))
    .filter(Boolean)
    .join(" ");
  const addrEn = [1, 2, 3, 4, 5, 6, 7]
    .map((i) => s(r[`EADDR${i}`]))
    .filter(Boolean)
    .join(" ");

  const [row] = await db
    .insert(companies)
    .values({
      code: s(r.COMPCODE),
      nameTh: s(r.TCOMPANY) ?? "(ไม่ระบุ)",
      nameEn: s(r.ECOMPANY),
      taxId: s(r.CIDCOMP),
      addressTh: addrTh || null,
      addressEn: addrEn || null,
      postcode: s(r.CPOST),
      tel: s(r.CTEL),
      email: s(r.EMAIL),
      website: s(r.WEBSITE),
      vatRate: n(r.NVATRATE) === "0" ? "7.00" : n(r.NVATRATE),
    })
    .returning({ id: companies.id });

  await db.insert(migrationLog).values({
    sourceTable: "Company.dbf",
    targetTable: "companies",
    rowsIn: 1,
    rowsOut: 1,
  });

  console.log(`  ✓ companies: 1`);
  return row;
}

// ============================================================
// 2. Customers
// ============================================================
async function migrateCustomers(): Promise<Map<string, number>> {
  const data = await loadJson("Customer");
  const codeToId = new Map<string, number>();
  let inserted = 0;
  let skipped = 0;

  for (const r of data.records) {
    const rec = r as Record<string, unknown>;
    const code = s(rec.NAME);
    const name = s(rec.INVARNAME);
    if (!code || !name) {
      skipped++;
      continue;
    }
    if (codeToId.has(code)) {
      skipped++;
      continue;
    }
    const [row] = await db
      .insert(customers)
      .values({
        code,
        name,
        taxId: s(rec.TAXID),
        defaultBranchCode: s(rec.BRANCH),
        province: s(rec.PROVINCE),
        address1: s(rec.ADDR1),
        address2: s(rec.ADDR2),
        address3: s(rec.ADDR3),
        tel: s(rec.TEL),
        fax: s(rec.FAX),
        email: s(rec.EMAIL),
        website: s(rec.WEBSITE),
        contactName: s(rec.CONTACT),
        contactNick: s(rec.CONTNICK),
        contactMobile: s(rec.CONTMOBILE),
        contactEmail: s(rec.CONTEMAIL),
      })
      .onConflictDoNothing({ target: customers.code })
      .returning({ id: customers.id });

    if (row) {
      codeToId.set(code, row.id);
      inserted++;
    }
  }

  await db.insert(migrationLog).values({
    sourceTable: "Customer.DBF",
    targetTable: "customers",
    rowsIn: data.records.length,
    rowsOut: inserted,
    rowsSkipped: skipped,
  });

  console.log(`  ✓ customers: ${inserted} (skipped ${skipped})`);
  return codeToId;
}

// ============================================================
// 3. Products
// ============================================================
async function migrateProducts(): Promise<Map<string, number>> {
  const data = await loadJson("cProduct");
  const codeToId = new Map<string, number>();
  let inserted = 0;

  for (const r of data.records) {
    const rec = r as Record<string, unknown>;
    const code = s(rec.PDID);
    const name = s(rec.PDETAIL1);
    if (!code || !name) continue;

    const [row] = await db
      .insert(products)
      .values({
        code,
        name,
        unit: s(rec.PUNIT1),
        price: n(rec.PPRICE1),
      })
      .onConflictDoNothing({ target: products.code })
      .returning({ id: products.id });

    if (row) {
      codeToId.set(code, row.id);
      inserted++;
    }
  }

  await db.insert(migrationLog).values({
    sourceTable: "cProduct.DBF",
    targetTable: "products",
    rowsIn: data.records.length,
    rowsOut: inserted,
  });

  console.log(`  ✓ products: ${inserted}`);
  return codeToId;
}

// ============================================================
// 4. Users
// ============================================================
async function migrateUsers(): Promise<void> {
  const data = await loadJson("userpwd");
  let inserted = 0;

  for (const r of data.records) {
    const rec = r as Record<string, unknown>;
    const username = s(rec.USERNAME);
    const password = s(rec.PASSWORD);
    if (!username || !password) continue;

    // เก็บ plaintext ก่อน + force change ตอน login ครั้งแรก
    // จะ hash ตอน user เปลี่ยนรหัสครั้งแรก
    await db
      .insert(users)
      .values({
        username,
        passwordHash: `legacy:${password}`,
        fullName: s(rec.FULLNAME),
        role: "staff",
        mustChangePassword: true,
      })
      .onConflictDoNothing({ target: users.username });
    inserted++;
  }

  await db.insert(migrationLog).values({
    sourceTable: "userpwd.dbf",
    targetTable: "users",
    rowsIn: data.records.length,
    rowsOut: inserted,
    notes: "passwords stored as legacy:<plaintext>, must change on first login",
  });

  console.log(`  ✓ users: ${inserted}`);
}

// ============================================================
// 5. Documents (Invoice.DBF) + items
// ============================================================
async function migrateDocuments(
  companyId: number,
  customerCodeToId: Map<string, number>,
  productCodeToId: Map<string, number>,
): Promise<void> {
  const data = await loadJson("Invoice");
  let docOut = 0;
  let itemOut = 0;
  let skipped = 0;

  console.log(`  → migrating ${data.records.length.toLocaleString()} invoices...`);

  const seenDocNo = new Map<string, number>();
  let dupRenamed = 0;

  for (const r of data.records) {
    const rec = r as Record<string, unknown>;
    let docNo = s(rec.INVOICE) || s(rec.RUNNING);
    const docDate = d(rec.DATE);
    if (!docDate) {
      skipped++;
      continue;
    }
    if (!docNo) {
      skipped++;
      continue;
    }

    // handle duplicate doc_no (real dupes in source DBF — append suffix)
    const seen = seenDocNo.get(docNo) ?? 0;
    if (seen > 0) {
      docNo = `${docNo}-DUP${seen + 1}`;
      dupRenamed++;
    }
    seenDocNo.set(s(rec.INVOICE) || s(rec.RUNNING) || "", seen + 1);

    const customerCode = s(rec.NAME);
    const customerId = customerCode ? customerCodeToId.get(customerCode) ?? null : null;

    const [doc] = await db
      .insert(documents)
      .values({
        documentType: "invoice",
        docNo,
        internalSeq: s(rec.RUNNING),
        docDate,
        dueDate: d(rec.DUE),
        paymentTermsDays: i(rec.TERM),
        companyId,
        customerId,
        customerCodeSnapshot: customerCode,
        customerNameSnapshot: s(rec.INVARNAME),
        customerTaxIdSnapshot: s(rec.TAXID),
        customerBranchSnapshot: s(rec.BRANCH),
        customerAddressSnapshot: [s(rec.ADDR1), s(rec.ADDR2), s(rec.ADDR3)]
          .filter(Boolean)
          .join("\n") || null,
        customerTelSnapshot: s(rec.TEL),
        customerProvinceSnapshot: s(rec.PROVINCE),
        salemanName: s(rec.SALEMAN),
        shippingMethod: s(rec.TRANS),
        referenceQuotationNo: s(rec.QUATATION),
        subtotal: n(rec.AMOUNT1),
        discount: n(rec.AMOUNT2),
        amountBeforeVat: n(rec.ALLAMOUNT),
        vatAmount: n(rec.VAT),
        total: n(rec.TOTAL),
        withholdingTaxAmount: n(rec.WHTAX),
        netTotal: n(rec.NETTOTAL),
        totalInWordsTh: s(rec.ALPHA),
        memo: s(rec.INVMEMO),
        remark1: s(rec.INVREMK1),
        remark2: s(rec.INVREMK2),
        arStatus: b(rec.CHK_AR) ? "paid" : "pending",
        legacyRunning: s(rec.RUNNING),
        legacyType: s(rec.TYPE),
        legacyMonthyear: s(rec.MONTHYEAR),
        legacyText2: s(rec.TEXT2),
        legacyText2Jnv: s(rec.TEXT2_JNV),
        legacyChk1: b(rec.CHK1),
        legacyChkAr: b(rec.CHK_AR),
        legacyCashDraw: s(rec.CCASHDRAW),
        legacyBranch2: s(rec.BRANCH2),
        legacyBranch2Detail: s(rec.BRN2DTL),
      })
      .returning({ id: documents.id });

    if (!doc) {
      skipped++;
      continue;
    }

    // expand 15 line items
    const items: typeof documentItems.$inferInsert[] = [];
    for (let k = 1; k <= 15; k++) {
      const desc = s(rec[`LINE${k}`]);
      const qty = n(rec[`QUAN${k}`]);
      const price = n(rec[`PRICE${k}`]);
      const amt = n(rec[`AMT${k}`]);
      const pd = s(rec[`PD${k}`]);
      const unit = s(rec[`UNIT${k}`]);
      // skip empty
      if (!desc && qty === "0" && price === "0" && amt === "0" && !pd) continue;

      items.push({
        documentId: doc.id,
        lineNo: k,
        productId: pd ? productCodeToId.get(pd) ?? null : null,
        productCodeSnapshot: pd,
        description: desc,
        quantity: qty,
        unit,
        unitPrice: price,
        amount: amt,
      });
      itemOut++;
    }
    if (items.length) {
      await db.insert(documentItems).values(items);
    }

    docOut++;
    if (docOut % 500 === 0) {
      console.log(`     ... ${docOut.toLocaleString()} / ${data.records.length.toLocaleString()}`);
    }
  }

  await db.insert(migrationLog).values({
    sourceTable: "Invoice.DBF",
    targetTable: "documents+items",
    rowsIn: data.records.length,
    rowsOut: docOut,
    rowsSkipped: skipped,
    notes: `${itemOut} items, ${dupRenamed} duplicates renamed with -DUP suffix`,
  });

  console.log(`  ✓ documents: ${docOut.toLocaleString()}, items: ${itemOut.toLocaleString()} (skipped ${skipped}, dup-renamed ${dupRenamed})`);
}

// ============================================================
// 6. Counters (init from latest doc_no per month)
// ============================================================
async function initCounters(): Promise<void> {
  // หาเลขสูงสุดต่อปี/เดือน จาก documents ที่ migrate มา
  const rows = await db.execute<{
    legacy_monthyear: string;
    max_no: number;
  }>(sql`
    SELECT legacy_monthyear,
           MAX(CAST(SUBSTRING(doc_no FROM '[0-9]+$') AS INTEGER)) as max_no
    FROM documents
    WHERE document_type = 'invoice'
      AND legacy_monthyear IS NOT NULL
      AND doc_no ~ '[0-9]+$'
    GROUP BY legacy_monthyear
  `);

  let n = 0;
  for (const r of rows) {
    const my = r.legacy_monthyear; // 'MMYY'
    if (!my || my.length !== 4) continue;
    const mm = my.slice(0, 2);
    const yy = my.slice(2, 4);
    await db
      .insert(counters)
      .values({
        key: `invoice:${yy}:${mm}`,
        documentType: "invoice",
        yearBe: yy,
        month: mm,
        currentValue: r.max_no,
        prefix: "IV",
      })
      .onConflictDoNothing({ target: counters.key });
    n++;
  }
  console.log(`  ✓ counters initialized: ${n}`);
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  console.log("=".repeat(60));
  console.log("ETL Step 2: JSON → PostgreSQL");
  console.log("=".repeat(60));

  console.log("\n[1/6] Companies");
  const company = await migrateCompanies();

  console.log("\n[2/6] Customers");
  const customerMap = await migrateCustomers();

  console.log("\n[3/6] Products");
  const productMap = await migrateProducts();

  console.log("\n[4/6] Users");
  await migrateUsers();

  console.log("\n[5/6] Documents + items (อาจใช้เวลาสักครู่...)");
  await migrateDocuments(company.id, customerMap, productMap);

  console.log("\n[6/6] Counters");
  await initCounters();

  console.log("\n" + "=".repeat(60));
  console.log("✓ ETL complete");

  // summary
  const counts = await db.execute<{ table_name: string; n: number }>(sql`
    SELECT 'companies' AS table_name, COUNT(*)::int AS n FROM companies UNION ALL
    SELECT 'customers',     COUNT(*)::int FROM customers UNION ALL
    SELECT 'products',      COUNT(*)::int FROM products UNION ALL
    SELECT 'documents',     COUNT(*)::int FROM documents UNION ALL
    SELECT 'document_items', COUNT(*)::int FROM document_items UNION ALL
    SELECT 'users',         COUNT(*)::int FROM users UNION ALL
    SELECT 'counters',      COUNT(*)::int FROM counters
  `);
  console.log("\nFinal counts:");
  for (const c of counts) console.log(`  ${c.table_name.padEnd(20)} ${c.n.toLocaleString()}`);

  process.exit(0);
}

main().catch((err) => {
  console.error("✗ ETL failed:", err);
  process.exit(1);
});
