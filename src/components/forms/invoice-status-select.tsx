"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateInvoiceStatusAction } from "@/app/invoices/actions";

// Only invoices sourced from service-center can be draft — this control lets
// admin flip such an invoice between its draft and issued state directly.
// Cancel/void go through the dedicated "ยกเลิกใบ" button instead.
const SC_OPTIONS: { value: string; th: string }[] = [
  { value: "draft", th: "ร่าง service-center" },
  { value: "issued", th: "ออกแล้ว service-center" },
];

export function InvoiceStatusSelect({
  id,
  docNo,
  status,
  className,
}: {
  id: number;
  docNo: string;
  status: string;
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value;
    if (next === status) return;
    const label = SC_OPTIONS.find((o) => o.value === next)?.th ?? next;
    if (!confirm(`เปลี่ยนสถานะใบ ${docNo} เป็น "${label}"?`)) {
      e.target.value = status;
      return;
    }
    startTransition(async () => {
      const res = await updateInvoiceStatusAction(id, next);
      if (res?.error) {
        alert(res.error);
        e.target.value = status;
        return;
      }
      router.refresh();
    });
  }

  return (
    <select
      value={status}
      disabled={pending}
      onChange={onChange}
      title="Admin: เปลี่ยนสถานะใบกำกับ"
      className={`rounded border border-zinc-300 bg-white px-1 py-0.5 text-[10px] font-medium disabled:opacity-50 ${className ?? ""}`}
    >
      {SC_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.th}
        </option>
      ))}
    </select>
  );
}
