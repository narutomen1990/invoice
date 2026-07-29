"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, CheckCircle2, AlertCircle, Trash2, RotateCcw, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  createBackupAction,
  deleteBackupAction,
  restoreBackupAction,
  uploadBackupAction,
} from "./actions";

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

export function UploadBackupCard() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [restoring, startRestore] = useTransition();
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [uploadedFilename, setUploadedFilename] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function onUpload() {
    if (!file) return;
    setMsg(null);
    setUploadedFilename(null);
    const fd = new FormData();
    fd.set("file", file);
    startTransition(async () => {
      const res = await uploadBackupAction(fd);
      if (res?.error) {
        setMsg({ type: "err", text: res.error });
        return;
      }
      setMsg({ type: "ok", text: `อัปโหลด ${res.filename} เรียบร้อย — ไฟล์นี้ยังไม่ถูกใช้กู้คืนข้อมูล ต้องกดปุ่ม "Restore ไฟล์นี้" ด้านล่างต่ออีกขั้นตอนหนึ่ง` });
      setUploadedFilename(res.filename ?? null);
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    });
  }

  function onRestoreUploaded() {
    if (!uploadedFilename) return;
    const step1 = confirm(
      `คำเตือน: การ Restore จากไฟล์ "${uploadedFilename}" จะเขียนทับข้อมูลปัจจุบันทั้งหมดในระบบ\n\n` +
        `ข้อมูลที่บันทึกหลังจากวันที่สำรองไฟล์นี้จะหายไปถาวรและกู้คืนไม่ได้ ต้องการดำเนินการต่อหรือไม่?`,
    );
    if (!step1) return;
    const step2 = confirm(`ยืนยันอีกครั้ง: Restore จากไฟล์ "${uploadedFilename}" ใช่หรือไม่?`);
    if (!step2) return;

    startRestore(async () => {
      const res = await restoreBackupAction(uploadedFilename);
      if (res?.error) alert(`Restore ไม่สำเร็จ: ${res.error}`);
      else {
        alert("Restore สำเร็จ — ข้อมูลถูกกู้คืนจากไฟล์สำรองแล้ว");
        setUploadedFilename(null);
        setMsg(null);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-zinc-500">
        นำไฟล์ backup ที่ดาวน์โหลดไว้ในคอมพิวเตอร์ (.dump หรือ .sql.gz) มาอัปโหลดขึ้นเซิร์ฟเวอร์
        ไฟล์จะไปปรากฏในตารางด้านล่าง — การอัปโหลด "ไม่ได้" กู้คืนข้อมูลให้อัตโนมัติ
        ต้องกดปุ่ม Restore อีกขั้นตอนหนึ่งจึงจะกู้คืนจริง
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept=".dump,.sql.gz"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          disabled={pending}
          className="block text-xs file:mr-3 file:cursor-pointer file:rounded file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-xs file:font-medium hover:file:bg-zinc-200 disabled:opacity-50"
        />
        <Button onClick={onUpload} disabled={pending || !file} size="sm">
          <Upload className="h-4 w-4" />
          {pending ? "กำลังอัปโหลด..." : "อัปโหลด"}
        </Button>
      </div>
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
      {uploadedFilename && (
        <Button
          onClick={onRestoreUploaded}
          disabled={restoring}
          variant="destructive"
          size="sm"
        >
          <RotateCcw className={`h-4 w-4 ${restoring ? "animate-spin" : ""}`} />
          {restoring ? "กำลัง Restore..." : `Restore ไฟล์นี้ (${uploadedFilename})`}
        </Button>
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
    <Button size="sm" variant="ghost" onClick={onClick} disabled={pending} title="ลบไฟล์">
      <Trash2 className="h-4 w-4 text-red-500" />
    </Button>
  );
}

export function RestoreBackupButton({ filename }: { filename: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onClick() {
    const step1 = confirm(
      `คำเตือน: การ Restore จากไฟล์ "${filename}" จะเขียนทับข้อมูลปัจจุบันทั้งหมดในระบบ\n\n` +
        `ข้อมูลที่บันทึกหลังจากวันที่สำรองไฟล์นี้จะหายไปถาวรและกู้คืนไม่ได้ ต้องการดำเนินการต่อหรือไม่?`,
    );
    if (!step1) return;

    const step2 = confirm(`ยืนยันอีกครั้ง: Restore จากไฟล์ "${filename}" ใช่หรือไม่?`);
    if (!step2) return;

    startTransition(async () => {
      const res = await restoreBackupAction(filename);
      if (res?.error) alert(`Restore ไม่สำเร็จ: ${res.error}`);
      else {
        alert("Restore สำเร็จ — ข้อมูลถูกกู้คืนจากไฟล์สำรองแล้ว");
        router.refresh();
      }
    });
  }

  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={onClick}
      disabled={pending}
      title="Restore ข้อมูลจากไฟล์นี้"
    >
      <RotateCcw className={`h-4 w-4 text-amber-600 ${pending ? "animate-spin" : ""}`} />
    </Button>
  );
}
