"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Save,
  X,
  Plus,
  Trash2,
  Building2,
  ArrowLeftRight,
  Printer,
  Stamp,
  Check,
  FileText,
  Users,
  Coins,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/thai/number";
import {
  WHT_FORM_TYPES,
  WHT_CATEGORIES,
  WHT_CONDITIONS,
  type WhtItem,
} from "@/lib/withholding/constants";
import { createWithholdingAction, updateWithholdingAction } from "./actions";

export type WhtFormInitial = {
  id?: number;
  docNo?: string;
  issueDate: string;
  volumeNo: string;
  sequenceInForm: string;
  formType: string;
  payerName: string;
  payerTaxId: string;
  payerAddress: string;
  payeeName: string;
  payeeTaxId: string;
  payeeAddress: string;
  items: WhtItem[];
  taxCondition: string;
  taxConditionOther: string;
  pensionFund: string;
  pensionFundLicense: string;
  socialSecurity: string;
  employerAccountNo: string;
  note: string;
  stampEnabled: boolean;
};

type CompanyInfo = { name: string; taxId: string; address: string };

const EMPTY_ITEM: WhtItem = {
  category: "sec3tres",
  description: "",
  datePaid: "",
  amount: 0,
  tax: 0,
};

export function WhtForm({
  mode,
  initial,
  company,
}: {
  mode: "new" | "edit";
  initial: WhtFormInitial;
  company: CompanyInfo;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [issueDate, setIssueDate] = useState(initial.issueDate);
  const [volumeNo, setVolumeNo] = useState(initial.volumeNo);
  const [sequenceInForm, setSequenceInForm] = useState(initial.sequenceInForm);
  const [formType, setFormType] = useState(initial.formType);
  const [payerName, setPayerName] = useState(initial.payerName);
  const [payerTaxId, setPayerTaxId] = useState(initial.payerTaxId);
  const [payerAddress, setPayerAddress] = useState(initial.payerAddress);
  const [payeeName, setPayeeName] = useState(initial.payeeName);
  const [payeeTaxId, setPayeeTaxId] = useState(initial.payeeTaxId);
  const [payeeAddress, setPayeeAddress] = useState(initial.payeeAddress);
  const [items, setItems] = useState<WhtItem[]>(
    initial.items.length ? initial.items : [{ ...EMPTY_ITEM }],
  );
  const [taxCondition, setTaxCondition] = useState(initial.taxCondition);
  const [taxConditionOther, setTaxConditionOther] = useState(
    initial.taxConditionOther,
  );
  const [pensionFund, setPensionFund] = useState(initial.pensionFund);
  const [pensionFundLicense, setPensionFundLicense] = useState(
    initial.pensionFundLicense,
  );
  const [socialSecurity, setSocialSecurity] = useState(initial.socialSecurity);
  const [employerAccountNo, setEmployerAccountNo] = useState(
    initial.employerAccountNo,
  );
  const [note, setNote] = useState(initial.note);
  const [stampEnabled, setStampEnabled] = useState(initial.stampEnabled);
  const [customDocNo, setCustomDocNo] = useState("");

  const totals = useMemo(() => {
    const paid = items.reduce((a, it) => a + (Number(it.amount) || 0), 0);
    const tax = items.reduce((a, it) => a + (Number(it.tax) || 0), 0);
    return { paid, tax };
  }, [items]);

  function updateItem(i: number, key: keyof WhtItem, value: string | number) {
    setItems((prev) =>
      prev.map((it, idx) => (idx === i ? { ...it, [key]: value } : it)),
    );
  }
  function addItem() {
    setItems((prev) => [...prev, { ...EMPTY_ITEM }]);
  }
  function removeItem(i: number) {
    setItems((prev) =>
      prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev,
    );
  }

  function fillCompany(side: "payer" | "payee") {
    if (side === "payer") {
      setPayerName(company.name);
      setPayerTaxId(company.taxId);
      setPayerAddress(company.address);
    } else {
      setPayeeName(company.name);
      setPayeeTaxId(company.taxId);
      setPayeeAddress(company.address);
    }
  }

  function swapParties() {
    setPayerName(payeeName);
    setPayerTaxId(payeeTaxId);
    setPayerAddress(payeeAddress);
    setPayeeName(payerName);
    setPayeeTaxId(payerTaxId);
    setPayeeAddress(payerAddress);
  }

  function buildFormData(): FormData {
    const fd = new FormData();
    fd.set("issueDate", issueDate);
    fd.set("volumeNo", volumeNo);
    fd.set("sequenceInForm", sequenceInForm);
    fd.set("formType", formType);
    fd.set("payerName", payerName);
    fd.set("payerTaxId", payerTaxId);
    fd.set("payerAddress", payerAddress);
    fd.set("payeeName", payeeName);
    fd.set("payeeTaxId", payeeTaxId);
    fd.set("payeeAddress", payeeAddress);
    fd.set("taxCondition", taxCondition);
    fd.set("taxConditionOther", taxConditionOther);
    fd.set("pensionFund", pensionFund);
    fd.set("pensionFundLicense", pensionFundLicense);
    fd.set("socialSecurity", socialSecurity);
    fd.set("employerAccountNo", employerAccountNo);
    fd.set("note", note);
    fd.set("stampEnabled", stampEnabled ? "1" : "0");
    if (customDocNo.trim()) fd.set("customDocNo", customDocNo.trim());
    const validItems = items
      .filter((it) => Number(it.amount) > 0 || Number(it.tax) > 0)
      .map((it) => ({
        category: it.category,
        description: it.description,
        datePaid: it.datePaid,
        amount: Number(it.amount) || 0,
        tax: Number(it.tax) || 0,
      }));
    fd.set("items_json", JSON.stringify(validItems));
    return fd;
  }

  function onSubmit(thenPrint: boolean) {
    setError(null);
    const fd = buildFormData();
    startTransition(async () => {
      const res =
        mode === "new"
          ? await createWithholdingAction(fd)
          : await updateWithholdingAction(initial.id!, fd);
      if (res?.error) {
        setError(res.error);
        return;
      }
      const id = res.id ?? initial.id;
      if (thenPrint && id) {
        window.open(`/withholding/${id}/print`, "_blank");
      }
      router.push("/withholding");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ===== 1. ข้อมูลเอกสาร ===== */}
      <SectionCard icon={<FileText className="h-4 w-4" />} title="ข้อมูลเอกสาร">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Field label="เล่มที่">
            <Input
              value={volumeNo}
              onChange={(e) => setVolumeNo(e.target.value)}
              placeholder="-"
            />
          </Field>
          <Field
            label={
              mode === "new"
                ? "เลขที่ (เว้นว่าง = อัตโนมัติ)"
                : "เลขที่เอกสาร"
            }
          >
            <Input
              value={mode === "edit" ? initial.docNo ?? "" : customDocNo}
              onChange={(e) => setCustomDocNo(e.target.value)}
              placeholder="WTI-202605xxxxx"
              disabled={mode === "edit"}
            />
          </Field>
          <Field label="ลำดับที่ ในแบบ">
            <Input
              value={sequenceInForm}
              onChange={(e) => setSequenceInForm(e.target.value)}
              placeholder="-"
            />
          </Field>
          <Field label="วันที่ออกหนังสือ">
            <Input
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
            />
          </Field>
        </div>
        <Field label="แบบยื่นรายการภาษี (ภ.ง.ด.)">
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {WHT_FORM_TYPES.map((f) => (
              <label
                key={f.value}
                className="flex cursor-pointer items-center gap-1.5 text-sm"
              >
                <input
                  type="radio"
                  name="formType"
                  checked={formType === f.value}
                  onChange={() => setFormType(f.value)}
                />
                {f.label}
              </label>
            ))}
          </div>
        </Field>
      </SectionCard>

      {/* ===== 2. คู่สัญญา ===== */}
      <SectionCard
        icon={<Users className="h-4 w-4" />}
        title="คู่สัญญา"
        right={
          <button
            type="button"
            onClick={swapParties}
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-600 transition hover:bg-zinc-50"
          >
            <ArrowLeftRight className="h-3.5 w-3.5" />
            สลับ ผู้หัก ↔ ผู้ถูกหัก
          </button>
        }
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <PartyBlock
            title="ผู้มีหน้าที่หักภาษี ณ ที่จ่าย (ผู้จ่ายเงิน)"
            name={payerName}
            taxId={payerTaxId}
            address={payerAddress}
            onName={setPayerName}
            onTaxId={setPayerTaxId}
            onAddress={setPayerAddress}
            onFillCompany={() => fillCompany("payer")}
          />
          <PartyBlock
            title="ผู้ถูกหักภาษี ณ ที่จ่าย (ผู้รับเงิน)"
            name={payeeName}
            taxId={payeeTaxId}
            address={payeeAddress}
            onName={setPayeeName}
            onTaxId={setPayeeTaxId}
            onAddress={setPayeeAddress}
            onFillCompany={() => fillCompany("payee")}
          />
        </div>
      </SectionCard>

      {/* ===== 3. ประเภทเงินได้ ===== */}
      <SectionCard
        icon={<Coins className="h-4 w-4" />}
        title="ประเภทเงินได้พึงประเมินที่จ่าย"
        right={
          <Button type="button" size="sm" variant="outline" onClick={addItem}>
            <Plus className="h-3.5 w-3.5" />
            เพิ่มรายการ
          </Button>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-zinc-500">
              <tr>
                <th className="pb-2 pr-2">ประเภทเงินได้</th>
                <th className="pb-2 px-2 w-32">วันเดือนปีที่จ่าย</th>
                <th className="pb-2 px-2 w-32 text-right">จำนวนเงิน</th>
                <th className="pb-2 px-2 w-32 text-right">ภาษีที่หัก</th>
                <th className="pb-2 w-8" />
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i} className="border-t">
                  <td className="py-1.5 pr-2">
                    <Select
                      value={it.category}
                      onChange={(e) =>
                        updateItem(i, "category", e.target.value)
                      }
                      className="h-8 text-xs"
                    >
                      {WHT_CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </Select>
                    <Input
                      value={it.description}
                      onChange={(e) =>
                        updateItem(i, "description", e.target.value)
                      }
                      placeholder="รายละเอียดเพิ่มเติม"
                      className="mt-1 h-8 text-xs"
                    />
                  </td>
                  <td className="py-1.5 px-2 align-top">
                    <Input
                      type="date"
                      value={it.datePaid}
                      onChange={(e) =>
                        updateItem(i, "datePaid", e.target.value)
                      }
                      className="h-8 text-xs"
                    />
                  </td>
                  <td className="py-1.5 px-2 align-top">
                    <Input
                      type="number"
                      step="0.01"
                      value={it.amount || ""}
                      onChange={(e) => updateItem(i, "amount", e.target.value)}
                      className="h-8 text-right text-xs tabular-nums"
                    />
                  </td>
                  <td className="py-1.5 px-2 align-top">
                    <Input
                      type="number"
                      step="0.01"
                      value={it.tax || ""}
                      onChange={(e) => updateItem(i, "tax", e.target.value)}
                      className="h-8 text-right text-xs tabular-nums"
                    />
                  </td>
                  <td className="py-1.5 align-top">
                    <button
                      type="button"
                      onClick={() => removeItem(i)}
                      className="inline-flex h-8 w-7 items-center justify-center rounded text-red-500 hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 text-sm font-semibold">
              <tr>
                <td className="py-2 pr-2 text-right" colSpan={2}>
                  รวมเงินที่จ่าย และ ภาษีที่นำส่ง
                </td>
                <td className="py-2 px-2 text-right tabular-nums">
                  {formatMoney(totals.paid)}
                </td>
                <td className="py-2 px-2 text-right tabular-nums">
                  {formatMoney(totals.tax)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </SectionCard>

      {/* ===== 4. กองทุน ===== */}
      <SectionCard
        icon={<Coins className="h-4 w-4" />}
        title="กองทุน (ถ้ามี)"
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label="กองทุนสำรองเลี้ยงชีพ — ใบอนุญาตเลขที่">
            <Input
              value={pensionFundLicense}
              onChange={(e) => setPensionFundLicense(e.target.value)}
              placeholder="เลขที่ใบอนุญาต"
            />
          </Field>
          <Field label="กองทุนสำรองเลี้ยงชีพ — จำนวนเงิน (บาท)">
            <Input
              type="number"
              step="0.01"
              value={pensionFund}
              onChange={(e) => setPensionFund(e.target.value)}
              placeholder="0.00"
            />
          </Field>
          <Field label="กองทุนประกันสังคม — จำนวนเงิน (บาท)">
            <Input
              type="number"
              step="0.01"
              value={socialSecurity}
              onChange={(e) => setSocialSecurity(e.target.value)}
              placeholder="0.00"
            />
          </Field>
          <Field label="เลขที่บัญชีนายจ้าง">
            <Input
              value={employerAccountNo}
              onChange={(e) => setEmployerAccountNo(e.target.value)}
              placeholder="-"
            />
          </Field>
        </div>
      </SectionCard>

      {/* ===== 5. ผู้จ่ายเงิน / เงื่อนไข ===== */}
      <SectionCard
        icon={<Stamp className="h-4 w-4" />}
        title="ผู้จ่ายเงิน / เงื่อนไขการหักภาษี"
      >
        <Field label="ผู้จ่ายเงิน">
          <div className="flex flex-wrap gap-x-5 gap-y-1.5">
            {WHT_CONDITIONS.map((c) => (
              <label
                key={c.value}
                className="flex cursor-pointer items-center gap-1.5 text-sm"
              >
                <input
                  type="radio"
                  name="taxCondition"
                  checked={taxCondition === c.value}
                  onChange={() => setTaxCondition(c.value)}
                />
                {c.label}
              </label>
            ))}
          </div>
        </Field>
        {taxCondition === "other" && (
          <Field label="ระบุเงื่อนไขอื่น ๆ">
            <Input
              value={taxConditionOther}
              onChange={(e) => setTaxConditionOther(e.target.value)}
              placeholder="ระบุ"
            />
          </Field>
        )}
        <Field label="หมายเหตุเพิ่มเติม">
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="หมายเหตุ (ถ้ามี)"
          />
        </Field>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setStampEnabled(!stampEnabled)}
            title="ใช้ตราประทับจากหน้า ตั้งค่า (Settings)"
            className={
              "inline-flex items-center gap-1.5 rounded-md border px-4 py-2 text-sm font-bold transition active:translate-y-px " +
              (stampEnabled
                ? "border-lime-600 bg-lime-500 text-white shadow-sm hover:bg-lime-600"
                : "border-zinc-300 bg-zinc-100 text-zinc-500 hover:bg-zinc-200")
            }
          >
            {stampEnabled ? (
              <Check className="h-4 w-4" />
            ) : (
              <Stamp className="h-4 w-4" />
            )}
            {stampEnabled ? "ใช้ตราประทับ" : "ไม่ใช้ตราประทับ"}
          </button>
        </div>
      </SectionCard>

      {/* ===== Actions ===== */}
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/withholding")}
          disabled={pending}
        >
          <X className="h-4 w-4" />
          ยกเลิก
        </Button>
        <Button
          type="button"
          variant="save"
          onClick={() => onSubmit(false)}
          disabled={pending}
        >
          <Save className="h-4 w-4" />
          {pending ? "กำลังบันทึก..." : "บันทึก"}
        </Button>
        <Button
          type="button"
          variant="search"
          onClick={() => onSubmit(true)}
          disabled={pending}
        >
          <Printer className="h-4 w-4" />
          บันทึก + พิมพ์
        </Button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- */
function SectionCard({
  icon,
  title,
  right,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-bold text-zinc-800">
            <span className="text-blue-600">{icon}</span>
            {title}
          </h3>
          {right}
        </div>
        <div className="space-y-3">{children}</div>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-zinc-700">{label}</span>
      {children}
    </label>
  );
}

function PartyBlock({
  title,
  name,
  taxId,
  address,
  onName,
  onTaxId,
  onAddress,
  onFillCompany,
}: {
  title: string;
  name: string;
  taxId: string;
  address: string;
  onName: (v: string) => void;
  onTaxId: (v: string) => void;
  onAddress: (v: string) => void;
  onFillCompany: () => void;
}) {
  return (
    <div className="space-y-2.5 rounded-lg border border-zinc-200 bg-zinc-50/50 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-bold text-zinc-700">{title}</div>
        <button
          type="button"
          onClick={onFillCompany}
          title="เติมข้อมูลบริษัทเรา"
          className="inline-flex flex-shrink-0 items-center gap-1 rounded-md border border-blue-300 bg-blue-50 px-2 py-1 text-[11px] font-medium text-blue-700 transition hover:bg-blue-100"
        >
          <Building2 className="h-3.5 w-3.5" />
          ใช้ข้อมูลบริษัทเรา
        </button>
      </div>
      <Field label="ชื่อ">
        <Input value={name} onChange={(e) => onName(e.target.value)} />
      </Field>
      <Field label="เลขประจำตัวผู้เสียภาษี (13 หลัก)">
        <Input
          value={taxId}
          onChange={(e) => onTaxId(e.target.value)}
          maxLength={13}
          className="font-mono"
        />
      </Field>
      <Field label="ที่อยู่">
        <textarea
          value={address}
          onChange={(e) => onAddress(e.target.value)}
          rows={2}
          className="flex w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400"
        />
      </Field>
    </div>
  );
}
