/**
 * Reusable: import NEW invoices from a FoxPro Invoice.DBF (+ optional .FPT)
 * into the documents table — preserves customers/products/other doc types.
 *
 * Behaviour:
 *  - reads every record in the DBF
 *  - skips any whose doc_no (INVOICE or RUNNING) is already in `documents`
 *    where document_type = 'invoice' (base name + any -DUP## variant)
 *  - inserts the remainder along with their up-to-15 line items
 *  - refreshes invoice counters for the affected months
 *
 * customer_id / product_id are looked up in the *current* Postgres state;
 * if not found the FK is left NULL — the snapshot fields on the invoice
 * still hold the printable customer name/address.
 */
import { DBFFile } from "dbffile";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  documents,
  documentItems,
  counters,
  migrationLog,
} from "@/db/schema";

export type ImportResult = {
  recordsRead: number;
  alreadyExisted: number;
  inserted: number;
  insertedInvoices: number;
  insertedCreditNotes: number;
  itemsInserted: number;
  dupRenamed: number;
  skipped: number;
  countersUpdated: number;
  newDocNos: string[];
};

function s(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const t = String(v).trim();
  return t === "" ? null : t;
}
function n(v: unknown): string {
  if (v === null || v === undefined || v === "") return "0";
  const x = Number(v);
  return Number.isNaN(x) ? "0" : x.toString();
}
function int(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  const x = parseInt(String(v), 10);
  return Number.isNaN(x) ? 0 : x;
}
function bool(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === "boolean") return v;
  const t = String(v).toLowerCase().trim();
  return t === "true" || t === "1" || t === "t" || t === "y";
}
function date(v: unknown): string | null {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const t = String(v).trim();
  if (!t || t === "00000000") return null;
  return t.slice(0, 10);
}

/**
 * @param dbfPath  Absolute path to Invoice.DBF — .FPT memo file (if any)
 *                 must sit at the same path with .fpt extension. dbffile
 *                 auto-links it.
 */
