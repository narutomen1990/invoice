"use server";

import { revalidatePath } from "next/cache";
import { eq, and, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { documents, documentItems, companies } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { reserveNextDocNo, useCustomDocNo } from "@/lib/counter";
import { bahtText } from "@/lib/thai/number";

const ItemInput = z.object({
  lineNo: z.coerce.number().int().min(0).nullable().optional(),
  productCode: z.string().nullable().optional(),
  description: z.string().min(1, "กรุณากรอกรายการ"),
  quantity: z.coerce.number().min(0).default(1),
  unit: z.string().nullable().optional(),
  unitPrice: z.coerce.number().min(0).default(0),
  amount: z.coerce.number().default(0),
});

const BillingInput = z.object({
  docDate: z.string().min(1),
  dueDate: z.string().nullable().optional(),
  paymentTermsDays: z.coerce.number().int().min(0).default(0),
  customerId: z.coerce.number().int().nullable().optional(),
  customerName: z.string().min(1, "กรุณาเลือกลูกค้า"),
  customerCode: z.string().nullable().optional(),
  customerTaxId: z.string().nullable().optional(),
  customerBranch: z.string().nullable().optional(),
  customerAddress: z.string().nullable().optional(),
  customerTel: z.string().nullable().optional(),
  customerProvince: z.string().nullable().optional(),
  customerEmail: z.string().nullable().optional(),
  contactName: z.string().nullable().optional(),
  contactTel: z.string().nullable().optional(),
  preparedBy: z.string().nullable().optional(),
  shippingMethod: z.string().nullable().optional(),
  referenceDocNo: z.string().nullable().optional(),
  discount: z.coerce.number().min(0).default(0),
  vatRate: z.coerce.number().min(0).max(100).default(7),
  withholdingTaxRate: z.coerce.number().min(0).max(100).default(0),
  // payment
  paymentDate: z.string().nullable().optional(),
  receiptNo: z.string().nullable().optional(),
  paidAmount: z.coerce.number().min(0).default(0),
  paymentMethod: z.string().nullable().optional(),
  remark: z.string().nullable().optional(),
  memo: z.string().nullable().optional(),
  remark1: z.string().nullable().optional(),
  items: z.array(ItemInput).default([]),
});

export type BillingInputData = z.infer<typeof BillingInput>;

function parseInput(formData: FormData): BillingInputData {
  const itemsJson = String(formData.get("items_json") ?? "[]");
  const items = JSON.parse(itemsJson);
  return BillingInput.parse({
    docDate: formData.get("docDate"),
    dueDate: formData.get("dueDate") || null,
    paymentTermsDays: formData.get("paymentTermsDays") || 0,
    customerId: formData.get("customerId") || null,
    customerName: formData.get("customerName"),
    customerCode: formData.get("customerCode") || null,
    customerTaxId: formData.get("customerTaxId") || null,
    customerBranch: formData.get("customerBranch") || null,
    customerAddress: formData.get("customerAddress") || null,
    customerTel: formData.get("customerTel") || null,
    customerProvince: formData.get("customerProvince") || null,
    customerEmail: formData.get("customerEmail") || null,
    contactName: formData.get("contactName") || null,
    contactTel: formData.get("contactTel") || null,
    preparedBy: formData.get("preparedBy") || null,
    shippingMethod: formData.get("shippingMethod") || null,
    referenceDocNo: formData.get("referenceDocNo") || null,
    discount: formData.get("discount") || 0,
    vatRate: formData.get("vatRate") || 7,
    withholdingTaxRate: formData.get("withholdingTaxRate") || 0,
    paymentDate: formData.get("paymentDate") || null,
    receiptNo: formData.get("receiptNo") || null,
    paidAmount: formData.get("paidAmount") || 0,
    paymentMethod: formData.get("paymentMethod") || null,
    remark: formData.get("remark") || null,
    memo: formData.get("memo") || null,
    remark1: formData.get("remark1") || null,
    items,
  });
}

function computeTotals(input: BillingInputData) {
  const subtotal = input.items.reduce(
    (s, it) => s + (Number(it.amount) || 0),
    0,
  );
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

function buildLegacyData(input: BillingInputData) {
  return {
    payment: {
      paymentDate: input.paymentDate ?? null,
      receiptNo: input.receiptNo ?? null,
      paidAmount: input.paidAmount ?? 0,
      paymentMethod: input.paymentMethod ?? null,
      remark: input.remark ?? null,
    },
    contact: {
      name: input.contactName ?? null,
      tel: input.contactTel ?? null,
    },
  };
}

export async function createBillingSlipAction(
  formData: FormData,
): Promise<{ error?: string; ok?: boolean; id?: number; docNo?: string }> {
  const session = await getSession();
  if (!session) return { error: "session หมดอายุ" };

  let input: BillingInputData;
  try {
    input = parseInput(formData);
  } catch (e: any) {
    return { error: e?.errors?.[0]?.message ?? e?.message ?? "ข้อมูลไม่ถูกต้อง" };
  }

  const totals = computeTotals(input);
  const [company] = await db.select().from(companies).limit(1);
  if (!company) return { error: "ยังไม่ได้ตั้งค่าบริษัท" };

  let result: { id: number; docNo: string } | null = null;
  const customDocNo = String(formData.get("customDocNo") ?? "").trim();

  try {
    result = await db.transaction(async (tx) => {
      const reserved = customDocNo
        ? await useCustomDocNo(tx as any, {
            documentType: "billing_slip",
            customDocNo,
          })
        : await reserveNextDocNo(tx as any, {
            documentType: "billing_slip",
            docDateBE: input.docDate,
          });

      const isPaid =
        input.paidAmount > 0 && input.paidAmount >= Number(totals.total);
      const arStatus = isPaid
        ? "paid"
        : input.paidAmount > 0
          ? "partial"
          : "pending";

      const [doc] = await tx
        .insert(documents)
        .values({
          documentType: "billing_slip",
          docNo: reserved.docNo,
          internalSeq: `${reserved.yearBe}${reserved.month}${String(reserved.value).padStart(5, "0")}`,
          docDate: input.docDate,
          dueDate: input.dueDate || null,
          paymentTermsDays: input.paymentTermsDays,
          companyId: company.id,
          companyNameSnapshot: company.nameTh,
          companyTaxIdSnapshot: company.taxId,
          customerId: input.customerId ?? null,
          customerCodeSnapshot: input.customerCode ?? null,
          customerNameSnapshot: input.customerName,
          customerTaxIdSnapshot: input.customerTaxId ?? null,
          customerBranchSnapshot: input.customerBranch ?? null,
          customerAddressSnapshot: input.customerAddress ?? null,
          customerTelSnapshot: input.customerTel ?? null,
          customerProvinceSnapshot: input.customerProvince ?? null,
          salemanName: input.preparedBy ?? null,
          shippingMethod: input.shippingMethod ?? null,
          referenceQuotationNo: input.referenceDocNo ?? null,
          subtotal: totals.subtotal,
          discount: input.discount.toFixed(2),
          amountBeforeVat: totals.amountBeforeVat,
          vatRate: input.vatRate.toFixed(2),
          vatAmount: totals.vatAmount,
          total: totals.total,
          withholdingTaxRate: input.withholdingTaxRate.toFixed(2),
          withholdingTaxAmount: totals.withholdingTaxAmount,
          netTotal: totals.netTotal,
          totalInWordsTh: bahtText(Number(totals.total)),
          memo: input.memo ?? null,
          remark1: input.remark1 ?? null,
          status: "issued",
          arStatus,
          legacyData: buildLegacyData(input),
          createdByUserId: session.userId,
          updatedByUserId: session.userId,
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

      return { id: doc.id, docNo: doc.docNo };
    });
  } catch (e: any) {
    if (e?.code === "23505") {
      return {
        error: `เลขที่เอกสาร "${customDocNo || "(auto)"}" ซ้ำในระบบ`,
      };
    }
    return { error: e?.message ?? "บันทึกไม่สำเร็จ" };
  }

  if (!result) return { error: "บันทึกไม่สำเร็จ" };
  revalidatePath("/receipts");
  return { ok: true, id: result.id, docNo: result.docNo };
}

export async function updateBillingSlipAction(
  id: number,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const session = await getSession();
  if (!session) return { error: "session หมดอายุ" };

  let input: BillingInputData;
  try {
    input = parseInput(formData);
  } catch (e: any) {
    return { error: e?.errors?.[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  }
  const totals = computeTotals(input);

  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ status: documents.status })
      .from(documents)
      .where(eq(documents.id, id))
      .limit(1);
    if (!existing) throw new Error("not found");
    if (existing.status === "cancelled")
      throw new Error("ใบที่ยกเลิกแล้ว แก้ไขไม่ได้");

    const isPaid =
      input.paidAmount > 0 && input.paidAmount >= Number(totals.total);
    const arStatus = isPaid
      ? "paid"
      : input.paidAmount > 0
        ? "partial"
        : "pending";

    await tx
      .update(documents)
      .set({
        docDate: input.docDate,
        dueDate: input.dueDate || null,
        paymentTermsDays: input.paymentTermsDays,
        customerId: input.customerId ?? null,
        customerCodeSnapshot: input.customerCode ?? null,
        customerNameSnapshot: input.customerName,
        customerTaxIdSnapshot: input.customerTaxId ?? null,
        customerBranchSnapshot: input.customerBranch ?? null,
        customerAddressSnapshot: input.customerAddress ?? null,
        customerTelSnapshot: input.customerTel ?? null,
        customerProvinceSnapshot: input.customerProvince ?? null,
        salemanName: input.preparedBy ?? null,
        shippingMethod: input.shippingMethod ?? null,
        referenceQuotationNo: input.referenceDocNo ?? null,
        subtotal: totals.subtotal,
        discount: input.discount.toFixed(2),
        amountBeforeVat: totals.amountBeforeVat,
        vatRate: input.vatRate.toFixed(2),
        vatAmount: totals.vatAmount,
        total: totals.total,
        withholdingTaxRate: input.withholdingTaxRate.toFixed(2),
        withholdingTaxAmount: totals.withholdingTaxAmount,
        netTotal: totals.netTotal,
        totalInWordsTh: bahtText(Number(totals.total)),
        memo: input.memo ?? null,
        remark1: input.remark1 ?? null,
        arStatus,
        legacyData: buildLegacyData(input),
        updatedByUserId: session.userId,
        updatedAt: new Date(),
      })
      .where(eq(documents.id, id));

    await tx.delete(documentItems).where(eq(documentItems.documentId, id));
    if (input.items.length) {
      await tx.insert(documentItems).values(
        input.items.map((it) => ({
          documentId: id,
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
  });

  revalidatePath(`/receipts`);
  return { ok: true };
}

export async function previewNextBillingNoAction(
  docDateBE: string,
): Promise<{ docNo: string }> {
  const [yyyy, mm] = docDateBE.split("-");
  const yearBe = (yyyy ?? "0000").slice(-2);
  const month = (mm ?? "01").padStart(2, "0");
  const key = `billing_slip:${yearBe}:${month}`;
  const [row] = await db.execute<{ current_value: string | null }>(sql`
    SELECT current_value::text FROM counters WHERE key = ${key} LIMIT 1
  `);
  const next = (Number(row?.current_value ?? 0) || 0) + 1;
  const docNo = `BS${yearBe}/${month}-${String(next).padStart(5, "0")}`;
  return { docNo };
}

export async function deleteBillingSlipAction(
  id: number,
): Promise<{ error?: string; ok?: boolean }> {
  const session = await getSession();
  if (!session) return { error: "session หมดอายุ" };
  try {
    await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: documents.id })
        .from(documents)
        .where(
          and(
            eq(documents.id, id),
            sql`${documents.documentType} IN ('billing_slip', 'receipt')`,
          ),
        )
        .limit(1);
      if (!existing) throw new Error("ไม่พบเอกสาร");
      await tx
        .delete(documents)
        .where(
          and(
            eq(documents.id, id),
            sql`${documents.documentType} IN ('billing_slip', 'receipt')`,
          ),
        );
    });
  } catch (e: any) {
    return { error: e?.message ?? "ลบไม่สำเร็จ" };
  }
  revalidatePath("/receipts");
  return { ok: true };
}
