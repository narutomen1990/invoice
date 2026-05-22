import { notFound } from "next/navigation";
import { promises as fs } from "node:fs";
import path from "node:path";
import { getInvoiceById } from "@/lib/queries/invoices";
import { db } from "@/db/client";
import { companies } from "@/db/schema";
import { formatMoney, bahtText } from "@/lib/thai/number";
import { formatThaiDateShort } from "@/lib/thai/date";
import { getSignaturesAction } from "@/app/settings/actions";
import { PrintActions } from "./print-actions";

async function loadImageBase64(p: string | null | undefined): Promise<string | null> {
  if (!p) return null;
  try {
    const lp = p.startsWith("/") ? path.join(process.cwd(), "public", p) : p;
    const buf = await fs.readFile(lp);
    const ext = path.extname(lp).slice(1).toLowerCase();
    const mime =
      ext === "png"
        ? "image/png"
        : ext === "gif"
          ? "image/gif"
          : ext === "webp"
            ? "image/webp"
            : "image/jpeg";
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

export const dynamic = "force-dynamic";

const TARGET_ROWS = 14;

function branchLabel(code: string | null): string {
  if (!code) return "";
  const c = code.trim();
  if (!c || c === "00000") return "สำนักงานใหญ่";
  const n = parseInt(c, 10);
  if (n === 0) return "สำนักงานใหญ่";
  if (Number.isNaN(n)) return c;
  return `สาขา ${n}`;
}

type FormKind = "tax" | "notice" | "receipt" | "billing";
const TITLES: Record<FormKind, { th: string; en: string; thCopy: string; enCopy: string }> = {
  tax: {
    th: "ใบกำกับภาษี / ใบเสร็จรับเงิน",
    en: "TAX INVOICE / RECEIPT",
    thCopy: "สำเนาใบกำกับภาษี / สำเนาใบเสร็จรับเงิน",
    enCopy: "TAX INVOICE COPY / RECEIPT COPY",
  },
  notice: {
    th: "ใบแจ้งหนี้ / INVOICE",
    en: "",
    thCopy: "สำเนาใบแจ้งหนี้ / INVOICE COPY",
    enCopy: "",
  },
  receipt: {
    th: "ใบส่งสินค้า / DELIVERY ORDER",
    en: "",
    thCopy: "สำเนาใบส่งสินค้า / DELIVERY ORDER COPY",
    enCopy: "",
  },
  billing: {
    th: "ใบกำกับภาษี / ใบเสร็จรับเงิน / ใบส่งสินค้า",
    en: "TAX INVOICE / RECEIPT / DELIVERY ORDER",
    thCopy: "สำเนาใบกำกับภาษี / สำเนาใบเสร็จรับเงิน / สำเนาใบส่งสินค้า",
    enCopy: "TAX INVOICE COPY / RECEIPT COPY / DELIVERY ORDER COPY",
  },
};

export default async function PrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const isCopy = sp.copy === "1";
  const stampDisabled = sp.stamp === "0";
  const formParam = (sp.form ?? "tax") as FormKind;
  const form = (TITLES[formParam] ? formParam : "tax") as FormKind;
  const title = TITLES[form];
  const numId = parseInt(id, 10);
  if (Number.isNaN(numId)) notFound();
  const data = await getInvoiceById(numId);
  if (!data) notFound();
  const { doc, items } = data;

  const [company] = await db.select().from(companies).limit(1);
  if (!company) notFound();

  const blankRows = Math.max(0, TARGET_ROWS - items.length);
  const alphaText = doc.totalInWordsTh?.trim() || bahtText(doc.total);

  // ---- load logo as base64 (works for both browser print + react-pdf consistent) ----
  const logoDataUrl = await loadImageBase64(company.logoPath);

  // ---- load signature & stamp from settings ----
  const sigs = await getSignaturesAction();
  const sigAuthDataUrl = sigs.authorized.enabled
    ? await loadImageBase64(sigs.authorized.path)
    : null;
  // stamp shows when image exists & not explicitly disabled per-document
  const stampDataUrl = !stampDisabled
    ? await loadImageBase64(sigs.stamp.path)
    : null;

  // Smart prefix: only add if user didn't already type it
  const withPrefix = (val: string | null, prefix: string): string | null => {
    if (!val) return null;
    return val.startsWith(prefix) ? val : `${prefix}${val}`;
  };

  const addrThParts = [
    company.buildingTh,
    company.mooTh ? `หมู่ ${company.mooTh}` : null,
    withPrefix(company.soiTh, "ซอย"),
    withPrefix(company.roadTh, "ถนน"),
    withPrefix(company.subDistrictTh, "แขวง"),
    withPrefix(company.districtTh, "เขต"),
    company.provinceTh,
    company.postcode,
  ].filter(Boolean).join(" ");

  const addrEnParts = [
    company.buildingEn,
    company.mooEn,
    company.soiEn,
    company.roadEn,
    company.subDistrictEn,
    company.districtEn,
    company.provinceEn,
    company.postcode,
  ].filter(Boolean).join(" ");

  return (
    <>
      <PrintActions docNo={doc.docNo} />
      <div className="invoice-page">
        {/* TOP: Logo + Company info */}
        <div className="top">
          <div className="logo-box">
            {logoDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoDataUrl} alt="logo" className="logo-img" />
            ) : (
              <>
                <div className="logo-vm">VM</div>
                <div className="logo-cam">camera</div>
                <div className="logo-pro">PRO</div>
              </>
            )}
          </div>
          <div className="company-info">
            <div className="company-th">{company.nameTh}</div>
            {company.nameEn && <div className="company-en">{company.nameEn}</div>}
            {addrThParts && <div className="company-addr">{addrThParts}</div>}
            {addrEnParts && <div className="company-addr-en">{addrEnParts}</div>}
            <div className="company-contact">
              {company.tel && <span>โทรศัพท์ / Telephone : {company.tel}</span>}
              {company.website && <span>Website : {company.website}</span>}
              {company.email && <span>email : {company.email}</span>}
            </div>
          </div>
        </div>

        {/* TITLE */}
        <div className="title-block">
          <div className="title-th">{isCopy ? title.thCopy : title.th}</div>
          {(isCopy ? title.enCopy : title.en) && (
            <div className="title-en">
              {isCopy ? title.enCopy : title.en}
            </div>
          )}
        </div>

        {/* TAX INFO ROW */}
        <div className="tax-info">
          <div className="tax-cell">
            <div className="tax-lbl-stack">
              <span className="lbl">เลขประจำตัวผู้เสียภาษี</span>
              <span className="lbl-en">TAX IDENTIFICATION</span>
            </div>
            <span className="val">{company.taxId ?? "-"}</span>
          </div>
          <div className="tax-cell">
            <span>สาขาที่ออกใบกำกับภาษี/Branch :</span>
            <span className="val">{branchLabel(company.branchCode)}</span>
          </div>
          <div className="tax-cell right">
            <span className="ital">อัตราภาษีร้อยละ /TAX RATE</span>
            <span className="val rate">{Number(doc.vatRate)}</span>
          </div>
        </div>

        {/* BODY: Customer (left) + Doc info (right) */}
        <div className="body">
          <div className="customer-box">
            {/* Row 1: รหัส [code] */}
            <div className="cust-top-row">
              <span className="cust-lbl-tight">
                <span className="lbl-th">รหัส</span>
                <span className="lbl-en">CODE</span>
              </span>
              <span className="cust-val-tight mono">{doc.customerCode ?? "-"}</span>
            </div>

            {/* Row 2: เลขประจำตัวผู้เสียภาษีผู้ซื้อ [taxid]   สาขาที่ [branch] */}
            <div className="cust-tax-row">
              <span className="cust-lbl-mid">เลขประจำตัวผู้เสียภาษีผู้ซื้อ :</span>
              <span className="cust-val-tight">{doc.customerTaxId ?? "-"}</span>
              <span className="cust-lbl-mid">สาขาที่ :</span>
              <span className="cust-val-tight">{branchLabel(doc.customerBranch)}</span>
            </div>

            <table className="customer">
              <tbody>
                <tr>
                  <td className="lbl">
                    <div>นามผู้ซื้อ</div>
                    <div className="lbl-en">SOLD TO</div>
                  </td>
                  <td className="val bold">
                    {doc.customerName ?? "-"}
                  </td>
                </tr>
                <tr>
                  <td className="lbl">
                    <div>ที่อยู่</div>
                    <div className="lbl-en">ADDRESS</div>
                  </td>
                  <td className="val">
                    {doc.customerAddress?.replace(/\n/g, " ") ?? "-"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="doc-info">
            <div className="doc-grid">
              <div className="doc-cell">
                <div className="doc-lbl">วันที่ / Date</div>
                <div className="doc-val">{formatThaiDateShort(doc.docDate)}</div>
              </div>
              <div className="doc-cell">
                <div className="doc-lbl">เลขที่ใบกำกับภาษี / Tax Invoice</div>
                <div className="doc-val mono bold">{doc.docNo}</div>
              </div>
              <div className="doc-cell">
                <div className="doc-lbl">ใบสั่งซื้อเลขที่ / Purchase Order</div>
                <div className="doc-val">{doc.referenceQuotationNo ?? " "}</div>
              </div>
              <div className="doc-cell">
                <div className="doc-lbl">ขายโดย / Sale By</div>
                <div className="doc-val">{doc.salemanName ?? " "}</div>
              </div>
              <div className="doc-cell">
                <div className="doc-lbl">
                  กำหนดชำระ <span className="lbl-en">CREDIT TERM</span>
                </div>
                <div className="doc-val">
                  {doc.paymentTermsDays}{" "}
                  <span className="lbl-en">วัน DAY</span>
                </div>
              </div>
              <div className="doc-cell">
                <div className="doc-lbl">วันครบกำหนดชำระ / Due Date</div>
                <div className="doc-val">
                  {doc.dueDate ? formatThaiDateShort(doc.dueDate) : " "}
                </div>
              </div>
              <div className="doc-cell doc-cell-full">
                <div className="doc-lbl">อ้างอิง / REFERENCE</div>
                <div className="doc-val">&nbsp;</div>
              </div>
            </div>
          </div>
        </div>

        {/* ITEMS TABLE */}
        <div className="items-wrap">
        <table className="items">
          <thead>
            <tr>
              <th className="col-no">
                <div className="ital">ลำดับ</div>
                <div className="ital-en">NO.</div>
              </th>
              <th className="col-desc">
                <div className="ital">รายการสินค้า</div>
                <div className="ital-en">DESCRIPTION GOODS</div>
              </th>
              <th className="col-qty">
                <div className="ital">จำนวน</div>
                <div className="ital-en">QUANTITY</div>
              </th>
              <th className="col-price">
                <div className="ital">ราคาต่อหน่วย</div>
                <div className="ital-en">UNIT PRICE</div>
              </th>
              <th className="col-amt">
                <div className="ital">จำนวนเงิน</div>
                <div className="ital-en">AMOUNT</div>
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, idx) => (
              <tr key={idx}>
                <td className="ctr">{it.lineNo ?? ""}</td>
                <td>{it.description ?? ""}</td>
                <td className="ctr">{it.quantity ? formatMoney(it.quantity, it.quantity % 1 === 0 ? 0 : 2) : ""}</td>
                <td className="rt">{it.unitPrice ? formatMoney(it.unitPrice) : ""}</td>
                <td className="rt">{it.amount ? formatMoney(it.amount) : ""}</td>
              </tr>
            ))}
            {Array.from({ length: blankRows }).map((_, i) => (
              <tr key={`b${i}`} className="blank">
                <td>&nbsp;</td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>

        {/* FOOTER: Notes+Words (left) | Totals (right) */}
        <div className="footer-row">
          <div className="notes">
            <div>1. ในกรณีชำระด้วยเช็ค โปรดสั่งจ่ายเช็คขีดคร่อมในนาม {company.nameTh} เท่านั้น</div>
            <div>2. ในกรณีที่จ่ายเช็ค ใบเสร็จรับเงินนี้จะสมบูรณ์ต่อเมื่อเช็คได้เรียกเก็บเงินจากธนาคารแล้ว</div>
            <div className="words-block">
              <div className="words-row">
                <div className="words-lbl-stack">
                  <div className="words-lbl">ตัวอักษร(บาท)</div>
                  <div className="words-lbl-en">ALPHA (BAHT)</div>
                </div>
                <div className="words-text">({alphaText})</div>
              </div>
            </div>
          </div>
          <table className="totals">
            <tbody>
              <tr>
                <td className="lbl">
                  <div className="lbl-en bold">AMOUNT</div>
                  <div>รวมมูลค่า</div>
                </td>
                <td className="val">{formatMoney(doc.amountBeforeVat)}</td>
              </tr>
              <tr>
                <td className="lbl">
                  <div className="lbl-en bold">VAT</div>
                  <div>ภาษีมูลค่าเพิ่ม {Number(doc.vatRate)}%</div>
                </td>
                <td className="val">{formatMoney(doc.vatAmount)}</td>
              </tr>
              <tr>
                <td className="lbl">
                  <div className="lbl-en bold">TOTAL</div>
                  <div>รวมทั้งสิ้น</div>
                </td>
                <td className="val total-val">{formatMoney(doc.total)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* SIGNATURES */}
        <div className="sign-block">
          <div className="sign-col left">
            <div className="sign-title">ได้รับสินค้าแล้วในสภาพที่เรียบร้อยและถูกต้อง</div>
            <div className="sign-title-en ital">Goods Received In Good Order And Condition</div>
            <div className="sign-stack">
              <div className="lbl-line">ผู้รับสินค้า</div>
              <div className="sign-row">
                <span className="lbl-en">Received By</span>
                <span className="dots"></span>
              </div>
            </div>
            <div className="sign-stack">
              <div className="lbl-line">วันที่</div>
              <div className="sign-row">
                <span className="lbl-en">Date</span>
                <span className="dots"></span>
              </div>
            </div>
            <div className="sign-stack">
              <div className="lbl-line">ผู้ส่งสินค้า</div>
              <div className="sign-row">
                <span className="lbl-en">Delivery By</span>
                <span className="dots dots-filled">{doc.salemanName ?? ""}</span>
              </div>
            </div>
            <div className="sign-stack">
              <div className="lbl-line">วันที่</div>
              <div className="sign-row">
                <span className="lbl-en">Date</span>
                <span className="dots dots-filled">
                  {formatThaiDateShort(doc.docDate)}
                </span>
              </div>
            </div>
          </div>

          <div className="sign-col mid">
            <div className="pay-row">
              <span>ชำระโดย</span>
              <span className="ck"><span className="cbx" /> เงินสด</span>
              <span className="ck"><span className="cbx" /> เช็ค</span>
              <span className="ck"><span className="cbx" /> เงินโอน</span>
            </div>
            <div className="pay-row-en ital">
              <span>Paid By</span>
              <span>Cash</span>
              <span>Cheque</span>
              <span>Transfer</span>
            </div>
            <div className="pay-line">
              <span>ธนาคาร</span>
              <span className="dots-sm"></span>
              <span>สาขา</span>
              <span className="dots-sm"></span>
            </div>
            <div className="pay-line">
              <span>เลขที่เช็ค</span>
              <span className="dots-sm"></span>
              <span>ลงวันที่</span>
              <span className="dots-sm"></span>
            </div>
            <div className="pay-line">
              <span>จำนวนเงิน</span>
              <span className="dots-sm flex-grow"></span>
            </div>
            <div className="pay-stack-row">
              <div className="sign-stack flex-1">
                <div className="lbl-line">ผู้รับเงิน</div>
                <div className="sign-row">
                  <span className="lbl-en">Collector</span>
                  <span className="dots"></span>
                </div>
              </div>
              <div className="sign-stack flex-1">
                <div className="lbl-line">วันที่</div>
                <div className="sign-row">
                  <span className="lbl-en">Date</span>
                  <span className="dots"></span>
                </div>
              </div>
            </div>
          </div>

          <div className="sign-col right">
            {stampDataUrl && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={stampDataUrl} alt="ตราประทับ" className="stamp-overlay" />
            )}
            <div className="sign-title">ในนาม / For</div>
            <div className="sign-company">{company.nameTh}</div>
            <div className="sign-company-en ital">{company.nameEn ?? ""}</div>
            <div className="sign-line center">
              {sigAuthDataUrl && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={sigAuthDataUrl}
                  alt="ลายเซ็น"
                  className="signature-img"
                />
              )}
              <span className="dots"></span>
            </div>
            <div className="sign-end">
              <div>ผู้มีอำนาจลงนาม</div>
              <div className="ital">Authorized Signature</div>
            </div>
          </div>
        </div>

      </div>

      <style>{`
        :root { color-scheme: light; }
        body { margin: 0; background: #e5e5e5; }
        .invoice-page {
          position: relative;
          width: 210mm;
          min-height: 297mm;
          margin: 1rem auto;
          padding: 8mm 8mm;
          background: #fff;
          color: #000;
          font-family: "Sarabun", "Noto Sans Thai", sans-serif;
          font-size: 11px;
          line-height: 1.3;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          box-sizing: border-box;
        }

        /* ---- TOP: logo + company ---- */
        .top { display: flex; gap: 6mm; align-items: flex-start; padding-bottom: 3mm; border-bottom: 1px solid #000; }
        .logo-box {
          width: 28mm; height: 24mm;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          color: #c00; font-weight: 700; overflow: hidden;
        }
        .logo-img { max-width: 100%; max-height: 100%; object-fit: contain; }
        .logo-vm { font-size: 18px; line-height: 1; }
        .logo-cam { font-size: 11px; letter-spacing: 1px; }
        .logo-pro { font-size: 14px; background: #c00; color: #fff; padding: 1px 8px; margin-top: 2px; }
        .company-info { flex: 1; }
        .company-th { font-size: 16px; font-weight: 700; }
        .company-en { font-size: 13px; font-style: italic; font-weight: 600; margin-bottom: 2px; }
        .company-addr { font-size: 10px; }
        .company-addr-en { font-size: 9.5px; font-style: italic; color: #444; }
        .company-contact { font-size: 9px; margin-top: 1mm; display: flex; gap: 3mm; flex-wrap: wrap; }

        /* ---- TITLE ---- */
        .title-block { text-align: center; margin: 2mm 0 1mm; }
        .title-th { font-size: 18px; font-weight: 700; font-style: italic; }
        .title-en { font-size: 16px; font-weight: 700; font-style: italic; letter-spacing: 1px; }

        /* ---- TAX INFO ---- */
        .tax-info {
          display: flex; justify-content: space-between; align-items: baseline;
          font-size: 10px; padding-bottom: 2mm; gap: 4mm;
        }
        .tax-cell { display: flex; gap: 2mm; align-items: flex-start; }
        .tax-lbl-stack { display: flex; flex-direction: column; line-height: 1.1; }
        .tax-cell.right { margin-left: auto; }
        .tax-cell .lbl { font-style: italic; }
        .tax-cell .lbl-en { font-style: italic; font-size: 9px; color: #555; }
        .tax-cell .val { font-weight: 700; }
        .tax-cell .val.rate { background: #fff; padding: 0 4mm; }
        .ital { font-style: italic; }

        /* ---- BODY: customer + doc-info (2 separate boxes) ---- */
        .body {
          display: flex; gap: 2mm;
          margin-bottom: 2mm;
        }
        .customer-box {
          flex: 1.4; padding: 2mm 3mm;
          border: 1px solid #000; border-radius: 6px;
        }
        .doc-info {
          flex: 1; padding: 0;
          border: 1px solid #000; border-radius: 6px;
          overflow: hidden; display: flex; flex-direction: column;
        }

        /* row 1: รหัส + value */
        .cust-top-row {
          display: flex; align-items: baseline; gap: 2mm;
          padding: 1mm 0; font-size: 10px;
        }
        /* row 2: เลขผู้เสียภาษี + สาขา */
        .cust-tax-row {
          display: flex; flex-wrap: wrap; align-items: baseline;
          gap: 2mm 6mm; padding: 0 0 1.5mm; font-size: 10px;
          margin-bottom: 0.5mm;
        }
        .cust-lbl-tight {
          display: inline-flex; align-items: baseline; gap: 1mm;
          font-style: italic; color: #333;
        }
        .cust-lbl-tight .lbl-th { font-weight: 600; font-size: 11px; }
        .cust-lbl-tight .lbl-en { font-size: 8.5px; }
        .cust-lbl-mid { font-style: italic; color: #333; font-size: 10px; }
        .cust-val-tight { font-weight: 700; }
        .cust-val-tight.mono { font-family: "Sarabun", monospace; }

        .customer { width: 100%; border-collapse: collapse; font-size: 10.5px; }
        .customer td { padding: 1.5mm 1mm; vertical-align: top; }
        .customer td.lbl { font-style: italic; color: #333; width: 1%; white-space: nowrap; padding-right: 3mm; }
        .customer td.lbl .lbl-en { font-size: 9px; font-style: italic; }
        .customer td.val { font-weight: 600; }
        .customer td.val.bold { font-weight: 700; font-size: 11px; }

        .doc-grid {
          display: grid; grid-template-columns: 1fr 1fr;
          font-size: 10px; height: 100%;
        }
        .doc-cell {
          padding: 1mm 3mm 1.5mm;
          border-bottom: 1px solid #000;
          border-right: 1px solid #000;
        }
        .doc-cell:nth-child(2n) { border-right: 0; }              /* right column: no right border */
        .doc-cell-full {
          grid-column: 1 / -1;
          border-right: 0; border-bottom: 0;                       /* last full-width row */
        }
        .doc-lbl { font-style: italic; color: #444; font-size: 9px; line-height: 1.1; }
        .doc-lbl .lbl-en { font-size: 8.5px; }
        .doc-val { font-weight: 600; text-align: center; margin-top: 0.5mm; min-height: 4mm; }
        .doc-val.mono { font-family: "Sarabun", monospace; }
        .doc-val.bold { font-weight: 700; font-size: 11px; }

        /* ---- ITEMS ---- */
        .items-wrap {
          border: 1px solid #000;
          border-bottom: 0;                            /* ใช้ border-top ของ notes/totals แทน */
          border-top-left-radius: 6px;
          border-top-right-radius: 6px;
          overflow: hidden;
          margin-bottom: 0;
        }
        .items { width: 100%; border-collapse: collapse; font-size: 11px; }
        .items th, .items td {
          border-right: 1px solid #000;
          padding: 1.5mm 2mm;
        }
        .items th:last-child, .items td:last-child { border-right: 0; }
        .items thead th {
          background: #f3f4f6; font-weight: 700; text-align: center;
          padding: 2mm 1mm; border-bottom: 1px solid #000;
        }
        .items thead th .ital { font-style: italic; font-size: 11px; }
        .items thead th .ital-en { font-style: italic; font-size: 9px; color: #444; }
        .items .col-no { width: 14mm; text-align: center; }
        .items .col-desc { }
        .items .col-qty { width: 22mm; }
        .items .col-price { width: 28mm; }
        .items .col-amt { width: 28mm; }
        .items td.ctr { text-align: center; font-style: italic; }
        .items td.rt { text-align: right; font-style: italic; font-variant-numeric: tabular-nums; }
        .items tbody td { border-bottom: 0; }
        .items tr.blank td { height: 6.5mm; }

        /* ---- FOOTER — Notes ติด Totals ไม่มี gap ---- */
        .footer-row { display: flex; gap: 0; margin-top: 0; align-items: stretch; }
        .notes {
          flex: 1; padding: 2mm 3mm; font-size: 9px; line-height: 1.5;
          border: 1px solid #000; border-radius: 6px;
          display: flex; flex-direction: column;
          margin-right: -1px;                            /* overlap border */
          border-top-left-radius: 0;                     /* ติดกับ items table */
          border-top-right-radius: 0;
          border-bottom-right-radius: 0;
        }
        .footer-row .totals {
          align-self: flex-start;
          border-top-left-radius: 0;
          border-top-right-radius: 0;                    /* ติดกับ items table */
          border-bottom-left-radius: 0;
        }
        .words-block {
          margin-top: auto; padding-top: 3mm;
          border-top: 1px solid #000;
          font-size: 11px; font-style: italic;
          margin-left: -3mm; margin-right: -3mm;
          padding-left: 3mm; padding-right: 3mm;
        }
        .words-row { display: flex; align-items: center; gap: 3mm; }
        .words-lbl-stack { display: flex; flex-direction: column; line-height: 1.1; flex-shrink: 0; }
        .words-lbl { font-weight: 700; font-style: normal; font-size: 11px; }
        .words-lbl-en { font-weight: 600; font-style: italic; font-size: 9px; color: #555; }
        .words-text { line-height: 1.4; font-weight: 700; font-size: 13px; flex: 1; }
        .totals {
          width: 70mm; border-collapse: separate; border-spacing: 0; font-size: 11px;
          border: 1px solid #000; border-radius: 6px; overflow: hidden;
        }
        .totals td { padding: 1.5mm 2mm; vertical-align: middle; border-bottom: 1px solid #000; }
        .totals tr:last-child td { border-bottom: 0; }
        .totals td.lbl { width: 30mm; border-right: 1px solid #000; }
        .totals td.lbl .lbl-en { font-style: italic; font-size: 11px; }
        .totals td.val { text-align: right; font-style: italic; font-variant-numeric: tabular-nums; font-weight: 600; }
        .totals td.total-val { font-weight: 700; font-size: 13px; }

        /* ---- SIGNATURES (left+mid touching, right with gap) ---- */
        .sign-block {
          display: flex; gap: 0;
          margin-top: 2mm;
        }
        .sign-col {
          padding: 2.5mm 3mm; font-size: 10px;
          border: 1px solid #000; border-radius: 6px;
          display: flex; flex-direction: column;
        }
        .sign-col.left {
          flex: 1.30;                                      /* ขยายอีกให้ "ได้รับสินค้า..." อยู่บรรทัดเดียว */
          justify-content: space-between;
          margin-right: -1px;                              /* touching: overlap border */
          border-top-right-radius: 0;
          border-bottom-right-radius: 0;
        }
        .sign-col.mid {
          flex: 0.56;                                      /* แคบลงเพื่อให้ left ขยายได้ */
          font-size: 9.5px; justify-content: space-between;
          border-top-left-radius: 0;
          border-bottom-left-radius: 0;
        }
        .sign-col.left .sign-title {
          white-space: nowrap;                             /* บังคับบรรทัดเดียว */
          font-size: 9.5px;                                /* ย่อลงเล็กน้อยให้ fit */
        }
        .sign-col.right {
          flex: 1.5;                                       /* ขยายให้ใหญ่ขึ้น (ชดเชย mid ที่เล็กลง) */
          margin-left: 2mm;
          position: relative;
        }
        .stamp-overlay {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(calc(-50% + 10mm), calc(-50% + 5mm));
          width: 19mm;
          height: 19mm;
          object-fit: contain;
          opacity: 0.78;
          z-index: 2;
          pointer-events: none;
        }
        .sign-line.center { position: relative; }
        .signature-img {
          position: absolute;
          left: 50%;
          bottom: -2mm;
          transform: translateX(-50%);
          height: 14mm;
          object-fit: contain;
          z-index: 3;
          pointer-events: none;
        }
        .sign-col.right .sign-title {
          text-align: center;
          font-weight: 700;
          font-size: 12px;
          margin-bottom: 2mm;
        }
        .sign-title { font-weight: 600; margin-bottom: 1mm; }
        .sign-title-en { font-size: 9px; color: #444; margin-bottom: 1mm; }
        .sign-line { display: flex; align-items: baseline; gap: 1.5mm; margin-top: 1.5mm; }
        .sign-line.center { justify-content: center; margin-top: 20mm; }
        .sign-stack { margin-top: 1.5mm; line-height: 1.2; }
        .sign-stack .lbl-line { font-style: italic; font-size: 10px; }
        .sign-stack .sign-row {
          display: flex; align-items: baseline; gap: 1.5mm;
          margin-top: 0.3mm;
        }
        .sign-stack.flex-1 { flex: 1; }
        .pay-stack-row {
          display: flex; gap: 3mm; align-items: flex-start;
          margin-top: 1.5mm;
        }
        .lbl-line { font-style: italic; }
        .lbl-en { font-size: 8.5px; font-style: italic; color: #444; }
        .dots { flex: 1; border-bottom: 1px dotted #000; min-width: 30mm; }
        .dots-filled {
          text-align: center;
          font-size: 10px;
          font-weight: 600;
          font-style: normal;
          color: #000;
          padding: 0 1mm 0.3mm;
        }
        .dots-sm { flex: 1; border-bottom: 1px dotted #000; min-width: 20mm; }
        /* aligned grid: ชำระโดย | เงินสด | เช็ค | เงินโอน */
        .pay-row, .pay-row-en {
          display: grid;
          grid-template-columns: 12mm 12mm 10mm 14mm;
          align-items: baseline;
        }
        .pay-row span, .pay-row-en span { white-space: nowrap; }
        .pay-row-en {
          font-size: 8.5px; color: #555; margin-bottom: 2mm;
        }
        .pay-row-en span:first-child,
        .pay-row span:first-child { padding-left: 0; }
        .pay-row-en span,
        .pay-row span:not(:first-child) { padding-left: 2mm; }   /* tighter under checkbox */
        .ck {
          white-space: nowrap;
          display: inline-flex; align-items: center; gap: 1.2mm;
        }
        .cbx {
          display: inline-block;
          width: 3.5mm; height: 3.5mm;
          border: 1px solid #000;
          border-radius: 1px;
          flex-shrink: 0;
        }
        .pay-line { display: flex; align-items: baseline; gap: 1.5mm; }
        .flex-grow { flex: 1; }
        .sign-company { font-weight: 700; text-align: center; margin-top: 1mm; }
        .sign-company-en { font-size: 9px; text-align: center; color: #333; }
        .sign-end { text-align: center; margin-top: 1mm; font-style: italic; font-size: 9.5px; }

        @media print {
          body { background: #fff; }
          .invoice-page { margin: 0; box-shadow: none; padding: 8mm 10mm; }
          @page { size: A4; margin: 0; }
        }
      `}</style>
    </>
  );
}
