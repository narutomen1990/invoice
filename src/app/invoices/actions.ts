"use server";

import { revalidatePath } from "next/cache";
import { eq, and, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { documents, documentItems } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { parseDocNo, buildDocNo, useCustomDocNo } from "@/lib/counter";
import { writeJournal } from "@/lib/audit";
import { bahtText } from "@/lib/thai/number";
import {
  InvoiceInput,
  type InvoiceInputData,
  ensureCustomer,
  computeTotals,
  createInvoiceCore,
} from "@/lib/invoices/create-core";

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

  const customDocNo = String(formData.get("customDocNo") ?? "").trim();

  let result: { id: number; docNo: string };
  try {
    result = await createInvoiceCore(input, {
      userId: session.userId,
      userNameSnapshot: session.fullName ?? session.username,
      status: "issued",
      customDocNo: customDocNo || undefined,
    });
  } catch (e: any) {
    if (e?.code === "23505") {
      return { error: `เลขที่เอกสาร "${customDocNo || "(auto)"}" ซ้ำในระบบ — กรุณาเปลี่ยนเลข` };
    }
    return { error: e?.message ?? "บันทึกไม่สำเร็จ" };
  }

  revalidatePath("/invoices");
  revalidatePath("/");
  return { ok: true, id: result.id, docNo: result.docNo };
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

    // ร่างจาก service-center (สร้างผ่าน external API เสมอเป็น draft ไม่เคย auto-issue)
    // ถูกตรวจ/แก้ไขแล้วกดบันทึกทับในระบบนี้ ถือว่า "ออกจริง" แล้ว — เลื่อนสถานะให้อัตโนมัติ
    const newStatus = existing.status === "draft" ? "issued" : existing.status;

    // auto-create or match customer if missing
    const { customerId, customerCode } = await ensureCustomer(tx, input);

    await tx
      .update(documents)
      .set({
        status: newStatus,
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

    await writeJournal(tx as any, {
      documentId: id,
      action: "update",
      user: session,
      changes: {
        total: totals.total,
        itemCount: input.items.length,
        ...(newStatus !== existing.status ? { statusFrom: existing.status, statusTo: newStatus } : {}),
      },
    });
  });

  revalidatePath(`/invoices/${id}`);
  revalidatePath("/invoices");
  return { ok: true };
}

export async function cancelInvoiceAction(id: number, reason?: string): Promise<{ error?: string; ok?: boolean }> {
  const session = await getSession();
  if (!session) return { error: "session หมดอายุ" };
  if (session.role !== "admin" && session.role !== "manager") {
    return { error: "เฉพาะ admin หรือ manager เท่านั้นที่ลบได้" };
  }

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

const DOC_STATUS_VALUES = ["draft", "issued", "cancelled", "voided"] as const;
type DocStatusValue = (typeof DOC_STATUS_VALUES)[number];

/** Admin-only override to move an invoice to any status directly (fixes mistaken
 * cancellations, corrects service-center drafts stuck as draft, etc). Unlike
 * cancelInvoiceAction this isn't restricted to a single from→to transition. */
export async function updateInvoiceStatusAction(
  id: number,
  newStatus: string,
): Promise<{ error?: string; ok?: boolean }> {
  const session = await getSession();
  if (!session) return { error: "session หมดอายุ" };
  if (session.role !== "admin") {
    return { error: "เฉพาะ admin เท่านั้นที่เปลี่ยนสถานะได้" };
  }
  if (!DOC_STATUS_VALUES.includes(newStatus as DocStatusValue)) {
    return { error: "สถานะไม่ถูกต้อง" };
  }
  const status = newStatus as DocStatusValue;

  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ status: documents.status })
      .from(documents)
      .where(eq(documents.id, id))
      .limit(1);
    if (!existing) throw new Error("ไม่พบใบกำกับนี้");
    if (existing.status === status) return;

    const wasClosed = existing.status === "cancelled" || existing.status === "voided";
    const isClosed = status === "cancelled" || status === "voided";

    await tx
      .update(documents)
      .set({
        status,
        ...(isClosed ? { arStatus: "cancelled" as const } : wasClosed ? { arStatus: "pending" as const } : {}),
        updatedByUserId: session.userId,
        updatedAt: new Date(),
      })
      .where(eq(documents.id, id));

    await writeJournal(tx as any, {
      documentId: id,
      action: "update",
      user: session,
      changes: { statusFrom: existing.status, statusTo: status },
    });
  });

  revalidatePath(`/invoices/${id}`);
  revalidatePath("/invoices");
  return { ok: true };
}

