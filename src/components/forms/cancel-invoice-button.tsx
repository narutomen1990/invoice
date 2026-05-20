"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cancelInvoiceAction } from "@/app/invoices/actions";

export function CancelInvoiceButton({ id, docNo }: { id: number; docNo: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onClick() {
    if (!confirm(`ยืนยันการยกเลิกใบ ${docNo}?\n(การยกเลิกไม่สามารถย้อนกลับได้)`)) return;
    startTransition(async () => {
      const res = await cancelInvoiceAction(id);
      if (res?.error) {
        alert(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <Button variant="destructive" size="sm" onClick={onClick} disabled={pending}>
      <XCircle className="h-4 w-4" />
      {pending ? "กำลังยกเลิก..." : "ยกเลิกใบ"}
    </Button>
  );
}
