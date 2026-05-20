"use server";

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
  productCode: z.string().nullable().optional(),
  description: z.string().min(1, "กรุณากรอกรายการ"),
  quantity: z.coerce.number().min(0).default(0),
  unit: z.string().nullable().optional(),
  unitPrice: z.coerce.number().min(0).default(0),
  amount: z.coerce.number().default(0),
});

const CreditNoteInput = z.object({
  docDate: z.string().min(1),
  customerId: z.coerce.number().int().nullable().optional(),
  customerCode: z.string().nullable().optional(),
  customerName: z.string().min(1, "กรุณากรอกชื่อลูกค้า"),
  customerTaxId: z.string().nullable().optional(),
  customerBranch: z.string().nullable().optional(),
  customerAddress: z.string().nullable().optional(),
  customerTel: z.string().nullable().optional(),
  customerProvince: z.string().nullable().optional(),
  salemanName: z.string().nullable().optional(),
  // ใบลดหนี้-specific
  referenceInvoiceNo: z.string().nullable().optional(),
  referenceInvoiceDate: z.string().nullable().optional(),
  reason: z.string().min(1, "กรุณากรอกสาเหตุของการออกใบลดหนี้"),
  originalAmount: z.coerce.number().default(0),
  correctAmount: z.coerce.number().default(0),
  // common
  vatRate: z.coerce.number().min(0).max(100).default(7),
  memo: z.string().nullable().optional(),
  remark1: z.string().nullable().optional(),
  items: z.array(ItemInput).min(1, "ต้องมีอย่างน้อย 1 รายการ"),
});

export type CreditNoteInputData = z.infer<typeof CreditNoteInput>;

function parseInput(formData: FormData): CreditNoteInputData {
  const itemsJson = String(formData.get("items_json") ?? "[]");
  const items = JSON.parse(itemsJson);
  return CreditNoteInput.parse({
    docDate: formData.get("docDate"),
    customerId: formData.get("customerId") || null,
    customerCode: formData.get("customerCode") || null,
    customerName: formData.get("customerName"),
    customerTaxId: formData.get("customerTaxId") || null,
    customerBranch: formData.get("customerBranch") || null,
    customerAddress: formData.get("customerAddress") || null,
    customerTel: formData.get("customerTel") || null,
    customerProvince: formData.get("customerProvince") || null,
    salemanName: formData.get("salemanName") || null,
    referenceInvoiceNo: formData.get("referenceInvoiceNo") || null,
    referenceInvoiceDate: formData.get("referenceInvoiceDate") || null,
    reason: formData.get("reason") || "",
    originalAmount: formData.get("originalAmount") || 0,
    correctAmount: formData.get("correctAmount") || 0,
    vatRate: formData.get("vatRate") || 7,
    memo: formData.get("memo") || null,
    remark1: formData.get("remark1") || null,
    items,
  });
}

async function ensureCustomer(
  tx: any,
  input: CreditNoteInputData,
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
  return { customerId: null, customerCode: input.customerCode ?? null };
}

function computeTotals(input: CreditNoteInputData) {
  // amountBeforeVat = (เดิม - ที่ถูกต้อง). If items provided, use sum.
  const itemSum = input.items.reduce(
    (s, it) => s + (Number(it.amount) || 0),
    0,
  );
  const amountBeforeVat = itemSum > 0
    ? +itemSum.toFixed(2)
    : +(input.originalAmount - input.correctAmount).toFixed(2);
  const vatAmount = +((amountBeforeVat * input.vatRate) / 100).toFixed(2);
  const total = +(amountBeforeVat + vatAmount).toFixed(2);
  return {
    subtotal: amountBeforeVat.toFixed(2),
    amountBeforeVat: amountBeforeVat.toFixed(2),
    vatAmount: vatAmount.toFixed(2),
    total: total.toFixed(2),
  };
}

