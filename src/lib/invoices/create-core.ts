import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { documents, documentItems, customers, companies } from "@/db/schema";
import { reserveNextDocNo, useCustomDocNo } from "@/lib/counter";
import { writeJournal } from "@/lib/audit";
import { bahtText } from "@/lib/thai/number";

// Logic ที่ createInvoiceAction (หน้า UI ปกติ, session-based) และ
// POST /api/external/invoices (bearer-key, เรียกจากระบบภายนอกเช่น
// service-center) ใช้ร่วมกัน — กันไม่ให้ transactional logic (reserve doc_no,
// ensure customer, insert documents+items, journal) กระจัดกระจายสองที่

export const ItemInput = z.object({
  lineNo: z.coerce.number().int().min(0).nullable().optional(),
  productCode: z.string().nullable().optional(),
  description: z.string(),
  quantity: z.coerce.number().min(0).default(0),
  unit: z.string().nullable().optional(),
  unitPrice: z.coerce.number().min(0).default(0),
  amount: z.coerce.number().default(0),
});

export const InvoiceInput = z.object({
  docDate: z.string().min(1),
  dueDate: z.string().nullable().optional(),
  paymentTermsDays: z.coerce.number().int().min(0).default(0),
  customerId: z.coerce.number().int().nullable().optional(),
  customerCode: z.string().nullable().optional(),
  customerName: z.string().min(1, "กรุณากรอกชื่อลูกค้า"),
  customerTaxId: z.string().nullable().optional(),
  customerBranch: z.string().nullable().optional(),
  customerAddress: z.string().nullable().optional(),
  customerTel: z.string().nullable().optional(),
  customerProvince: z.string().nullable().optional(),
  salemanName: z.string().nullable().optional(),
  shippingMethod: z.string().nullable().optional(),
  referenceQuotationNo: z.string().nullable().optional(),
  discount: z.coerce.number().min(0).default(0),
  vatRate: z.coerce.number().min(0).max(100).default(7),
  withholdingTaxRate: z.coerce.number().min(0).max(100).default(0),
  memo: z.string().nullable().optional(),
  remark1: z.string().nullable().optional(),
  remark2: z.string().nullable().optional(),
  items: z.array(ItemInput).min(1, "ต้องมีอย่างน้อย 1 รายการ"),
});

export type InvoiceInputData = z.infer<typeof InvoiceInput>;

/**
 * Ensure a customer exists for this invoice.
 *  - If customerId is given, return it as-is (existing customer).
 *  - Else, try to match by customerCode if provided.
 *  - Else, auto-create new customer with auto-generated code.
 */
