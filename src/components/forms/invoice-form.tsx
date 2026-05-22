"use client";

import { useState, useTransition, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Trash2, Save, AlertCircle, X, Printer, FileSpreadsheet,
} from "lucide-react";
import { Input, Select } from "@/components/ui/input";
import { formatMoney, bahtText } from "@/lib/thai/number";
import {
  createInvoiceAction,
  updateInvoiceAction,
  checkDocNoAvailableAction,
} from "@/app/invoices/actions";
import type { QuotationPickerDetail } from "@/app/quotations/actions";
import { QuotationPickerDialog } from "@/components/forms/quotation-picker-dialog";
import { InvoicePrintPickerDialog } from "@/components/forms/invoice-print-picker";

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

type Product = {
  id: number;
  code: string;
  name: string;
  unit: string | null;
  price: number;
};

type ItemRow = {
  lineNo: string;
  productCode: string;
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
};

export type InvoiceFormInitial = {
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
  salemanName: string | null;
  shippingMethod: string | null;
  referenceQuotationNo: string | null;
  discount: number;
  vatRate: number;
  withholdingTaxRate: number;
  memo: string | null;
  remark1: string | null;
  remark2: string | null;
  items: ItemRow[];
};

const EMPTY_ROW: ItemRow = {
  lineNo: "",
  productCode: "",
  description: "",
  quantity: "",
  unit: "",
  unitPrice: "0",
};

const MIN_ROWS = 14;

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

