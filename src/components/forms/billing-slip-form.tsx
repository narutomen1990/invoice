"use client";

import { useState, useTransition, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Save, AlertCircle, X, Printer, FileText,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatMoney, bahtText } from "@/lib/thai/number";
import {
  createBillingSlipAction,
  updateBillingSlipAction,
} from "@/app/receipts/actions";
import { BillingFormPrintPickerDialog } from "@/components/forms/billing-form-print-picker";

type Customer = {
  id: number;
  code: string;
  name: string;
  taxId: string | null;
  defaultBranchCode: string | null;
  address1: string | null;
  address2: string | null;
  address3: string | null;
  province: string | null;
  tel: string | null;
};

type ItemRow = {
  productCode: string;
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  // billing-specific fields shown in legacy UI
  invoiceNo?: string;
  invoiceDate?: string;
  dueDate?: string;
  customerCode?: string;
};

export type BillingSlipFormInitial = {
  id?: number;
  docNo?: string;
  docDate: string;
  dueDate: string | null;
  paymentTermsDays: number;
  customerId: number | null;
  customerCode: string;
  customerName: string;
  customerTaxId: string | null;
  customerBranch: string | null;
  customerAddress: string | null;
  customerTel: string | null;
  customerProvince: string | null;
  customerEmail: string | null;
  contactName: string | null;
  contactTel: string | null;
  preparedBy: string | null;
  shippingMethod: string | null;
  referenceDocNo: string | null;
  discount: number;
  vatRate: number;
  withholdingTaxRate: number;
  paymentDate: string | null;
  receiptNo: string | null;
  paidAmount: number;
  paymentMethod: string | null;
  remark: string | null;
  memo: string | null;
  remark1: string | null;
  items: ItemRow[];
};

const EMPTY_ROW: ItemRow = {
  productCode: "",
  description: "",
  quantity: "1",
  unit: "",
  unitPrice: "0",
  invoiceNo: "",
  invoiceDate: "",
  dueDate: "",
  customerCode: "",
};

const MIN_ROWS = 11;

function fillRows(items: ItemRow[]): ItemRow[] {
  const copy = items.length > 0 ? [...items] : [];
  while (copy.length < MIN_ROWS) copy.push({ ...EMPTY_ROW });
  return copy;
}

function splitAddress(addr: string | null): [string, string, string] {
  if (!addr) return ["", "", ""];
  const parts = addr.split("\n");
  return [parts[0] ?? "", parts[1] ?? "", parts[2] ?? ""];
}

const PAY_METHODS = ["CASH", "Transfer", "Cheque", "Credit Card", "Not Yet"];

