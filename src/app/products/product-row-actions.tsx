"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { deleteProductAction } from "./actions";

export function ProductRowActions({
  id,
  code,
  name,
}: {
  id: number;
  code: string;
  name: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onDelete() {
    if (
      !confirm(
        `ลบสินค้า "${code} — ${name}"?\n(ถ้าสินค้านี้เคยถูกใช้ในเอกสาร จะถูกปิดใช้งานแทนการลบ)`,
      )
    )
      return;
    startTransition(async () => {
      const res = await deleteProductAction(id);
      if (res?.error) alert(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex justify-end gap-1">
      <Link
        href={`/products/${id}/edit`}
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
