/**
 * Seed sample ใบวางบิล (billing_slip) records.
 *
 * Run:
 *   pnpm tsx scripts/seed-billing-slips.ts
 *   or
 *   npx tsx scripts/seed-billing-slips.ts
 *
 * Picks up to 5 active customers from the DB and creates one sample
 * billing slip for each.
 */

import { sql } from "drizzle-orm";
import { db } from "../src/db/client";
import {
  documents,
  documentItems,
  companies,
  customers,
} from "../src/db/schema";
import { reserveNextDocNo } from "../src/lib/counter";
import { bahtText } from "../src/lib/thai/number";

type SeedItem = {
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
};

type SeedSpec = {
  daysAgo: number;       // doc_date offset from today
  paidRatio: 0 | 0.5 | 1; // 0 = pending, 0.5 = partial, 1 = paid
  paymentMethod: string;
  remark?: string;
  items: SeedItem[];
};

const SPECS: SeedSpec[] = [
  {
    daysAgo: 1,
    paidRatio: 1,
    paymentMethod: "Transfer",
    remark: "ชำระโดยโอน — ยอดเข้าบัญชี SCB",
    items: [
      { description: "ค่าบริการดูแลระบบรายเดือน", quantity: 1, unit: "งวด", unitPrice: 5000 },
      { description: "ค่าบริการสำรองข้อมูล", quantity: 1, unit: "งวด", unitPrice: 1500 },
    ],
  },
  {
    daysAgo: 5,
    paidRatio: 0.5,
    paymentMethod: "Cheque",
    remark: "เช็ค ธ.กรุงไทย เลขที่ 0123456 — ชำระบางส่วน",
    items: [
      { description: "อุปกรณ์เครือข่าย Switch 24 port", quantity: 2, unit: "เครื่อง", unitPrice: 8500 },
      { description: "สาย LAN Cat6 100m", quantity: 3, unit: "ม้วน", unitPrice: 1200 },
    ],
  },
  {
    daysAgo: 10,
    paidRatio: 0,
    paymentMethod: "Not Yet",
    items: [
      { description: "ค่าออกแบบและติดตั้งระบบ CCTV", quantity: 1, unit: "งาน", unitPrice: 28000 },
      { description: "กล้อง IP HikVision 4MP", quantity: 4, unit: "ตัว", unitPrice: 4200 },
      { description: "ค่าเดินทางและติดตั้ง", quantity: 1, unit: "งาน", unitPrice: 3500 },
    ],
  },
  {
    daysAgo: 18,
    paidRatio: 1,
    paymentMethod: "CASH",
    remark: "ชำระเงินสดที่หน้าร้าน",
    items: [
      { description: "หมึก HP 85A (ของแท้)", quantity: 5, unit: "กล่อง", unitPrice: 2300 },
      { description: "กระดาษ A4 80g", quantity: 10, unit: "รีม", unitPrice: 110 },
    ],
  },
  {
    daysAgo: 25,
    paidRatio: 0.5,
    paymentMethod: "Credit Card",
    remark: "บัตรเครดิต KBANK ผ่อน 0% 3 เดือน",
    items: [
      { description: "ค่าบำรุงรักษาเซิร์ฟเวอร์", quantity: 1, unit: "งวด", unitPrice: 12000 },
      { description: "License Antivirus 1 ปี", quantity: 5, unit: "user", unitPrice: 950 },
    ],
  },
];

