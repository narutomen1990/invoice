"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Save, CheckCircle2, AlertCircle,
  Building2, Globe, FileText, Hash, X, PenTool, Upload, Trash2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { updateCompanyAction } from "./actions";

export type CompanyData = {
  code: string;
  // Thai
  nameTh: string;
  buildingTh: string;
  mooTh: string;
  soiTh: string;
  roadTh: string;
  subDistrictTh: string;
  districtTh: string;
  provinceTh: string;
  postcode: string;
  tel: string;
  fax: string;
  email: string;
  website: string;
  taxId: string;
  branchCode: string;
  vatRate: string;
  logoPath: string;
  // English
  nameEn: string;
  buildingEn: string;
  mooEn: string;
  soiEn: string;
  roadEn: string;
  subDistrictEn: string;
  districtEn: string;
  provinceEn: string;
  // Doc format
  paperSize: string;
  businessType: string;
  saleType: string;
  // Number format
  docNumberFormat: number;
  docNumberYearBe: string;
  docNumberMonth: string;
  invoicePrefix: string;
  quotationPrefix: string;
  billingPrefix: string;
  debitNotePrefix: string;
  lastInvoiceNo: number;
  lastQuotationNo: number;
  lastBillingNo: number;
  lastDebitNoteNo: number;
  defaultPaymentTermsDays: number;
  // Tab 5: signatures (signature image)
  sigAuthorizedEnabled: boolean;
  sigAuthorizedPath: string;
  sigReceiverEnabled: boolean;
  sigReceiverPath: string;
  sigPresenterEnabled: boolean;
  sigPresenterPath: string;
  sigBillingEnabled: boolean;
  sigBillingPath: string;
  // Tab 5: print name (text)
  sigAuthorizedNameEnabled: boolean;
  sigAuthorizedName: string;
  sigReceiverNameEnabled: boolean;
  sigReceiverName: string;
  sigPresenterNameEnabled: boolean;
  sigPresenterName: string;
  sigBillingNameEnabled: boolean;
  sigBillingName: string;
  // Tab 5: print date toggles
  sigReceiverDateEnabled: boolean;
  sigPresenterDateEnabled: boolean;
  // Tab 5: company stamp
  stampEnabled: boolean;
  stampPath: string;
};

const EMPTY: CompanyData = {
  code: "", nameTh: "", buildingTh: "", mooTh: "", soiTh: "", roadTh: "",
  subDistrictTh: "", districtTh: "", provinceTh: "", postcode: "", tel: "",
  fax: "", email: "", website: "", taxId: "", branchCode: "00000",
  vatRate: "7.00", logoPath: "",
  nameEn: "", buildingEn: "", mooEn: "", soiEn: "", roadEn: "",
  subDistrictEn: "", districtEn: "", provinceEn: "",
  paperSize: "A4", businessType: "goods_service", saleType: "cash",
  docNumberFormat: 3, docNumberYearBe: "", docNumberMonth: "",
  invoicePrefix: "IV", quotationPrefix: "QT", billingPrefix: "IN", debitNotePrefix: "DN",
  lastInvoiceNo: 0, lastQuotationNo: 0, lastBillingNo: 0, lastDebitNoteNo: 0,
  defaultPaymentTermsDays: 30,
  sigAuthorizedEnabled: false, sigAuthorizedPath: "",
  sigReceiverEnabled: false, sigReceiverPath: "",
  sigPresenterEnabled: false, sigPresenterPath: "",
  sigBillingEnabled: false, sigBillingPath: "",
  sigAuthorizedNameEnabled: false, sigAuthorizedName: "",
  sigReceiverNameEnabled: false, sigReceiverName: "",
  sigPresenterNameEnabled: false, sigPresenterName: "",
  sigBillingNameEnabled: false, sigBillingName: "",
  sigReceiverDateEnabled: false, sigPresenterDateEnabled: false,
  stampEnabled: false, stampPath: "",
};

