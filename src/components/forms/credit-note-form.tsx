"use client";

import { useState, useTransition, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Save, AlertCircle, Trash2, Printer } from "lucide-react";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/thai/number";
import {
  createCreditNoteAction,
  checkCreditNoteNoAvailableAction,
} from "@/app/credit-notes/actions";
import { CreditNotePrintPickerDialog } from "@/components/forms/credit-note-print-picker";

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
  productCode: string;
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
};

const EMPTY_ROW: ItemRow = {
  productCode: "",
  description: "",
  quantity: "1",
  unit: "",
  unitPrice: "0",
};

const MIN_ROWS = 10;
function fillRows(items: ItemRow[]): ItemRow[] {
  const copy = items.length > 0 ? [...items] : [];
  while (copy.length < MIN_ROWS) copy.push({ ...EMPTY_ROW });
  return copy;
}

export type CreditNoteFormInitial = {
  customerId: number | null;
  customerCode: string;
  customerName: string;
  customerTaxId: string;
  customerBranch: string;
  customerAddress1: string;
  customerAddress2: string;
  customerAddress3: string;
  customerTel: string;
  salemanName: string;
  referenceInvoiceNo: string;
  referenceInvoiceDate: string;
  reason: string;
  originalAmount: number;
  correctAmount: number;
  vatRate: number;
  items: {
    productCode: string;
    description: string;
    quantity: number;
    unit: string;
    unitPrice: number;
  }[];
};

