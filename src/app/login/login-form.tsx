"use client";

import { useState, useTransition } from "react";
import { LogIn, User, Lock, AlertCircle } from "lucide-react";
import { loginAction } from "./actions";

export function LoginForm({
  next,
  initialError,
}: {
  next?: string;
  initialError?: string;
}) {
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await loginAction(formData);
      if (res?.error) setError(res.error);
    });
  }

  return (
    <div className="rounded-2xl border border-blue-300 bg-white/95 p-6 shadow-2xl backdrop-blur-md">
      <form action={onSubmit} className="space-y-4">
        <input type="hidden" name="next" value={next ?? "/"} />

        <div className="space-y-1.5">
          <label
            htmlFor="username"
            className="flex items-center gap-1.5 text-sm font-semibold text-zinc-700"
          >
            <User className="h-4 w-4 text-blue-600" />
            ชื่อผู้ใช้
          </label>
          <div className="relative">
            <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              id="username"
              name="username"
              autoFocus
              required
              autoComplete="username"
              className="h-11 w-full rounded-lg border border-zinc-300 bg-white pl-10 pr-3 text-sm text-zinc-900 shadow-sm transition placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              placeholder="username"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="password"
            className="flex items-center gap-1.5 text-sm font-semibold text-zinc-700"
          >
            <Lock className="h-4 w-4 text-blue-600" />
            รหัสผ่าน
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="h-11 w-full rounded-lg border border-zinc-300 bg-white pl-10 pr-3 text-sm text-zinc-900 shadow-sm transition placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              placeholder="••••••••"
            />
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={pending}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 text-sm font-bold text-white shadow-md transition hover:bg-blue-700 active:translate-y-px disabled:opacity-60"
        >
          <LogIn className="h-4 w-4" />
          {pending ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
        </button>
      </form>
    </div>
  );
}
