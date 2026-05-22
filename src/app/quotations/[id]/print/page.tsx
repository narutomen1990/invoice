import { notFound } from "next/navigation";
import { promises as fs } from "node:fs";
import path from "node:path";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { companies } from "@/db/schema";
import { formatMoney, bahtText } from "@/lib/thai/number";
import { formatThaiDateShort } from "@/lib/thai/date";
import { PrintActions } from "./print-actions";

export const dynamic = "force-dynamic";

// 12 keeps the items table substantial while leaving A4 headroom, so a wrapped
// line or renderer drift never spills to a 2nd page (was 14 — overflowed).
const TARGET_ROWS = 12;

type QuotationLegacyData = {
  quotationTerms?: {
    validityDays?: number;
    deliveryDays?: number;
    warrantyMonths?: number;
    agingDays?: number;
    customerEmail?: string | null;
  };
};

function branchLabel(code: string | null): string {
  if (!code) return "";
  const c = code.trim();
  if (!c || c === "00000") return "สำนักงานใหญ่";
  const n = parseInt(c, 10);
  if (n === 0) return "สำนักงานใหญ่";
  if (Number.isNaN(n)) return c;
  return `สาขา ${n}`;
}

async function loadQuotation(id: number) {
  const docRaw = await db.execute<any>(sql`
    SELECT * FROM documents
     WHERE id = ${id} AND document_type = 'quotation'
     LIMIT 1
  `);
  const d = docRaw[0];
  if (!d) return null;

  const itemsRaw = await db.execute<any>(sql`
    SELECT line_no, product_code_snapshot, description, quantity::text, unit,
           unit_price::text, amount::text
      FROM document_items
     WHERE document_id = ${id}
     ORDER BY line_no
  `);

  return { doc: d, items: itemsRaw };
}