export function BillingSlipForm({
  mode,
  initial,
  customers,
  previewDocNo,
}: {
  mode: "new" | "edit";
  initial: BillingSlipFormInitial;
  customers: Customer[];
  previewDocNo?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [savedToast, setSavedToast] = useState<string | null>(null);
  const [printOpen, setPrintOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!savedToast) return;
    const t = setTimeout(() => setSavedToast(null), 1800);
    return () => clearTimeout(t);
  }, [savedToast]);

  const [docDate, setDocDate] = useState(initial.docDate);
  const [dueDate, setDueDate] = useState(initial.dueDate ?? "");
  const [terms, setTerms] = useState(initial.paymentTermsDays);
  const [docNo, setDocNo] = useState(initial.docNo ?? previewDocNo ?? "");

  const initAddr = splitAddress(initial.customerAddress);
  const [customerId, setCustomerId] = useState<number | null>(initial.customerId);
  const [customerCode, setCustomerCode] = useState(initial.customerCode ?? "");
  const [customerName, setCustomerName] = useState(initial.customerName);
  const [customerTaxId, setCustomerTaxId] = useState(initial.customerTaxId ?? "");
  const [customerBranch, setCustomerBranch] = useState(initial.customerBranch ?? "");
  const [addr1, setAddr1] = useState(initAddr[0]);
  const [addr2, setAddr2] = useState(initAddr[1]);
  const [addr3, setAddr3] = useState(initAddr[2]);
  const [customerTel, setCustomerTel] = useState(initial.customerTel ?? "");
  const [customerEmail, setCustomerEmail] = useState(initial.customerEmail ?? "");
  const [contactName, setContactName] = useState(initial.contactName ?? "");
  const [contactTel, setContactTel] = useState(initial.contactTel ?? "");
  const [preparedBy, setPreparedBy] = useState(initial.preparedBy ?? "");
  const [shippingMethod, setShippingMethod] = useState(initial.shippingMethod ?? "");
  const [referenceDocNo, setReferenceDocNo] = useState(initial.referenceDocNo ?? "");

  const [discount, setDiscount] = useState(String(initial.discount));
  const [vatRate, setVatRate] = useState(String(initial.vatRate));

  const [paymentDate, setPaymentDate] = useState(initial.paymentDate ?? "");
  const [receiptNo, setReceiptNo] = useState(initial.receiptNo ?? "");
  const [paidAmount, setPaidAmount] = useState(String(initial.paidAmount ?? 0));
  const [paymentMethod, setPaymentMethod] = useState(
    initial.paymentMethod ?? "Not Yet",
  );
  const [remark, setRemark] = useState(initial.remark ?? "");

  const [memo, setMemo] = useState(initial.memo ?? "");
  const [remark1, setRemark1] = useState(
    initial.remark1 ?? "สินค้าซื้อแล้วไม่รับเปลี่ยนหรือคืนในทุกกรณี",
  );

  const [items, setItems] = useState<ItemRow[]>(fillRows(initial.items));

  const totals = useMemo(() => {
    const subtotal = items.reduce((s, it) => {
      const q = parseFloat(it.quantity) || 0;
      const p = parseFloat(it.unitPrice) || 0;
      return s + q * p;
    }, 0);
    const dc = parseFloat(discount) || 0;
    const vr = parseFloat(vatRate) || 0;
    const before = +(subtotal - dc).toFixed(2);
    const vat = +((before * vr) / 100).toFixed(2);
    const total = +(before + vat).toFixed(2);
    const paid = parseFloat(paidAmount) || 0;
    const overdue = Math.max(0, total - paid);
    return { subtotal, before, vat, total, paid, overdue };
  }, [items, discount, vatRate, paidAmount]);

  function pickCustomer(c: Customer) {
    setCustomerId(c.id);
    setCustomerCode(c.code);
    setCustomerName(c.name);
    setCustomerTaxId(c.taxId ?? "");
    setCustomerBranch(c.defaultBranchCode ?? "");
    setAddr1(c.address1 ?? "");
    setAddr2(c.address2 ?? "");
    setAddr3(c.address3 ?? "");
    setCustomerTel(c.tel ?? "");
  }

  function lookupByCustomerCode(code: string) {
    const t = code.trim();
    if (!t) return;
    const c = customers.find(
      (x) => x.code.trim().toLowerCase() === t.toLowerCase(),
    );
    if (c) pickCustomer(c);
  }

  function updateItem(idx: number, key: keyof ItemRow, value: string) {
    setItems((prev) => prev.map((r, i) => (i === idx ? { ...r, [key]: value } : r)));
  }

  function buildFormData(): FormData {
    const fd = new FormData();
    fd.set("docDate", docDate);
    fd.set("dueDate", dueDate);
    fd.set("paymentTermsDays", String(terms));
    if (
      mode === "new" &&
      docNo.trim() &&
      docNo.trim() !== (previewDocNo ?? "").trim()
    ) {
      fd.set("customDocNo", docNo.trim());
    }
    if (customerId !== null) fd.set("customerId", String(customerId));
    fd.set("customerCode", customerCode);
    fd.set("customerName", customerName);
    fd.set("customerTaxId", customerTaxId);
    fd.set("customerBranch", customerBranch);
    fd.set("customerAddress", [addr1, addr2, addr3].filter(Boolean).join("\n"));
    fd.set("customerTel", customerTel);
    fd.set("customerEmail", customerEmail);
    fd.set("contactName", contactName);
    fd.set("contactTel", contactTel);
    fd.set("preparedBy", preparedBy);
    fd.set("shippingMethod", shippingMethod);
    fd.set("referenceDocNo", referenceDocNo);
    fd.set("discount", discount);
    fd.set("vatRate", vatRate);
    fd.set("paymentDate", paymentDate);
    fd.set("receiptNo", receiptNo);
    fd.set("paidAmount", paidAmount);
    fd.set("paymentMethod", paymentMethod);
    fd.set("remark", remark);
    fd.set("memo", memo);
    fd.set("remark1", remark1);

    const validItems = items
      .filter((it) => it.description.trim() || (it.invoiceNo ?? "").trim())
      .map((it) => {
        const q = parseFloat(it.quantity) || 0;
        const p = parseFloat(it.unitPrice) || 0;
        return {
          productCode: it.productCode || null,
          description: it.description || it.invoiceNo || "-",
          quantity: q,
          unit: it.unit || null,
          unitPrice: p,
          amount: +(q * p).toFixed(2),
        };
      });
    fd.set("items_json", JSON.stringify(validItems));
    return fd;
  }

  function onSubmit() {
    setError(null);
    const fd = buildFormData();
    startTransition(async () => {
      const res =
        mode === "new"
          ? await createBillingSlipAction(fd)
          : await updateBillingSlipAction(initial.id!, fd);
      if (res?.error) {
        setError(res.error);
        return;
      }
      setSavedToast("บันทึกเรียบร้อยแล้ว");
      setTimeout(() => router.push("/receipts"), 600);
    });
  }

  return (
    <>
      {savedToast && (
        <div className="fixed left-1/2 top-6 z-[60] -translate-x-1/2 rounded-lg border border-green-300 bg-green-50 px-5 py-3 shadow-lg">
          <div className="flex items-center gap-2 text-sm font-semibold text-green-800">
            ✓ {savedToast}
          </div>
        </div>
      )}

      <div className="flex gap-2 text-[12px]">
        {/* MAIN FORM */}
        <div className="flex flex-1 flex-col rounded border border-sky-300 bg-white">
          {/* Title */}
          <div className="flex items-end justify-between border-b border-sky-300 bg-white px-3 py-1.5">
            <div>
              <h1 className="text-lg font-bold text-blue-900">
                ใบวางบิล / ใบเสร็จรับเงิน{" "}
                <span className="italic">(Billing Slip)</span>
              </h1>
              <p className="text-[11px] text-zinc-500">
                ราคายังไม่รวมภาษีมูลค่าเพิ่ม ( VAT Exclude )
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[12px] text-zinc-700">อัตราภาษีร้อยละ</span>
              <Input
                type="number"
                value={vatRate}
                onChange={(e) => setVatRate(e.target.value)}
                className="h-7 w-12 text-center font-bold text-red-600 tabular-nums"
              />
              <div className="rounded border border-sky-400 bg-sky-100 px-3 py-1 text-right">
                <div className="text-[10px] text-sky-800">เลขที่เอกสาร</div>
                <div className="font-mono text-base font-bold text-rose-700">
                  {docNo || "—"}
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 border-b border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {error}
            </div>
          )}

          {/* Header (sky-blue panel) */}
          <div className="border-b border-sky-300 bg-sky-100/70 px-3 py-2">
            <div className="grid grid-cols-12 items-end gap-2">
              <div className="col-span-3">
                <Lbl>เลขผู้เสียภาษีผู้ซื้อ</Lbl>
                <Input
                  value={customerTaxId}
                  onChange={(e) => setCustomerTaxId(e.target.value)}
                  maxLength={13}
                  className="h-7 bg-white font-mono"
                />
              </div>
              <div className="col-span-2">
                <Lbl>สาขาผู้ซื้อ</Lbl>
                <Input
                  value={customerBranch}
                  onChange={(e) => setCustomerBranch(e.target.value)}
                  maxLength={5}
                  className="h-7 bg-white text-center font-mono"
                  placeholder="00000"
                />
              </div>
              <div className="col-span-2">
                <Lbl>วันที่ใบวางบิล</Lbl>
                <Input
                  value={docDate}
                  onChange={(e) => setDocDate(e.target.value)}
                  className="h-7 bg-white text-center"
                  placeholder="YYYY-MM-DD"
                />
              </div>
              <div className="col-span-1">
                <Lbl>TERM</Lbl>
                <Input
                  type="number"
                  value={terms}
                  onChange={(e) => setTerms(parseInt(e.target.value) || 0)}
                  className="h-7 bg-white text-center font-semibold tabular-nums"
                />
              </div>
              <div className="col-span-2">
                <Lbl>วันที่ครบกำหนด</Lbl>
                <Input
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="h-7 bg-white text-center"
                  placeholder="YYYY-MM-DD"
                />
              </div>
              <div className="col-span-2">
                <Lbl>เลขที่ใบวางบิล</Lbl>
                <Input
                  value={docNo}
                  onChange={(e) => setDocNo(e.target.value)}
                  disabled={mode === "edit"}
                  className="h-7 bg-yellow-50 text-center font-mono font-semibold"
                  placeholder="BS61/11-00001"
                />
              </div>
            </div>

            <div className="mt-1.5 grid grid-cols-12 items-end gap-2">
              <div className="col-span-2">
                <Lbl>รหัสลูกค้า</Lbl>
                <Input
                  value={customerCode}
                  onChange={(e) => setCustomerCode(e.target.value)}
                  onBlur={(e) => lookupByCustomerCode(e.target.value)}
                  list="receipt-customer-codes"
                  className="h-7 bg-white font-mono"
                  placeholder="รหัส แล้ว Tab"
                />
                <datalist id="receipt-customer-codes">
                  {customers.map((c) => (
                    <option key={c.id} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </datalist>
              </div>
              <div className="col-span-6">
                <Lbl>รายชื่อลูกค้า</Lbl>
                <Input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="h-7 bg-yellow-50 font-medium"
                  required
                />
              </div>
              <div className="col-span-2">
                <Lbl>อ้างถึงเอกสาร</Lbl>
                <Input
                  value={referenceDocNo}
                  onChange={(e) => setReferenceDocNo(e.target.value)}
                  className="h-7 bg-white"
                />
              </div>
              <div className="col-span-2">
                <Lbl>พนักงานขาย</Lbl>
                <Input
                  value={preparedBy}
                  onChange={(e) => setPreparedBy(e.target.value)}
                  className="h-7 bg-white"
                />
              </div>
            </div>

            <div className="mt-1.5 grid grid-cols-12 items-end gap-2">
              <div className="col-span-6">
                <Lbl>ที่อยู่ 1</Lbl>
                <Input
                  value={addr1}
                  onChange={(e) => setAddr1(e.target.value)}
                  className="h-7 bg-white"
                />
              </div>
              <div className="col-span-2">
                <Lbl>โทรศัพท์ พนง.ขาย</Lbl>
                <Input
                  value={customerTel}
                  onChange={(e) => setCustomerTel(e.target.value)}
                  className="h-7 bg-white"
                />
              </div>
              <div className="col-span-4">
                <Lbl>email พนง.ขาย</Lbl>
                <Input
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  className="h-7 bg-white"
                />
              </div>
            </div>

            <div className="mt-1.5 grid grid-cols-12 items-end gap-2">
              <div className="col-span-6">
                <Lbl>ที่อยู่ 2</Lbl>
                <Input
                  value={addr2}
                  onChange={(e) => setAddr2(e.target.value)}
                  className="h-7 bg-white"
                />
              </div>
              <div className="col-span-2">
                <Lbl>ขนส่งโดย</Lbl>
                <Input
                  value={shippingMethod}
                  onChange={(e) => setShippingMethod(e.target.value)}
                  className="h-7 bg-white"
                />
              </div>
            </div>

            <div className="mt-1.5 grid grid-cols-12 items-end gap-2">
              <div className="col-span-6">
                <Lbl>ที่อยู่ 3</Lbl>
                <Input
                  value={addr3}
                  onChange={(e) => setAddr3(e.target.value)}
                  className="h-7 bg-white"
                />
              </div>
              <div className="col-span-3">
                <Lbl>ชื่อผู้ติดต่อ</Lbl>
                <Input
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="h-7 bg-white"
                  placeholder="คุณสมหวัง พลอยยินดี"
                />
              </div>
              <div className="col-span-3">
                <Lbl>โทรศัพท์</Lbl>
                <Input
                  value={contactTel}
                  onChange={(e) => setContactTel(e.target.value)}
                  className="h-7 bg-white"
                />
              </div>
            </div>
          </div>

          {/* Items table — INVOICE list */}
          <div
            className="overflow-auto"
            style={{ maxHeight: "calc(100vh - 32rem)" }}
          >
            <table className="w-full border-collapse text-[12px]">
              <thead className="sticky top-0 z-10 bg-sky-200 text-sky-900">
                <tr>
                  <th className="w-[42px] border border-sky-300 px-1 py-1">No.</th>
                  <th className="w-[110px] border border-sky-300 px-1 py-1">INVOICE</th>
                  <th className="w-[80px] border border-sky-300 px-1 py-1">DATE</th>
                  <th className="w-[80px] border border-sky-300 px-1 py-1">DUE</th>
                  <th className="w-[80px] border border-sky-300 px-1 py-1">รหัสลูกค้า</th>
                  <th className="w-[90px] border border-sky-300 px-1 py-1">AMOUNT</th>
                  <th className="w-[70px] border border-sky-300 px-1 py-1">VAT</th>
                  <th className="w-[90px] border border-sky-300 px-1 py-1">มูลค่ารวม</th>
                  <th className="w-[90px] border border-sky-300 px-1 py-1">ค้างชำระ</th>
                  <th className="w-[90px] border border-sky-300 px-1 py-1">ยอดชำระ</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row, i) => {
                  const q = parseFloat(row.quantity) || 0;
                  const p = parseFloat(row.unitPrice) || 0;
                  const amt = q * p;
                  const vat = +((amt * (parseFloat(vatRate) || 0)) / 100).toFixed(2);
                  return (
                    <tr key={i} className="hover:bg-sky-50">
                      <td className="border border-sky-200 px-1 text-center text-zinc-600">
                        {i + 1}
                      </td>
                      <td className="border border-sky-200 p-0">
                        <Input
                          value={row.invoiceNo ?? ""}
                          onChange={(e) => updateItem(i, "invoiceNo", e.target.value)}
                          className="h-7 w-full border-0 bg-transparent text-[11px] font-mono focus:ring-0"
                        />
                      </td>
                      <td className="border border-sky-200 p-0">
                        <Input
                          value={row.invoiceDate ?? ""}
                          onChange={(e) => updateItem(i, "invoiceDate", e.target.value)}
                          className="h-7 w-full border-0 bg-transparent text-center text-[11px] focus:ring-0"
                          placeholder="DD/MM/YY"
                        />
                      </td>
                      <td className="border border-sky-200 p-0">
                        <Input
                          value={row.dueDate ?? ""}
                          onChange={(e) => updateItem(i, "dueDate", e.target.value)}
                          className="h-7 w-full border-0 bg-transparent text-center text-[11px] focus:ring-0"
                          placeholder="DD/MM/YY"
                        />
                      </td>
                      <td className="border border-sky-200 p-0">
                        <Input
                          value={row.customerCode ?? ""}
                          onChange={(e) => updateItem(i, "customerCode", e.target.value)}
                          className="h-7 w-full border-0 bg-transparent text-[11px] focus:ring-0"
                        />
                      </td>
                      <td className="border border-sky-200 p-0">
                        <Input
                          type="number"
                          step="0.01"
                          value={row.unitPrice}
                          onChange={(e) => updateItem(i, "unitPrice", e.target.value)}
                          className="h-7 w-full border-0 bg-transparent text-right text-[12px] tabular-nums focus:ring-0"
                        />
                      </td>
                      <td className="border border-sky-200 px-1 text-right text-[11px] tabular-nums text-zinc-700">
                        {amt > 0 ? formatMoney(vat) : ""}
                      </td>
                      <td className="border border-sky-200 px-1 text-right text-[12px] font-semibold tabular-nums">
                        {amt > 0 ? formatMoney(amt + vat) : ""}
                      </td>
                      <td className="border border-sky-200 px-1 text-right text-[12px] tabular-nums text-rose-700">
                        {amt > 0 ? formatMoney(amt + vat) : ""}
                      </td>
                      <td className="border border-sky-200 p-0">
                        <Input
                          type="number"
                          step="0.01"
                          value={row.quantity}
                          onChange={(e) => updateItem(i, "quantity", e.target.value)}
                          className="h-7 w-full border-0 bg-transparent text-right text-[12px] tabular-nums focus:ring-0"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* FOOTER */}
          <div className="border-t border-sky-300 bg-sky-100/70 px-3 py-1.5">
            <div className="grid grid-cols-12 items-start gap-3">
              <div className="col-span-7 space-y-1.5">
                <div className="rounded border border-sky-300 bg-white px-2 py-1.5">
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col text-[11px] leading-tight">
                      <span className="font-bold">ตัวอักษร(บาท)</span>
                      <span className="italic text-zinc-500">ALPHA (BAHT)</span>
                    </div>
                    <div className="font-bold text-zinc-800">
                      ({bahtText(totals.total)})
                    </div>
                  </div>
                </div>
                <div className="rounded border border-amber-300 bg-amber-50 px-2 py-1.5">
                  <div className="text-[11px] font-bold text-amber-800">
                    หมายเหตุใบวางบิล . . .
                  </div>
                  <textarea
                    value={remark1}
                    onChange={(e) => setRemark1(e.target.value)}
                    rows={2}
                    className="mt-1 w-full rounded border border-amber-200 bg-white px-2 py-1 text-[12px] focus:outline-none focus:ring-1 focus:ring-amber-400"
                  />
                </div>
                <div>
                  <Lbl>
                    หมายเหตุ2{" "}
                    <span className="text-zinc-400">
                      (หมายเหตุข้อมูลภายใน ไม่พิมพ์ลงเอกสาร)
                    </span>
                  </Lbl>
                  <textarea
                    value={memo}
                    onChange={(e) => setMemo(e.target.value)}
                    rows={2}
                    className="w-full rounded border border-zinc-300 bg-white px-2 py-1 text-[12px] focus:outline-none focus:ring-1 focus:ring-zinc-400"
                  />
                </div>
              </div>

              <div className="col-span-3 space-y-1">
                <SumLine label="รวมจำนวนเงิน / Amount" value={formatMoney(totals.before)} />
                <SumLine
                  label={`ภาษีมูลค่าเพิ่ม / VAT ${vatRate}%`}
                  value={formatMoney(totals.vat)}
                />
                <SumLine label="รวมทั้งสิ้น Total" value={formatMoney(totals.total)} bold />
              </div>

              <div className="col-span-2 space-y-1">
                <SumLine
                  label="รวมค้างชำระ OVERDUE"
                  value={formatMoney(totals.overdue)}
                  className="text-rose-700"
                  bold
                />
                <SumLine
                  label="รวมยอดชำระ PAYMENT"
                  value={formatMoney(totals.paid)}
                  className="text-blue-700"
                  bold
                />
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: payment panel + action buttons */}
        <div className="flex w-72 shrink-0 flex-col gap-2">
          {/* Payment panel */}
          <div className="rounded border border-sky-400 bg-sky-100 p-2 text-[12px]">
            <div className="grid grid-cols-[1fr_auto] items-end gap-x-2 gap-y-1">
              <div>
                <Lbl>วันที่ใบเสร็จรับเงิน</Lbl>
                <Input
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="h-7 bg-white text-center"
                  placeholder="YYYY-MM-DD"
                />
              </div>
              <div className="text-zinc-500">📅</div>
              <div className="col-span-2">
                <Lbl>เลขที่ใบเสร็จรับเงิน</Lbl>
                <Input
                  value={receiptNo}
                  onChange={(e) => setReceiptNo(e.target.value)}
                  className="h-7 bg-white font-mono"
                />
              </div>
              <div>
                <Lbl>จำนวนเงินที่ชำระ</Lbl>
                <Input
                  type="number"
                  step="0.01"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                  className="h-7 bg-yellow-50 text-right tabular-nums"
                />
              </div>
              <button
                type="button"
                className="h-7 rounded bg-rose-600 px-3 text-xs font-bold text-white shadow hover:bg-rose-700"
              >
                PAY
              </button>
            </div>

            <div className="mt-2">
              <div className="text-[11px] font-bold text-blue-900">
                วิธีการชำระเงิน
              </div>
              <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[11px]">
                {PAY_METHODS.map((m) => (
                  <label key={m} className="flex cursor-pointer items-center gap-1.5">
                    <input
                      type="radio"
                      name="paymentMethod"
                      checked={paymentMethod === m}
                      onChange={() => setPaymentMethod(m)}
                    />
                    {m === "Not Yet" ? "Not Yet Payment Type" : m}
                  </label>
                ))}
              </div>
            </div>

            <div className="mt-2">
              <Lbl>REMARK</Lbl>
              <textarea
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                rows={2}
                className="w-full rounded border border-sky-300 bg-white px-2 py-1 text-[12px] focus:outline-none focus:ring-1 focus:ring-sky-400"
              />
            </div>
          </div>

          {/* Action buttons */}
          <button
            type="button"
            onClick={onSubmit}
            disabled={pending}
            title="บันทึกทับ"
            className="flex h-10 items-center justify-center gap-1.5 rounded-md border border-yellow-700 bg-gradient-to-b from-yellow-300 to-yellow-500 px-2 text-sm font-bold italic text-yellow-950 shadow-sm transition active:translate-y-px hover:from-yellow-400 hover:to-yellow-600 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            <span>Save บันทึกทับ</span>
          </button>

          <button
            type="button"
            disabled
            title="ฟีเจอร์เลือกใบกำกับภาษี (กำลังพัฒนา)"
            className="flex h-10 items-center justify-center gap-1.5 rounded-md border border-cyan-700 bg-gradient-to-b from-cyan-400 to-cyan-600 px-2 text-sm font-bold italic text-white shadow-sm disabled:opacity-60"
          >
            <FileText className="h-4 w-4" />
            <span>เลือกใบกำกับภาษี</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (mode === "new" || !initial.id) {
                setError("กรุณาบันทึกก่อนพิมพ์");
                return;
              }
              setPrintOpen(true);
            }}
            disabled={mode === "new"}
            title={
              mode === "new"
                ? "กรุณาบันทึกก่อนพิมพ์"
                : "เลือกแบบฟอร์มเพื่อพิมพ์"
            }
            className="flex h-10 items-center justify-center gap-1.5 rounded-md border border-zinc-700 bg-gradient-to-b from-zinc-500 to-zinc-700 px-2 text-sm font-bold italic text-white shadow-sm transition active:translate-y-px hover:from-zinc-600 hover:to-zinc-800 disabled:opacity-60"
          >
            <Printer className="h-4 w-4" />
            <span>พิมพ์กระดาษ A4</span>
          </button>

          <button
            type="button"
            onClick={() => router.back()}
            className="flex h-11 items-center justify-center gap-1.5 rounded-md border border-blue-800 bg-gradient-to-b from-blue-700 to-blue-900 px-2 text-base font-bold italic text-white shadow-sm transition active:translate-y-px hover:from-blue-800 hover:to-blue-950"
          >
            <X className="h-4 w-4" />
            <span>ESC ออก</span>
          </button>
        </div>
      </div>

      {printOpen && initial.id && (
        <BillingFormPrintPickerDialog
          docNo={initial.docNo ?? docNo}
          id={initial.id}
          onClose={() => setPrintOpen(false)}
        />
      )}
    </>
  );
}

function Lbl({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-0.5 block text-[10.5px] font-medium text-sky-900/80">
      {children}
    </label>
  );
}

function SumLine({
  label,
  value,
  bold,
  className = "",
}: {
  label: string;
  value: string;
  bold?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="flex-1 text-[11px] text-zinc-700">{label}</span>
      <span
        className={`tabular-nums rounded border border-sky-300 bg-white px-2 py-0.5 text-right ${
          bold ? "font-bold" : ""
        }`}
        style={{ minWidth: "5.5rem" }}
      >
        {value}
      </span>
    </div>
  );
}
