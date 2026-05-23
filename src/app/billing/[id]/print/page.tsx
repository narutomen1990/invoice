import { notFound } from "next/navigation";
import { promises as fs } from "node:fs";
import path from "node:path";
import { getInvoiceById } from "@/lib/queries/invoices";
import { db } from "@/db/client";
import { companies } from "@/db/schema";
import { formatMoney, bahtText } from "@/lib/thai/number";
import { formatThaiDateShort } from "@/lib/thai/date";
import { PrintActions } from "@/app/invoices/[id]/print/print-actions";

export const dynamic = "force-dynamic";

// 12 keeps the items table substantial while leaving A4 headroom, so a wrapped
// line or renderer drift never spills to a 2nd page (was 14 — only ~5 mm spare).
const TARGET_ROWS = 12;

function branchLabel(code: string | null): string {
  if (!code) return "";
  const c = code.trim();
  if (!c || c === "00000") return "สำนักงานใหญ่";
  const n = parseInt(c, 10);
  if (n === 0) return "สำนักงานใหญ่";
  if (Number.isNaN(n)) return c;
  return `สาขา ${n}`;
}

export default async function PrintBillingPage({
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
  const data = await getInvoiceById(numId);
  if (!data) notFound();
  const { doc, items } = data;

  const [company] = await db.select().from(companies).limit(1);
  if (!company) notFound();

  const blankRows = Math.max(0, TARGET_ROWS - items.length);
  const alphaText = doc.totalInWordsTh?.trim() || bahtText(doc.total);

  let logoDataUrl: string | null = null;
  if (company.logoPath) {
    try {
      const lp = company.logoPath.startsWith("/")
        ? path.join(process.cwd(), "public", company.logoPath)
        : company.logoPath;
      const buf = await fs.readFile(lp);
      const ext = path.extname(lp).slice(1).toLowerCase();
      const mime =
        ext === "png" ? "image/png" : ext === "gif" ? "image/gif" : "image/jpeg";
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
  ]
    .filter(Boolean)
    .join(" ");

  const addrEnParts = [
    company.buildingEn,
    company.mooEn,
    company.soiEn,
    company.roadEn,
    company.subDistrictEn,
    company.districtEn,
    company.provinceEn,
    company.postcode,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <PrintActions docNo={doc.docNo} />
      <div className="bill-page">
        {/* TOP: logo + company */}
        <div className="top">
          <div className="logo-box">
            {logoDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoDataUrl} alt="logo" className="logo-img" />
            ) : (
              <div className="logo-placeholder">TAX</div>
            )}
          </div>
          <div className="company-info">
            <div className="company-th">{company.nameTh}</div>
            {company.nameEn && <div className="company-en">{company.nameEn}</div>}
            {addrThParts && <div className="company-addr">{addrThParts}</div>}
            {addrEnParts && (
              <div className="company-addr-en">{addrEnParts}</div>
            )}
            <div className="company-contact">
              {company.tel && (
                <span>โทรศัพท์ / Telephone : {company.tel}</span>
              )}
              {company.fax && <span>FAX : {company.fax}</span>}
              {company.website && <span>Website : {company.website}</span>}
              {company.email && <span>email : {company.email}</span>}
            </div>
            <div className="company-tax-line">
              <span>เลขประจำตัวผู้เสียภาษี/Tax ID.</span>
              <span className="bold">{company.taxId ?? "-"}</span>
              <span>สาขาที่ออกใบกำกับภาษี/Branch :</span>
              <span className="bold">{branchLabel(company.branchCode)}</span>
            </div>
          </div>
        </div>

        {/* TITLE */}
        <div className="title-block">
          <div className="title-th">ใบแจ้งหนี้ / INVOICE</div>
        </div>

        {/* TAX RATE row */}
        <div className="tax-rate-row">
          <span className="ital">อัตราภาษีร้อยละ /TAX RATE</span>
          <span className="rate-num">{Number(doc.vatRate)}</span>
        </div>

        {/* BODY: customer + doc-info */}
        <div className="body">
          <div className="customer-box">
            <div className="cust-row code-row">
              <span className="cust-lbl-tight">
                <span className="lbl-th">รหัส</span>
                <span className="lbl-en">CODE</span>
              </span>
              <span className="cust-val-tight mono">
                {doc.customerCode ?? "-"}
              </span>
              <span className="cust-lbl-mid">เลขประจำตัวผู้เสียภาษีผู้ซื้อ :</span>
              <span className="cust-val-tight">
                {doc.customerTaxId ?? "-"}
              </span>
              <span className="cust-lbl-mid">สาขาที่ :</span>
              <span className="cust-val-tight">
                {branchLabel(doc.customerBranch)}
              </span>
            </div>

            <table className="customer">
              <tbody>
                <tr>
                  <td className="lbl">
                    <div>นามผู้ซื้อ</div>
                    <div className="lbl-en">SOLD TO</div>
                  </td>
                  <td className="val bold">{doc.customerName ?? "-"}</td>
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
                {doc.customerTel && (
                  <tr>
                    <td className="lbl">
                      <div className="lbl-en">โทรศัพท์ :</div>
                    </td>
                    <td className="val bold">{doc.customerTel}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="doc-info">
            <div className="doc-grid">
              <div className="doc-cell">
                <div className="doc-lbl">วันที่ / Date</div>
                <div className="doc-val">
                  {formatThaiDateShort(doc.docDate)}
                </div>
              </div>
              <div className="doc-cell">
                <div className="doc-lbl">เลขที่ใบแจ้งหนี้ / INVOICE No.</div>
                <div className="doc-val mono bold">{doc.docNo}</div>
              </div>
              <div className="doc-cell doc-cell-full">
                <div className="doc-lbl">ใบสั่งซื้อเลขที่ / Purchase Order</div>
                <div className="doc-val">&nbsp;</div>
              </div>
              <div className="doc-cell doc-cell-full">
                <div className="doc-lbl">ขายโดย / Sale By</div>
                <div className="doc-val">{doc.salemanName ?? " "}</div>
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
                  {doc.dueDate ? formatThaiDateShort(doc.dueDate) : " "}
                </div>
              </div>
              <div className="doc-cell doc-cell-full">
                <div className="doc-lbl">อ้างอิง / REFERENCE</div>
                <div className="doc-val">
                  {doc.referenceQuotationNo ?? " "}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ITEMS */}
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
                  <td className="ctr">
                    {it.quantity
                      ? `${formatMoney(
                          it.quantity,
                          it.quantity % 1 === 0 ? 0 : 2,
                        )}${it.unit ? ` ${it.unit}` : ""}`
                      : ""}
                  </td>
                  <td className="rt">
                    {it.unitPrice ? formatMoney(it.unitPrice) : ""}
                  </td>
                  <td className="rt">
                    {it.amount ? formatMoney(it.amount) : ""}
                  </td>
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

        {/* FOOTER: notes + words (left) | totals (right) */}
        <div className="footer-row">
          <div className="notes">
            <div className="note-line">
              <span className="lbl">หมายเหตุ :</span>
              <span className="val">{doc.remark1 ?? doc.memo ?? " "}</span>
            </div>
            <div className="words-block">
              <div className="words-row">
                <div className="words-lbl-stack">
                  <div className="words-lbl ital">ตัวอักษร</div>
                  <div className="words-lbl">บาท</div>
                </div>
                <div className="words-text">({alphaText})</div>
              </div>
            </div>
          </div>
          <table className="totals">
            <tbody>
              <tr>
                <td className="lbl">
                  <span className="lbl-en bold">AMOUNT</span> รวมมูลค่า
                </td>
                <td className="val">{formatMoney(doc.amountBeforeVat)}</td>
              </tr>
              <tr>
                <td className="lbl">
                  <span className="lbl-en bold">VAT</span> ภาษีมูลค่าเพิ่ม{" "}
                  <span className="bold">{Number(doc.vatRate)}%</span>
                </td>
                <td className="val">{formatMoney(doc.vatAmount)}</td>
              </tr>
              <tr>
                <td className="lbl">
                  <span className="lbl-en bold">TOTAL</span> รวมทั้งสิ้น
                </td>
                <td className="val total-val">{formatMoney(doc.total)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* SIGNATURES (3 columns: receive | payment | for) */}
        <div className="sign-block">
          <div className="sign-col left">
            <div className="sign-title">
              ได้รับสินค้าแล้วในสภาพที่เรียบร้อยและถูกต้อง
            </div>
            <div className="sign-title-en ital">
              Goods Received In Good Order And Condition
            </div>
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
          </div>

          <div className="sign-col mid">
            <div className="pay-en ital">
              PAYMENT BY CHEQUE IN FAVOUR OF
            </div>
            <div className="pay-company-en bold ital">
              {company.nameEn ?? ""}
            </div>
            <div className="pay-en ital">
              AND ACROSS &quot; A/C PAYEE ONLY &quot;
            </div>
            <div className="pay-th-spacer"></div>
            <div className="pay-th">กรุณาสั่งจ่ายในนาม</div>
            <div className="pay-company-th bold">{company.nameTh}</div>
            <div className="pay-th">ขีดคร่อม A/C PAYEE ONLY</div>
          </div>

          <div className="sign-col right">
            <div className="sign-title">ในนาม / For</div>
            <div className="sign-company">{company.nameTh}</div>
            <div className="sign-company-en ital">{company.nameEn ?? ""}</div>
            <div className="sign-line center">
              <span className="dots"></span>
            </div>
            <div className="sign-end">
              <div>ผู้มีอำนาจลงนาม</div>
              <div className="ital">Authorized Signature</div>
            </div>
          </div>
        </div>

        {isCopy && <div className="copy-watermark">COPY</div>}
      </div>

      <style>{`
        :root { color-scheme: light; }
        body { margin: 0; background: #e5e5e5; }
        .bill-page {
          position: relative;
          width: 210mm;
          height: 297mm;
          margin: 1rem auto;
          padding: 8mm 8mm;
          background: #fff;
          color: #000;
          font-family: "Sarabun", "Noto Sans Thai", sans-serif;
          font-size: 11px;
          line-height: 1.3;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
        }
        .items-wrap { flex: 1 1 auto; display: flex; flex-direction: column; }
        .items-wrap .items { flex: 1 1 auto; }
        .items tbody { vertical-align: top; }

        /* TOP */
        .top { display: flex; gap: 6mm; align-items: flex-start; padding-bottom: 3mm; border-bottom: 1px solid #000; }
        .logo-box { width: 28mm; height: 24mm; display: flex; align-items: center; justify-content: center; overflow: hidden; }
        .logo-img { max-width: 100%; max-height: 100%; object-fit: contain; }
        .logo-placeholder { font-size: 22px; font-weight: 800; color: #c00; letter-spacing: 1px; border: 2px solid #c00; padding: 2mm 4mm; }
        .company-info { flex: 1; }
        .company-th { font-size: 16px; font-weight: 700; }
        .company-en { font-size: 13px; font-style: italic; font-weight: 600; margin-bottom: 2px; }
        .company-addr { font-size: 10px; }
        .company-addr-en { font-size: 9.5px; font-style: italic; color: #444; }
        .company-contact { font-size: 9px; margin-top: 1mm; display: flex; gap: 3mm; flex-wrap: wrap; }
        .company-tax-line { font-size: 10px; margin-top: 1mm; display: flex; gap: 3mm; flex-wrap: wrap; align-items: baseline; }
        .company-tax-line .bold { font-weight: 700; font-style: italic; }

        /* TITLE */
        .title-block { text-align: center; margin: 3mm 0 1mm; }
        .title-th { font-size: 22px; font-weight: 700; }

        /* TAX RATE row */
        .tax-rate-row { display: flex; justify-content: flex-end; align-items: baseline; gap: 2mm; padding: 1mm 0 2mm; font-size: 11px; }
        .tax-rate-row .ital { font-style: italic; }
        .tax-rate-row .rate-num { font-weight: 700; padding: 0 4mm; font-size: 13px; }
        .ital { font-style: italic; }

        /* BODY */
        .body { display: flex; gap: 2mm; margin-bottom: 0; }
        .customer-box { flex: 1.4; padding: 2mm 3mm; border: 1px solid #000; border-top-left-radius: 6px; border-top-right-radius: 6px; border-bottom: 0; }
        .doc-info { flex: 1; padding: 0; border: 1px solid #000; border-top-left-radius: 6px; border-top-right-radius: 6px; border-bottom: 0; overflow: hidden; display: flex; flex-direction: column; }
        .cust-row { display: flex; flex-wrap: wrap; align-items: baseline; gap: 2mm 4mm; padding: 1mm 0; font-size: 10px; }
        .cust-lbl-tight { display: inline-flex; align-items: baseline; gap: 1mm; font-style: italic; color: #333; }
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

        .doc-grid { display: grid; grid-template-columns: 1fr 1fr; font-size: 10px; height: 100%; }
        .doc-cell { padding: 1mm 3mm 1.5mm; border-bottom: 1px solid #000; border-right: 1px solid #000; }
        .doc-cell:nth-child(2n) { border-right: 0; }
        .doc-cell-full { grid-column: 1 / -1; border-right: 0; }
        .doc-grid .doc-cell:last-child { border-bottom: 0; }
        .doc-lbl { font-style: italic; color: #444; font-size: 9px; line-height: 1.1; }
        .doc-lbl .lbl-en { font-size: 8.5px; }
        .doc-val { font-weight: 600; text-align: center; margin-top: 0.5mm; min-height: 4mm; }
        .doc-val.mono { font-family: "Sarabun", monospace; }
        .doc-val.bold { font-weight: 700; font-size: 11px; }
        .lbl-en { font-size: 8.5px; font-style: italic; color: #444; }

        /* ITEMS */
        .items-wrap { border: 1px solid #000; border-bottom: 0; overflow: hidden; }
        .items { width: 100%; border-collapse: collapse; font-size: 11px; }
        .items th, .items td { border-right: 1px solid #000; padding: 1.5mm 2mm; }
        .items th:last-child, .items td:last-child { border-right: 0; }
        .items thead th { background: #f3f4f6; font-weight: 700; text-align: center; padding: 2mm 1mm; border-bottom: 1px solid #000; }
        .items thead th .ital { font-style: italic; font-size: 11px; }
        .items thead th .ital-en { font-style: italic; font-size: 9px; color: #444; }
        .items .col-no { width: 14mm; text-align: center; }
        .items .col-qty { width: 24mm; }
        .items .col-price { width: 28mm; }
        .items .col-amt { width: 28mm; }
        .items td.ctr { text-align: center; font-style: italic; }
        .items td.rt { text-align: right; font-style: italic; font-variant-numeric: tabular-nums; }
        .items tr.blank td { height: 6.5mm; }

        /* FOOTER */
        .footer-row { display: flex; gap: 0; align-items: stretch; }
        .notes {
          flex: 1; padding: 2mm 3mm; font-size: 10px;
          border: 1px solid #000;
          margin-right: -1px;
          display: flex; flex-direction: column;
          border-top-left-radius: 0; border-top-right-radius: 0;
          border-bottom-right-radius: 0;
        }
        .note-line { display: flex; gap: 3mm; align-items: baseline; }
        .note-line .lbl { font-style: italic; }
        .note-line .val { flex: 1; min-height: 4mm; }
        .words-block { margin-top: auto; padding-top: 3mm; border-top: 1px solid #000;
          margin-left: -3mm; margin-right: -3mm; padding-left: 3mm; padding-right: 3mm; }
        .words-row { display: flex; align-items: baseline; gap: 3mm; }
        .words-lbl-stack { display: flex; flex-direction: column; line-height: 1.1; flex-shrink: 0; }
        .words-lbl { font-weight: 700; font-size: 11px; }
        .words-lbl.ital { font-style: italic; font-weight: 400; font-size: 10px; color: #555; }
        .words-text { line-height: 1.4; font-weight: 700; font-size: 12px; flex: 1; }

        .totals {
          width: 70mm; border-collapse: separate; border-spacing: 0; font-size: 11px;
          border: 1px solid #000;
          align-self: flex-start;
          border-top-left-radius: 0; border-top-right-radius: 0;
        }
        .totals td { padding: 1.5mm 2mm; vertical-align: middle; border-bottom: 1px solid #000; }
        .totals tr:last-child td { border-bottom: 0; }
        .totals td.lbl { width: 30mm; border-right: 1px solid #000; }
        .totals td.lbl .lbl-en { font-style: italic; font-size: 11px; }
        .totals td.val { text-align: right; font-style: italic; font-variant-numeric: tabular-nums; font-weight: 600; }
        .totals td.total-val { font-weight: 700; font-size: 13px; }

        /* SIGNATURES */
        .sign-block { display: flex; gap: 0; margin-top: 2mm; }
        .sign-col {
          padding: 2.5mm 3mm; font-size: 10px;
          border: 1px solid #000; border-radius: 6px;
          display: flex; flex-direction: column;
        }
        .sign-col.left {
          flex: 1.30; justify-content: space-between;
          margin-right: -1px;
          border-top-right-radius: 0; border-bottom-right-radius: 0;
        }
        .sign-col.mid {
          flex: 1.10; font-size: 9.5px; line-height: 1.5;
          border-top-left-radius: 0; border-bottom-left-radius: 0;
        }
        .sign-col.right { flex: 1.2; margin-left: 2mm; }
        .sign-col.right .sign-title { text-align: center; font-weight: 700; font-size: 12px; margin-bottom: 2mm; }
        .sign-col.left .sign-title { white-space: nowrap; font-size: 9.5px; }
        .sign-title { font-weight: 600; margin-bottom: 1mm; }
        .sign-title-en { font-size: 9px; color: #444; margin-bottom: 1mm; }
        .sign-line { display: flex; align-items: baseline; gap: 1.5mm; margin-top: 1.5mm; }
        .sign-line.center { justify-content: center; margin-top: 18mm; }
        .sign-stack { margin-top: 1mm; line-height: 1.2; }
        .sign-stack .lbl-line { font-style: italic; font-size: 10px; }
        .sign-stack .sign-row { display: flex; align-items: baseline; gap: 1.5mm; margin-top: 0.3mm; }
        .lbl-line { font-style: italic; }
        .dots { flex: 1; border-bottom: 1px dotted #000; min-width: 30mm; }
        .sign-company { font-weight: 700; text-align: center; margin-top: 1mm; }
        .sign-company-en { font-size: 9px; text-align: center; color: #333; }
        .sign-end { text-align: center; margin-top: 1mm; font-style: italic; font-size: 9.5px; }

        /* mid (payment block) */
        .pay-en { font-style: italic; font-size: 9px; color: #333; }
        .pay-company-en { font-style: italic; font-size: 10px; }
        .pay-th { font-size: 10px; }
        .pay-company-th { font-size: 10.5px; font-weight: 700; }
        .pay-th-spacer { height: 2mm; }
        .bold { font-weight: 700; }

        /* COPY watermark */
        .copy-watermark {
          position: absolute;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%) rotate(-25deg);
          font-size: 110px;
          font-weight: 900;
          color: rgba(220, 38, 38, 0.18);
          pointer-events: none;
          letter-spacing: 8px;
          z-index: 1;
        }

        @media print {
          body { background: #fff; }
          .bill-page { margin: 0; box-shadow: none; padding: 8mm 10mm; }
          @page { size: A4; margin: 0; }
        }
      `}</style>
    </>
  );
}
