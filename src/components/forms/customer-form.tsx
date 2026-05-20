"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save, AlertCircle, Trash2, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createCustomerAction, updateCustomerAction } from "@/app/customers/actions";

export type CustomerFormInitial = {
  id?: number;
  code: string;
  name: string;
  nameEn: string;
  taxId: string;
  defaultBranchCode: string;
  province: string;
  address1: string;
  address2: string;
  address3: string;
  tel: string;
  fax: string;
  email: string;
  website: string;
  contactName: string;
  contactNick: string;
  contactMobile: string;
  contactEmail: string;
  defaultSalemanName: string;
  defaultSalemanTel: string;
  defaultSalemanEmail: string;
  notes: string;
  isActive: boolean;
};

export function CustomerForm({
  mode,
  initial,
}: {
  mode: "new" | "edit";
  initial: CustomerFormInitial;
}) {
  const router = useRouter();
  const [d, setD] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function set<K extends keyof CustomerFormInitial>(key: K, value: CustomerFormInitial[K]) {
    setD((p) => ({ ...p, [key]: value }));
  }

  function onSubmit(thenAction: "back" | "addAnother") {
    setError(null);
    const fd = new FormData();
    Object.entries(d).forEach(([k, v]) => fd.set(k, String(v)));
    startTransition(async () => {
      const res =
        mode === "new"
          ? await createCustomerAction(fd)
          : await updateCustomerAction(initial.id!, fd);
      if (res?.error) {
        setError(res.error);
        return;
      }
      if (mode === "new" && thenAction === "addAnother") {
        setD({
          ...initial,
          name: "",
          taxId: "",
          address1: "",
          address2: "",
          address3: "",
          tel: "",
          fax: "",
          email: "",
          website: "",
          contactName: "",
          contactNick: "",
          contactMobile: "",
          contactEmail: "",
        });
        router.refresh();
        return;
      }
      const id = mode === "new" ? res?.id : initial.id;
      router.push(id ? `/customers/${id}` : "/customers");
    });
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="flex items-start gap-2 rounded-md bg-red-50 p-2 text-xs text-red-700">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_220px]">
        {/* LEFT: form */}
        <div className="space-y-2">
          {/* Top right: TAX ID + Branch (above Section 1, right-aligned) */}
          <div className="flex flex-wrap items-center justify-end gap-2 px-1 text-[12px]">
            <label className="text-zinc-700">เลขผู้เสียภาษี : TAX ID</label>
            <Input
              value={d.taxId}
              onChange={(e) => set("taxId", e.target.value)}
              maxLength={13}
              className="h-7 w-40 bg-yellow-50 px-2 py-0 font-mono text-center text-[12px] tracking-wider"
            />
            <label className="text-zinc-700">สาขาที่ : Branch No.</label>
            <Input
              value={d.defaultBranchCode}
              onChange={(e) => set("defaultBranchCode", e.target.value)}
              maxLength={5}
              className="h-7 w-20 bg-yellow-50 px-2 py-0 font-mono text-center text-[12px]"
              placeholder="00000"
            />
          </div>

          {/* Section 1: ข้อมูลลูกค้า (cyan) */}
          <Section>
            <Row label="รหัสลูกค้า : CustID">
              <Input
                value={d.code}
                onChange={(e) => set("code", e.target.value)}
                disabled={mode === "new"}
                className="h-7 w-40 bg-yellow-50 px-2 py-0 font-mono text-[12px] disabled:bg-zinc-100"
              />
            </Row>
            <Row label="รายชื่อลูกค้า : CustomerName">
              <Input
                value={d.name}
                onChange={(e) => set("name", e.target.value)}
                required
                autoFocus
                className="h-7 bg-yellow-50 px-2 py-0 text-[12px]"
              />
            </Row>
            <Row label="ที่อยู่ 1 : Address1">
              <Input
                value={d.address1}
                onChange={(e) => set("address1", e.target.value)}
                className="h-7 bg-yellow-50 px-2 py-0 text-[12px]"
              />
            </Row>
            <Row label="ที่อยู่ 2 : Address2">
              <Input
                value={d.address2}
                onChange={(e) => set("address2", e.target.value)}
                className="h-7 bg-yellow-50 px-2 py-0 text-[12px]"
              />
            </Row>
            <Row label="ที่อยู่ 3 : Address3">
              <Input
                value={d.address3}
                onChange={(e) => set("address3", e.target.value)}
                className="h-7 bg-yellow-50 px-2 py-0 text-[12px]"
              />
            </Row>
            <Row label="โทรศัพท์ : TEL">
              <Input
                value={d.tel}
                onChange={(e) => set("tel", e.target.value)}
                className="h-7 w-72 bg-yellow-50 px-2 py-0 text-[12px]"
              />
            </Row>
            <Row label="โทรสาร : FAX">
              <Input
                value={d.fax}
                onChange={(e) => set("fax", e.target.value)}
                className="h-7 w-72 bg-yellow-50 px-2 py-0 text-[12px]"
              />
            </Row>
            <Row label="อีเมล์ : email">
              <Input
                type="email"
                value={d.email}
                onChange={(e) => set("email", e.target.value)}
                className="h-7 bg-yellow-50 px-2 py-0 text-[12px]"
              />
            </Row>
            <Row label="เว็ปไซต์ : WebSite">
              <Input
                value={d.website}
                onChange={(e) => set("website", e.target.value)}
                className="h-7 bg-yellow-50 px-2 py-0 text-[12px]"
              />
            </Row>
          </Section>

          {/* Section 2: ผู้ติดต่อ (cyan) */}
          <Section>
            <Row label="ชื่อผู้ติดต่อ / ATTN">
              <Input
                value={d.contactName}
                onChange={(e) => set("contactName", e.target.value)}
                className="h-7 bg-yellow-50 px-2 py-0 text-[12px]"
              />
            </Row>
            <Row label="ชื่อเล่น : NickName">
              <Input
                value={d.contactNick}
                onChange={(e) => set("contactNick", e.target.value)}
                className="h-7 w-72 bg-yellow-50 px-2 py-0 text-[12px]"
              />
            </Row>
            <Row label="โทรศัพท์มือถือ : Mobile">
              <Input
                value={d.contactMobile}
                onChange={(e) => set("contactMobile", e.target.value)}
                className="h-7 w-72 bg-yellow-50 px-2 py-0 text-[12px]"
              />
            </Row>
            <Row label="อีเมล์ : email">
              <Input
                type="email"
                value={d.contactEmail}
                onChange={(e) => set("contactEmail", e.target.value)}
                className="h-7 bg-yellow-50 px-2 py-0 text-[12px]"
              />
            </Row>
          </Section>

          {/* Section 3: พนักงานขาย (cyan) */}
          <Section>
            <Row label="ชื่อพนักงานขาย">
              <Input
                value={d.defaultSalemanName}
                onChange={(e) => set("defaultSalemanName", e.target.value)}
                className="h-7 bg-yellow-50 px-2 py-0 text-[12px]"
              />
            </Row>
            <Row label="โทรศัพท์พนักงานขาย : SaleTel">
              <Input
                value={d.defaultSalemanTel}
                onChange={(e) => set("defaultSalemanTel", e.target.value)}
                className="h-7 w-72 bg-yellow-50 px-2 py-0 text-[12px]"
              />
            </Row>
            <Row label="email พนักงานขาย">
              <Input
                type="email"
                value={d.defaultSalemanEmail}
                onChange={(e) => set("defaultSalemanEmail", e.target.value)}
                className="h-7 bg-yellow-50 px-2 py-0 text-[12px]"
              />
            </Row>
          </Section>

          <details className="rounded-md border bg-zinc-50 px-3 py-2 text-[12px]">
            <summary className="cursor-pointer font-medium text-zinc-700">
              ข้อมูลเพิ่มเติม (optional)
            </summary>
            <div className="mt-2 space-y-1.5">
              <Row label="ชื่ออังกฤษ : English Name">
                <Input
                  value={d.nameEn}
                  onChange={(e) => set("nameEn", e.target.value)}
                  className="h-7 bg-yellow-50 px-2 py-0 text-[12px]"
                />
              </Row>
              <Row label="จังหวัด : Province">
                <Input
                  value={d.province}
                  onChange={(e) => set("province", e.target.value)}
                  className="h-7 w-72 bg-yellow-50 px-2 py-0 text-[12px]"
                />
              </Row>
              <Row label="หมายเหตุ">
                <textarea
                  value={d.notes}
                  onChange={(e) => set("notes", e.target.value)}
                  rows={2}
                  className="w-full rounded-md border border-zinc-300 bg-yellow-50 px-2 py-1 text-[12px] focus:outline-none focus:ring-1 focus:ring-cyan-400"
                />
              </Row>
              <Row label="สถานะ">
                <label className="flex items-center gap-2 text-[12px]">
                  <input
                    type="checkbox"
                    checked={d.isActive}
                    onChange={(e) => set("isActive", e.target.checked)}
                  />
                  เปิดใช้งาน (active)
                </label>
              </Row>
            </div>
          </details>
        </div>

        {/* RIGHT: action buttons */}
        <div className="space-y-2">
          <Button
            type="button"
            onClick={() => onSubmit("back")}
            disabled={pending}
            className="w-full justify-start bg-zinc-500 text-white hover:bg-zinc-600"
          >
            <Save className="h-4 w-4" />
            {pending ? "กำลังบันทึก..." : "Save บันทึกทับ"}
          </Button>
          {mode === "new" && (
            <Button
              type="button"
              onClick={() => onSubmit("addAnother")}
              disabled={pending}
              className="w-full justify-start bg-emerald-500 text-white hover:bg-emerald-600"
            >
              <Plus className="h-4 w-4" />
              Save รายการเพิ่ม
            </Button>
          )}
          <Button
            type="button"
            disabled
            className="w-full justify-start bg-rose-400 text-white opacity-70"
          >
            <Trash2 className="h-4 w-4" />
            ลบ Record ปัจจุบัน
          </Button>
          <Button
            type="button"
            onClick={() => router.back()}
            className="w-full justify-start bg-blue-700 text-white hover:bg-blue-800"
          >
            ESC ออก
          </Button>
          <p className="pt-1 text-[10px] text-zinc-400">C:\MICHAELSHAW\INVOICE</p>
        </div>
      </div>
    </div>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-cyan-300 bg-cyan-50 px-3 py-2">
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-12 items-center gap-2">
      <label className="col-span-4 text-right text-[12px] text-zinc-700 md:col-span-3">
        {label}
      </label>
      <div className="col-span-8 md:col-span-9">{children}</div>
    </div>
  );
}
