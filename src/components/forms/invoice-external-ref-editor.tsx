"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateInvoiceExternalRefAction } from "@/app/invoices/actions";

export function InvoiceExternalRefEditor({
  id,
  docNo,
  externalRef,
}: {
  id: number;
  docNo: string;
  externalRef: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onEdit() {
    const next = prompt(
      `เลขอ้างอิง service-center สำหรับใบ ${docNo}\n(ใส่เลขอะไรก็ได้เพื่อให้ใบนี้ขึ้นใน "รายงานภาษีงานซ่อม" — เว้นว่างเพื่อยกเลิกการผูก):`,
      externalRef ?? "",
    );
    if (next === null) return; // cancelled
    startTransition(async () => {
      const res = await updateInvoiceExternalRefAction(id, next);
      if (res?.error) {
        alert(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="border-t border-cyan-200 bg-indigo-50 px-3 py-1.5 text-[11px] text-indigo-800">
      {externalRef ? (
        <>
          📥 รับข้อมูลมาจาก service-center — <span className="font-mono">{externalRef}</span>
        </>
      ) : (
        <span className="text-zinc-500">ยังไม่ได้ผูกกับ service-center</span>
      )}{" "}
      <button
        type="button"
        disabled={pending}
        onClick={onEdit}
        className="ml-1 underline decoration-dotted hover:text-indigo-900 disabled:opacity-50"
      >
        {externalRef ? "แก้ไข" : "ผูกกับ service-center"}
      </button>
    </div>
  );
}