/** Admin-only: manually attach/change/remove the service-center reference on
 * an invoice that wasn't created through the external API — e.g. to make a
 * plain invoice for a repair job show up in "รายงานภาษีงานซ่อม" (which is
 * driven entirely by externalRef being non-null), even without a real
 * job/ticket ID from that system. Pass null/empty to unlink. */
export async function updateInvoiceExternalRefAction(
  id: number,
  externalRef: string | null,
): Promise<{ error?: string; ok?: boolean }> {
  const session = await getSession();
  if (!session) return { error: "session หมดอายุ" };
  if (session.role !== "admin") {
    return { error: "เฉพาะ admin เท่านั้นที่แก้ไขได้" };
  }
  const trimmed = externalRef?.trim() || null;
  if (trimmed && trimmed.length > 100) {
    return { error: "เลขอ้างอิงยาวเกินไป (สูงสุด 100 ตัวอักษร)" };
  }

  try {
    await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ externalRef: documents.externalRef })
        .from(documents)
        .where(eq(documents.id, id))
        .limit(1);
      if (!existing) throw new Error("ไม่พบใบกำกับนี้");
      if (existing.externalRef === trimmed) return;

      await tx
        .update(documents)
        .set({ externalRef: trimmed, updatedByUserId: session.userId, updatedAt: new Date() })
        .where(eq(documents.id, id));

      await writeJournal(tx as any, {
        documentId: id,
        action: "update",
        user: session,
        changes: { externalRefFrom: existing.externalRef, externalRefTo: trimmed },
      });
    });
  } catch (e: any) {
    if (e?.code === "23505") {
      return { error: `เลขอ้างอิง "${trimmed}" ถูกใช้กับใบกำกับอื่นแล้ว — กรุณาใช้เลขอื่น` };
    }
    return { error: e?.message ?? "บันทึกไม่สำเร็จ" };
  }

  revalidatePath(`/invoices/${id}`);
  revalidatePath("/invoices");
  return { ok: true };
}

/** Admin-only: correct the doc_no on an invoice that originated from
 * service-center (externalRef set) — the number service-center's own POST
 * auto-reserves at draft time doesn't always match what should actually be
 * printed, and until now there was no way to fix it short of delete+recreate.
 * Scoped to externalRef-having invoices only; not for plain in-app invoices.
 * Bumps the month's counter forward so future auto-numbers don't collide. */
export async function updateInvoiceDocNoAction(
  id: number,
  newDocNo: string,
): Promise<{ error?: string; ok?: boolean; docNo?: string }> {
  const session = await getSession();
  if (!session) return { error: "session หมดอายุ" };
  if (session.role !== "admin") {
    return { error: "เฉพาะ admin เท่านั้นที่แก้ไขเลขที่ได้" };
  }

  const trimmed = newDocNo.trim();
  const parts = parseDocNo(trimmed);
  if (!parts) {
    return { error: `รูปแบบเลขที่เอกสารไม่ถูกต้อง: "${trimmed}" — ต้องเป็นรูป IV69/05-17805` };
  }

  try {
    const result = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ docNo: documents.docNo, status: documents.status, externalRef: documents.externalRef })
        .from(documents)
        .where(eq(documents.id, id))
        .limit(1);
      if (!existing) throw new Error("ไม่พบใบกำกับนี้");
      if (!existing.externalRef) {
        throw new Error("แก้เลขที่ได้เฉพาะใบที่มาจาก service-center เท่านั้น");
      }
      if (existing.status === "cancelled" || existing.status === "voided") {
        throw new Error("ใบที่ยกเลิก/โมฆะแล้ว แก้เลขที่ไม่ได้");
      }
      if (existing.docNo === trimmed) return { docNo: existing.docNo };

      await useCustomDocNo(tx as any, { documentType: "invoice", customDocNo: trimmed });

      await tx
        .update(documents)
        .set({
          docNo: trimmed,
          internalSeq: `${parts.yearBe}${parts.month}${String(parts.value).padStart(5, "0")}`,
          updatedByUserId: session.userId,
          updatedAt: new Date(),
        })
        .where(eq(documents.id, id));

      await writeJournal(tx as any, {
        documentId: id,
        action: "update",
        user: session,
        changes: { docNoFrom: existing.docNo, docNoTo: trimmed },
      });

      return { docNo: trimmed };
    });

    revalidatePath(`/invoices/${id}`);
    revalidatePath("/invoices");
    return { ok: true, docNo: result.docNo };
  } catch (e: any) {
    if (e?.code === "23505") {
      return { error: `เลขที่เอกสาร "${trimmed}" ซ้ำในระบบ — กรุณาเปลี่ยนเลข` };
    }
    return { error: e?.message ?? "บันทึกไม่สำเร็จ" };
  }
}