function dateBE(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const yearBe = d.getFullYear() + 543;
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yearBe}-${mm}-${dd}`;
}

function dueDate(docDateBE: string, days: number): string {
  const [yyyy, mm, dd] = docDateBE.split("-").map((s) => parseInt(s, 10));
  const d = new Date(yyyy! - 543, mm! - 1, dd!);
  d.setDate(d.getDate() + days);
  const yearBe = d.getFullYear() + 543;
  const mmStr = String(d.getMonth() + 1).padStart(2, "0");
  const ddStr = String(d.getDate()).padStart(2, "0");
  return `${yearBe}-${mmStr}-${ddStr}`;
}

async function main() {
  console.log("🌱 Seeding sample billing slips...");

  const [company] = await db.select().from(companies).limit(1);
  if (!company) {
    console.error("❌ ไม่พบบริษัทในตาราง companies — กรุณา setup ก่อน");
    process.exit(1);
  }

  const custList = await db
    .select()
    .from(customers)
    .where(sql`${customers.deletedAt} IS NULL AND ${customers.isActive} = true`)
    .limit(SPECS.length);

  if (custList.length === 0) {
    console.error("❌ ไม่พบลูกค้าในตาราง customers");
    process.exit(1);
  }

  // pick first user for createdBy
  const [adminRow] = await db.execute<{ id: number }>(sql`
    SELECT id FROM users ORDER BY id LIMIT 1
  `);
  const userId = adminRow ? Number(adminRow.id) : 1;

  let created = 0;
  for (let i = 0; i < SPECS.length; i++) {
    const spec = SPECS[i]!;
    const cust = custList[i % custList.length]!;

    const docDate = dateBE(spec.daysAgo);
    const due = dueDate(docDate, 30);

    const subtotal = spec.items.reduce(
      (s, it) => s + it.quantity * it.unitPrice,
      0,
    );
    const amountBeforeVat = +subtotal.toFixed(2);
    const vatRate = 7;
    const vatAmount = +((amountBeforeVat * vatRate) / 100).toFixed(2);
    const total = +(amountBeforeVat + vatAmount).toFixed(2);
    const paid = +(total * spec.paidRatio).toFixed(2);

    const arStatus =
      spec.paidRatio === 1
        ? "paid"
        : spec.paidRatio === 0.5
          ? "partial"
          : "pending";

    try {
      await db.transaction(async (tx) => {
        const reserved = await reserveNextDocNo(tx as any, {
          documentType: "billing_slip",
          docDateBE: docDate,
        });

        const [doc] = await tx
          .insert(documents)
          .values({
            documentType: "billing_slip",
            docNo: reserved.docNo,
            internalSeq: `${reserved.yearBe}${reserved.month}${String(reserved.value).padStart(5, "0")}`,
            docDate,
            dueDate: due,
            paymentTermsDays: 30,
            companyId: company.id,
            companyNameSnapshot: company.nameTh,
            companyTaxIdSnapshot: company.taxId,
            customerId: cust.id,
            customerCodeSnapshot: cust.code,
            customerNameSnapshot: cust.name,
            customerTaxIdSnapshot: cust.taxId ?? null,
            customerBranchSnapshot: cust.defaultBranchCode ?? null,
            customerAddressSnapshot: [cust.address1, cust.address2, cust.address3]
              .filter(Boolean)
              .join("\n") || null,
            customerTelSnapshot: cust.tel ?? null,
            customerProvinceSnapshot: cust.province ?? null,
            salemanName: "shaw",
            shippingMethod: null,
            referenceQuotationNo: null,
            subtotal: subtotal.toFixed(2),
            discount: "0.00",
            amountBeforeVat: amountBeforeVat.toFixed(2),
            vatRate: vatRate.toFixed(2),
            vatAmount: vatAmount.toFixed(2),
            total: total.toFixed(2),
            withholdingTaxRate: "0.00",
            withholdingTaxAmount: "0.00",
            netTotal: total.toFixed(2),
            totalInWordsTh: bahtText(total),
            memo: null,
            remark1: "สินค้าซื้อแล้วไม่รับเปลี่ยนหรือคืนในทุกกรณี",
            status: "issued",
            arStatus,
            legacyData: {
              payment: {
                paymentDate: spec.paidRatio > 0 ? docDate : null,
                receiptNo: null,
                paidAmount: paid,
                paymentMethod: spec.paymentMethod,
                remark: spec.remark ?? null,
              },
              contact: {
                name: null,
                tel: null,
              },
            },
            createdByUserId: userId,
            updatedByUserId: userId,
          })
          .returning({ id: documents.id, docNo: documents.docNo });

        await tx.insert(documentItems).values(
          spec.items.map((it, idx) => ({
            documentId: doc.id,
            lineNo: idx + 1,
            productCodeSnapshot: null,
            description: it.description,
            quantity: it.quantity.toFixed(3),
            unit: it.unit,
            unitPrice: it.unitPrice.toFixed(2),
            amount: (it.quantity * it.unitPrice).toFixed(2),
          })),
        );

        console.log(
          `  ✓ ${doc.docNo}  ${cust.name.slice(0, 30).padEnd(30)}  ฿${total.toLocaleString()}  [${arStatus}]`,
        );
        created++;
      });
    } catch (e: any) {
      console.error(`  ✗ ${cust.name}: ${e?.message ?? e}`);
    }
  }

  console.log(`\n✅ สร้างใบวางบิลตัวอย่างสำเร็จ ${created}/${SPECS.length} ใบ`);
  console.log(`👉 ดูได้ที่ http://localhost:3000/receipts`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