export async function createCreditNoteAction(
  formData: FormData,
): Promise<{ error?: string; ok?: boolean; id?: number; docNo?: string }> {
  const session = await getSession();
  if (!session) return { error: "session หมดอายุ" };

  let input: CreditNoteInputData;
  try {
    input = parseInput(formData);
  } catch (e: any) {
    const msg = e?.errors?.[0]?.message ?? e?.message ?? "ข้อมูลไม่ถูกต้อง";
    return { error: msg };
  }

  const totals = computeTotals(input);
  const [company] = await db.select().from(companies).limit(1);
  if (!company) return { error: "ยังไม่ได้ตั้งค่าบริษัท" };

  let result: { id: number; docNo: string } | null = null as
    | { id: number; docNo: string }
    | null;
  const customDocNo = String(formData.get("customDocNo") ?? "").trim();

  try {
    await db.transaction(async (tx) => {
      const reserved = customDocNo
        ? await useCustomDocNo(tx as any, {
            documentType: "credit_note",
            customDocNo,
          })
        : await reserveNextDocNo(tx as any, {
            documentType: "credit_note",
            docDateBE: input.docDate,
          });

      const { customerId, customerCode } = await ensureCustomer(tx, input);

      const reasonAndRef = [
        input.referenceInvoiceNo
          ? `อ้างถึงใบกำกับเลขที่ ${input.referenceInvoiceNo}${
              input.referenceInvoiceDate
                ? ` ลงวันที่ ${input.referenceInvoiceDate}`
                : ""
            }`
          : null,
        input.reason ? `สาเหตุ: ${input.reason}` : null,
      ]
        .filter(Boolean)
        .join("\n");

      const [doc] = await tx
        .insert(documents)
        .values({
          documentType: "credit_note",
          docNo: reserved.docNo,
          internalSeq: `${reserved.yearBe}${reserved.month}${String(
            reserved.value,
          ).padStart(5, "0")}`,
          docDate: input.docDate,
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
          referenceQuotationNo: input.referenceInvoiceNo ?? null,
          subtotal: totals.subtotal,
          discount: "0.00",
          amountBeforeVat: totals.amountBeforeVat,
          vatRate: input.vatRate.toFixed(2),
          vatAmount: totals.vatAmount,
          total: totals.total,
          withholdingTaxRate: "0.00",
          withholdingTaxAmount: "0.00",
          netTotal: totals.total,
          totalInWordsTh: bahtText(Number(totals.total)),
          memo: input.memo ?? reasonAndRef,
          remark1: input.remark1 ?? null,
          remark2: input.reason,
          status: "issued",
          arStatus: "pending",
          createdByUserId: session.userId,
          updatedByUserId: session.userId,
          // store credit-note-specific values for printing
          legacyData: {
            creditNote: {
              originalAmount: Number(input.originalAmount) || 0,
              correctAmount: Number(input.correctAmount) || 0,
              referenceInvoiceNo: input.referenceInvoiceNo ?? null,
              referenceInvoiceDate: input.referenceInvoiceDate ?? null,
              reason: input.reason,
            },
          },
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
        changes: {
          docNo: doc.docNo,
          total: totals.total,
          itemCount: input.items.length,
        },
      });

      result = { id: doc.id, docNo: doc.docNo };
    });
  } catch (e: any) {
    if (e?.code === "23505") {
      return {
        error: `เลขที่เอกสาร "${customDocNo || "(auto)"}" ซ้ำในระบบ — กรุณาเปลี่ยนเลข`,
      };
    }
    return { error: e?.message ?? "บันทึกไม่สำเร็จ" };
  }

  if (!result) return { error: "บันทึกไม่สำเร็จ" };
  revalidatePath("/credit-notes");
  revalidatePath("/");
  return { ok: true, id: result.id, docNo: result.docNo };
}

export async function previewNextCreditNoteNoAction(
  docDateBE: string,
): Promise<{ docNo: string }> {
  const [yyyy, mm] = docDateBE.split("-");
  const yearBe = (yyyy ?? "0000").slice(-2);
  const month = (mm ?? "01").padStart(2, "0");
  const key = `credit_note:${yearBe}:${month}`;

  const [row] = await db.execute<{ current_value: string | null }>(sql`
    SELECT current_value::text FROM counters WHERE key = ${key} LIMIT 1
  `);
  const next = (Number(row?.current_value ?? 0) || 0) + 1;
  const docNo = `CN${yearBe}/${month}-${String(next).padStart(5, "0")}`;
  return { docNo };
}

export async function deleteCreditNoteAction(
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
          and(eq(documents.id, id), eq(documents.documentType, "credit_note")),
        )
        .limit(1);
      if (!existing) throw new Error("ไม่พบใบลดหนี้นี้");

      // document_journals + document_items cascade with parent
      await tx
        .delete(documents)
        .where(
          and(eq(documents.id, id), eq(documents.documentType, "credit_note")),
        );
    });
  } catch (e: any) {
    return { error: e?.message ?? "ลบไม่สำเร็จ" };
  }

  revalidatePath("/credit-notes");
  return { ok: true };
}

export async function checkCreditNoteNoAvailableAction(
  docNo: string,
): Promise<{ available: boolean; reason?: string }> {
  const trimmed = docNo.trim();
  if (!trimmed) return { available: true };
  if (!/^[A-Za-z]+\d{2}\/\d{2}-\d+$/.test(trimmed)) {
    return {
      available: false,
      reason: "รูปแบบไม่ถูก (ต้องเป็น CN69/05-00001)",
    };
  }
  const [row] = await db.execute<{ n: number }>(sql`
    SELECT COUNT(*)::int AS n
      FROM documents
     WHERE document_type = 'credit_note' AND doc_no = ${trimmed}
  `);
  if (Number(row?.n ?? 0) > 0) {
    return { available: false, reason: "เลขนี้มีอยู่แล้วในระบบ" };
  }
  return { available: true };
}
