"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Pencil, Trash2, Printer } from "lucide-react";
import { deleteWithholdingAction } from "./actions";

export function WhtRowActions({
  id,
  docNo,
}: {
  id: number;
  docNo: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onDelete() {
    if (!confirm(`ลบหนังสือรับรองหัก ณ ที่จ่าย "${docNo}"?`)) return;
    startTransition(async () => {
      const res = await deleteWithholdingAction(id);
      if (res?.error) alert(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex justify-end gap-1">
      <a
        href={`/withholding/${id}/print`}
        target="_blank"
        rel="noopener noreferrer"
        title="พิมพ์ A5"
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900"
      >
        <Printer className="h-4 w-4" />
      </a>
      <Link
        href={`/withholding/${id}/edit`}
        title="แก้ไข"
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-blue-600 transition hover:bg-blue-50 hover:text-blue-700"
      >
        <Pencil className="h-4 w-4" />
      </Link>
      <button
        type="button"
        title="ลบ"
        onClick={onDelete}
        disabled={pending}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-red-500 transition hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