export async function importInvoicesFromDbf(
  dbfPath: string,
): Promise<ImportResult> {
  const dbf = await DBFFile.open(dbfPath, { encoding: "tis620" });
  const records = (await dbf.readRecords(dbf.recordCount)) as Record<
    string,
    unknown
  >[];

  const [companyRow] = await db.execute<{ company_id: number }>(sql`
    SELECT id AS company_id FROM companies LIMIT 1
  `);
  if (!companyRow) throw new Error("no company row — set up company first");
  const companyId = Number(companyRow.company_id);

  // FoxPro stores invoices AND credit notes in the same Invoice.DBF (TYPE=3
  // for credit notes), so we must check both document_types when deduping.
  const existing = await db.execute<{ doc_no: string }>(sql`
    SELECT doc_no FROM documents
     WHERE document_type IN ('invoice', 'credit_note')
  `);
  // strip any -DUP## suffix when checking — a re-import must not duplicate
  const existingBase = new Set<string>();
  for (const r of existing) {
    existingBase.add(r.doc_no.replace(/-DUP\d+$/, ""));
  }

  const custRows = await db.execute<{ code: string; id: number }>(sql`
    SELECT code, id FROM customers
  `);
  const customerMap = new Map(custRows.map((r) => [r.code, Number(r.id)]));
  const prodRows = await db.execute<{ code: string; id: number }>(sql`
    SELECT code, id FROM products
  `);
  const productMap = new Map(prodRows.map((r) => [r.code, Number(r.id)]));

  const result: ImportResult = {
    recordsRead: records.length,
    alreadyExisted: 0,
    inserted: 0,
    insertedInvoices: 0,
    insertedCreditNotes: 0,
    itemsInserted: 0,
    dupRenamed: 0,
    skipped: 0,
    countersUpdated: 0,
    newDocNos: [],
  };

  // dedup within this batch (FoxPro source sometimes has duplicates)
  const seenInBatch = new Map<string, number>();

  for (const r of records) {
    let docNo = s(r.INVOICE) || s(r.RUNNING);
    const docDate = date(r.DATE);
    if (!docNo || !docDate) {
      result.skipped++;
      continue;
    }
    if (existingBase.has(docNo)) {
      result.alreadyExisted++;
      continue;
    }
    const origDocNo = docNo;
    const dupCount = seenInBatch.get(docNo) ?? 0;
    if (dupCount > 0) {
      docNo = `${docNo}-DUP${dupCount + 1}`;
      result.dupRenamed++;
    }
    seenInBatch.set(origDocNo, dupCount + 1);

    const customerCode = s(r.NAME);
    const customerId = customerCode
      ? customerMap.get(customerCode) ?? null
      : null;

    // FoxPro distinguishes credit notes via TYPE=3 (also visible as the CN
    // prefix on doc_no). Map both to the new schema's credit_note type so
    // tax reports / the /credit-notes page see them correctly.
    const isCreditNote =
      String(r.TYPE ?? "").trim() === "3" || docNo.startsWith("CN");
    const documentType = isCreditNote ? "credit_note" : "invoice";

    const [doc] = await db
      .insert(documents)
      .values({
        documentType,
        docNo,
        internalSeq: s(r.RUNNING),
        docDate,
        dueDate: date(r.DUE),
        paymentTermsDays: int(r.TERM),
        companyId,
        customerId,
        customerCodeSnapshot: customerCode,
        customerNameSnapshot: s(r.INVARNAME),
        customerTaxIdSnapshot: s(r.TAXID),
        customerBranchSnapshot: s(r.BRANCH),
        customerAddressSnapshot:
          [s(r.ADDR1), s(r.ADDR2), s(r.ADDR3)].filter(Boolean).join("\n") ||
          null,
        customerTelSnapshot: s(r.TEL),
        customerProvinceSnapshot: s(r.PROVINCE),
        salemanName: s(r.SALEMAN),
        shippingMethod: s(r.TRANS),
        referenceQuotationNo: s(r.QUATATION),
        subtotal: n(r.AMOUNT1),
        discount: n(r.AMOUNT2),
        amountBeforeVat: n(r.ALLAMOUNT),
        vatAmount: n(r.VAT),
        total: n(r.TOTAL),
        withholdingTaxAmount: n(r.WHTAX),
        netTotal: n(r.NETTOTAL),
        totalInWordsTh: s(r.ALPHA),
        memo: s(r.INVMEMO),
        remark1: s(r.INVREMK1),
        remark2: s(r.INVREMK2),
        arStatus: bool(r.CHK_AR) ? "paid" : "pending",
        legacyRunning: s(r.RUNNING),
        legacyType: s(r.TYPE),
        legacyMonthyear: s(r.MONTHYEAR),
        legacyText2: s(r.TEXT2),
        legacyText2Jnv: s(r.TEXT2_JNV),
        legacyChk1: bool(r.CHK1),
        legacyChkAr: bool(r.CHK_AR),
        legacyCashDraw: s(r.CCASHDRAW),
        legacyBranch2: s(r.BRANCH2),
        legacyBranch2Detail: s(r.BRN2DTL),
      })
      .returning({ id: documents.id });

    if (!doc) {
      result.skipped++;
      continue;
    }

    const items: (typeof documentItems.$inferInsert)[] = [];
    for (let k = 1; k <= 15; k++) {
      const desc = s(r[`LINE${k}`]);
      const qty = n(r[`QUAN${k}`]);
      const price = n(r[`PRICE${k}`]);
      const amt = n(r[`AMT${k}`]);
      const pd = s(r[`PD${k}`]);
      const unit = s(r[`UNIT${k}`]);
      if (!desc && qty === "0" && price === "0" && amt === "0" && !pd) continue;
      items.push({
        documentId: doc.id,
        lineNo: k,
        productId: pd ? productMap.get(pd) ?? null : null,
        productCodeSnapshot: pd,
        description: desc,
        quantity: qty,
        unit,
        unitPrice: price,
        amount: amt,
      });
      result.itemsInserted++;
    }
    if (items.length) await db.insert(documentItems).values(items);

    result.inserted++;
    if (isCreditNote) result.insertedCreditNotes++;
    else result.insertedInvoices++;
    result.newDocNos.push(docNo);
  }

  // refresh counters
  if (result.inserted > 0) {
    const monthly = await db.execute<{
      yearmonth: string;
      max_no: number;
    }>(sql`
      SELECT legacy_monthyear AS yearmonth,
             MAX(CAST(SUBSTRING(doc_no FROM '[0-9]+$') AS INTEGER)) AS max_no
        FROM documents
       WHERE document_type = 'invoice'
         AND legacy_monthyear IS NOT NULL
         AND doc_no ~ '[0-9]+$'
       GROUP BY legacy_monthyear
    `);
    for (const r of monthly) {
      const my = r.yearmonth;
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
        .onConflictDoUpdate({
          target: counters.key,
          set: { currentValue: r.max_no },
        });
      result.countersUpdated++;
    }
  }

  await db.insert(migrationLog).values({
    sourceTable: "Invoice.DBF (UI)",
    targetTable: "documents+items",
    rowsIn: records.length,
    rowsOut: result.inserted,
    rowsSkipped: result.skipped,
    notes: `UI import: existed=${result.alreadyExisted}, items=${result.itemsInserted}, dup=${result.dupRenamed}`,
  });

  return result;
}
