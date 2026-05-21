"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq, and, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { documents, documentItems, customers, companies } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { reserveNextDocNo, useCustomDocNo } from "@/lib/counter";
import { writeJournal } from "@/lib/audit";
import { bahtText } from "@/lib/thai/number";

const ItemInput = z.object({
  lineNo: z.coerce.number().int().min(0).optional(),
  productCode: z.string().nullable().optional(),
  description: z.string().min(1, "กรุณากรอกรายการ"),
  quantity: z.coerce.number().min(0).default(0),
  unit: z.string().nullable().optional(),
  unitPrice: z.coerce.number().min(0).default(0),
  amount: z.coerce.number().default(0),
});

const InvoiceInput = z.object({
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

function parseInvoiceInput(formData: FormData): InvoiceInputData {
  const itemsJson = String(formData.get("items_json") ?? "[]");
  const items = JSON.parse(itemsJson);
  const data = {
    docDate: formData.get("docDate"),
    dueDate: formData.get("dueDate") || null,
    paymentTermsDays: formData.get("paymentTermsDays") || 0,
    customerId: formData.get("customerId") || null,
    customerCode: formData.get("customerCode") || null,
    customerName: formData.get("customerName"),
    customerTaxId: formData.get("customerTaxId") || null,
    customerBranch: formData.get("customerBranch") || null,
    customerAddress: formData.get("customerAddress") || null,
    customerTel: formData.get("customerTel") || null,
    customerProvince: formData.get("customerProvince") || null,
    salemanName: formData.get("salemanName") || null,
    shippingMethod: formData.get("shippingMethod") || null,
    referenceQuotationNo: formData.get("referenceQuotationNo") || null,
    discount: formData.get("discount") || 0,
    vatRate: formData.get("vatRate") || 7,
    withholdingTaxRate: formData.get("withholdingTaxRate") || 0,
    memo: formData.get("memo") || null,
    remark1: formData.get("remark1") || null,
    remark2: formData.get("remark2") || null,
    items,
  };
  return InvoiceInput.parse(data);
}

/**
 * Ensure a customer exists for this invoice.
 *  - If customerId is given, return it as-is (existing customer).
 *  - Else, try to match by customerCode if provided.
 *  - Else, auto-create new customer with auto-generated code.
 * Returns { customerId, customerCode }.
 */
async function ensureCustomer(
  tx: any,
  input: InvoiceInputData,
): Promise<{ customerId: number | null; customerCode: string | null }> {
  // Existing customer selected
  if (input.customerId) {
    return {
      customerId: input.customerId,
      customerCode: input.customerCode ?? null,
    };
  }

  // Try to match by code if user typed an existing one
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

  // Auto-generate next code (numeric format, 7 digits zero-padded)
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

function computeTotals(input: InvoiceInputData) {
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

export async function createInvoiceAction(formData: FormData): Promise<{ error?: string; ok?: boolean; id?: number; docNo?: string }> {
  const session = await getSession();
  if (!session) return { error: "session หมดอายุ" };

  let input: InvoiceInputData;
  try {
    input = parseInvoiceInput(formData);
  } catch (e: any) {
    const msg = e?.errors?.[0]?.message ?? e?.message ?? "ข้อมูลไม่ถูกต้อง";
    return { error: msg };
  }

  const totals = computeTotals(input);
  const [company] = await db.select().from(companies).limit(1);
  if (!company) return { error: "ยังไม่ได้ตั้งค่าบริษัท" };

  let result: { id: number; docNo: string } | null = null as { id: number; docNo: string } | null;
  const customDocNo = String(formData.get("customDocNo") ?? "").trim();

  try {
    await db.transaction(async (tx) => {
      const reserved = customDocNo
        ? await useCustomDocNo(tx as any, {
            documentType: "invoice",
            customDocNo,
          })
        : await reserveNextDocNo(tx as any, {
            documentType: "invoice",
            docDateBE: input.docDate,
          });

      // auto-create or match customer
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
        status: "issued",
        arStatus: "pending",
        createdByUserId: session.userId,
        updatedByUserId: session.userId,
      })
      .returning({ id: documents.id, docNo: documents.docNo });

    if (input.items.length) {
      await tx.insert(documentItems).values(
        input.items.map((it, idx) => ({
          documentId: doc.id,
          lineNo: it.lineNo ?? idx + 1,
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
      user: session,
      changes: { docNo: doc.docNo, total: totals.total, itemCount: input.items.length },
    });

    result = { id: doc.id, docNo: doc.docNo };
    });
  } catch (e: any) {
    if (e?.code === "23505") {
      return { error: `เลขที่เอกสาร "${customDocNo || "(auto)"}" ซ้ำในระบบ — กรุณาเปลี่ยนเลข` };
    }
    return { error: e?.message ?? "บันทึกไม่สำเร็จ" };
  }

  const r = result as { id: number; docNo: string } | null;
  if (!r) return { error: "บันทึกไม่สำเร็จ" };

  revalidatePath("/invoices");
  revalidatePath("/");
  return { ok: true, id: r.id, docNo: r.docNo };
}

export async function updateInvoiceAction(id: number, formData: FormData): Promise<{ error?: string; ok?: boolean; id?: number; docNo?: string }> {
  const session = await getSession();
  if (!session) return { error: "session หมดอายุ" };

  let input: InvoiceInputData;
  try {
    input = parseInvoiceInput(formData);
  } catch (e: any) {
    const msg = e?.errors?.[0]?.message ?? e?.message ?? "ข้อมูลไม่ถูกต้อง";
    return { error: msg };
  }

  const totals = computeTotals(input);

  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ status: documents.status })
      .from(documents)
      .where(eq(documents.id, id))
      .limit(1);
    if (!existing) throw new Error("not found");
    if (existing.status === "cancelled") throw new Error("ใบที่ยกเลิกแล้ว แก้ไขไม่ได้");

    // auto-create or match customer if missing
    const { customerId, customerCode } = await ensureCustomer(tx, input);

    await tx
      .update(documents)
      .set({
        docDate: input.docDate,
        dueDate: input.dueDate || null,
        paymentTermsDays: input.paymentTermsDays,
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
        updatedByUserId: session.userId,
        updatedAt: new Date(),
      })
      .where(eq(documents.id, id));

    await tx.delete(documentItems).where(eq(documentItems.documentId, id));
    if (input.items.length) {
      await tx.insert(documentItems).values(
        input.items.map((it, idx) => ({
          documentId: id,
          lineNo: idx + 1,
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
      documentId: id,
      action: "update",
      user: session,
      changes: { total: totals.total, itemCount: input.items.length },
    });
  });

  revalidatePath(`/invoices/${id}`);
  revalidatePath("/invoices");
  return { ok: true };
}

export async function cancelInvoiceAction(id: number, reason?: string): Promise<{ error?: string; ok?: boolean }> {
  const session = await getSession();
  if (!session) return { error: "session หมดอายุ" };

  await db.transaction(async (tx) => {
    const [doc] = await tx
      .update(documents)
      .set({
        status: "cancelled",
        arStatus: "cancelled",
        updatedByUserId: session.userId,
        updatedAt: new Date(),
      })
      .where(and(eq(documents.id, id), eq(documents.status, "issued")))
      .returning({ id: documents.id, docNo: documents.docNo });

    if (!doc) throw new Error("ใบนี้ยกเลิกไม่ได้ (อาจถูกยกเลิกแล้ว)");

    await writeJournal(tx as any, {
      documentId: id,
      action: "cancel",
      user: session,
      changes: { reason: reason ?? null },
    });
  });

  revalidatePath(`/invoices/${id}`);
  revalidatePath("/invoices");
  return { ok: true };
}

export async function lookupCustomerByCodeAction(code: string): Promise<{
  found: boolean;
  customer?: {
    id: number;
    code: string;
    name: string;
    taxId: string | null;
    defaultBranchCode: string | null;
    address1: string | null;
    address2: string | null;
    address3: string | null;
    tel: string | null;
    province: string | null;
    defaultSalemanName: string | null;
  };
}> {
  const trimmed = code.trim();
  if (!trimmed) return { found: false };

  const [c] = await db.execute<any>(sql`
    SELECT id, code, name, tax_id, default_branch_code,
           address1, address2, address3, tel, province, default_saleman_name
      FROM customers
     WHERE code = ${trimmed} AND deleted_at IS NULL
     LIMIT 1
  `);
  if (!c) return { found: false };
  return {
    found: true,
    customer: {
      id: Number(c.id),
      code: c.code,
      name: c.name,
      taxId: c.tax_id,
      defaultBranchCode: c.default_branch_code,
      address1: c.address1,
      address2: c.address2,
      address3: c.address3,
      tel: c.tel,
      province: c.province,
      defaultSalemanName: c.default_saleman_name,
    },
  };
}

export async function checkDocNoAvailableAction(docNo: string): Promise<{
  available: boolean;
  reason?: string;
}> {
  const trimmed = docNo.trim();
  if (!trimmed) return { available: true };
  // basic format check
  if (!/^[A-Za-z]+\d{2}\/\d{2}-\d+$/.test(trimmed)) {
    return { available: false, reason: "รูปแบบไม่ถูก (ต้องเป็น IV69/05-17805)" };
  }
  const [row] = await db.execute<{ n: number }>(sql`
    SELECT COUNT(*)::int AS n
      FROM documents
     WHERE document_type = 'invoice' AND doc_no = ${trimmed}
  `);
  if (Number(row?.n ?? 0) > 0) {
    return { available: false, reason: "เลขนี้มีอยู่แล้วในระบบ" };
  }
  return { available: true };
}

export async function previewNextDocNoAction(docDateBE: string): Promise<{ docNo: string }> {
  // Read-only preview — does NOT increment counter (docDate already in BE)
  const [yyyy, mm] = docDateBE.split("-");
  const yearBe = (yyyy ?? "0000").slice(-2);
  const month = (mm ?? "01").padStart(2, "0");
  const key = `invoice:${yearBe}:${month}`;

  const [row] = await db.execute<{ current_value: string | null }>(sql`
    SELECT current_value::text FROM counters WHERE key = ${key} LIMIT 1
  `);
  const next = (Number(row?.current_value ?? 0) || 0) + 1;
  const docNo = `IV${yearBe}/${month}-${String(next).padStart(5, "0")}`;
  return { docNo };
}