export default async function QuotationPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const isCopy = sp.copy === "1";
  const numId = parseInt(id, 10);
  if (Number.isNaN(numId)) notFound();
  const data = await loadQuotation(numId);
  if (!data) notFound();
  const { doc, items } = data;

  const [company] = await db.select().from(companies).limit(1);
  if (!company) notFound();

  const blankRows = Math.max(0, TARGET_ROWS - items.length);
  const total = Number(doc.total ?? 0);
  const alphaText = (doc.total_in_words_th as string | null)?.trim() || bahtText(total);

  const legacy = (doc.legacy_data as QuotationLegacyData | null) ?? {};
  const terms = legacy.quotationTerms ?? {};

  let logoDataUrl: string | null = null;
  if (company.logoPath) {
    try {
      const lp = company.logoPath.startsWith("/")
        ? path.join(process.cwd(), "public", company.logoPath)
        : company.logoPath;
      const buf = await fs.readFile(lp);
      const ext = path.extname(lp).slice(1).toLowerCase();
      const mime = ext === "png" ? "image/png" : ext === "gif" ? "image/gif" : "image/jpeg";
      logoDataUrl = `data:${mime};base64,${buf.toString("base64")}`;
    } catch {
      logoDataUrl = null;
    }
  }

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
      <PrintActions docNo={doc.doc_no} />
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
          <div className="title-th">
            {isCopy ? "สำเนาใบเสนอราคา" : "ใบเสนอราคา"}
          </div>
          <div className="title-en">QUOTATION</div>
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
            <span>สาขา / Branch :</span>
            <span className="val">{branchLabel(company.branchCode)}</span>
          </div>
          <div className="tax-cell right">
            <span className="ital">อัตราภาษีร้อยละ /TAX RATE</span>
            <span className="val rate">{Number(doc.vat_rate ?? 0)}</span>
          </div>
        </div>

        {/* BODY: Customer (left) + Doc info (right) */}
        <div className="body">
          <div className="customer-box">
            <div className="cust-top-row">
              <span className="cust-lbl-tight">
                <span className="lbl-th">รหัส</span>
                <span className="lbl-en">CODE</span>
              </span>
              <span className="cust-val-tight mono">{doc.customer_code_snapshot ?? "-"}</span>
            </div>

            <div className="cust-tax-row">
              <span className="cust-lbl-mid">เลขประจำตัวผู้เสียภาษีผู้ซื้อ :</span>
              <span className="cust-val-tight">{doc.customer_tax_id_snapshot ?? "-"}</span>
              <span className="cust-lbl-mid">สาขาที่ :</span>
              <span className="cust-val-tight">{branchLabel(doc.customer_branch_snapshot)}</span>
            </div>

            <table className="customer">
              <tbody>
                <tr>
                  <td className="lbl">
                    <div>เรียน / นามผู้ซื้อ</div>
                    <div className="lbl-en">TO</div>
                  </td>
                  <td className="val bold">
                    {doc.customer_name_snapshot ?? "-"}
                  </td>
                </tr>
                <tr>
                  <td className="lbl">
                    <div>ที่อยู่</div>
                    <div className="lbl-en">ADDRESS</div>
                  </td>
                  <td className="val">
                    {(doc.customer_address_snapshot as string | null)?.replace(/\n/g, " ") ?? "-"}
                  </td>
                </tr>
                <tr>
                  <td className="lbl">
                    <div>โทรศัพท์</div>
                    <div className="lbl-en">TEL</div>
                  </td>
                  <td className="val">
                    {doc.customer_tel_snapshot ?? "-"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="doc-info">
            <div className="doc-grid">
              <div className="doc-cell">
                <div className="doc-lbl">วันที่ / Date</div>
                <div className="doc-val">{formatThaiDateShort(doc.doc_date)}</div>
              </div>
              <div className="doc-cell">
                <div className="doc-lbl">เลขที่ใบเสนอราคา / Quotation No.</div>
                <div className="doc-val mono bold">{doc.doc_no}</div>
              </div>
              <div className="doc-cell">
                <div className="doc-lbl">ใบสั่งซื้อเลขที่ / P.O. No.</div>
                <div className="doc-val">{doc.reference_quotation_no ?? " "}</div>
              </div>
              <div className="doc-cell">
                <div className="doc-lbl">เสนอราคาโดย / Prepared By</div>
                <div className="doc-val">{doc.saleman_name ?? " "}</div>
              </div>
              <div className="doc-cell">
                <div className="doc-lbl">ขนส่งโดย / Transfer By</div>
                <div className="doc-val">{doc.shipping_method ?? " "}</div>
              </div>
              <div className="doc-cell">
                <div className="doc-lbl">วันครบกำหนดชำระ / Due Date</div>
                <div className="doc-val">
                  {doc.due_date ? formatThaiDateShort(doc.due_date) : " "}
                </div>
              </div>
              <div className="doc-cell doc-cell-full">
                <div className="doc-lbl">อ้างอิง / REFERENCE</div>
                <div className="doc-val">{doc.memo ?? " "}</div>
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
            {items.map((it: any) => {
              const qty = Number(it.quantity);
              const price = Number(it.unit_price);
              const amt = Number(it.amount);
              return (
                <tr key={it.line_no}>
                  <td className="ctr">{it.line_no}</td>
                  <td>{it.description ?? ""}</td>
                  <td className="ctr">
                    {qty ? formatMoney(qty, qty % 1 === 0 ? 0 : 2) : ""}
                  </td>
                  <td className="rt">{price ? formatMoney(price) : ""}</td>
                  <td className="rt">{amt ? formatMoney(amt) : ""}</td>
                </tr>
              );
            })}
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

        {/* FOOTER: Quotation terms (left) | Totals (right) */}
        <div className="footer-row">
          <div className="notes-stack">
            <div className="words-block">
              <div className="words-row">
                <div className="words-lbl-stack">
                  <div className="words-lbl">ตัวอักษร(บาท)</div>
                  <div className="words-lbl-en">ALPHA (BAHT)</div>
                </div>
                <div className="words-text">({alphaText})</div>
              </div>
            </div>
            <div className="notes">
            <div className="terms-title">ข้อกำหนดใบเสนอราคา</div>
            <div className="terms-grid">
              <div>
                <span className="terms-lbl">กำหนดยืนราคา / Validity</span>
                <span className="terms-val">
                  {Number(terms.validityDays ?? 30)} วัน / Days
                </span>
              </div>
              <div>
                <span className="terms-lbl">กำหนดส่งมอบ / Delivery</span>
                <span className="terms-val">
                  {Number(terms.deliveryDays ?? 0)} วัน / Days
                </span>
              </div>
              <div>
                <span className="terms-lbl">การรับประกัน / Warranty</span>
                <span className="terms-val">
                  {Number(terms.warrantyMonths ?? 0)} เดือน / Months
                </span>
              </div>
              <div>
                <span className="terms-lbl">เครดิต / Credit Term</span>
                <span className="terms-val">
                  {Number(doc.payment_terms_days ?? 0)} วัน / Days
                </span>
              </div>
            </div>
            {doc.remark1 && (
              <div className="remark">หมายเหตุ : {doc.remark1}</div>
            )}
            </div>
          </div>
          <div className="totals">
            <div className="totals-row">
              <div className="totals-lbl">
                <div className="lbl-en bold">AMOUNT</div>
                <div>รวมมูลค่า</div>
              </div>
              <div className="totals-val">{formatMoney(Number(doc.amount_before_vat ?? 0))}</div>
            </div>
            <div className="totals-row">
              <div className="totals-lbl">
                <div className="lbl-en bold">VAT</div>
                <div>ภาษีมูลค่าเพิ่ม {Number(doc.vat_rate ?? 0)}%</div>
              </div>
              <div className="totals-val">{formatMoney(Number(doc.vat_amount ?? 0))}</div>
            </div>
            <div className="totals-row totals-row-grow">
              <div className="totals-lbl">
                <div className="lbl-en bold">TOTAL</div>
                <div>รวมทั้งสิ้น</div>
              </div>
              <div className="totals-val total-val">{formatMoney(total)}</div>
            </div>
          </div>
        </div>

        {/* SIGNATURES */}
        <div className="sign-block">
          <div className="sign-col left">
            <div className="sign-title">หมายเหตุ / Remarks</div>
            <div className="sign-note">
              ใบเสนอราคานี้มีผลตามวันที่ระบุข้างต้น ราคาที่เสนออาจเปลี่ยนแปลงได้
              เมื่อพ้นกำหนดเวลายืนราคา
            </div>
            <div className="sign-line">
              <span className="lbl-line">ผู้รับใบเสนอราคา</span>
              <span className="dots"></span>
            </div>
            <div className="sign-line">
              <span className="lbl-line">วันที่ / Date</span>
              <span className="dots"></span>
            </div>
          </div>

          <div className="sign-col mid">
            <div className="sign-title center">ผู้อนุมัติ / Approved By</div>
            <div className="sign-line center tall">
              <span className="dots"></span>
            </div>
            <div className="sign-end">
              <div>(.....................................................)</div>
              <div className="ital">วันที่ / Date</div>
            </div>
          </div>

          <div className="sign-col right">
            <div className="sign-title">ในนาม / For</div>
            <div className="sign-company">{company.nameTh}</div>
            <div className="sign-company-en ital">{company.nameEn ?? ""}</div>
            <div className="sign-line center tall">
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

        .title-block { text-align: center; margin: 2mm 0 1mm; }
        .title-th { font-size: 20px; font-weight: 700; font-style: italic; color: #b45309; }
        .copy-watermark {
          position: absolute; top: 50%; left: 50%;
          transform: translate(-50%, -50%) rotate(-30deg);
          font-size: 110px; font-weight: 900; font-style: italic;
          color: rgba(220, 38, 38, 0.18);
          letter-spacing: 6px;
          pointer-events: none; z-index: 0; white-space: nowrap;
        }
        .invoice-page { position: relative; }
        .title-en { font-size: 16px; font-weight: 700; font-style: italic; letter-spacing: 2px; color: #b45309; }

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

        .cust-top-row {
          display: flex; align-items: baseline; gap: 2mm;
          padding: 1mm 0; font-size: 10px;
        }
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
        .doc-cell:nth-child(2n) { border-right: 0; }
        .doc-cell-full {
          grid-column: 1 / -1;
          border-right: 0; border-bottom: 0;
        }
        .doc-lbl { font-style: italic; color: #444; font-size: 9px; line-height: 1.1; }
        .doc-lbl .lbl-en { font-size: 8.5px; }
        .doc-val { font-weight: 600; text-align: center; margin-top: 0.5mm; min-height: 4mm; }
        .doc-val.mono { font-family: "Sarabun", monospace; }
        .doc-val.bold { font-weight: 700; font-size: 11px; }

        .items-wrap {
          border: 1px solid #000;
          border-bottom: 0;
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
          background: #fef3c7; font-weight: 700; text-align: center;
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

        .footer-row { display: flex; gap: 0; margin-top: 0; align-items: stretch; }
        .notes-stack {
          flex: 1; display: flex; flex-direction: column; gap: 2mm;
          margin-right: -1px;
        }
        .words-block {
          padding: 2mm 3mm;
          border: 1px solid #000; border-radius: 6px;
          font-size: 11px; font-style: italic;
          border-top-left-radius: 0;
        }
        .notes {
          flex: 1; padding: 2mm 3mm; font-size: 9.5px; line-height: 1.5;
          border: 1px solid #000; border-radius: 6px;
          display: flex; flex-direction: column;
          border-bottom-right-radius: 0;
        }
        .terms-title { font-weight: 700; font-size: 11px; margin-bottom: 1mm; color: #b45309; }
        .terms-grid {
          display: grid; grid-template-columns: 1fr 1fr;
          gap: 1mm 4mm; margin-bottom: 1.5mm;
        }
        .terms-grid > div {
          display: flex; justify-content: space-between; gap: 2mm;
          border-bottom: 1px dotted #999; padding-bottom: 0.5mm;
        }
        .terms-lbl { font-style: italic; color: #333; }
        .terms-val { font-weight: 700; }
        .remark { font-size: 9px; color: #555; margin-bottom: 1mm; }
        .words-row { display: flex; align-items: center; gap: 3mm; }
        .words-lbl-stack { display: flex; flex-direction: column; line-height: 1.1; flex-shrink: 0; }
        .words-lbl { font-weight: 700; font-style: normal; font-size: 11px; }
        .words-lbl-en { font-weight: 600; font-style: italic; font-size: 9px; color: #555; }
        .words-text { line-height: 1.4; font-weight: 700; font-size: 13px; flex: 1; }
        .totals {
          width: 70mm; font-size: 11px;
          border: 1px solid #000; border-bottom: 0; border-left: 0;
          border-top-left-radius: 0; border-top-right-radius: 0;
          border-bottom-left-radius: 6px; border-bottom-right-radius: 6px;
          overflow: hidden;
          display: flex; flex-direction: column;
        }
        .footer-row .totals {
          align-self: stretch;
          border-bottom-left-radius: 0;
        }
        .totals-row {
          display: flex;
          flex: 1 1 0;
        }
        .totals-row-grow { flex: 1 1 0; }
        .totals-lbl {
          width: 30mm; padding: 1.5mm 2mm;
          display: flex; flex-direction: column; justify-content: center; align-items: flex-end;
          text-align: right;
        }
        .totals-lbl .lbl-en { font-style: italic; font-size: 11px; }
        .totals-val {
          flex: 1; padding: 1.5mm 2mm;
          text-align: right; font-style: italic; font-variant-numeric: tabular-nums; font-weight: 600;
          display: flex; align-items: center; justify-content: flex-end;
          border-left: 1px solid #000;
          border-bottom: 1px solid #000;
        }
        .totals-row:last-child .totals-val { border-bottom: 1px solid #000; }
        .totals-val.total-val { font-weight: 700; font-size: 13px; background: #fef3c7; }

        .sign-block {
          display: flex; gap: 2mm;
          margin-top: 2mm;
        }
        .sign-col {
          padding: 2.5mm 3mm; font-size: 10px;
          border: 1px solid #000; border-radius: 6px;
          display: flex; flex-direction: column;
          flex: 1;
        }
        .sign-title { font-weight: 700; margin-bottom: 1mm; }
        .sign-title.center { text-align: center; }
        .sign-note { font-size: 9px; color: #555; margin-bottom: 2mm; line-height: 1.4; }
        .sign-line { display: flex; align-items: baseline; gap: 1.5mm; margin-top: 1.5mm; }
        .sign-line.center { justify-content: center; }
        .sign-line.tall { margin-top: 14mm; }
        .lbl-line { font-style: italic; }
        .lbl-en { font-size: 8.5px; font-style: italic; color: #444; }
        .dots { flex: 1; border-bottom: 1px dotted #000; min-width: 30mm; }
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
