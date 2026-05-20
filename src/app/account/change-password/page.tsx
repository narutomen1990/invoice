import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { ChangePasswordForm } from "./change-password-form";

export default async function ChangePasswordPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-100 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold">เปลี่ยนรหัสผ่าน</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {session.mustChangePassword
              ? "ต้องเปลี่ยนรหัสผ่านก่อนใช้งาน"
              : `บัญชี ${session.username}`}
          </p>
        </div>
        <ChangePasswordForm />
      </div>
    </div>
  );
}
