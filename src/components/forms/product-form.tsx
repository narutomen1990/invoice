"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createProductAction, updateProductAction } from "@/app/products/actions";

export type ProductFormInitial = {
  id?: number;
  code: string;
  name: string;
  nameEn: string;
  unit: string;
  price: string;
  isService: boolean;
  isActive: boolean;
  notes: string;
};

export function ProductForm({
  mode,
  initial,
}: {
  mode: "new" | "edit";
  initial: ProductFormInitial;
}) {
  const router = useRouter();
  const [d, setD] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function set<K extends keyof ProductFormInitial>(key: K, value: ProductFormInitial[K]) {
    setD((p) => ({ ...p, [key]: value }));
  }

  function onSubmit() {
    setError(null);
    const fd = new FormData();
    Object.entries(d).forEach(([k, v]) => fd.set(k, String(v)));
    startTransition(async () => {
      const res =
        mode === "new"
          ? await createProductAction(fd)
          : await updateProductAction(initial.id!, fd);
      if (res?.error) {
        setError(res.error);
        return;
      }
      const id = mode === "new" ? res?.id : initial.id;
      router.push(id ? `/products/${id}` : "/products");
    });
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-start gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <Card>
        <CardContent className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
          <Field label="รหัสสินค้า/บริการ *">
            <Input
              value={d.code}
              onChange={(e) => set("code", e.target.value)}
              required
              maxLength={30}
              className="font-mono"
            />
          </Field>
          <Field label="ประเภท">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={d.isService}
                onChange={(e) => set("isService", e.target.checked)}
              />
              เป็นบริการ (ไม่ใช่สินค้า)
            </label>
          </Field>
          <Field label="ชื่อ (ไทย) *" colSpan>
            <Input value={d.name} onChange={(e) => set("name", e.target.value)} required />
          </Field>
          <Field label="ชื่อ (อังกฤษ)" colSpan>
            <Input value={d.nameEn} onChange={(e) => set("nameEn", e.target.value)} />
          </Field>
          <Field label="หน่วย">
            <Input
              value={d.unit}
              onChange={(e) => set("unit", e.target.value)}
              maxLength={20}
              placeholder="ชิ้น, ชุด, กล่อง..."
            />
          </Field>
          <Field label="ราคา/หน่วย">
            <Input
              type="number"
              step="0.01"
              value={d.price}
              onChange={(e) => set("price", e.target.value)}
              className="text-right tabular-nums"
            />
          </Field>
          <Field label="หมายเหตุ" colSpan>
            <textarea
              value={d.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={2}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
            />
          </Field>
          <Field label="สถานะ">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={d.isActive}
                onChange={(e) => set("isActive", e.target.checked)}
              />
              เปิดใช้งาน (active)
            </label>
          </Field>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => router.back()}>
          ยกเลิก
        </Button>
        <Button variant="save" onClick={onSubmit} disabled={pending}>
          <Save className="h-4 w-4" />
          {pending ? "กำลังบันทึก..." : mode === "new" ? "บันทึกใหม่" : "บันทึกการแก้ไข"}
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  colSpan,
}: {
  label: string;
  children: React.ReactNode;
  colSpan?: boolean;
}) {
  return (
    <div className={colSpan ? "md:col-span-2" : ""}>
      <label className="mb-1 block text-xs text-zinc-500">{label}</label>
      {children}
    </div>
  );
}
