"use server";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { withholdingCertificates } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { bahtText } from "@/lib/thai/number";
import { cleanText } from "@/lib/withholding/sanitize";

const ItemSchema = z.object({
  category: z.string().min(1),
  description: z.string().default(""),
  datePaid: z.string().default(""),
  amount: z.coerce.number().min(0).default(0),
  tax: z.coerce.number().min(0).default(0),
});

const WhtSchema = z.object({
  issueDate: z.string().min(1, "กรุณาระบุวันที่"),
  volumeNo: z.string().nullable().optional(),
  sequenceInForm: z.string().nullable().optional(),
  formType: z.string().default("pnd53"),
  payerName: z.string().min(1, "กรุณาระบุชื่อผู้มีหน้าที่หักภาษี"),
  payerTaxId: z.string().nullable().optional(),
  payerAddress: z.string().nullable().optional(),
  payeeName: z.string().min(1, "กรุณาระบุชื่อผู้ถูกหักภาษี"),
  payeeTaxId: z.string().nullable().optional(),
  payeeAddress: z.string().nullable().optional(),
  items: z.array(ItemSchema).min(1, "ต้องมีรายการเงินได้อย่างน้อย 1 รายการ"),
  taxCondition: z.string().default("withhold"),
  taxConditionOther: z.string().nullable().optional(),
  pensionFund: z.coerce.number().nullable().optional(),
  pensionFundLicense: z.string().nullable().optional(),
  socialSecurity: z.coerce.number().nullable().optional(),
  employerAccountNo: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  stampEnabled: z.boolean().default(false),
});

const clean = cleanText;

const s = (fd: FormData, k: string) => clean(String(fd.get(k) ?? "")).trim();
const sn = (fd: FormData, k: string) => s(fd, k) || null;

function parseForm(formData: FormData) {
  const rawItems = JSON.parse(String(formData.get("items_json") ?? "[]"));
  const items = Array.isArray(rawItems)
    ? rawItems.map((it) => ({
        ...it,
        category: clean(String(it?.category ?? "")),
        description: clean(String(it?.description ?? "")),
        datePaid: clean(String(it?.datePaid ?? "")),
      }))
    : [];
  return WhtSchema.safeParse({
    issueDate: s(formData, "issueDate"),
    volumeNo: sn(formData, "volumeNo"),
    sequenceInForm: sn(formData, "sequenceInForm"),
    formType: s(formData, "formType") || "pnd53",
    payerName: s(formData, "payerName"),
    payerTaxId: sn(formData, "payerTaxId"),
    payerAddress: sn(formData, "payerAddress"),
    payeeName: s(formData, "payeeName"),
    payeeTaxId: sn(formData, "payeeTaxId"),
    payeeAddress: sn(formData, "payeeAddress"),
    items,
    taxCondition: s(formData, "taxCondition") || "withhold",
    taxConditionOther: sn(formData, "taxConditionOther"),
    pensionFund: sn(formData, "pensionFund"),
    pensionFundLicense: sn(formData, "pensionFundLicense"),
    socialSecurity: sn(formData, "socialSecurity"),
    employerAccountNo: sn(formData, "employerAccountNo"),
    note: sn(formData, "note"),
    stampEnabled: formData.get("stampEnabled") === "1",
  });
}

/** Generate next WTI doc number: WTI-YYYYMM##### */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function nextWhtDocNo(tx: any, issueDate: string): Promise<{
  docNo: string;
  seq: number;
}> {
  const [y, m] = issueDate.split("-");
  const yyyymm = `${y}${(m ?? "01").padStart(2, "0")}`;
  const lockKey = `wht:${yyyymm}`;
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`);
  const rows = await tx.execute(sql`
    SELECT COALESCE(MAX(sequence_no), 0) + 1 AS next
      FROM withholding_certificates
     WHERE doc_no LIKE ${"WTI-" + yyyymm + "%"}
  `);
  const seq = Number(rows[0]?.next ?? 1);
  return { docNo: `WTI-${yyyymm}${String(seq).padStart(5, "0")}`, seq };
}

function rowFromInput(d: z.infer<typeof WhtSchema>) {
  const totalPaid = d.items.reduce((a, it) => a + it.amount, 0);
  const totalTax = d.items.reduce((a, it) => a + it.tax, 0);
  return {
    issueDate: d.issueDate,
    volumeNo: d.volumeNo ?? null,
    sequenceInForm: d.sequenceInForm ?? null,
    formType: d.formType,
    payerName: d.payerName,
    payerTaxId: d.payerTaxId ?? null,
    payerAddress: d.payerAddress ?? null,
    payeeName: d.payeeName,
    payeeTaxId: d.payeeTaxId ?? null,
    payeeAddress: d.payeeAddress ?? null,
    items: d.items,
    totalPaid: totalPaid.toFixed(2),
    totalTax: totalTax.toFixed(2),
    totalTaxWords: bahtText(totalTax),
    taxCondition: d.taxCondition,
    taxConditionOther: d.taxConditionOther ?? null,
    pensionFund: d.pensionFund != null ? String(d.pensionFund) : null,
    pensionFundLicense: d.pensionFundLicense ?? null,
    socialSecurity: d.socialSecurity != null ? String(d.socialSecurity) : null,
    employerAccountNo: d.employerAccountNo ?? null,
    note: d.note ?? null,
    stampEnabled: d.stampEnabled,
  };
}

export async function createWithholdingAction(
  formData: FormData,
): Promise<{ error?: string; ok?: boolean; id?: number }> {
  const session = await getSession();
  if (!session) return { error: "session หมดอายุ" };

  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  }
  const customDocNo = clean(String(formData.get("customDocNo") ?? "")).trim();

  try {
    const result = await db.transaction(async (tx) => {
      let docNo = customDocNo;
      let seq = 0;
      if (!docNo) {
        const gen = await nextWhtDocNo(tx, parsed.data.issueDate);
        docNo = gen.docNo;
        seq = gen.seq;
      }
      const [row] = await tx
        .insert(withholdingCertificates)
        .values({
          docNo,
          sequenceNo: seq,
          ...rowFromInput(parsed.data),
          createdByUserId: session.userId,
        })
        .returning({ id: withholdingCertificates.id });
      return { id: row.id };
    });
    revalidatePath("/withholding");
    return { ok: true, id: result.id };
  } catch (e: any) {
    if (e?.code === "23505") {
      return { error: `เลขที่เอกสาร "${customDocNo}" ซ้ำในระบบ` };
    }
    return { error: e?.message ?? "บันทึกไม่สำเร็จ" };
  }
}

export async function updateWithholdingAction(
  id: number,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean; id?: number }> {
  const session = await getSession();
  if (!session) return { error: "session หมดอายุ" };

  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  }

  try {
    await db
      .update(withholdingCertificates)
      .set({ ...rowFromInput(parsed.data), updatedAt: new Date() })
      .where(eq(withholdingCertificates.id, id));
    revalidatePath("/withholding");
    revalidatePath(`/withholding/${id}`);
    return { ok: true, id };
  } catch (e: any) {
    return { error: e?.message ?? "บันทึกไม่สำเร็จ" };
  }
}

export async function deleteWithholdingAction(
  id: number,
): Promise<{ error?: string; ok?: boolean }> {
  const session = await getSession();
  if (!session) return { error: "session หมดอายุ" };

  try {
    await db
      .delete(withholdingCertificates)
      .where(eq(withholdingCertificates.id, id));
    revalidatePath("/withholding");
    return { ok: true };
  } catch (e: any) {
    return { error: e?.message ?? "ลบไม่สำเร็จ" };
  }
}