export async function ensureCustomer(
  tx: any,
  input: InvoiceInputData,
): Promise<{ customerId: number | null; customerCode: string | null }> {
  if (input.customerId) {
    return {
      customerId: input.customerId,
      customerCode: input.customerCode ?? null,
    };
  }

  if (input.customerCode && input.customerCode.trim()) {
    const [existing] = await tx
      .select({ id: customers.id, code: customers.code })
      .from(customers)
      .where(eq(customers.code, input.customerCode.trim()))
      .limit(1);
    if (existing) {
      return { customerId: existing.id, customerCode: existing.code };
    }
  }

  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('customer_code'))`);
  const maxRows = (await tx.execute(sql`
    SELECT MAX(CAST(code AS INTEGER))::text AS max_code
      FROM customers
     WHERE code ~ '^[0-9]+$'
  `)) as Array<{ max_code: string | null }>;
  const maxRow = maxRows[0];
  const next = (Number(maxRow?.max_code ?? 0) || 0) + 1;
  const newCode = String(next).padStart(7, "0");

  const [created] = await tx
    .insert(customers)
    .values({
      code: newCode,
      name: input.customerName,
      taxId: input.customerTaxId ?? null,
      defaultBranchCode: input.customerBranch ?? null,
      province: input.customerProvince ?? null,
      address1: input.customerAddress?.split("\n")[0] ?? null,
      address2: input.customerAddress?.split("\n")[1] ?? null,
      address3: input.customerAddress?.split("\n")[2] ?? null,
      tel: input.customerTel ?? null,
    })
    .returning({ id: customers.id, code: customers.code });

  return { customerId: created.id, customerCode: created.code };
}

export function computeTotals(input: InvoiceInputData) {
  const subtotal = input.items.reduce((s, it) => s + (Number(it.amount) || 0), 0);
  const amountBeforeVat = +(subtotal - input.discount).toFixed(2);
  const vatAmount = +((amountBeforeVat * input.vatRate) / 100).toFixed(2);
  const total = +(amountBeforeVat + vatAmount).toFixed(2);
  const wht = +((amountBeforeVat * input.withholdingTaxRate) / 100).toFixed(2);
  const netTotal = +(total - wht).toFixed(2);
  return {
    subtotal: subtotal.toFixed(2),
    amountBeforeVat: amountBeforeVat.toFixed(2),
    vatAmount: vatAmount.toFixed(2),
    total: total.toFixed(2),
    withholdingTaxAmount: wht.toFixed(2),
    netTotal: netTotal.toFixed(2),
  };
}

export type CreateInvoiceOpts = {
  userId: number | null;
  userNameSnapshot?: string | null;
  status: "draft" | "issued";
  externalRef?: string | null;
  customDocNo?: string;
};

export async function createInvoiceCore(
  input: InvoiceInputData,
  opts: CreateInvoiceOpts,
): Promise<{ id: number; docNo: string }> {
  const totals = computeTotals(input);
  const [company] = await db.select().from(companies).limit(1);
  if (!company) throw new Error("ยังไม่ได้ตั้งค่าบริษัท");

  let result: { id: number; docNo: string } | null = null;

  await db.transaction(async (tx) => {
    const reserved = opts.customDocNo
      ? await useCustomDocNo(tx as any, { documentType: "invoice", customDocNo: opts.customDocNo })
      : await reserveNextDocNo(tx as any, { documentType: "invoice", docDateBE: input.docDate });

    const { customerId, customerCode } = await ensureCustomer(tx, input);

    const [doc] = await tx
      .insert(documents)
      .values({
        documentType: "invoice",
        docNo: reserved.docNo,
        internalSeq: `${reserved.yearBe}${reserved.month}${String(reserved.value).padStart(5, "0")}`,
        docDate: input.docDate,
        dueDate: input.dueDate || null,
        paymentTermsDays: input.paymentTermsDays,
        companyId: company.id,
        companyNameSnapshot: company.nameTh,
        companyTaxIdSnapshot: company.taxId,
        customerId,
        customerCodeSnapshot: customerCode,
        customerNameSnapshot: input.customerName,
        customerTaxIdSnapshot: input.customerTaxId ?? null,
        customerBranchSnapshot: input.customerBranch ?? null,
        customerAddressSnapshot: input.customerAddress ?? null,
        customerTelSnapshot: input.customerTel ?? null,
        customerProvinceSnapshot: input.customerProvince ?? null,
        salemanName: input.salemanName ?? null,
        shippingMethod: input.shippingMethod ?? null,
        referenceQuotationNo: input.referenceQuotationNo ?? null,
        subtotal: totals.subtotal,
        discount: input.discount.toFixed(2),
        amountBeforeVat: totals.amountBeforeVat,
        vatRate: input.vatRate.toFixed(2),
        vatAmount: totals.vatAmount,
        total: totals.total,
        withholdingTaxRate: input.withholdingTaxRate.toFixed(2),
        withholdingTaxAmount: totals.withholdingTaxAmount,
        netTotal: totals.netTotal,
        totalInWordsTh: bahtText(totals.total),
        memo: input.memo ?? null,
        remark1: input.remark1 ?? null,
        remark2: input.remark2 ?? null,
        status: opts.status,
        arStatus: "pending",
        externalRef: opts.externalRef ?? null,
        createdByUserId: opts.userId,
        updatedByUserId: opts.userId,
      })
      .returning({ id: documents.id, docNo: documents.docNo });

    if (input.items.length) {
      await tx.insert(documentItems).values(
        input.items.map((it) => ({
          documentId: doc.id,
          lineNo: it.lineNo ?? null,
          productCodeSnapshot: it.productCode ?? null,
          description: it.description,
          quantity: it.quantity.toFixed(3),
          unit: it.unit ?? null,
          unitPrice: it.unitPrice.toFixed(2),
          amount: it.amount.toFixed(2),
        })),
      );
    }

    await writeJournal(tx as any, {
      documentId: doc.id,
      action: "create",
      user: opts.userId
        ? ({ userId: opts.userId, fullName: opts.userNameSnapshot ?? null } as any)
        : null,
      changes: { docNo: doc.docNo, total: totals.total, itemCount: input.items.length, status: opts.status },
    });

    result = { id: doc.id, docNo: doc.docNo };
  });

  if (!result) throw new Error("บันทึกไม่สำเร็จ");
  return result;
}
