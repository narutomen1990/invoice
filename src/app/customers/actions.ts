"use server";

import { revalidatePath } from "next/cache";
import { eq, sql, and, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { customers, documents } from "@/db/schema";
import { getSession } from "@/lib/auth/session";

type CustomerFormData = {
  code: string;
  name: string;
  nameEn: string;
  taxId: string;
  defaultBranchCode: string;
  province: string;
  address1: string;
  address2: string;
  address3: string;
  tel: string;
  fax: string;
  email: string;
  website: string;
  contactName: string;
  contactNick: string;
  contactMobile: string;
  contactEmail: string;
  defaultSalemanName: string;
  defaultSalemanTel: string;
  defaultSalemanEmail: string;
  notes: string;
  isActive: boolean;
};

function parseInput(formData: FormData): CustomerFormData {
  const s = (k: string) => String(formData.get(k) ?? "").trim();
  return {
    code: s("code"),
    name: s("name"),
    nameEn: s("nameEn"),
    taxId: s("taxId"),
    defaultBranchCode: s("defaultBranchCode"),
    province: s("province"),
    address1: s("address1"),
    address2: s("address2"),
    address3: s("address3"),
    tel: s("tel"),
    fax: s("fax"),
    email: s("email"),
    website: s("website"),
    contactName: s("contactName"),
    contactNick: s("contactNick"),
    contactMobile: s("contactMobile"),
    contactEmail: s("contactEmail"),
    defaultSalemanName: s("defaultSalemanName"),
    defaultSalemanTel: s("defaultSalemanTel"),
    defaultSalemanEmail: s("defaultSalemanEmail"),
    notes: s("notes"),
    isActive: formData.get("isActive") === "1" || formData.get("isActive") === "true",
  };
}

function toRow(d: CustomerFormData) {
  const nullify = (v: string) => (v ? v : null);
  return {
    code: d.code,
    name: d.name,
    nameEn: nullify(d.nameEn),
    taxId: nullify(d.taxId),
    defaultBranchCode: nullify(d.defaultBranchCode),
    province: nullify(d.province),
    address1: nullify(d.address1),
    address2: nullify(d.address2),
    address3: nullify(d.address3),
    tel: nullify(d.tel),
    fax: nullify(d.fax),
    email: nullify(d.email),
    website: nullify(d.website),
    contactName: nullify(d.contactName),
    contactNick: nullify(d.contactNick),
    contactMobile: nullify(d.contactMobile),
    contactEmail: nullify(d.contactEmail),
    defaultSalemanName: nullify(d.defaultSalemanName),
    defaultSalemanTel: nullify(d.defaultSalemanTel),
    defaultSalemanEmail: nullify(d.defaultSalemanEmail),
    notes: nullify(d.notes),
    isActive: d.isActive,
  };
}

export async function createCustomerAction(formData: FormData): Promise<{ error?: string; ok?: boolean; id?: number }> {
  const session = await getSession();
  if (!session) return { error: "session หมดอายุ" };

  const d = parseInput(formData);
  if (!d.code) return { error: "รหัสลูกค้าห้ามว่าง" };
  if (!d.name) return { error: "ชื่อลูกค้าห้ามว่าง" };

  try {
    const [row] = await db
      .insert(customers)
      .values(toRow(d))
      .returning({ id: customers.id });
    revalidatePath("/customers");
    return { ok: true, id: row.id };
  } catch (e: any) {
    if (e?.code === "23505") return { error: `รหัสลูกค้า "${d.code}" ซ้ำ` };
    return { error: e?.message ?? "บันทึกไม่สำเร็จ" };
  }
}

export async function updateCustomerAction(id: number, formData: FormData): Promise<{ error?: string; ok?: boolean; id?: number }> {
  const session = await getSession();
  if (!session) return { error: "session หมดอายุ" };

  const d = parseInput(formData);
  if (!d.code) return { error: "รหัสลูกค้าห้ามว่าง" };
  if (!d.name) return { error: "ชื่อลูกค้าห้ามว่าง" };

  try {
    await db
      .update(customers)
      .set({ ...toRow(d), updatedAt: new Date() })
      .where(eq(customers.id, id));
    revalidatePath(`/customers/${id}`);
    revalidatePath("/customers");
    return { ok: true };
  } catch (e: any) {
    if (e?.code === "23505") return { error: `รหัสลูกค้า "${d.code}" ซ้ำ` };
    return { error: e?.message ?? "บันทึกไม่สำเร็จ" };
  }
}

export async function deleteCustomerAction(id: number): Promise<{ error?: string; ok?: boolean }> {
  const session = await getSession();
  if (!session) return { error: "session หมดอายุ" };

  // soft delete; block if has invoices
  const [u] = await db
    .select({ n: sql<number>`COUNT(*)::int` })
    .from(documents)
    .where(eq(documents.customerId, id));

  if (Number(u?.n ?? 0) > 0) {
    // soft delete only — เก็บไว้สำหรับใบกำกับเก่า
    await db
      .update(customers)
      .set({ isActive: false, deletedAt: new Date() })
      .where(eq(customers.id, id));
    revalidatePath("/customers");
    return { ok: true };
  }

  await db.delete(customers).where(eq(customers.id, id));
  revalidatePath("/customers");
  return { ok: true };
}

export async function nextCustomerCodeAction(): Promise<{ code: string }> {
  const [row] = await db.execute<{ max_code: string | null }>(sql`
    SELECT MAX(CAST(code AS INTEGER))::text AS max_code
      FROM customers
     WHERE code ~ '^[0-9]+$'
  `);
  const next = (Number(row?.max_code ?? 0) || 0) + 1;
  return { code: String(next).padStart(7, "0") };
}