export function CreditNoteForm({
  customers,
  products,
  previewDocNo,
  initialDocDate,
  initial,
}: {
  customers: Customer[];
  products: Product[];
  previewDocNo: string;
  initialDocDate: string;
  initial?: CreditNoteFormInitial;
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

  const [docDate, setDocDate] = useState(initialDocDate);
  const [dueDate, setDueDate] = useState("");
  const [terms, setTerms] = useState(0);
  const [docNo, setDocNo] = useState(previewDocNo);
  const [docNoCheck, setDocNoCheck] = useState<{
    state: "idle" | "checking" | "ok" | "dup" | "invalid";
    msg?: string;
  }>({ state: "idle" });
  const docNoTouched = useRef(false);

  // customer
  const [customerId, setCustomerId] = useState<number | null>(
    initial?.customerId ?? null,
  );
  const [customerCode, setCustomerCode] = useState(initial?.customerCode ?? "");
  const [customerName, setCustomerName] = useState(initial?.customerName ?? "");
  const [customerTaxId, setCustomerTaxId] = useState(
    initial?.customerTaxId ?? "",
  );
  const [customerBranch, setCustomerBranch] = useState(
    initial?.customerBranch ?? "",
  );
  const [addr1, setAddr1] = useState(initial?.customerAddress1 ?? "");
  const [addr2, setAddr2] = useState(initial?.customerAddress2 ?? "");
  const [addr3, setAddr3] = useState(initial?.customerAddress3 ?? "");
  const [customerTel, setCustomerTel] = useState(initial?.customerTel ?? "");
  const [saleman, setSaleman] = useState(initial?.salemanName ?? "");

  // credit-note specific
  const [refInvoiceNo, setRefInvoiceNo] = useState(
    initial?.referenceInvoiceNo ?? "",
  );
  const [refInvoiceDate, setRefInvoiceDate] = useState(
    initial?.referenceInvoiceDate ?? "",
  );
  const [reason, setReason] = useState(initial?.reason ?? "");
  const [originalAmount, setOriginalAmount] = useState(
    String(initial?.originalAmount ?? 0),
  );
  const [correctAmount, setCorrectAmount] = useState(
    String(initial?.correctAmount ?? 0),
  );

  const [vatRate, setVatRate] = useState(String(initial?.vatRate ?? 7));
  const [memo, setMemo] = useState("");
  const [remark1, setRemark1] = useState("");

  const [items, setItems] = useState<ItemRow[]>(
    fillRows(
      initial?.items.map((it) => ({
        productCode: it.productCode,
        description: it.description,
        quantity: String(it.quantity),
        unit: it.unit,
        unitPrice: String(it.unitPrice),
      })) ?? [],
    ),
  );

  const [printPicker, setPrintPicker] = useState<{
    id: number;
    docNo: string;
  } | null>(null);

  const totals = useMemo(() => {
    const itemSum = items.reduce((s, it) => {
      const q = parseFloat(it.quantity) || 0;
      const p = parseFloat(it.unitPrice) || 0;
      return s + q * p;
    }, 0);
    const adjusted = +(
      (parseFloat(originalAmount) || 0) - (parseFloat(correctAmount) || 0)
    ).toFixed(2);
    const before = itemSum > 0 ? +itemSum.toFixed(2) : adjusted;
    const vr = parseFloat(vatRate) || 0;
    const vat = +((before * vr) / 100).toFixed(2);
    const total = +(before + vat).toFixed(2);
    return { adjusted, before, vat, total };
  }, [items, originalAmount, correctAmount, vatRate]);

  // doc no live check
  useEffect(() => {
    if (!docNoTouched.current) return;
    if (!docNo.trim()) {
      setDocNoCheck({ state: "idle" });
      return;
    }
    setDocNoCheck({ state: "checking" });
    const t = setTimeout(async () => {
      const res = await checkCreditNoteNoAvailableAction(docNo);
      if (res.available) setDocNoCheck({ state: "ok" });
      else if (res.reason?.includes("รูปแบบ"))
        setDocNoCheck({ state: "invalid", msg: res.reason });
      else setDocNoCheck({ state: "dup", msg: res.reason });
    }, 400);
    return () => clearTimeout(t);
  }, [docNo]);

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
    setItems((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, [key]: value } : r)),
    );
  }
  function removeRow(idx: number) {
    setItems((prev) =>
      prev.map((r, i) => (i === idx ? { ...EMPTY_ROW } : r)),
    );
  }

  function buildFormData(): FormData {
    const fd = new FormData();
    fd.set("docDate", docDate);
    if (docNo.trim() && docNo.trim() !== previewDocNo.trim()) {
      fd.set("customDocNo", docNo.trim());
    }
    if (customerId !== null) fd.set("customerId", String(customerId));
    fd.set("customerCode", customerCode);
    fd.set("customerName", customerName);
    fd.set("customerTaxId", customerTaxId);
    fd.set("customerBranch", customerBranch);
    fd.set(
      "customerAddress",
      [addr1, addr2, addr3].filter(Boolean).join("\n"),
    );
    fd.set("customerTel", customerTel);
    fd.set("salemanName", saleman);
    fd.set("referenceInvoiceNo", refInvoiceNo);
    fd.set("referenceInvoiceDate", refInvoiceDate);
    fd.set("reason", reason);
    fd.set("originalAmount", originalAmount);
    fd.set("correctAmount", correctAmount);
    fd.set("vatRate", vatRate);
    fd.set("memo", memo);
    fd.set("remark1", remark1);

    const validItems = items
      .filter((it) => it.description.trim())
      .map((it) => {
        const q = parseFloat(it.quantity) || 0;
        const p = parseFloat(it.unitPrice) || 0;
        return {
          productCode: it.productCode || null,
          description: it.description,
          quantity: q,
          unit: it.unit || null,
          unitPrice: p,
          amount: +(q * p).toFixed(2),
        };
      });

    // If no items, but original/correct amount given, push a synthetic line so server validation passes
    if (validItems.length === 0) {
      const adj = totals.adjusted;
      validItems.push({
        productCode: null,
        description: reason || "ปรับปรุงตามใบลดหนี้",
        quantity: 1,
        unit: null,
        unitPrice: adj,
        amount: adj,
      });
    }
    fd.set("items_json", JSON.stringify(validItems));
    return fd;
  }

  function onSubmit(thenAction: "back" | "addAnother" | "print") {
    setError(null);
    if (docNoCheck.state === "dup" || docNoCheck.state === "invalid") {
      setError(`เลขที่เอกสาร: ${docNoCheck.msg}`);
      return;
    }
    if (!reason.trim()) {
      setError("กรุณากรอกสาเหตุของการออกใบลดหนี้");
      return;
    }
    if (!customerName.trim()) {
      setError("กรุณากรอกชื่อลูกค้า");
      return;
    }
    const fd = buildFormData();
    startTransition(async () => {
      const res = await createCreditNoteAction(fd);
      if (res?.error) {
        setError(res.error);
        return;
      }
      setSavedToast("บันทึกใบลดหนี้เรียบร้อยแล้ว");
      if (thenAction === "addAnother") {
        setCustomerId(null);
        setCustomerCode("");
        setCustomerName("");
        setCustomerTaxId("");
        setCustomerBranch("");
        setAddr1("");
        setAddr2("");
        setAddr3("");
        setCustomerTel("");
        setRefInvoiceNo("");
        setRefInvoiceDate("");
        setReason("");
        setOriginalAmount("0");
        setCorrectAmount("0");
        setItems(fillRows([]));
        setMemo("");
        setRemark1("");
        router.refresh();
        return;
      }
      if (thenAction === "print" && res?.id) {
        // open Windows-style picker (Original / COPY) before navigating away
        setPrintPicker({ id: res.id, docNo: res.docNo ?? docNo });
        return;
      }
      setTimeout(() => router.push("/invoices"), 600);
    });
  }

  return (
    <>
      {savedToast && (
        <div className="fixed left-1/2 top-6 z-[60] -translate-x-1/2 rounded-lg border border-green-300 bg-green-50 px-5 py-3 shadow-lg">
          <div className="text-sm font-semibold text-green-800">
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
                ใบลดหนี้ / <span className="italic">CreditNote</span>
              </h1>
              <p className="text-[11px] text-zinc-500">
                ราคายังไม่รวมภาษีมูลค่าเพิ่ม ( VAT Exclude )
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
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
                  list="cn-customer-codes"
                  className="h-7 bg-white font-mono"
                  placeholder="พิมพ์รหัส แล้ว Enter"
                />
                <datalist id="cn-customer-codes">
                  {customers.map((c) => (
                    <option key={c.id} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </datalist>
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
                <Lbl>สาขาที่</Lbl>
                <Input
                  value={customerBranch}
                  onChange={(e) => setCustomerBranch(e.target.value)}
                  maxLength={5}
                  className="h-7 bg-white text-center font-mono"
                  placeholder="00000"
                />
              </div>
              <div className="col-span-3">
                <Lbl>ชื่อลูกค้า / บริษัท</Lbl>
                <Input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="h-7 bg-yellow-50 font-medium"
                  required
                />
              </div>
              <div className="col-span-2">
                <Lbl>วันที่ / Date</Lbl>
                <Input
                  value={docDate}
                  onChange={(e) => setDocDate(e.target.value)}
                  className="h-7 bg-white text-center"
                  placeholder="YYYY-MM-DD"
                />
              </div>
              <div className="col-span-1">
                <Lbl>Term</Lbl>
                <Input
                  type="number"
                  value={terms}
                  onChange={(e) => setTerms(parseInt(e.target.value) || 0)}
                  className="h-7 bg-white text-center font-semibold"
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
              <div className="col-span-3">
                <Lbl>เลขที่ใบกำกับภาษี (CN.No)</Lbl>
                <Input
                  value={docNo}
                  onChange={(e) => {
                    docNoTouched.current = true;
                    setDocNo(e.target.value);
                  }}
                  className={`h-7 text-center font-mono font-semibold ${
                    docNoCheck.state === "dup" ||
                    docNoCheck.state === "invalid"
                      ? "border-red-400 bg-red-50"
                      : docNoCheck.state === "ok"
                        ? "border-green-400 bg-green-50"
                        : "bg-yellow-50"
                  }`}
                  placeholder="CN69/05-00001"
                />
              </div>
              <div className="col-span-3">
                <Lbl>Quotation/Invoice No.</Lbl>
                <Input
                  value={refInvoiceNo}
                  onChange={(e) => setRefInvoiceNo(e.target.value)}
                  className="h-7 bg-white font-mono"
                  placeholder="IV69/04-17764"
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
              <div className="col-span-3">
                <Lbl>โทรศัพท์ Telephone</Lbl>
                <Input
                  value={customerTel}
                  onChange={(e) => setCustomerTel(e.target.value)}
                  className="h-7 bg-white"
                />
              </div>
              <div className="col-span-3">
                <Lbl>พนักงานขาย</Lbl>
                <Input
                  value={saleman}
                  onChange={(e) => setSaleman(e.target.value)}
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
              <div className="col-span-6">
                <Lbl>อ้างอิง / Refer</Lbl>
                <Input
                  value={remark1}
                  onChange={(e) => setRemark1(e.target.value)}
                  className="h-7 bg-white"
                />
              </div>
            </div>
          </div>

          {/* ITEMS TABLE */}
          <div
            className="overflow-auto"
            style={{ maxHeight: "calc(100vh - 32rem)" }}
          >
            <table className="w-full border-collapse text-[12px]">
              <thead className="sticky top-0 z-10 bg-sky-200 text-sky-900">
                <tr>
                  <th className="w-[88px] border border-sky-300 px-1.5 py-1 text-center font-semibold">
                    รหัส
                    <div className="text-[9px] font-normal italic text-sky-700">
                      Code
                    </div>
                  </th>
                  <th className="w-[42px] border border-sky-300 px-1 py-1 text-center font-semibold">
                    ลำดับ
                    <div className="text-[9px] font-normal italic text-sky-700">
                      No.
                    </div>
                  </th>
                  <th className="border border-sky-300 px-1.5 py-1 text-center font-semibold">
                    รายการ
                    <div className="text-[9px] font-normal italic text-sky-700">
                      Description
                    </div>
                  </th>
                  <th className="w-[80px] border border-sky-300 px-1 py-1 text-center font-semibold">
                    จำนวน
                    <div className="text-[9px] font-normal italic text-sky-700">
                      Quantity
                    </div>
                  </th>
                  <th className="w-[60px] border border-sky-300 px-1 py-1 text-center font-semibold">
                    หน่วย
                    <div className="text-[9px] font-normal italic text-sky-700">
                      Unit
                    </div>
                  </th>
                  <th className="w-[90px] border border-sky-300 px-1 py-1 text-center font-semibold">
                    ราคาต่อหน่วย
                    <div className="text-[9px] font-normal italic text-sky-700">
                      UnitPrice
                    </div>
                  </th>
                  <th className="w-[100px] border border-sky-300 px-1 py-1 text-center font-semibold">
                    จำนวนเงิน
                    <div className="text-[9px] font-normal italic text-sky-700">
                      Amount
                    </div>
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
                      <td className="border border-sky-200 px-1 text-center text-[11px] text-zinc-600">
                        {i + 1}
                      </td>
                      <td className="border border-sky-200 p-0">
                        <Input
                          value={row.description}
                          onChange={(e) =>
                            updateItem(i, "description", e.target.value)
                          }
                          className="h-7 w-full border-0 bg-transparent focus:ring-0"
                        />
                      </td>
                      <td className="border border-sky-200 p-0">
                        <Input
                          type="number"
                          step="0.001"
                          value={row.quantity}
                          onChange={(e) =>
                            updateItem(i, "quantity", e.target.value)
                          }
                          className="h-7 w-full border-0 bg-transparent text-right tabular-nums focus:ring-0"
                        />
                      </td>
                      <td className="border border-sky-200 p-0">
                        <Input
                          value={row.unit}
                          onChange={(e) =>
                            updateItem(i, "unit", e.target.value)
                          }
                          className="h-7 w-full border-0 bg-transparent text-center text-[11px] focus:ring-0"
                        />
                      </td>
                      <td className="border border-sky-200 p-0">
                        <Input
                          type="number"
                          step="0.01"
                          value={row.unitPrice}
                          onChange={(e) =>
                            updateItem(i, "unitPrice", e.target.value)
                          }
                          className="h-7 w-full border-0 bg-transparent text-right tabular-nums focus:ring-0"
                        />
                      </td>
                      <td className="border border-sky-200 px-1.5 text-right font-semibold tabular-nums">
                        {formatMoney(amt)}
                      </td>
                      <td className="border border-sky-200 p-0 text-center">
                        <button
                          type="button"
                          onClick={() => removeRow(i)}
                          className="h-7 w-full text-[10px] text-rose-600 hover:bg-rose-50"
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

          {/* CREDIT-NOTE-SPECIFIC FIELDS */}
          <div className="border-t border-sky-300 bg-sky-100/70 px-3 py-2">
            <div>
              <Lbl>สาเหตุของการออกใบลดหนี้ *</Lbl>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="h-7 bg-yellow-50"
                required
                placeholder="เช่น สินค้ารับคืน / ลดราคาสินค้า / ลดมูลค่าตามใบกำกับเดิม"
              />
            </div>

            <div className="mt-1.5 grid grid-cols-12 items-end gap-2">
              <div className="col-span-3">
                <Lbl>อ้างถึงใบกำกับภาษีเลขที่</Lbl>
                <Input
                  value={refInvoiceNo}
                  onChange={(e) => setRefInvoiceNo(e.target.value)}
                  className="h-7 bg-white font-mono"
                  placeholder="IV69/04-17764"
                />
              </div>
              <div className="col-span-3">
                <Lbl>ลงวันที่</Lbl>
                <Input
                  value={refInvoiceDate}
                  onChange={(e) => setRefInvoiceDate(e.target.value)}
                  className="h-7 bg-white text-center"
                  placeholder="YYYY-MM-DD"
                />
              </div>
              <div className="col-span-3">
                <Lbl>มูลค่าสินค้า/บริการเดิม</Lbl>
                <Input
                  type="number"
                  step="0.01"
                  value={originalAmount}
                  onChange={(e) => setOriginalAmount(e.target.value)}
                  className="h-7 bg-yellow-50 text-right tabular-nums"
                />
              </div>
              <div className="col-span-3">
                <Lbl>มูลค่าสินค้า/บริการที่ถูกต้อง</Lbl>
                <Input
                  type="number"
                  step="0.01"
                  value={correctAmount}
                  onChange={(e) => setCorrectAmount(e.target.value)}
                  className="h-7 bg-yellow-50 text-right tabular-nums"
                />
              </div>
            </div>

            <div className="mt-1.5 grid grid-cols-12 items-center gap-2">
              <div className="col-span-3 text-right text-[11px] text-zinc-700">
                มูลค่าที่ปรับปรุง (เดิม − ถูกต้อง)
              </div>
              <div className="col-span-3">
                <Input
                  readOnly
                  value={formatMoney(totals.adjusted)}
                  className="h-7 bg-amber-50 text-right font-semibold tabular-nums"
                />
              </div>
              <div className="col-span-3 text-right text-[11px] text-zinc-700">
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
              <div className="col-span-9 text-right text-[11px] text-zinc-700">
                ภาษีมูลค่าเพิ่ม / VAT {vatRate}%
              </div>
              <div className="col-span-3">
                <Input
                  readOnly
                  value={formatMoney(totals.vat)}
                  className="h-7 bg-white text-right font-semibold tabular-nums"
                />
              </div>
            </div>

            <div className="mt-1.5 grid grid-cols-12 items-center gap-2">
              <div className="col-span-9 text-right font-semibold text-zinc-800">
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

            <div className="mt-2 grid grid-cols-2 gap-2">
              <div>
                <Lbl>
                  หมายเหตุ{" "}
                  <span className="text-zinc-400">
                    (ภายใน — ไม่พิมพ์ลงเอกสาร)
                  </span>
                </Lbl>
                <textarea
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  rows={2}
                  className="w-full rounded border border-zinc-300 bg-white px-2 py-1 text-[12px] focus:outline-none focus:ring-1 focus:ring-zinc-400"
                />
              </div>
              <div>
                <Lbl>
                  หมายเหตุ1{" "}
                  <span className="text-zinc-400">
                    (พิมพ์ลงในเอกสาร)
                  </span>
                </Lbl>
                <textarea
                  value={remark1}
                  onChange={(e) => setRemark1(e.target.value)}
                  rows={2}
                  className="w-full rounded border border-sky-300 bg-yellow-50 px-2 py-1 text-[12px] focus:outline-none focus:ring-1 focus:ring-sky-400"
                />
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT SIDEBAR — buttons */}
        <div className="flex w-44 shrink-0 flex-col gap-2">
          <Button
            type="button"
            onClick={() => onSubmit("back")}
            disabled={pending}
            className="w-full justify-start bg-zinc-500 text-white hover:bg-zinc-600"
          >
            <Save className="h-4 w-4" />
            {pending ? "กำลังบันทึก..." : "Save บันทึกทับ"}
          </Button>
          <Button
            type="button"
            onClick={() => onSubmit("addAnother")}
            disabled={pending}
            className="w-full justify-start bg-emerald-500 text-white hover:bg-emerald-600"
          >
            <Save className="h-4 w-4" />
            Save รายการเพิ่ม
          </Button>

          <div className="h-32" aria-hidden="true" />

          <Button
            type="button"
            onClick={() => onSubmit("print")}
            disabled={pending}
            className="w-full justify-start bg-zinc-700 text-white hover:bg-zinc-800"
          >
            <Printer className="h-4 w-4" />
            พิมพ์กระดาษA4
          </Button>
          <Button
            type="button"
            onClick={() => router.back()}
            className="w-full justify-start bg-blue-700 text-white hover:bg-blue-800"
          >
            ESC ออก
          </Button>
        </div>
      </div>

      {printPicker && (
        <CreditNotePrintPickerDialog
          id={printPicker.id}
          docNo={printPicker.docNo}
          onClose={() => {
            setPrintPicker(null);
            setTimeout(() => router.push("/invoices"), 200);
          }}
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
