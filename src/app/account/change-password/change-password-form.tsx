"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { changePasswordAction } from "@/app/login/actions";

export function ChangePasswordForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await changePasswordAction(formData);
      if (res?.error) {
        setError(res.error);
        return;
      }
      setDone(true);
      setTimeout(() => router.push("/"), 1500);
    });
  }

  if (done) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 p-6 text-center">
          <CheckCircle2 className="h-10 w-10 text-green-600" />
          <p className="font-semibold">เปลี่ยนรหัสผ่านสำเร็จ</p>
          <p className="text-sm text-zinc-500">กำลังพาคุณไปหน้าหลัก...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6">
        <form action={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">รหัสผ่านปัจจุบัน</label>
            <Input name="current" type="password" required autoFocus autoComplete="current-password" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">รหัสผ่านใหม่</label>
            <Input name="password" type="password" required minLength={6} autoComplete="new-password" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">ยืนยันรหัสผ่านใหม่</label>
            <Input name="confirm" type="password" required minLength={6} autoComplete="new-password" />
          </div>
          {error && (
            <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}
          <Button type="submit" className="w-full" disabled={pending}>
            <KeyRound className="h-4 w-4" />
            {pending ? "กำลังบันทึก..." : "เปลี่ยนรหัสผ่าน"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
