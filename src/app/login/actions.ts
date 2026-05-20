"use server";

import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { setSession, clearSession, getSession } from "@/lib/auth/session";
import { verifyPassword, hashPassword } from "@/lib/auth/password";

export async function loginAction(formData: FormData): Promise<{ error?: string }> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/");

  if (!username || !password) {
    return { error: "กรุณากรอก username และ password" };
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  if (!user) {
    return { error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" };
  }
  if (!user.isActive) {
    return { error: "บัญชีนี้ถูกระงับ ติดต่อผู้ดูแลระบบ" };
  }

  const result = await verifyPassword(password, user.passwordHash);
  if (!result.ok) {
    await db
      .update(users)
      .set({ failedLoginCount: sql`${users.failedLoginCount} + 1` })
      .where(eq(users.id, user.id));
    return { error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" };
  }

  // upgrade legacy plaintext → bcrypt hash
  if (result.isLegacy) {
    const hash = await hashPassword(password);
    await db
      .update(users)
      .set({ passwordHash: hash, mustChangePassword: true })
      .where(eq(users.id, user.id));
  }

  await db
    .update(users)
    .set({ lastLoginAt: new Date(), failedLoginCount: 0 })
    .where(eq(users.id, user.id));

  await setSession({
    userId: user.id,
    username: user.username,
    fullName: user.fullName,
    role: user.role,
    mustChangePassword: user.mustChangePassword || result.isLegacy,
  });

  if (user.mustChangePassword || result.isLegacy) {
    redirect("/account/change-password");
  }

  redirect(next.startsWith("/") ? next : "/");
}

export async function logoutAction() {
  await clearSession();
  redirect("/login");
}

export async function changePasswordAction(formData: FormData): Promise<{ error?: string; ok?: boolean }> {
  const current = String(formData.get("current") ?? "");
  const next1 = String(formData.get("password") ?? "");
  const next2 = String(formData.get("confirm") ?? "");

  if (next1.length < 6) return { error: "รหัสผ่านใหม่ต้องอย่างน้อย 6 ตัวอักษร" };
  if (next1 !== next2) return { error: "รหัสผ่านใหม่ไม่ตรงกัน" };

  const session = await getSession();
  if (!session) return { error: "session หมดอายุ" };

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);

  if (!user) return { error: "ไม่พบผู้ใช้" };

  const result = await verifyPassword(current, user.passwordHash);
  if (!result.ok) return { error: "รหัสผ่านปัจจุบันไม่ถูกต้อง" };

  const hash = await hashPassword(next1);
  await db
    .update(users)
    .set({ passwordHash: hash, mustChangePassword: false, updatedAt: new Date() })
    .where(eq(users.id, user.id));

  // refresh session
  await setSession({
    userId: user.id,
    username: user.username,
    fullName: user.fullName,
    role: user.role,
    mustChangePassword: false,
  });

  return { ok: true };
}
