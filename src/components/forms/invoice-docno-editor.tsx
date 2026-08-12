"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { updateInvoiceDocNoAction } from "@/app/invoices/actions";

export function InvoiceDocNoEditor({ id, docNo }: { id: number; docNo: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onEdit() {
    const next = prompt(
      `แก้ไขเลขที่ใบกำกับ (จาก service-center)\nรูปแบบ: IV69/05-17805`,
      docNo,
    );
    if (next === null || !next.trim() || next.trim() === docNo) return;
    if (!confirm(`เปลี่ยนเลขที่ใบกำกับจาก ${docNo} เป็น ${next.trim()}?`)) return;
    startTransition(async () => {
      const res = await updateInvoiceDocNoAction(id, next.trim());
      if (res?.error) {
        alert(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={onEdit}
      title="Admin: แก้ไขเลขที่ใบกำกับ (จาก service-center)"
      className="text-zinc-400 hover:text-rose-700 disabled:opacity-50"
    >
      <Pencil className="h-3 w-3" />
    </button>
  );
}
