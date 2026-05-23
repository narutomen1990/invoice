"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  CheckCircle2,
  AlertCircle,
  FileDown,
  Database,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { importInvoicesFromFoxProAction } from "./actions";
import type { ImportResult } from "@/lib/etl/import-invoices";

function fmtMb(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function ImportInvoicesCard() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dbf, setDbf] = useState<File | null>(null);
  const [fpt, setFpt] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const dbfRef = useRef<HTMLInputElement>(null);
  const fptRef = useRef<HTMLInputElement>(null);

  function onSubmit() {
    setError(null);
    setResult(null);
    if (!dbf) {
      setError("กรุณาเลือกไฟล์ Invoice.DBF");
      return;
    }
    const fd = new FormData();
    fd.set("dbf", dbf);
    if (fpt) fd.set("fpt", fpt);

    startTransition(async () => {
      const res = await importInvoicesFromFoxProAction(fd);
      if (res?.error) {
        setError(res.error);
        return;
      }
      if (res?.result) {
        setResult(res.result);
        setDbf(null);
        setFpt(null);
        if (dbfRef.current) dbfRef.current.value = "";
        if (fptRef.current) fptRef.current.value = "";
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-xs leading-relaxed text-blue-900">
        <div className="mb-1.5 flex items-center gap-1.5 font-semibold">
          <Database className="h-3.5 w-3.5" />
          วิธีใช้
        </div>
        <ol className="ml-4 list-decimal space-y-0.5">
          <li>
            เปิดโปรแกรม FoxPro เดิม → หาโฟลเดอร์ที่เก็บข้อมูล (เช่น
            <span className="font-mono"> C:\Invoice\</span>)
          </li>
          <li>เลือก 2 ไฟล์: <span className="font-mono">Invoice.DBF</span> (บังคับ)
            และ <span className="font-mono">Invoice.FPT</span> (แนะนำ — เก็บหมายเหตุยาว ๆ)</li>
          <li>กดปุ่ม "นำเข้า" — ระบบจะเพิ่มเฉพาะ <strong>ใบกำกับใหม่</strong>
            ที่ยังไม่มีในระบบ (ไม่ทับของเดิม ไม่กระทบลูกค้า/สินค้า/เอกสารอื่น)</li>
        </ol>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-semibold text-zinc-700">
            Invoice.DBF <span className="text-red-500">*</span>
          </span>
          <input
            ref={dbfRef}
            type="file"
            accept=".dbf,.DBF"
            onChange={(e) => setDbf(e.target.files?.[0] ?? null)}
            disabled={pending}
            className="block w-full rounded border border-zinc-300 bg-white text-xs file:mr-3 file:cursor-pointer file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-xs file:font-medium hover:file:bg-zinc-200 disabled:opacity-50"
          />
          {dbf && (
            <span className="text-xs text-zinc-500">
              {dbf.name} ({fmtMb(dbf.size)})
            </span>
          )}
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-semibold text-zinc-700">
            Invoice.FPT <span className="text-zinc-400">(แนะนำ)</span>
          </span>
          <input
            ref={fptRef}
            type="file"
            accept=".fpt,.FPT"
            onChange={(e) => setFpt(e.target.files?.[0] ?? null)}
            disabled={pending}
            className="block w-full rounded border border-zinc-300 bg-white text-xs file:mr-3 file:cursor-pointer file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-xs file:font-medium hover:file:bg-zinc-200 disabled:opacity-50"
          />
          {fpt && (
            <span className="text-xs text-zinc-500">
              {fpt.name} ({fmtMb(fpt.size)})
            </span>
          )}
        </label>
      </div>

      <div>
        <Button onClick={onSubmit} disabled={pending || !dbf}>
          <Upload className="h-4 w-4" />
          {pending ? "กำลังนำเข้า..." : "นำเข้า (OK)"}
        </Button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {result && (
        <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-900">
          <div className="mb-2 flex items-center gap-2 font-semibold">
            <CheckCircle2 className="h-4 w-4" />
            นำเข้าสำเร็จ
          </div>
          <table className="w-full text-xs">
            <tbody className="divide-y divide-green-200">
              <Row label="อ่านจาก FoxPro" value={result.recordsRead.toLocaleString()} />
              <Row label="มีในระบบแล้ว (ข้าม)" value={result.alreadyExisted.toLocaleString()} />
              <Row
                label="เพิ่มใหม่"
                value={`${result.inserted.toLocaleString()} ใบ`}
                strong
              />
              {result.insertedInvoices > 0 && (
                <Row
                  label="  • ใบกำกับภาษีขาย"
                  value={result.insertedInvoices.toLocaleString()}
                />
              )}
              {result.insertedCreditNotes > 0 && (
                <Row
                  label="  • ใบลดหนี้ (CN)"
                  value={result.insertedCreditNotes.toLocaleString()}
                />
              )}
              <Row label="รายการสินค้าที่เพิ่ม" value={result.itemsInserted.toLocaleString()} />
              {result.dupRenamed > 0 && (
                <Row
                  label="doc_no ซ้ำในไฟล์ — เปลี่ยนชื่อ"
                  value={`${result.dupRenamed} (suffix -DUP)`}
                />
              )}
              {result.skipped > 0 && (
                <Row label="ข้าม (ข้อมูลไม่ครบ)" value={result.skipped.toLocaleString()} />
              )}
              <Row label="counter ที่อัปเดต" value={`${result.countersUpdated} เดือน`} />
            </tbody>
          </table>
          {result.newDocNos.length > 0 && (
            <details className="mt-3 text-xs">
              <summary className="cursor-pointer font-medium">
                ดูเลขใบที่เพิ่ม ({result.newDocNos.length})
              </summary>
              <div className="mt-2 max-h-40 overflow-y-auto rounded border border-green-200 bg-white p-2 font-mono text-[11px]">
                {result.newDocNos.join(", ")}
              </div>
            </details>
          )}
          <div className="mt-3 flex items-center gap-1.5 text-xs">
            <FileDown className="h-3.5 w-3.5" />
            <a href="/invoices" className="underline hover:text-green-700">
              ไปดูในรายการใบกำกับ
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <tr>
      <td className="py-1.5 pr-3 text-zinc-700">{label}</td>
      <td className={`py-1.5 text-right tabular-nums ${strong ? "font-bold" : ""}`}>
        {value}
      </td>
    </tr>
  );
}
