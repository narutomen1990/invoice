"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, CheckCircle2, AlertCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createBackupAction, deleteBackupAction } from "./actions";

export function BackupActions({
  items,
}: {
  items: { name: string; size: string; createdAt: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  function onCreate() {
    setMsg(null);
    startTransition(async () => {
      const res = await createBackupAction();
      if (res?.error) setMsg({ type: "err", text: res.error });
      else if (res?.filename) {
        setMsg({ type: "ok", text: `สร้างไฟล์ ${res.filename} เรียบร้อย` });
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-3">
      <Button onClick={onCreate} disabled={pending}>
        <Archive className="h-4 w-4" />
        {pending ? "กำลังสำรอง..." : "Backup ทันที"}
      </Button>
      {msg && (
        <div
          className={`flex items-start gap-2 rounded-md p-3 text-sm ${
            msg.type === "ok" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
          }`}
        >
          {msg.type === "ok" ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          {msg.text}
        </div>
      )}
      {items.length > 0 && (
        <div className="text-xs text-zinc-500">
          ล่าสุด: {items[0]?.name} ({items[0]?.size})
        </div>
      )}
    </div>
  );
}

export function DeleteBackupButton({ filename }: { filename: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  function onClick() {
    if (!confirm(`ลบไฟล์ ${filename}?`)) return;
    startTransition(async () => {
      const res = await deleteBackupAction(filename);
      if (res?.error) alert(res.error);
      else router.refresh();
    });
  }
  return (
    <Button size="sm" variant="ghost" onClick={onClick} disabled={pending}>
      <Trash2 className="h-4 w-4 text-red-500" />
    </Button>
  );
}