/**
 * Permanently deletes an invoice record (document_items and document_journals
 * cascade with it). Unlike cancelInvoiceAction, this does NOT touch the
 * counters table — the doc_no is intentionally left as a gap in the
 * sequence, findable later via the "รายงานเลขที่ขาดหาย" report so it can be
 * re-issued or accounted for. Tax invoice numbers must never be silently
 * reused; a real number that once existed just becomes a documented skip.
 */
export async function deleteInvoiceAction(id: number): Promise<{ error?: string; ok?: boolean }> {
  const session = await getSession();
  if (!session) return { error: "session หมดอายุ" };
  if (session.role !== "admin" && session.role !== "manager") {
    return { error: "เฉพาะ admin หรือ manager เท่านั้นที่ลบได้" };
  }

  const [doc] = await db
    .delete(documents)
    .where(eq(documents.id, id))
    .returning({ id: documents.id, docNo: documents.docNo });

  if (!doc) return { error: "ไม่พบใบกำกับนี้ (อาจถูกลบไปแล้ว)" };

  console.log(
    `[invoice-delete] ${doc.docNo} (id=${id}) deleted by ${session.username} (userId=${session.userId})`,
  );

  revalidatePath("/invoices");
  revalidatePath("/");
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

export type MissingDocNoGroup = {
  yearBe: string;
  month: string;
  min: string;
  max: string;
  missing: string[];
};

/** Find gaps in invoice doc_no sequences (per year/month) so intentionally-skipped
 * numbers can be located and filled in later. */
export async function getMissingDocNosAction(): Promise<{
  groups: MissingDocNoGroup[];
}> {
  const rows = await db.execute<{ doc_no: string }>(sql`
    SELECT doc_no FROM documents WHERE document_type = 'invoice' ORDER BY doc_no
  `);

  const byMonth = new Map<
    string,
    { yearBe: string; month: string; prefix: string; values: number[] }
  >();
  for (const r of rows) {
    const parts = parseDocNo(r.doc_no);
    if (!parts) continue;
    const key = `${parts.yearBe}-${parts.month}`;
    let g = byMonth.get(key);
    if (!g) {
      g = { yearBe: parts.yearBe, month: parts.month, prefix: parts.prefix, values: [] };
      byMonth.set(key, g);
    }
    g.values.push(parts.value);
  }

  const groups: MissingDocNoGroup[] = [];
  for (const g of byMonth.values()) {
    g.values.sort((a, b) => a - b);
    const min = g.values[0]!;
    const max = g.values[g.values.length - 1]!;
    const present = new Set(g.values);
    const missing: string[] = [];
    for (let v = min; v <= max; v++) {
      if (!present.has(v)) missing.push(buildDocNo(g.prefix, g.yearBe, g.month, v));
    }
    if (missing.length > 0) {
      groups.push({
        yearBe: g.yearBe,
        month: g.month,
        min: buildDocNo(g.prefix, g.yearBe, g.month, min),
        max: buildDocNo(g.prefix, g.yearBe, g.month, max),
        missing,
      });
    }
  }
  groups.sort((a, b) => (a.yearBe + a.month).localeCompare(b.yearBe + b.month));
  return { groups };
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
