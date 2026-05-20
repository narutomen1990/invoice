"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";

function isAdmin(role: string | undefined) {
  return role === "admin";
}

export async function createUserAction(formData: FormData): Promise<{ error?: string; ok?: boolean }> {
  const session = await getSession();
  if (!session) return { error: "session หมดอายุ" };
  if (!isAdmin(session.role)) return { error: "เฉพาะ admin เท่านั้น" };

  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim();
  const role = String(formData.get("role") ?? "staff").trim() as
    | "admin"
    | "manager"
    | "staff"
    | "viewer";

  if (!username) return { error: "ชื่อผู้ใช้ห้ามว่าง" };
  if (password.length < 6) return { error: "รหัสผ่านต้องอย่างน้อย 6 ตัวอักษร" };

  try {
    await db.insert(users).values({
      username,
      passwordHash: await hashPassword(password),
      fullName: fullName || null,
      role,
      mustChangePassword: false,
      isActive: true,
    });
    revalidatePath("/users");
    return { ok: true };
  } catch (e: any) {
    if (e?.code === "23505") return { error: `ชื่อผู้ใช้ "${username}" ถูกใช้แล้ว` };
    return { error: e?.message ?? "บันทึกไม่สำเร็จ" };
  }
}

export async function updateUserAction(id: number, formData: FormData): Promise<{ error?: string; ok?: boolean }> {
  const session = await getSession();
  if (!session) return { error: "session หมดอายุ" };
  if (!isAdmin(session.role)) return { error: "เฉพาะ admin เท่านั้น" };

  const username = String(formData.get("username") ?? "").trim();
  const fullName = String(formData.get("fullName") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "staff").trim() as
    | "admin"
    | "manager"
    | "staff"
    | "viewer";
  const isActive = formData.get("isActive") === "1" || formData.get("isActive") === "true";

  if (!username) return { error: "ชื่อผู้ใช้ห้ามว่าง" };
  if (password && password.length < 6) {
    return { error: "รหัสผ่านใหม่ต้องอย่างน้อย 6 ตัวอักษร" };
  }

  const update: Record<string, unknown> = {
    username,
    fullName: fullName || null,
    role,
    isActive,
    updatedAt: new Date(),
  };
  if (password) {
    update.passwordHash = await hashPassword(password);
    update.mustChangePassword = false;
    update.failedLoginCount = 0;
  }

  try {
    await db.update(users).set(update).where(eq(users.id, id));
    revalidatePath("/users");
    return { ok: true };
  } catch (e: any) {
    if (e?.code === "23505") return { error: `ชื่อผู้ใช้ "${username}" ถูกใช้แล้ว` };
    return { error: e?.message ?? "บันทึกไม่สำเร็จ" };
  }
}

export async function resetPasswordAction(id: number, newPassword: string): Promise<{ error?: string; ok?: boolean }> {
  const session = await getSession();
  if (!session) return { error: "session หมดอายุ" };
  if (!isAdmin(session.role)) return { error: "เฉพาะ admin เท่านั้น" };
  if (newPassword.length < 6) return { error: "รหัสผ่านต้องอย่างน้อย 6 ตัวอักษร" };

  await db
    .update(users)
    .set({
      passwordHash: await hashPassword(newPassword),
      mustChangePassword: true,
      failedLoginCount: 0,
      updatedAt: new Date(),
    })
    .where(eq(users.id, id));
  revalidatePath("/users");
  return { ok: true };
}

export async function deleteUserAction(
  id: number,
): Promise<{ error?: string; ok?: boolean; softDisabled?: boolean }> {
  const session = await getSession();
  if (!session) return { error: "session หมดอายุ" };
  if (!isAdmin(session.role)) return { error: "เฉพาะ admin เท่านั้น" };
  if (id === session.userId) return { error: "ลบบัญชีตัวเองไม่ได้" };

  try {
    await db.delete(users).where(eq(users.id, id));
    revalidatePath("/users");
    return { ok: true };
  } catch (e: any) {
    // PostgreSQL FK violation → fall back to soft disable
    if (e?.code === "23503") {
      await db
        .update(users)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(users.id, id));
      revalidatePath("/users");
      return {
        ok: true,
        softDisabled: true,
        error:
          "ลบจริงไม่ได้เพราะ user นี้มีข้อมูลอ้างอิง (เอกสาร/log) — เปลี่ยนเป็นปิดใช้งานแทน",
      };
    }
    return { error: e?.message ?? "ลบไม่สำเร็จ" };
  }
}