export function InvoiceForm({
  mode,
  initial,
  customers,
  products,
  previewDocNo,
}: {
  mode: "new" | "edit";
  initial: InvoiceFormInitial;
  customers: Customer[];
  products: Product[];
  previewDocNo?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [savedToast, setSavedToast] = useState<string | null>(null);
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
  const [docNoCheck, setDocNoCheck] = useState<{
    state: "idle" | "checking" | "ok" | "dup" | "invalid";
    msg?: string;
  }>({ state: "idle" });
  const docNoTouched = useRef(false);
  const initialDocNoRef = useRef(initial.docNo ?? previewDocNo ?? "");

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
  const [customerProvince, setCustomerProvince] = useState(initial.customerProvince ?? "");
  const [saleman, setSaleman] = useState(initial.salemanName ?? "");
  const [refQuo, setRefQuo] = useState(initial.referenceQuotationNo ?? "");

  const [discount, setDiscount] = useState(String(initial.discount));
  const [vatRate, setVatRate] = useState(String(initial.vatRate));
  const [whtToggle, setWhtToggle] = useState((initial.withholdingTaxRate ?? 0) > 0);
  const [whtRate, setWhtRate] = useState(String(initial.withholdingTaxRate || "3"));
  const [memo, setMemo] = useState(initial.memo ?? "");
  const [remark1, setRemark1] = useState(initial.remark1 ?? "");

  const [items, setItems] = useState<ItemRow[]>(fillRows(initial.items));

  const [quotationPickerOpen, setQuotationPickerOpen] = useState(false);
  const [printPicker, setPrintPicker] = useState<{
    id: number;
    docNo: string;
    internalSeq: string | null;
  } | null>(null);

  // signer toggles for printing (per-document override)
  const [signerAuth, setSignerAuth] = useState(false);
  const [signerPres, setSignerPres] = useState(false);
  const [signerRecv, setSignerRecv] = useState(false);
  const [signerBill, setSignerBill] = useState(false);
  const [stampEnabled, setStampEnabled] = useState(false);

  function applyQuotationToForm(q: QuotationPickerDetail) {
    setCustomerId(q.customerId);
    setCustomerCode(q.customerCode ?? "");
    setCustomerName(q.customerName ?? "");
    setCustomerTaxId(q.customerTaxId ?? "");
    setCustomerBranch(q.customerBranch ?? "");
    const [a1, a2, a3] = splitAddress(q.customerAddress);
    setAddr1(a1); setAddr2(a2); setAddr3(a3);
    setCustomerTel(q.customerTel ?? "");
    setCustomerProvince(q.customerProvince ?? "");
    setSaleman(q.salemanName ?? "");
    setRefQuo(q.docNo); // อ้างอิงใบเสนอราคา = doc_no ของ quotation
    setDiscount(String(q.discount));
    setVatRate(String(q.vatRate));
    if (q.withholdingTaxRate > 0) {
      setWhtToggle(true);
      setWhtRate(String(q.withholdingTaxRate));
    } else {
      setWhtToggle(false);
    }
    setMemo(q.memo ?? "");
    setRemark1(q.remark1 ?? "");
    const mapped: ItemRow[] = q.items.map((it, idx) => ({
      lineNo: String(idx + 1),
      productCode: it.productCode ?? "",
      description: it.description,
      quantity: String(it.quantity),
      unit: it.unit ?? "",
      unitPrice: String(it.unitPrice),
    }));
    setItems(fillRows(mapped));
    setSavedToast(`ดึงข้อมูลจาก ${q.docNo} แล้ว`);
  }

  // ---- totals ----
  const totals = useMemo(() => {
    const subtotal = items.reduce((s, it) => {
      const q = parseFloat(it.quantity) || 0;
      const p = parseFloat(it.unitPrice) || 0;
      return s + q * p;
    }, 0);
    const dc = parseFloat(discount) || 0;
    const vr = parseFloat(vatRate) || 0;
    const wr = whtToggle ? parseFloat(whtRate) || 0 : 0;
    const before = +(subtotal - dc).toFixed(2);
    const vat = +((before * vr) / 100).toFixed(2);
    const total = +(before + vat).toFixed(2);
    const wht = +((before * wr) / 100).toFixed(2);
    const net = +(total - wht).toFixed(2);
    return { subtotal, before, vat, total, wht, net };
  }, [items, discount, vatRate, whtRate, whtToggle]);

  // ---- live duplicate check (debounced) ----
  useEffect(() => {
    if (mode === "edit") return;
    if (!docNoTouched.current) return;
    if (!docNo.trim()) {
      setDocNoCheck({ state: "idle" });
      return;
    }
    if (docNo.trim() === initialDocNoRef.current.trim()) {
      setDocNoCheck({ state: "idle" });
      return;
    }
    setDocNoCheck({ state: "checking" });
    const t = setTimeout(async () => {
      const res = await checkDocNoAvailableAction(docNo);
      if (res.available) setDocNoCheck({ state: "ok" });
      else if (res.reason?.includes("รูปแบบ"))
        setDocNoCheck({ state: "invalid", msg: res.reason });
      else setDocNoCheck({ state: "dup", msg: res.reason });
    }, 400);
    return () => clearTimeout(t);
  }, [docNo, mode]);

  // ---- handlers ----
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
    setCustomerProvince(c.province ?? "");
  }

  function clearCustomer() {
    setCustomerId(null);
    setCustomerCode("");
    setCustomerName("");
    setCustomerTaxId("");
    setCustomerBranch("");
    setAddr1(""); setAddr2(""); setAddr3("");
    setCustomerTel("");
    setCustomerProvince("");
  }

  function lookupByCustomerCode(code: string) {
    const trimmed = code.trim();
    if (!trimmed) return;
    const c = customers.find(
      (x) => x.code.trim().toLowerCase() === trimmed.toLowerCase(),
    );
    if (c) pickCustomer(c);
  }

  function pickProduct(rowIdx: number, productId: number) {
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    setItems((prev) =>
      prev.map((r, i) =>
        i === rowIdx
          ? {
              ...r,
              productCode: p.code,
              description: p.name,
              unit: p.unit ?? "",
              unitPrice: String(p.price),
            }
          : r,
      ),
    );
  }

  function updateItem(idx: number, key: keyof ItemRow, value: string) {
    setItems((prev) => prev.map((r, i) => (i === idx ? { ...r, [key]: value } : r)));
  }

  function addRow() {
    setItems((prev) => [...prev, { ...EMPTY_ROW }]);
  }

  function removeRow(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function clearRow(idx: number) {
    setItems((prev) => prev.map((r, i) => (i === idx ? { ...EMPTY_ROW } : r)));
  }

  function buildFormData(): FormData {
    const fd = new FormData();
    fd.set("docDate", docDate);
    fd.set("dueDate", dueDate);
    fd.set("paymentTermsDays", String(terms));
    // custom doc_no: only send if user changed from preview
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
    fd.set("customerProvince", customerProvince);
    fd.set("salemanName", saleman);
    fd.set("referenceQuotationNo", refQuo);
    fd.set("discount", discount);
    fd.set("vatRate", vatRate);
    fd.set("withholdingTaxRate", whtToggle ? whtRate : "0");
    fd.set("memo", memo);
    fd.set("remark1", remark1);

    const validItems = items
      .filter((it) => it.description.trim())
      .map((it) => {
        const q = parseFloat(it.quantity) || 0;
        const p = parseFloat(it.unitPrice) || 0;
        // เว้นว่าง = ไม่มีเลขลำดับ (null) — จะไม่พิมพ์เลขในแถวนั้น
        const ln = it.lineNo.trim() ? parseInt(it.lineNo, 10) : NaN;
        return {
          lineNo: Number.isNaN(ln) ? null : ln,
          productCode: it.productCode || null,
          description: it.description,
          quantity: q,
          unit: it.unit || null,
          unitPrice: p,
          amount: +(q * p).toFixed(2),
        };
      });
    fd.set("items_json", JSON.stringify(validItems));
    return fd;
  }

  function onSubmit(thenAction: "back" | "addAnother" | "print") {
    setError(null);
    if (mode === "new" && (docNoCheck.state === "dup" || docNoCheck.state === "invalid")) {
      setError(`เลขที่เอกสาร: ${docNoCheck.msg}`);
      return;
    }
    const fd = buildFormData();
    // In edit mode, "addAnother" creates a NEW invoice (does not update existing)
    const useCreate = mode === "new" || thenAction === "addAnother";
    startTransition(async () => {
      const res = useCreate
        ? await createInvoiceAction(fd)
        : await updateInvoiceAction(initial.id!, fd);
      if (res?.error) {
        setError(res.error);
        return;
      }
      setSavedToast("บันทึกเรียบร้อยแล้ว");
      if (thenAction === "addAnother") {
        if (mode === "new") {
          setCustomerId(null);
          setCustomerCode("");
          setCustomerName("");
          setCustomerTaxId("");
          setCustomerBranch("");
          setAddr1(""); setAddr2(""); setAddr3("");
          setCustomerTel(""); setCustomerProvince("");
          setRefQuo("");
          setItems(fillRows([]));
          setMemo(""); setRemark1("");
          router.refresh();
        } else {
          if (res?.id)
            setTimeout(() => router.push(`/invoices/${res.id}/edit`), 600);
          else setTimeout(() => router.push("/invoices"), 600);
        }
        return;
      }
      const id = useCreate ? res?.id : initial.id;
      if (thenAction === "print" && id) {
        // open Windows-style picker (4 forms × normal/COPY) instead of going straight to print
        setPrintPicker({
          id,
          docNo: res?.docNo ?? docNo,
          internalSeq: null,
        });
        return;
      }
      setTimeout(() => router.push("/invoices"), 600);
    });
  }

  return (
    <>
    {savedToast && (
      <div className="fixed left-1/2 top-6 z-[60] -translate-x-1/2 rounded-lg border border-green-300 bg-green-50 px-5 py-3 shadow-lg">
        <div className="flex items-center gap-2 text-sm font-semibold text-green-800">
          <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          {savedToast}
        </div>
      </div>
    )}
    <div className="flex gap-2 text-[12px]">
      {/* MAIN FORM (left) */}
      <div className="flex flex-1 flex-col rounded border border-sky-300 bg-white">
        {/* TITLE BAR */}
        <div className="flex items-end justify-between border-b border-sky-300 bg-white px-3 py-1.5">
          <div>
            <h1 className="text-lg font-bold text-blue-900">
              ใบกำกับภาษีขาย / <span className="italic">TAX Invoice</span>
            </h1>
            <p className="text-[11px] text-zinc-500">
              ราคายังไม่รวมภาษีมูลค่าเพิ่ม ( VAT Exclude )
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-[12px]">
              <span className="text-zinc-700">อัตราภาษีร้อยละ</span>
              <Input
                type="number"
                value={vatRate}
                onChange={(e) => setVatRate(e.target.value)}
                className="h-7 w-12 text-center font-bold text-red-600 tabular-nums"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 border-b border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {error}
          </div>
        )}

        {/* HEADER (sky-blue panel) */}
        <div className="border-b border-sky-300 bg-sky-100/70 px-3 py-2">
          {/* row 1 */}
          <div className="grid grid-cols-12 items-end gap-2">
            <div className="col-span-2">
              <Lbl>รหัสลูกค้า</Lbl>
              <Input
                value={customerCode}
                onChange={(e) => setCustomerCode(e.target.value)}
                onBlur={(e) => lookupByCustomerCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    lookupByCustomerCode(customerCode);
                  }
                }}
                list="invoice-customer-codes"
                className="h-7 bg-white font-mono"
                placeholder="พิมพ์รหัส แล้ว Enter"
              />
              <datalist id="invoice-customer-codes">
                {customers.map((c) => (
                  <option key={c.id} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </datalist>
            </div>
            <div className="col-span-4">
              <Lbl>ชื่อลูกค้า /บริษัท </Lbl>
              <Input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="h-7 bg-yellow-50 font-medium"
                required
                placeholder="คุณสมหวัง พลอยยินดี"
              />
            </div>
            <div className="col-span-2">
              <Lbl>Invoice No.</Lbl>
              <Input
                value={docNo}
                onChange={(e) => {
                  docNoTouched.current = true;
                  setDocNo(e.target.value);
                }}
                disabled={mode === "edit"}
                className={`h-7 text-center font-mono font-semibold ${
                  docNoCheck.state === "dup" || docNoCheck.state === "invalid"
                    ? "border-red-400 bg-red-50"
                    : docNoCheck.state === "ok"
                      ? "border-green-400 bg-green-50"
                      : "bg-yellow-50"
                }`}
                placeholder="IV69/05-00001 (เว้นว่าง = auto)"
              />
              {mode === "new" && (
                <p
                  className={`mt-0.5 text-[10px] ${
                    docNoCheck.state === "dup" || docNoCheck.state === "invalid"
                      ? "text-red-600"
                      : docNoCheck.state === "ok"
                        ? "text-green-600"
                        : "text-zinc-500"
                  }`}
                >
                  {docNoCheck.state === "checking"
                    ? "กำลังตรวจสอบ..."
                    : docNoCheck.state === "ok"
                      ? "✓ ใช้ได้ (ข้ามเลขได้)"
                      : docNoCheck.state === "dup"
                        ? `✗ ${docNoCheck.msg}`
                        : docNoCheck.state === "invalid"
                          ? `✗ ${docNoCheck.msg}`
                          : "พิมพ์เองหรือเว้นว่างให้ระบบใส่อัตโนมัติ"}
                </p>
              )}
            </div>
            <div className="col-span-2">
              <Lbl>พนักงานขาย</Lbl>
              <Input
                value={saleman}
                onChange={(e) => setSaleman(e.target.value)}
                className="h-7 bg-white"
              />
            </div>
            <div className="col-span-2">
              <Lbl>โทรศัพท์ พนักงานขาย</Lbl>
              <Input
                value={customerTel}
                onChange={(e) => setCustomerTel(e.target.value)}
                className="h-7 bg-white"
              />
            </div>
          </div>

          {/* row 2 */}
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
              <Lbl>อ้างอิงใบเสนอราคา</Lbl>
              <Input
                value={refQuo}
                onChange={(e) => setRefQuo(e.target.value)}
                className="h-7 bg-white font-mono"
              />
            </div>
            <div className="col-span-2">
              <Lbl>เครดิตเทอม (วัน)</Lbl>
              <Input
                type="number"
                value={terms}
                onChange={(e) => setTerms(parseInt(e.target.value) || 0)}
                className="h-7 bg-white text-center font-semibold tabular-nums"
              />
            </div>
            <div className="col-span-2">
              <Lbl>วันที่ใบกำกับ</Lbl>
              <Input
                value={docDate}
                onChange={(e) => setDocDate(e.target.value)}
                className="h-7 bg-white text-center"
                placeholder="YYYY-MM-DD"
              />
            </div>
          </div>

          {/* row 3 */}
          <div className="mt-1.5 grid grid-cols-12 items-end gap-2">
            <div className="col-span-6">
              <Lbl>ที่อยู่ 2</Lbl>
              <Input
                value={addr2}
                onChange={(e) => setAddr2(e.target.value)}
                className="h-7 bg-white"
              />
            </div>
            <div className="col-span-3">
              <Lbl>เลขผู้เสียภาษีผู้ซื้อ</Lbl>
              <Input
                value={customerTaxId}
                onChange={(e) => setCustomerTaxId(e.target.value)}
                maxLength={13}
                className="h-7 bg-white font-mono"
              />
            </div>
            <div className="col-span-1">
              <Lbl>สาขา</Lbl>
              <Input
                value={customerBranch}
                onChange={(e) => setCustomerBranch(e.target.value)}
                maxLength={5}
                className="h-7 bg-white text-center font-mono"
                placeholder="00000"
              />
            </div>
            <div className="col-span-2">
              <Lbl>จังหวัด</Lbl>
              <Input
                value={customerProvince}
                onChange={(e) => setCustomerProvince(e.target.value)}
                className="h-7 bg-white"
              />
            </div>
          </div>

          {/* row 4 */}
          <div className="mt-1.5 grid grid-cols-12 items-end gap-2">
            <div className="col-span-6">
              <Lbl>ที่อยู่ 3</Lbl>
              <Input
                value={addr3}
                onChange={(e) => setAddr3(e.target.value)}
                className="h-7 bg-white"
              />
            </div>
            <div className="col-span-2">
              <Lbl>วันครบกำหนด</Lbl>
              <Input
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="h-7 bg-white text-center"
                placeholder="YYYY-MM-DD"
              />
            </div>
          </div>
        </div>

        {/* ITEMS TABLE */}
        <div className="overflow-auto" style={{ maxHeight: "calc(100vh - 28rem)" }}>
          <table className="w-full border-collapse text-[12px]">
            <thead className="sticky top-0 z-10 bg-sky-200 text-sky-900">
              <tr>
                <th className="w-[88px] border border-sky-300 px-1.5 py-1 text-center font-semibold">
                  รหัส<div className="text-[9px] font-normal italic text-sky-700">Code</div>
                </th>
                <th className="w-[42px] border border-sky-300 px-1 py-1 text-center font-semibold">
                  ลำดับ<div className="text-[9px] font-normal italic text-sky-700">No.</div>
                </th>
                <th className="border border-sky-300 px-1.5 py-1 text-center font-semibold">
                  รายการ<div className="text-[9px] font-normal italic text-sky-700">Description</div>
                </th>
                <th className="w-[80px] border border-sky-300 px-1 py-1 text-center font-semibold">
                  จำนวน<div className="text-[9px] font-normal italic text-sky-700">Quantity</div>
                </th>
                <th className="w-[60px] border border-sky-300 px-1 py-1 text-center font-semibold">
                  หน่วย<div className="text-[9px] font-normal italic text-sky-700">Unit</div>
                </th>
                <th className="w-[90px] border border-sky-300 px-1 py-1 text-center font-semibold">
                  ราคาต่อหน่วย<div className="text-[9px] font-normal italic text-sky-700">UnitPrice</div>
                </th>
                <th className="w-[100px] border border-sky-300 px-1 py-1 text-center font-semibold">
                  จำนวนเงิน<div className="text-[9px] font-normal italic text-sky-700">Amount</div>
                </th>
                <th className="w-[36px] border border-sky-300 bg-sky-200 px-0.5 py-1"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((row, i) => {
                const q = parseFloat(row.quantity) || 0;
                const p = parseFloat(row.unitPrice) || 0;
                const amt = q * p;
                return (
                  <tr key={i} className="hover:bg-sky-50">
                    <td className="border border-sky-200 p-0">
                      <Select
                        value=""
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v) pickProduct(i, parseInt(v, 10));
                        }}
                        className="h-7 w-full border-0 bg-transparent text-[11px] focus:ring-0"
                      >
                        <option value="">{row.productCode || "—"}</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            [{p.code}] {p.name}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="border border-sky-200 p-0">
                      <Input
                        value={row.lineNo}
                        onChange={(e) => updateItem(i, "lineNo", e.target.value)}
                        placeholder={String(i + 1)}
                        className="h-7 w-full border-0 bg-transparent text-center text-[11px] tabular-nums focus:ring-0"
                      />
                    </td>
                    <td className="border border-sky-200 p-0">
                      <Input
                        value={row.description}
                        onChange={(e) => updateItem(i, "description", e.target.value)}
                        className="h-7 w-full border-0 bg-transparent text-[12px] focus:ring-0"
                      />
                    </td>
                    <td className="border border-sky-200 p-0">
                      <Input
                        type="number"
                        step="0.001"
                        value={row.quantity}
                        onChange={(e) => updateItem(i, "quantity", e.target.value)}
                        className="h-7 w-full border-0 bg-transparent text-right text-[12px] tabular-nums focus:ring-0"
                      />
                    </td>
                    <td className="border border-sky-200 p-0">
                      <Input
                        value={row.unit}
                        onChange={(e) => updateItem(i, "unit", e.target.value)}
                        className="h-7 w-full border-0 bg-transparent text-center text-[11px] focus:ring-0"
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
                    <td className="border border-sky-200 px-1.5 text-right text-[12px] font-semibold tabular-nums">
                      {formatMoney(amt)}
                    </td>
                    <td className="border border-sky-200 p-0 text-center">
                      <button
                        type="button"
                        onClick={() => removeRow(i)}
                        className="h-7 w-full text-[10px] text-rose-600 hover:bg-rose-50"
                        title="ลบแถว"
                      >
                        ลบ
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* FOOTER */}
        <div className="border-t border-sky-300 bg-sky-100/70 px-3 py-1.5">
          <div className="grid grid-cols-12 items-center gap-2">
            <div className="col-span-7">
              <Lbl>ตัวอักษร <span className="text-zinc-400">บาท / Baht</span></Lbl>
              <div className="h-7 truncate rounded border border-sky-300 bg-white px-2 py-1 text-[12px] font-medium text-blue-900">
                {bahtText(totals.total)}
              </div>
            </div>
            <div className="col-span-2 flex items-center justify-end text-[11px] text-zinc-700">
              รวมจำนวนเงิน / Amount
            </div>
            <div className="col-span-3">
              <Input
                readOnly
                value={formatMoney(totals.before)}
                className="h-7 bg-white text-right font-semibold tabular-nums"
              />
            </div>
          </div>

          <div className="mt-1.5 grid grid-cols-12 items-center gap-2">
            <div className="col-span-3 flex items-center gap-2 text-[11px] text-zinc-700">
              <span>ส่วนลด</span>
              <Input
                type="number"
                step="0.01"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                className="h-7 w-24 bg-white text-right tabular-nums"
              />
            </div>
            <div className="col-span-2 flex items-center gap-1">
              <span className="text-[11px] text-zinc-700">เครดิต</span>
              <Input
                type="number"
                value={terms}
                onChange={(e) => setTerms(parseInt(e.target.value) || 0)}
                className="h-7 w-12 bg-white text-center font-semibold tabular-nums"
              />
              <span className="text-[11px] text-zinc-700">วัน</span>
            </div>
            <div className="col-span-2 flex items-center justify-end text-[11px] text-zinc-700">
              ภาษีมูลค่าเพิ่ม / VAT {vatRate}%
            </div>
            <div className="col-span-2"></div>
            <div className="col-span-3">
              <Input
                readOnly
                value={formatMoney(totals.vat)}
                className="h-7 bg-white text-right font-semibold tabular-nums"
              />
            </div>
          </div>

          <div className="mt-1.5 grid grid-cols-12 items-center gap-2">
            <div className="col-span-9 flex items-center justify-end text-[12px] font-semibold text-zinc-800">
              รวมทั้งสิ้น / Total
            </div>
            <div className="col-span-3">
              <Input
                readOnly
                value={formatMoney(totals.total)}
                className="h-7 bg-amber-100 text-right text-[13px] font-bold tabular-nums text-amber-900"
              />
            </div>
          </div>

          <div className="mt-1.5 grid grid-cols-2 gap-2">
            <div>
              <Lbl>หมายเหตุใบกำกับ <span className="text-zinc-400">(พิมพ์ลงเอกสาร)</span></Lbl>
              <textarea
                value={remark1}
                onChange={(e) => setRemark1(e.target.value)}
                rows={2}
                className="w-full rounded border border-sky-300 bg-white px-2 py-1 text-[12px] focus:outline-none focus:ring-1 focus:ring-sky-400"
              />
            </div>
            <div>
              <Lbl>หมายเหตุ2 <span className="text-zinc-400">(ภายใน — ไม่พิมพ์)</span></Lbl>
              <textarea
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                rows={2}
                className="w-full rounded border border-zinc-300 bg-white px-2 py-1 text-[12px] focus:outline-none focus:ring-1 focus:ring-zinc-400"
              />
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT ACTION SIDEBAR */}
      <div className="flex w-44 shrink-0 flex-col gap-2">
        <button
          type="button"
          onClick={() => onSubmit("back")}
          disabled={pending}
          title="บันทึกทับรายการเดิม"
          className="group flex h-10 items-center justify-center gap-1.5 rounded-md border border-lime-600 bg-lime-500 px-2 text-sm font-semibold text-white shadow-sm transition active:translate-y-px active:shadow-inner hover:bg-lime-600 disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          <span>Save (บันทึกทับ)</span>
        </button>

        <button
          type="button"
          onClick={() => onSubmit("addAnother")}
          disabled={pending}
          title={mode === "edit" ? "บันทึกเป็นใบกำกับใหม่ (ไม่ทับใบเดิม)" : "บันทึกเป็นรายการใหม่"}
          className="group flex h-10 items-center justify-center gap-1.5 rounded-md border border-lime-600 bg-lime-500 px-2 text-sm font-semibold text-white shadow-sm transition active:translate-y-px active:shadow-inner hover:bg-lime-600 disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          <span>Save (บันทึกเพิ่ม)</span>
        </button>

        <button
          type="button"
          onClick={() => setQuotationPickerOpen(true)}
          disabled={pending}
          title="เลือกใบเสนอราคามาแปลงเป็นใบกำกับ — ข้อมูลจะถูกใส่ในฟอร์มนี้"
          className="group flex h-10 items-center justify-center gap-1.5 rounded-md border border-amber-700 bg-gradient-to-b from-amber-300 to-amber-400 px-2 text-sm font-semibold text-amber-950 shadow-sm transition active:translate-y-px active:shadow-inner hover:from-amber-400 hover:to-amber-500 disabled:opacity-50"
        >
          <FileSpreadsheet className="h-4 w-4" />
          <span>เลือกใบเสนอราคา</span>
        </button>

        <button
          type="button"
          onClick={addRow}
          title="เพิ่มแถวสินค้าในตาราง"
          className="group flex h-10 items-center justify-center gap-1.5 rounded-md border border-zinc-500 bg-gradient-to-b from-zinc-200 to-zinc-300 px-2 text-sm font-semibold text-zinc-800 shadow-sm transition active:translate-y-px active:shadow-inner hover:from-zinc-300 hover:to-zinc-400"
        >
          <Plus className="h-4 w-4" />
          <span>เพิ่มแถวรายการ</span>
        </button>

        <button
          type="button"
          onClick={() => onSubmit("print")}
          disabled={pending}
          title={mode === "new" ? "บันทึก + เปิดหน้าพิมพ์" : "บันทึกการแก้ไข + เปิดหน้าพิมพ์"}
          className="group flex h-10 items-center justify-center gap-1.5 rounded-md border border-amber-700 bg-gradient-to-b from-amber-400 to-amber-500 px-2 text-sm font-semibold text-amber-950 shadow-sm transition active:translate-y-px active:shadow-inner hover:from-amber-500 hover:to-amber-600 disabled:opacity-50"
        >
          <Printer className="h-4 w-4" />
          <span>พิมพ์กระดาษ A4</span>
        </button>

        {/* WHT toggle */}
        <div className="flex flex-col gap-1 rounded border border-zinc-300 bg-white p-2 text-[11px]">
          <label className="flex cursor-pointer items-center gap-1.5">
            <input type="radio" checked={whtToggle} onChange={() => setWhtToggle(true)} />
            หัก ณ ที่จ่าย
          </label>
          <label className="flex cursor-pointer items-center gap-1.5">
            <input type="radio" checked={!whtToggle} onChange={() => setWhtToggle(false)} />
            ไม่หัก ณ ที่จ่าย
          </label>
          {whtToggle && (
            <div className="flex items-center gap-1">
              <span className="text-zinc-500">%</span>
              <Input
                type="number"
                step="0.01"
                value={whtRate}
                onChange={(e) => setWhtRate(e.target.value)}
                className="h-6 flex-1 text-right tabular-nums"
              />
            </div>
          )}
        </div>

        {/* Signers toggle box */}
        <div className="flex flex-col gap-1 rounded border border-zinc-300 bg-white p-2 text-[11px]">
          <div className="mb-0.5 text-[10.5px] font-semibold text-zinc-700">
            รายชื่อลงนาม (พิมพ์ลงเอกสาร)
          </div>
          <label className="flex cursor-pointer items-center gap-1.5">
            <input
              type="checkbox"
              checked={signerAuth}
              onChange={(e) => setSignerAuth(e.target.checked)}
            />
            ผู้มีอำนาจลงนาม
          </label>
          <label className="flex cursor-pointer items-center gap-1.5">
            <input
              type="checkbox"
              checked={signerPres}
              onChange={(e) => setSignerPres(e.target.checked)}
            />
            ผู้เสนอราคา
          </label>
          <label className="flex cursor-pointer items-center gap-1.5">
            <input
              type="checkbox"
              checked={signerRecv}
              onChange={(e) => setSignerRecv(e.target.checked)}
            />
            ผู้รับเงิน
          </label>
          <label className="flex cursor-pointer items-center gap-1.5">
            <input
              type="checkbox"
              checked={signerBill}
              onChange={(e) => setSignerBill(e.target.checked)}
            />
            ผู้วางบิล
          </label>
        </div>

        {/* Stamp toggle box */}
        <div className="flex flex-col gap-1 rounded border border-zinc-300 bg-white p-2 text-[11px]">
          <div className="mb-0.5 text-[10.5px] font-semibold text-zinc-700">
            ตราประทับบริษัท
          </div>
          <label className="flex cursor-pointer items-center gap-1.5">
            <input
              type="checkbox"
              checked={stampEnabled}
              onChange={(e) => setStampEnabled(e.target.checked)}
            />
            พิมพ์ตราประทับลงเอกสาร
          </label>
        </div>

        <div className="h-[80px]" aria-hidden="true" />

        <button
          type="button"
          onClick={() => router.back()}
          title="ปิดฟอร์มและกลับ"
          className="group flex h-11 items-center justify-center gap-1.5 rounded-md border border-rose-700 bg-gradient-to-b from-rose-500 to-rose-600 px-2 text-base font-bold italic text-white shadow-sm transition active:translate-y-px active:shadow-inner hover:from-rose-600 hover:to-rose-700"
        >
          <X className="h-4 w-4" />
          <span>ESC ออก</span>
        </button>
      </div>
    </div>

    <QuotationPickerDialog
      open={quotationPickerOpen}
      onClose={() => setQuotationPickerOpen(false)}
      onPick={applyQuotationToForm}
    />

    {printPicker && (
      <InvoicePrintPickerDialog
        id={printPicker.id}
        docNo={printPicker.docNo}
        internalSeq={printPicker.internalSeq}
        stampEnabled={stampEnabled}
        onClose={() => {
          setPrintPicker(null);
          setTimeout(() => router.push("/invoices"), 200);
        }}
      />
    )}
    </>
  );
}

// ============================================================
// helpers
// ============================================================
function Lbl({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-0.5 block text-[10.5px] font-medium text-sky-900/80">
      {children}
    </label>
  );
}
