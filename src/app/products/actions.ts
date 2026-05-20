"use server";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { products, documentItems } from "@/db/schema";
import { getSession } from "@/lib/auth/session";

type ProductFormData = {
  code: string;
  name: string;
  nameEn: string;
  unit: string;
  price: string;
  isService: boolean;
  isActive: boolean;
  notes: string;
};

function parseInput(formData: FormData): ProductFormData {
  const s = (k: string) => String(formData.get(k) ?? "").trim();
  return {
    code: s("code"),
    name: s("name"),
    nameEn: s("nameEn"),
    unit: s("unit"),
    price: s("price"),
    isService: formData.get("isService") === "1" || formData.get("isService") === "true",
    isActive: formData.get("isActive") === "1" || formData.get("isActive") === "true",
    notes: s("notes"),
  };
}

function toRow(d: ProductFormData) {
  const nullify = (v: string) => (v ? v : null);
  return {
    code: d.code,
    name: d.name,
    nameEn: nullify(d.nameEn),
    unit: nullify(d.unit),
    price: (parseFloat(d.price) || 0).toFixed(2),
    isService: d.isService,
    isActive: d.isActive,
    notes: nullify(d.notes),
  };
}

export async function createProductAction(formData: FormData): Promise<{ error?: string; ok?: boolean; id?: number }> {
  const session = await getSession();
  if (!session) return { error: "session หมดอายุ" };

  const d = parseInput(formData);
  if (!d.code) return { error: "รหัสสินค้าห้ามว่าง" };
  if (!d.name) return { error: "ชื่อสินค้าห้ามว่าง" };

  try {
    const [row] = await db.insert(products).values(toRow(d)).returning({ id: products.id });
    revalidatePath("/products");
    return { ok: true, id: row.id };
  } catch (e: any) {
    if (e?.code === "23505") return { error: `รหัสสินค้า "${d.code}" ซ้ำ` };
    return { error: e?.message ?? "บันทึกไม่สำเร็จ" };
  }
}

export async function updateProductAction(id: number, formData: FormData): Promise<{ error?: string; ok?: boolean; id?: number }> {
  const session = await getSession();
  if (!session) return { error: "session หมดอายุ" };

  const d = parseInput(formData);
  if (!d.code) return { error: "รหัสสินค้าห้ามว่าง" };
  if (!d.name) return { error: "ชื่อสินค้าห้ามว่าง" };

  try {
    await db
      .update(products)
      .set({ ...toRow(d), updatedAt: new Date() })
      .where(eq(products.id, id));
    revalidatePath(`/products/${id}`);
    revalidatePath("/products");
    return { ok: true };
  } catch (e: any) {
    if (e?.code === "23505") return { error: `รหัสสินค้า "${d.code}" ซ้ำ` };
    return { error: e?.message ?? "บันทึกไม่สำเร็จ" };
  }
}

export async function deleteProductAction(id: number): Promise<{ error?: string; ok?: boolean }> {
  const session = await getSession();
  if (!session) return { error: "session หมดอายุ" };

  const [u] = await db
    .select({ n: sql<number>`COUNT(*)::int` })
    .from(documentItems)
    .where(eq(documentItems.productId, id));

  if (Number(u?.n ?? 0) > 0) {
    await db
      .update(products)
      .set({ isActive: false, deletedAt: new Date() })
      .where(eq(products.id, id));
  } else {
    await db.delete(products).where(eq(products.id, id));
  }
  revalidatePath("/products");
  return { ok: true };
}