export function SettingsForm({ initial }: { initial: CompanyData | null }) {
  const [d, setD] = useState<CompanyData>(initial ?? EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function set<K extends keyof CompanyData>(k: K, v: CompanyData[K]) {
    setD((p) => ({ ...p, [k]: v }));
    setSaved(false);
  }

  function onSubmit() {
    setError(null);
    setSaved(false);
    const fd = new FormData();
    Object.entries(d).forEach(([k, v]) => fd.set(k, String(v)));
    startTransition(async () => {
      const res = await updateCompanyAction(fd);
      if (res?.error) setError(res.error);
      else setSaved(true);
    });
  }

  return (
    <Card>
      <CardContent className="p-6">
        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
        {saved && (
          <div className="mb-4 flex items-start gap-2 rounded-md bg-green-50 p-3 text-sm text-green-700">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            บันทึกเรียบร้อย
          </div>
        )}

        <Tabs defaultValue="th">
          <TabsList>
            <TabsTrigger value="th">
              <Building2 className="mr-2 inline h-4 w-4" />
              ชื่อที่อยู่ภาษาไทย
            </TabsTrigger>
            <TabsTrigger value="en">
              <Globe className="mr-2 inline h-4 w-4" />
              ชื่อที่อยู่ภาษาอังกฤษ
            </TabsTrigger>
            <TabsTrigger value="doc">
              <FileText className="mr-2 inline h-4 w-4" />
              รูปแบบเอกสาร
            </TabsTrigger>
            <TabsTrigger value="num">
              <Hash className="mr-2 inline h-4 w-4" />
              รูปแบบเลข Invoice
            </TabsTrigger>
            <TabsTrigger value="sig">
              <PenTool className="mr-2 inline h-4 w-4" />
              ลายเซ็น
            </TabsTrigger>
          </TabsList>

          {/* ============= TAB 1 ============= */}
          <TabsContent value="th">
            <ThaiTab d={d} set={set} />
          </TabsContent>

          {/* ============= TAB 2 ============= */}
          <TabsContent value="en">
            <EnglishTab d={d} set={set} />
          </TabsContent>

          {/* ============= TAB 3 ============= */}
          <TabsContent value="doc">
            <DocFormatTab d={d} set={set} />
          </TabsContent>

          {/* ============= TAB 4 ============= */}
          <TabsContent value="num">
            <NumberFormatTab d={d} set={set} />
          </TabsContent>

          {/* ============= TAB 5 ============= */}
          <TabsContent value="sig">
            <SignatureTab d={d} set={set} />
          </TabsContent>
        </Tabs>

        <div className="mt-6 flex justify-end gap-2 border-t pt-4">
          <Button variant="outline" onClick={() => setD(initial ?? EMPTY)}>
            <X className="h-4 w-4" />
            รีเซ็ต
          </Button>
          <Button variant="save" onClick={onSubmit} disabled={pending}>
            <Save className="h-4 w-4" />
            {pending ? "กำลังบันทึก..." : "บันทึกทั้งหมด"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// TAB 1: Thai
// ============================================================
function ThaiTab({
  d, set,
}: {
  d: CompanyData;
  set: <K extends keyof CompanyData>(k: K, v: CompanyData[K]) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* left col: address */}
      <div className="space-y-3 lg:col-span-2">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label="รหัสกิจการ">
            <Input
              value={d.code}
              onChange={(e) => set("code", e.target.value)}
              maxLength={16}
              className="font-mono"
            />
          </Field>
          <Field label="ชื่อกิจการ (ไทย) *" colSpan>
            <Input value={d.nameTh} onChange={(e) => set("nameTh", e.target.value)} required />
          </Field>
          <Field label="เลขที่/อาคาร" colSpan>
            <Input value={d.buildingTh} onChange={(e) => set("buildingTh", e.target.value)} />
          </Field>
          <Field label="หมู่ที่">
            <Input value={d.mooTh} onChange={(e) => set("mooTh", e.target.value)} />
          </Field>
          <Field label="ตรอก/ซอย">
            <Input value={d.soiTh} onChange={(e) => set("soiTh", e.target.value)} />
          </Field>
          <Field label="ถนน">
            <Input value={d.roadTh} onChange={(e) => set("roadTh", e.target.value)} />
          </Field>
          <Field label="แขวง/ตำบล">
            <Input value={d.subDistrictTh} onChange={(e) => set("subDistrictTh", e.target.value)} />
          </Field>
          <Field label="เขต/อำเภอ">
            <Input value={d.districtTh} onChange={(e) => set("districtTh", e.target.value)} />
          </Field>
          <Field label="จังหวัด">
            <Input value={d.provinceTh} onChange={(e) => set("provinceTh", e.target.value)} />
          </Field>
          <Field label="รหัสไปรษณีย์">
            <Input value={d.postcode} onChange={(e) => set("postcode", e.target.value)} maxLength={10} />
          </Field>
          <Field label="โทรศัพท์ / FAX" colSpan>
            <Input value={d.tel} onChange={(e) => set("tel", e.target.value)} />
          </Field>
          <Field label="WebSite" colSpan>
            <Input value={d.website} onChange={(e) => set("website", e.target.value)} />
          </Field>
          <Field label="email Address" colSpan>
            <Input
              type="email"
              value={d.email}
              onChange={(e) => set("email", e.target.value)}
            />
          </Field>
        </div>
      </div>

      {/* right col: tax + logo */}
      <div className="space-y-4">
        <div className="rounded-md border bg-zinc-50 p-4 space-y-3">
          <div className="text-sm font-semibold text-zinc-700">ข้อมูลภาษี</div>
          <Field label="เลขประจำตัวนิติบุคคล 13 หลัก">
            <Input
              value={d.taxId}
              onChange={(e) => set("taxId", e.target.value)}
              maxLength={13}
              className="font-mono text-center tracking-wider"
            />
          </Field>
          <Field label="สาขาที่ออกใบกำกับภาษี">
            <Input
              value={d.branchCode}
              onChange={(e) => set("branchCode", e.target.value)}
              maxLength={5}
              className="font-mono text-center"
              placeholder="00000 = สำนักงานใหญ่"
            />
          </Field>
          <Field label="อัตราภาษีมูลค่าเพิ่ม ร้อยละ">
            <Input
              type="number"
              step="0.01"
              value={d.vatRate}
              onChange={(e) => set("vatRate", e.target.value)}
              className="text-right tabular-nums"
            />
          </Field>
        </div>

        <div className="rounded-md border p-4 space-y-3">
          <div className="text-sm font-semibold text-zinc-700">โลโก้บริษัท</div>
          <Field label="ตำแหน่งที่เก็บไฟล์รูป LOGO">
            <Input
              value={d.logoPath}
              onChange={(e) => set("logoPath", e.target.value)}
              placeholder="/path/to/logo.jpg"
              className="text-xs"
            />
          </Field>
          {d.logoPath && (
            <div className="flex justify-center rounded border bg-zinc-50 p-3">
              <img src={d.logoPath.startsWith("http") || d.logoPath.startsWith("/") ? d.logoPath : ""}
                alt="Logo preview" className="max-h-24 max-w-full object-contain"
                onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// TAB 2: English
// ============================================================
function EnglishTab({
  d, set,
}: {
  d: CompanyData;
  set: <K extends keyof CompanyData>(k: K, v: CompanyData[K]) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-3 lg:col-span-2">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label="ชื่อกิจการ (English)" colSpan>
            <Input value={d.nameEn} onChange={(e) => set("nameEn", e.target.value)} />
          </Field>
          <Field label="No. / Building" colSpan>
            <Input value={d.buildingEn} onChange={(e) => set("buildingEn", e.target.value)} />
          </Field>
          <Field label="Moo">
            <Input value={d.mooEn} onChange={(e) => set("mooEn", e.target.value)} />
          </Field>
          <Field label="Soi">
            <Input value={d.soiEn} onChange={(e) => set("soiEn", e.target.value)} />
          </Field>
          <Field label="Road">
            <Input value={d.roadEn} onChange={(e) => set("roadEn", e.target.value)} />
          </Field>
          <Field label="Sub-district">
            <Input value={d.subDistrictEn} onChange={(e) => set("subDistrictEn", e.target.value)} />
          </Field>
          <Field label="District">
            <Input value={d.districtEn} onChange={(e) => set("districtEn", e.target.value)} />
          </Field>
          <Field label="Province" colSpan>
            <Input value={d.provinceEn} onChange={(e) => set("provinceEn", e.target.value)} />
          </Field>
        </div>
      </div>
      <div className="rounded-md border bg-amber-50/50 p-4 text-sm text-zinc-600">
        <p className="font-semibold text-zinc-700">หมายเหตุ</p>
        <p className="mt-2 leading-relaxed">
          ให้ใส่ชื่อ-ที่อยู่เป็นภาษาอังกฤษ
          กรณีที่ไม่ต้องการใช้ที่อยู่ภาษาอังกฤษ ให้ปล่อยว่างไว้ทุกช่อง
        </p>
      </div>
    </div>
  );
}

// ============================================================
// TAB 3: Document format
// ============================================================
function DocFormatTab({
  d, set,
}: {
  d: CompanyData;
  set: <K extends keyof CompanyData>(k: K, v: CompanyData[K]) => void;
}) {
  const SALE_TYPES = [
    { v: "cash", label: "ขายสด", docs: ["ใบแจ้งหนี้", "ใบเสร็จรับเงิน/ใบกำกับภาษี", "ใบกำกับภาษี/ใบเสร็จรับเงิน/ใบส่งสินค้า"] },
    { v: "credit_1", label: "ขายเชื่อ แบบที่ 1", docs: ["ใบแจ้งหนี้", "ใบกำกับภาษี"] },
    { v: "credit_2", label: "ขายเชื่อ แบบที่ 2", docs: ["ใบแจ้งหนี้/ใบกำกับภาษี", "ใบเสร็จรับเงิน"] },
    { v: "credit_3", label: "ขายเชื่อ แบบที่ 3", docs: ["ใบแจ้งหนี้", "ใบกำกับภาษี", "ใบเสร็จรับเงิน"] },
    { v: "credit_4", label: "ขายเชื่อแบบที่ 4", docs: ["ใบส่งสินค้า/ใบกำกับภาษี", "ใบแจ้งหนี้", "ใบเสร็จรับเงิน"] },
    { v: "no_a4", label: "ไม่ใช้กระดาษ A4", docs: [] },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Field label="เลือกประเภทของกระดาษ">
          <div className="flex gap-4">
            <Radio
              checked={d.paperSize === "A4"}
              onChange={() => set("paperSize", "A4")}
              label="กระดาษ A4"
            />
            <Radio
              checked={d.paperSize === "A5"}
              onChange={() => set("paperSize", "A5")}
              label="กระดาษ A5"
            />
          </div>
        </Field>
        <Field label="เลือกข้อความที่ปรากฏด้านล่าง (ตามลักษณะธุรกิจ)">
          <div className="flex flex-col gap-2">
            <Radio
              checked={d.businessType === "goods_service"}
              onChange={() => set("businessType", "goods_service")}
              label="ขายสินค้าและงานบริการ"
            />
            <Radio
              checked={d.businessType === "service_only"}
              onChange={() => set("businessType", "service_only")}
              label="งานบริการอย่างเดียว"
            />
          </div>
        </Field>
      </div>

      <div>
        <div className="mb-3 text-sm font-semibold text-zinc-700">รูปแบบเอกสารที่จะออก</div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {SALE_TYPES.map((t) => {
            const active = d.saleType === t.v;
            return (
              <button
                key={t.v}
                type="button"
                onClick={() => set("saleType", t.v)}
                className={`flex flex-col rounded-md border p-3 text-left transition ${
                  active ? "border-blue-600 bg-blue-50 ring-2 ring-blue-200" : "hover:bg-zinc-50"
                }`}
              >
                <div className="mb-2 flex items-center gap-2">
                  <input type="radio" checked={active} readOnly />
                  <span className="text-xs font-medium">{t.label}</span>
                </div>
                <div className="space-y-1.5 text-[10px] leading-tight text-zinc-600">
                  {t.docs.length === 0 ? (
                    <div className="italic text-zinc-400">— ไม่มีเอกสาร —</div>
                  ) : (
                    t.docs.map((doc, i) => (
                      <div
                        key={i}
                        className="rounded border border-zinc-200 bg-white px-2 py-1 shadow-sm"
                      >
                        {doc}
                      </div>
                    ))
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// TAB 4: Number format
// ============================================================
function NumberFormatTab({
  d, set,
}: {
  d: CompanyData;
  set: <K extends keyof CompanyData>(k: K, v: CompanyData[K]) => void;
}) {
  const FORMATS = [
    { id: 1, sample: "00001", desc: "มีเฉพาะตัวเลข 5 หลัก" },
    { id: 2, sample: "IV-00001", desc: "มีตัวอักษรนำหน้า + ตัวเลข 5 หลัก" },
    { id: 3, sample: "IV53/09-00001", desc: "มีตัวอักษรนำหน้า + ปี พ.ศ. + เดือนที่ออก + ตัวเลข 5 หลัก" },
    { id: 4, sample: "530900001", desc: "มีปี พ.ศ. นำหน้า + เดือนที่ออก + ตัวเลข 5 หลัก" },
    { id: 5, sample: "IV530900001", desc: "มีตัวอักษรนำหน้า + ปี พ.ศ. + เดือนที่ออก + ตัวเลข 5 หลัก" },
    { id: 6, sample: "001/00001", desc: "เล่มที่ / เลขที่ ใบกำกับภาษี" },
    { id: 7, sample: "—", desc: "ต้องการออกเลขที่ใบกำกับภาษีด้วยตนเอง" },
  ];

  // Build sample
  const sample = useMemo(() => {
    const yy = d.docNumberYearBe || "69";
    const mm = (d.docNumberMonth || "05").padStart(2, "0");
    const num = String((d.lastInvoiceNo || 0) + 1).padStart(5, "0");
    const p = d.invoicePrefix || "IV";
    switch (d.docNumberFormat) {
      case 1: return num;
      case 2: return `${p}-${num}`;
      case 3: return `${p}${yy}/${mm}-${num}`;
      case 4: return `${yy}${mm}${num}`;
      case 5: return `${p}${yy}${mm}${num}`;
      case 6: return `001/${num}`;
      default: return "—";
    }
  }, [d.docNumberFormat, d.docNumberYearBe, d.docNumberMonth, d.lastInvoiceNo, d.invoicePrefix]);

  return (
    <div className="space-y-6">
      <div className="rounded-md bg-blue-50 px-4 py-3 text-sm">
        เลือกรูปแบบเลขที่ใบกำกับภาษี/ใบเสนอราคา/ใบวางบิล/ใบแจ้งหนี้
        <span className="ml-4 font-semibold text-blue-700">
          ตัวอย่างเลขที่: {sample}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Left: number format selection */}
        <div className="space-y-2">
          {FORMATS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => set("docNumberFormat", f.id)}
              className={`flex w-full items-start gap-3 rounded-md border p-3 text-left transition ${
                d.docNumberFormat === f.id ? "border-blue-600 bg-blue-50" : "hover:bg-zinc-50"
              }`}
            >
              <input type="radio" checked={d.docNumberFormat === f.id} readOnly className="mt-1" />
              <div className="flex-1">
                <div className="font-mono text-sm font-semibold">รูปแบบที่ {f.id} — {f.sample}</div>
                <div className="text-xs text-zinc-500">{f.desc}</div>
              </div>
            </button>
          ))}
        </div>

        {/* Right: counters */}
        <div className="space-y-4">
          <Section title="ข้อมูลปี/เดือนที่ใช้ออกเลขที่ใบกำกับภาษี/ใบเสนอราคา">
            <div className="grid grid-cols-2 gap-3">
              <Field label="ปี พ.ศ. ที่ใช้ออกเลข">
                <Input
                  value={d.docNumberYearBe}
                  onChange={(e) => set("docNumberYearBe", e.target.value)}
                  maxLength={2}
                  className="text-center font-mono"
                />
              </Field>
              <Field label="เดือน ที่ใช้ออกเลข">
                <Input
                  value={d.docNumberMonth}
                  onChange={(e) => set("docNumberMonth", e.target.value)}
                  maxLength={2}
                  className="text-center font-mono"
                />
              </Field>
            </div>
          </Section>

          <Section title="ข้อมูลใบกำกับภาษี" color="border-blue-200">
            <div className="grid grid-cols-3 gap-3">
              <Field label="prefix">
                <Input
                  value={d.invoicePrefix}
                  onChange={(e) => set("invoicePrefix", e.target.value)}
                  maxLength={10}
                  className="font-mono text-center"
                />
              </Field>
              <Field label="เลขที่ล่าสุด" colSpan>
                <Input
                  type="number"
                  value={d.lastInvoiceNo}
                  onChange={(e) => set("lastInvoiceNo", parseInt(e.target.value) || 0)}
                  className="text-right tabular-nums"
                />
              </Field>
            </div>
          </Section>

          <Section title="ข้อมูลใบเสนอราคา" color="border-emerald-200">
            <div className="grid grid-cols-3 gap-3">
              <Field label="prefix">
                <Input
                  value={d.quotationPrefix}
                  onChange={(e) => set("quotationPrefix", e.target.value)}
                  maxLength={10}
                  className="font-mono text-center"
                />
              </Field>
              <Field label="เลขที่ล่าสุด" colSpan>
                <Input
                  type="number"
                  value={d.lastQuotationNo}
                  onChange={(e) => set("lastQuotationNo", parseInt(e.target.value) || 0)}
                  className="text-right tabular-nums"
                />
              </Field>
            </div>
          </Section>

          <Section title="ข้อมูลใบแจ้งหนี้" color="border-rose-200">
            <div className="grid grid-cols-3 gap-3">
              <Field label="prefix">
                <Input
                  value={d.billingPrefix}
                  onChange={(e) => set("billingPrefix", e.target.value)}
                  maxLength={10}
                  className="font-mono text-center"
                />
              </Field>
              <Field label="เลขที่ล่าสุด" colSpan>
                <Input
                  type="number"
                  value={d.lastBillingNo}
                  onChange={(e) => set("lastBillingNo", parseInt(e.target.value) || 0)}
                  className="text-right tabular-nums"
                />
              </Field>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// helpers
// ============================================================
function Field({
  label, children, colSpan,
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

function Radio({
  checked, onChange, label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input type="radio" checked={checked} onChange={onChange} />
      {label}
    </label>
  );
}

function Section({
  title, color, children,
}: {
  title: string;
  color?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-md border ${color ?? "border-zinc-200"} p-3`}>
      <div className="mb-2 text-xs font-semibold text-zinc-700">{title}</div>
      {children}
    </div>
  );
}

// ============================================================
// TAB 5: Signatures
// ============================================================
type SignatureRole = "authorized" | "presenter" | "receiver" | "billing";

const SIG_LABELS: Record<
  SignatureRole,
  {
    nameLabel: string;
    sigLabel: string;
    nameEnabledKey: keyof CompanyData;
    nameKey: keyof CompanyData;
    sigEnabledKey: keyof CompanyData;
    sigPathKey: keyof CompanyData;
  }
> = {
  authorized: {
    nameLabel: "ผู้มีอำนาจลงนาม 1",
    sigLabel: "ใช้ลายเซ็นผู้มีอำนาจลงนาม",
    nameEnabledKey: "sigAuthorizedNameEnabled",
    nameKey: "sigAuthorizedName",
    sigEnabledKey: "sigAuthorizedEnabled",
    sigPathKey: "sigAuthorizedPath",
  },
  presenter: {
    nameLabel: "ผู้มีอำนาจลงนาม 2",
    sigLabel: "ใช้ลายเซ็นผู้มีอำนาจลงนาม 2",
    nameEnabledKey: "sigPresenterNameEnabled",
    nameKey: "sigPresenterName",
    sigEnabledKey: "sigPresenterEnabled",
    sigPathKey: "sigPresenterPath",
  },
  receiver: {
    nameLabel: "ผู้มีอำนาจลงนาม 3",
    sigLabel: "ใช้ลายเซ็นผู้มีอำนาจลงนาม 3",
    nameEnabledKey: "sigReceiverNameEnabled",
    nameKey: "sigReceiverName",
    sigEnabledKey: "sigReceiverEnabled",
    sigPathKey: "sigReceiverPath",
  },
  billing: {
    nameLabel: "ผู้มีอำนาจลงนาม 4",
    sigLabel: "ใช้ลายผู้มีอำนาจลงนาม 4",
    nameEnabledKey: "sigBillingNameEnabled",
    nameKey: "sigBillingName",
    sigEnabledKey: "sigBillingEnabled",
    sigPathKey: "sigBillingPath",
  },
};

function SignatureTab({
  d, set,
}: {
  d: CompanyData;
  set: <K extends keyof CompanyData>(k: K, v: CompanyData[K]) => void;
}) {
  const roles = Object.keys(SIG_LABELS) as SignatureRole[];
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {/* LEFT: name table + date toggles */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-zinc-700">รายชื่อผู้ลงนาม</div>
        <div className="overflow-hidden rounded-md border border-zinc-200 bg-white">
          {roles.map((role, i) => {
            const cfg = SIG_LABELS[role];
            return (
              <div
                key={role}
                className={`flex items-center gap-2 px-2 py-1.5 ${
                  i > 0 ? "border-t border-zinc-200" : ""
                }`}
              >
                <label className="flex shrink-0 items-center gap-1.5 text-[12px] text-zinc-700">
                  <input
                    type="checkbox"
                    checked={Boolean(d[cfg.nameEnabledKey])}
                    onChange={(e) =>
                      set(
                        cfg.nameEnabledKey,
                        e.target.checked as CompanyData[typeof cfg.nameEnabledKey],
                      )
                    }
                  />
                  <span className="w-[150px]">{cfg.nameLabel}</span>
                </label>
                <Input
                  value={String(d[cfg.nameKey] ?? "")}
                  onChange={(e) =>
                    set(
                      cfg.nameKey,
                      e.target.value as CompanyData[typeof cfg.nameKey],
                    )
                  }
                  className="h-7 flex-1 bg-yellow-50 text-[12px]"
                />
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-[12px]">
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={d.sigReceiverDateEnabled}
              onChange={(e) =>
                set("sigReceiverDateEnabled", e.target.checked)
              }
            />
            พิมพ์ลงวันที่รับเงิน
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={d.sigPresenterDateEnabled}
              onChange={(e) =>
                set("sigPresenterDateEnabled", e.target.checked)
              }
            />
            พิมพ์ลงวันที่เสนอราคา
          </label>
        </div>

        <StampSlot d={d} set={set} />
      </div>

      {/* RIGHT: signature 2x2 grid */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-zinc-700">รูปลายเซ็น</div>
        <div className="grid grid-cols-2 gap-2">
          {roles.map((role) => (
            <SignatureSlot key={role} role={role} d={d} set={set} />
          ))}
        </div>
        <p className="text-[10.5px] text-zinc-400">
          รองรับ JPG/PNG/WebP ขนาดไม่เกิน 2 MB
        </p>
      </div>
    </div>
  );
}

function SignatureSlot({
  role, d, set,
}: {
  role: SignatureRole;
  d: CompanyData;
  set: <K extends keyof CompanyData>(k: K, v: CompanyData[K]) => void;
}) {
  const cfg = SIG_LABELS[role];
  const enabledKey = cfg.sigEnabledKey;
  const pathKey = cfg.sigPathKey;
  const th = cfg.sigLabel;
  const enabled = Boolean(d[enabledKey]);
  const path = String(d[pathKey] ?? "");
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setErr(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/upload/signature?role=${role}`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data?.error ?? "อัปโหลดไม่สำเร็จ");
        return;
      }
      set(pathKey, data.path as CompanyData[typeof pathKey]);
    } catch (e: any) {
      setErr(e?.message ?? "อัปโหลดไม่สำเร็จ");
    } finally {
      setUploading(false);
    }
  }

  function clearPath() {
    set(pathKey, "" as CompanyData[typeof pathKey]);
  }

  return (
    <div className="rounded border border-zinc-200 bg-white p-2">
      <label className="mb-1 flex items-center gap-1.5 text-[11.5px] font-medium text-zinc-700">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) =>
            set(enabledKey, e.target.checked as CompanyData[typeof enabledKey])
          }
        />
        <span className="truncate">{th}</span>
      </label>

      <div className="flex h-14 items-center justify-center rounded border border-dashed border-zinc-200 bg-zinc-50">
        {path ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={path}
            alt={th}
            className="max-h-12 max-w-full object-contain"
          />
        ) : (
          <span className="text-[10px] italic text-zinc-400">— ยังไม่ได้อัปโหลด —</span>
        )}
      </div>

      <div className="mt-1.5 flex items-center gap-1">
        <label
          className={`flex flex-1 cursor-pointer items-center justify-center gap-1 rounded border border-zinc-300 bg-white px-1 py-0.5 text-[11px] hover:bg-zinc-50 ${
            uploading ? "pointer-events-none opacity-60" : ""
          }`}
        >
          <Upload className="h-3 w-3" />
          {uploading ? "กำลัง..." : "เลือกภาพ"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            onChange={handleFile}
            className="hidden"
          />
        </label>
        <button
          type="button"
          onClick={clearPath}
          disabled={!path}
          className="flex flex-1 items-center justify-center gap-1 rounded border border-rose-300 bg-white px-1 py-0.5 text-[11px] text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Trash2 className="h-3 w-3" />
          ลบภาพ
        </button>
      </div>

      {err && <div className="mt-1 text-[10px] text-rose-600">{err}</div>}
    </div>
  );
}

function StampSlot({
  d,
  set,
}: {
  d: CompanyData;
  set: <K extends keyof CompanyData>(k: K, v: CompanyData[K]) => void;
}) {
  const path = d.stampPath;
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setErr(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/upload/signature?role=stamp`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data?.error ?? "อัปโหลดไม่สำเร็จ");
        return;
      }
      set("stampPath", data.path);
    } catch (e: any) {
      setErr(e?.message ?? "อัปโหลดไม่สำเร็จ");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="rounded-md border border-zinc-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[12px] font-semibold text-zinc-700">
          ตราประทับบริษัท
        </span>
        <span className="text-[10.5px] text-zinc-400">
          แนะนำพื้นหลังโปร่งใส (PNG)
        </span>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex h-24 w-24 flex-shrink-0 items-center justify-center rounded border border-dashed border-zinc-300 bg-zinc-50">
          {path ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={path}
              alt="ตราประทับ"
              className="max-h-20 max-w-20 object-contain"
            />
          ) : (
            <span className="text-[10px] italic text-zinc-400">
              — ยังไม่ได้อัปโหลด —
            </span>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            className={`inline-flex w-32 cursor-pointer items-center justify-center gap-1 rounded border border-zinc-300 bg-white px-2 py-1 text-[12px] hover:bg-zinc-50 ${
              uploading ? "pointer-events-none opacity-60" : ""
            }`}
          >
            <Upload className="h-3.5 w-3.5" />
            {uploading ? "กำลัง..." : "เลือกภาพ"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              onChange={handleFile}
              className="hidden"
            />
          </label>
          <button
            type="button"
            onClick={() => set("stampPath", "")}
            disabled={!path}
            className="inline-flex w-32 items-center justify-center gap-1 rounded border border-rose-300 bg-white px-2 py-1 text-[12px] text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            ลบภาพ
          </button>
          {err && <div className="text-[10px] text-rose-600">{err}</div>}
        </div>
      </div>
    </div>
  );
}
