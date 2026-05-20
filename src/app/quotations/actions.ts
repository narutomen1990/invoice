"use server";

import { revalidatePath } from "next/cache";
import { eq, and, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { documents, documentItems, companies } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { reserveNextDocNo, useCustomDocNo } from "@/lib/counter";
import { writeJournal } from "@/lib/audit";
import { bahtText } from "@/lib/thai/number";

const ItemInput = z.object({
  productCode: z.string().nullable().optional(),
  description: z.string().min(1, "กรุณากรอกรายการ"),
  quantity: z.coerce.number().min(0).default(0),
  unit: z.string().nullable().optional(),
  unitPrice: z.coerce.number().min(0).default(0),
  amount: z.coerce.number().default(0),
});

const QuotationInput = z.object({
  docDate: z.string().min(1),
  dueDate: z.string().nullable().optional(),
  paymentTermsDays: z.coerce.number().int().min(0).default(0),
  customerId: z.coerce.number().int().nullable().optional(),
  customerName: z.string().min(1, "กรุณาเลือกลูกค้า"),
  customerTaxId: z.string().nullable().optional(),
  customerBranch: z.string().nullable().optional(),
  customerAddress: z.string().nullable().optional(),
  customerTel: z.string().nullable().optional(),
  customerProvince: z.string().nullable().optional(),
  // เสนอราคาโดย / Prepared By → ใช้ salemanName
  preparedBy: z.string().nullable().optional(),
  shippingMethod: z.string().nullable().optional(),
  // ใบสั่งซื้อเลขที่ / Purchase Order No. → เก็บใน referenceQuotationNo (rename ความหมาย)
  purchaseOrderNo: z.string().nullable().optional(),

  discount: z.coerce.number().min(0).default(0),
  vatRate: z.coerce.number().min(0).max(100).default(7),
  withholdingTaxRate: z.coerce.number().min(0).max(100).default(0),

  memo: z.string().nullable().optional(),
  remark1: z.string().nullable().optional(),
  remark2: z.string().nullable().optional(),

  // quotation-specific terms (เก็บใน legacy_data jsonb ก่อน — ยังไม่ทำ migration)
  validityDays: z.coerce.number().int().min(0).default(30),
  deliveryDays: z.coerce.number().int().min(0).default(15),
  warrantyMonths: z.coerce.number().int().min(0).default(3),
  agingDays: z.coerce.number().int().min(0).default(0),
  customerEmail: z.string().nullable().optional(),

  items: z.array(ItemInput).min(1, "ต้องมีอย่างน้อย 1 รายการ"),
});

export type QuotationInputData = z.infer<typeof QuotationInput>;

function parseQuotationInput(formData: FormData): QuotationInputData {
  const itemsJson = String(formData.get("items_json") ?? "[]");
  const items = JSON.parse(itemsJson);
  const data = {
    docDate: formData.get("docDate"),
    dueDate: formData.get("dueDate") || null,
    paymentTermsDays: formData.get("paymentTermsDays") || 0,
    customerId: formData.get("customerId") || null,
    customerName: formData.get("customerName"),
    customerTaxId: formData.get("customerTaxId") || null,
    customerBranch: formData.get("customerBranch") || null,
    customerAddress: formData.get("customerAddress") || null,
    customerTel: formData.get("customerTel") || null,
    customerProvince: formData.get("customerProvince") || null,
    preparedBy: formData.get("preparedBy") || null,
    shippingMethod: formData.get("shippingMethod") || null,
    purchaseOrderNo: formData.get("purchaseOrderNo") || null,
    discount: formData.get("discount") || 0,
    vatRate: formData.get("vatRate") || 7,
    withholdingTaxRate: formData.get("withholdingTaxRate") || 0,
    memo: formData.get("memo") || null,
    remark1: formData.get("remark1") || null,
    remark2: formData.get("remark2") || null,
    validityDays: formData.get("validityDays") || 30,
    deliveryDays: formData.get("deliveryDays") || 15,
    warrantyMonths: formData.get("warrantyMonths") || 3,
    agingDays: formData.get("agingDays") || 0,
    customerEmail: formData.get("customerEmail") || null,
    items,
  };
  return QuotationInput.parse(data);
}

function computeTotals(input: QuotationInputData) {
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

function buildLegacyData(input: QuotationInputData) {
  return {
    quotationTerms: {
      validityDays: input.validityDays,
      deliveryDays: input.deliveryDays,
      warrantyMonths: input.warrantyMonths,
      agingDays: input.agingDays,
      customerEmail: input.customerEmail ?? null,
    },
  };
}

export async function createQuotationAction(
  formData: FormData,
): Promise<{ error?: string; ok?: boolean; id?: number; docNo?: string }> {
  const session = await getSession();
  if (!session) return { error: "session หมดอายุ" };

  let input: QuotationInputData;
  try {
    input = parseQuotationInput(formData);
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
            documentType: "quotation",
            customDocNo,
          })
        : await reserveNextDocNo(tx as any, {
            documentType: "quotation",
            docDateBE: input.docDate,
          });

      const [doc] = await tx
        .insert(documents)
        .values({
          documentType: "quotation",
          docNo: reserved.docNo,
          internalSeq: `${reserved.yearBe}${reserved.month}${String(reserved.value).padStart(5, "0")}`,
          docDate: input.docDate,
          dueDate: input.dueDate || null,
          paymentTermsDays: input.paymentTermsDays,
          companyId: company.id,
          companyNameSnapshot: company.nameTh,
          companyTaxIdSnapshot: company.taxId,
          customerId: input.customerId ?? null,
          customerNameSnapshot: input.customerName,
          customerTaxIdSnapshot: input.customerTaxId ?? null,
          customerBranchSnapshot: input.customerBranch ?? null,
          customerAddressSnapshot: input.customerAddress ?? null,
          customerTelSnapshot: input.customerTel ?? null,
          customerProvinceSnapshot: input.customerProvince ?? null,
          salemanName: input.preparedBy ?? null,
          shippingMethod: input.shippingMethod ?? null,
          referenceQuotationNo: input.purchaseOrderNo ?? null,
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
          legacyData: buildLegacyData(input),
          createdByUserId: session.userId,
          updatedByUserId: session.userId,
        })
        .returning({ id: documents.id, docNo: documents.docNo });

      if (input.items.length) {
        await tx.insert(documentItems).values(
          input.items.map((it, idx) => ({
            documentId: doc.id,
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

  revalidatePath("/quotations");
  return { ok: true, id: r.id, docNo: r.docNo };
}

export async function updateQuotationAction(
  id: number,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean; id?: number; docNo?: string }> {
  const session = await getSession();
  if (!session) return { error: "session หมดอายุ" };

  let input: QuotationInputData;
  try {
    input = parseQuotationInput(formData);
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

    await tx
      .update(documents)
      .set({
        docDate: input.docDate,
        dueDate: input.dueDate || null,
        paymentTermsDays: input.paymentTermsDays,
        customerId: input.customerId ?? null,
        customerNameSnapshot: input.customerName,
        customerTaxIdSnapshot: input.customerTaxId ?? null,
        customerBranchSnapshot: input.customerBranch ?? null,
        customerAddressSnapshot: input.customerAddress ?? null,
        customerTelSnapshot: input.customerTel ?? null,
        customerProvinceSnapshot: input.customerProvince ?? null,
        salemanName: input.preparedBy ?? null,
        shippingMethod: input.shippingMethod ?? null,
        referenceQuotationNo: input.purchaseOrderNo ?? null,
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
        legacyData: buildLegacyData(input),
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

  revalidatePath(`/quotations/${id}`);
  revalidatePath("/quotations");
  return { ok: true };
}

export async function cancelQuotationAction(
  id: number,
  reason?: string,
): Promise<{ error?: string; ok?: boolean }> {
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

  revalidatePath(`/quotations/${id}`);
  revalidatePath("/quotations");
  return { ok: true };
}

export async function deleteQuotationAction(
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
            eq(documents.documentType, "quotation"),
          ),
        )
        .limit(1);
      if (!existing) throw new Error("ไม่พบใบเสนอราคานี้");

      // document_journals and document_items are ON DELETE CASCADE — deleted with parent
      await tx
        .delete(documents)
        .where(
          and(
            eq(documents.id, id),
            eq(documents.documentType, "quotation"),
          ),
        );
    });
  } catch (e: any) {
    return { error: e?.message ?? "ลบไม่สำเร็จ" };
  }

  revalidatePath("/quotations");
  return { ok: true };
}

export async function checkQuotationNoAvailableAction(
  docNo: string,
): Promise<{ available: boolean; reason?: string }> {
  const trimmed = docNo.trim();
  if (!trimmed) return { available: true };
  if (!/^[A-Za-z]+\d{2}\/\d{2}-\d+$/.test(trimmed)) {
    return { available: false, reason: "รูปแบบไม่ถูก (ต้องเป็น QT69/05-00001)" };
  }
  const [row] = await db.execute<{ n: number }>(sql`
    SELECT COUNT(*)::int AS n
      FROM documents
     WHERE document_type = 'quotation' AND doc_no = ${trimmed}
  `);
  if (Number(row?.n ?? 0) > 0) {
    return { available: false, reason: "เลขนี้มีอยู่แล้วในระบบ" };
  }
  return { available: true };
}

export type QuotationListItem = {
  id: number;
  docNo: string;
  docDate: string;
  customerName: string | null;
  total: number;
  status: string;
};

export async function listQuotationsForPickerAction(
  q?: string,
): Promise<QuotationListItem[]> {
  const term = (q ?? "").trim();
  const like = `%${term}%`;
  const rows = await db.execute<any>(sql`
    SELECT id, doc_no, doc_date::text, customer_name_snapshot, total::text, status::text
      FROM documents
     WHERE document_type = 'quotation'
       AND status = 'issued'
       AND (
         ${term} = '' OR
         doc_no ILIKE ${like} OR
         customer_name_snapshot ILIKE ${like}
       )
     ORDER BY doc_date DESC, id DESC
     LIMIT 100
  `);
  return rows.map((r) => ({
    id: Number(r.id),
    docNo: r.doc_no,
    docDate: r.doc_date,
    customerName: r.customer_name_snapshot,
    total: Number(r.total),
    status: r.status,
  }));
}

export type QuotationPickerDetail = {
  id: number;
  docNo: string;
  docDate: string;
  customerId: number | null;
  customerCode: string | null;
  customerName: string | null;
  customerTaxId: string | null;
  customerBranch: string | null;
  customerAddress: string | null;
  customerTel: string | null;
  customerProvince: string | null;
  salemanName: string | null;
  shippingMethod: string | null;
  referenceQuotationNo: string | null;
  discount: number;
  vatRate: number;
  withholdingTaxRate: number;
  memo: string | null;
  remark1: string | null;
  remark2: string | null;
  items: {
    productCode: string | null;
    description: string;
    quantity: number;
    unit: string | null;
    unitPrice: number;
  }[];
};

export async function getQuotationForPickerAction(
  id: number,
): Promise<QuotationPickerDetail | null> {
  const docRaw = await db.execute<any>(sql`
    SELECT * FROM documents
     WHERE id = ${id} AND document_type = 'quotation'
     LIMIT 1
  `);
  const d = docRaw[0];
  if (!d) return null;

  const itemsRaw = await db.execute<any>(sql`
    SELECT product_code_snapshot, description, quantity::text, unit, unit_price::text
      FROM document_items
     WHERE document_id = ${id}
     ORDER BY line_no
  `);

  return {
    id: Number(d.id),
    docNo: d.doc_no,
    docDate: d.doc_date,
    customerId: d.customer_id,
    customerCode: d.customer_code_snapshot,
    customerName: d.customer_name_snapshot,
    customerTaxId: d.customer_tax_id_snapshot,
    customerBranch: d.customer_branch_snapshot,
    customerAddress: d.customer_address_snapshot,
    customerTel: d.customer_tel_snapshot,
    customerProvince: d.customer_province_snapshot,
    salemanName: d.saleman_name,
    shippingMethod: d.shipping_method,
    referenceQuotationNo: d.reference_quotation_no,
    discount: Number(d.discount ?? 0),
    vatRate: Number(d.vat_rate ?? 7),
    withholdingTaxRate: Number(d.withholding_tax_rate ?? 0),
    memo: d.memo,
    remark1: d.remark1,
    remark2: d.remark2,
    items: itemsRaw.map((it: any) => ({
      productCode: it.product_code_snapshot,
      description: it.description ?? "",
      quantity: Number(it.quantity),
      unit: it.unit,
      unitPrice: Number(it.unit_price),
    })),
  };
}

export async function previewNextQuotationNoAction(
  docDateBE: string,
): Promise<{ docNo: string }> {
  const [yyyy, mm] = docDateBE.split("-");
  const yearBe = (yyyy ?? "0000").slice(-2);
  const month = (mm ?? "01").padStart(2, "0");
  const key = `quotation:${yearBe}:${month}`;

  const [row] = await db.execute<{ current_value: string | null }>(sql`
    SELECT current_value::text FROM counters WHERE key = ${key} LIMIT 1
  `);
  const next = (Number(row?.current_value ?? 0) || 0) + 1;
  const docNo = `QT${yearBe}/${month}-${String(next).padStart(5, "0")}`;
  return { docNo };
}
