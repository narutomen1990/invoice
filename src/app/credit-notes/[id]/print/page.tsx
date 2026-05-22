import { notFound } from "next/navigation";
import { promises as fs } from "node:fs";
import path from "node:path";
import { getInvoiceById } from "@/lib/queries/invoices";
import { db } from "@/db/client";
import { companies, documents } from "@/db/schema";
import { eq } from "drizzle-orm";
import { formatMoney, bahtText } from "@/lib/thai/number";
import { formatThaiDateShort } from "@/lib/thai/date";
import { PrintActions } from "@/app/invoices/[id]/print/print-actions";

export const dynamic = "force-dynamic";

// 12 keeps the items table substantial while leaving A4 headroom, so a wrapped
// line or renderer drift never spills to a 2nd page (was 14 — only ~4 mm spare).
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

type CreditNoteMeta = {
  originalAmount?: number;
  correctAmount?: number;
  referenceInvoiceNo?: string | null;
  referenceInvoiceDate?: string | null;
  reason?: string;
};

export default async function PrintCreditNotePage({
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

  // pull legacyData for CN-specific meta
  const [docRow] = await db
    .select({ legacyData: documents.legacyData })
    .from(documents)
    .where(eq(documents.id, numId))
    .limit(1);
  const meta: CreditNoteMeta =
    (docRow?.legacyData as any)?.creditNote ?? {};

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
      <div className="cn-page">
        {/* TOP: Logo + company */}
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
            {company.nameEn && (
              <div className="company-en">{company.nameEn}</div>
            )}
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
          </div>
        </div>

        {/* TITLE */}
        <div className="title-block">
          <div className="title-th">ใบลดหนี้ / Credit Note</div>
        </div>

        {/* TAX INFO */}
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

        {/* BODY */}
        <div className="body">
          <div className="customer-box">
            <div className="cust-top-row">
              <span className="cust-lbl-tight">
                <span className="lbl-th">รหัส</span>
                <span className="lbl-en">CODE</span>
              </span>
              <span className="cust-val-tight mono">
                {doc.customerCode ?? "-"}
              </span>
              <span className="cust-lbl-mid" style={{ marginLeft: "8mm" }}>
                เลขประจำตัวผู้เสียภาษีผู้ซื้อ :
              </span>
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
                <div className="doc-lbl">เลขที่ใบกำกับภาษี / Tax Invoice</div>
                <div className="doc-val mono bold">{doc.docNo}</div>
              </div>
              <div className="doc-cell doc-cell-full">
                <div className="doc-lbl">
                  อ้างถึงใบกำกับภาษี{" "}
                  <span className="lbl-en">Refer TAX Invoice</span>
                </div>
                <div className="doc-val mono">
                  {meta.referenceInvoiceNo ?? doc.referenceQuotationNo ?? " "}
                </div>
              </div>
              <div className="doc-cell doc-cell-full">
                <div className="doc-lbl">
                  ลงวันที่ <span className="lbl-en">/ Date</span>
                </div>
                <div className="doc-val">
                  {meta.referenceInvoiceDate
                    ? formatThaiDateShort(meta.referenceInvoiceDate)
                    : " "}
                </div>
              </div>
              <div className="doc-cell doc-cell-full">
                <div className="doc-lbl">
                  ออกเอกสารโดย / Prepaired By
                </div>
                <div className="doc-val">{doc.salemanName ?? " "}</div>
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
              {items.map((it) => (
                <tr key={it.lineNo}>
                  <td className="ctr">{it.lineNo}</td>
                  <td>{it.description ?? ""}</td>
                  <td className="ctr">
                    {it.quantity
                      ? formatMoney(
                          it.quantity,
                          it.quantity % 1 === 0 ? 0 : 2,
                        )
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

        {/* CN-SPECIFIC + TOTALS */}
        <div className="cn-detail-row">
          <div className="cn-detail-left">
            <div className="cn-detail-block">
              <div className="cn-row">
                <span className="cn-lbl">อ้างถึงใบกำกับภาษี เลขที่</span>
                <span className="cn-val mono">
                  {meta.referenceInvoiceNo ??
                    doc.referenceQuotationNo ??
                    ""}
                </span>
                <span className="cn-lbl">ลงวันที่</span>
                <span className="cn-val">
                  {meta.referenceInvoiceDate
                    ? formatThaiDateShort(meta.referenceInvoiceDate)
                    : ""}
                </span>
              </div>
            </div>
            <div className="cn-detail-block">
              <div className="cn-reason-row">
                <div className="cn-lbl">เหตุผลในการออกใบลดหนี้</div>
              </div>
              <div className="cn-reason-row">
                <span className="cn-lbl">เนื่องจาก</span>
                <span className="cn-val">{meta.reason ?? doc.remark2 ?? ""}</span>
              </div>
            </div>
            <div className="cn-detail-block notes">
              <span className="cn-lbl">หมายเหตุ :</span>
              <span className="cn-val">{doc.remark1 ?? ""}</span>
            </div>
            <div className="cn-detail-block words-inline">
              <span className="cn-lbl ital">ตัวอักษร</span>
              <span className="cn-lbl">บาท</span>
              <span className="cn-val cn-words">({alphaText})</span>
            </div>
          </div>

          <div className="cn-detail-right">
            <table className="cn-amount-table">
              <tbody>
                <tr>
                  <td className="lbl">มูลค่าสินค้า/ค่าบริการเดิม</td>
                  <td className="val">
                    {meta.originalAmount
                      ? formatMoney(meta.originalAmount)
                      : ""}
                  </td>
                </tr>
                <tr>
                  <td className="lbl">มูลค่าสินค้า/ค่าบริการที่ถูกต้อง</td>
                  <td className="val">
                    {meta.correctAmount
                      ? formatMoney(meta.correctAmount)
                      : ""}
                  </td>
                </tr>
                <tr>
                  <td className="lbl">มูลค่าสินค้า/ค่าบริการที่ปรับปรุง</td>
                  <td className="val">{formatMoney(doc.amountBeforeVat)}</td>
                </tr>
              </tbody>
            </table>
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
                    {Number(doc.vatRate)}%
                  </td>
                  <td className="val">{formatMoney(doc.vatAmount)}</td>
                </tr>
                <tr>
                  <td className="lbl">
                    <span className="lbl-en bold">TOTAL</span> รวมทั้งสิ้น
                  </td>
                  <td className="val total-val">
                    {formatMoney(doc.total)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* SIGNATURE */}
        <div className="sign-block">
          <div className="sign-col left">
            <div className="sign-company">{company.nameTh}</div>
            <div className="sign-text">
              ได้เครดิตบัญชีของท่านตามรายการข้างต้น
              ถูกต้องครบถ้วนแล้ว
            </div>
            <div className="sign-grid">
              <div className="sign-stack">
                <div className="lbl-line">ผู้รับเอกสาร</div>
                <div className="sign-row">
                  <span className="lbl-en">Received By</span>
                  <span className="dots"></span>
                </div>
                <div className="sign-row">
                  <span>วันที่</span>
                  <span className="lbl-en">Date</span>
                  <span className="dots"></span>
                </div>
              </div>
              <div className="sign-stack">
                <div className="lbl-line">ผู้ส่งมอบเอกสาร</div>
                <div className="sign-row">
                  <span className="lbl-en">Delivery By</span>
                  <span className="dots"></span>
                </div>
                <div className="sign-row">
                  <span>วันที่</span>
                  <span className="lbl-en">Date</span>
                  <span className="dots"></span>
                </div>
              </div>
            </div>
          </div>

          <div className="sign-col right">
            <div className="sign-title">ในนาม / For</div>
            <div className="sign-company">{company.nameTh}</div>
            <div className="sign-company-en ital">
              {company.nameEn ?? ""}
            </div>
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
        .cn-page {
          position: relative;
          width: 210mm;
          height: 297mm;                /* exact A4 to control bottom spacing */
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
        /* Items table grows to absorb remaining vertical space */
        .items-wrap { flex: 1 1 auto; display: flex; flex-direction: column; }
        .items-wrap .items { flex: 1 1 auto; }
        .items tbody { vertical-align: top; }

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

        .title-block { text-align: center; margin: 3mm 0 1mm; }
        .title-th { font-size: 22px; font-weight: 700; }

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

        .body { display: flex; gap: 2mm; margin-bottom: 2mm; }
        .customer-box { flex: 1.4; padding: 2mm 3mm; border: 1px solid #000; border-radius: 6px; }
        .doc-info { flex: 1; padding: 0; border: 1px solid #000; border-radius: 6px; overflow: hidden; display: flex; flex-direction: column; }

        .cust-top-row { display: flex; align-items: baseline; gap: 2mm; padding: 1mm 0; font-size: 10px; flex-wrap: wrap; }
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

        .doc-grid { display: grid; grid-template-columns: 1fr 1fr; font-size: 10px; }
        .doc-cell { padding: 1mm 3mm 1.5mm; border-bottom: 1px solid #000; border-right: 1px solid #000; }
        .doc-cell:nth-child(2n) { border-right: 0; }
        .doc-cell-full { grid-column: 1 / -1; border-right: 0; }
        .doc-grid .doc-cell:last-child { border-bottom: 0; }
        .doc-lbl { font-style: italic; color: #444; font-size: 9px; line-height: 1.1; }
        .doc-val { font-weight: 600; text-align: center; margin-top: 0.5mm; min-height: 4mm; }
        .doc-val.mono { font-family: "Sarabun", monospace; }
        .doc-val.bold { font-weight: 700; font-size: 11px; }
        .lbl-en { font-size: 8.5px; font-style: italic; color: #444; }

        .items-wrap { border: 1px solid #000; border-bottom: 0; border-top-left-radius: 6px; border-top-right-radius: 6px; overflow: hidden; }
        .items { width: 100%; border-collapse: collapse; font-size: 11px; }
        .items th, .items td { border-right: 1px solid #000; padding: 1.5mm 2mm; }
        .items th:last-child, .items td:last-child { border-right: 0; }
        .items thead th { background: #f3f4f6; font-weight: 700; text-align: center; padding: 2mm 1mm; border-bottom: 1px solid #000; }
        .items thead th .ital { font-style: italic; font-size: 11px; }
        .items thead th .ital-en { font-style: italic; font-size: 9px; color: #444; }
        .items .col-no { width: 14mm; text-align: center; }
        .items .col-qty { width: 22mm; }
        .items .col-price { width: 28mm; }
        .items .col-amt { width: 28mm; }
        .items td.ctr { text-align: center; font-style: italic; }
        .items td.rt { text-align: right; font-style: italic; font-variant-numeric: tabular-nums; }
        .items tr.blank td { height: 6.5mm; }

        /* CN detail + totals */
        .cn-detail-row {
          display: flex; gap: 0;
          border: 1px solid #000;
          border-radius: 0 0 6px 6px;   /* square top to flush with items table */
          overflow: hidden;             /* clip child borders to rounded corners */
          margin-top: 0;
          align-items: stretch;
        }
        .cn-detail-left {
          flex: 1.3; padding: 2mm 3mm; font-size: 10px; line-height: 1.4;
          border-right: 1px solid #000;
          display: flex; flex-direction: column; gap: 1.5mm;
        }
        .cn-detail-block { padding-bottom: 1mm; }
        .cn-detail-block.notes { border-top: 1px dashed #999; padding-top: 1mm; }
        .cn-row { display: flex; flex-wrap: wrap; gap: 2mm 4mm; align-items: baseline; }
        .cn-lbl { font-style: italic; color: #333; }
        .cn-val { font-weight: 600; min-width: 30mm; border-bottom: 1px dotted #999; padding: 0 1mm; }
        .cn-val.mono { font-family: "Sarabun", monospace; }
        .cn-reason-row { margin-top: 0.5mm; }
        .cn-detail-right { flex: 1; padding: 0; display: flex; flex-direction: column; }
        .cn-amount-table { width: 100%; border-collapse: collapse; font-size: 10px; }
        .cn-amount-table td { padding: 1.5mm 2mm; border-bottom: 1px solid #000; }
        .cn-amount-table td.lbl { font-style: italic; color: #333; }
        .cn-amount-table td.val { text-align: right; font-weight: 700; font-variant-numeric: tabular-nums; width: 28mm; border-left: 1px solid #000; }
        .totals { width: 100%; border-collapse: collapse; font-size: 11px; }
        .totals td { padding: 1.5mm 2mm; border-bottom: 1px solid #000; }
        .totals tr:last-child td { border-bottom: 0; }
        .totals td.lbl { font-style: italic; }
        .totals td.lbl .lbl-en { font-style: italic; font-weight: 700; }
        .totals td.val { text-align: right; font-style: italic; font-weight: 600; font-variant-numeric: tabular-nums; width: 28mm; border-left: 1px solid #000; }
        .totals td.total-val { font-weight: 700; font-size: 13px; background: #fff; }

        .cn-detail-block.words-inline {
          display: flex; align-items: baseline; gap: 3mm;
          border-top: 1px solid #000; padding-top: 1.5mm;
          margin-top: auto;             /* push to bottom of left column */
          font-size: 10.5px;
        }
        .cn-detail-block.words-inline .cn-words {
          flex: 1; font-weight: 700; min-width: auto; border-bottom: 0;
        }

        .sign-block { display: flex; gap: 2mm; margin-top: 2mm; }
        .sign-col { padding: 2.5mm 3mm; font-size: 10px; border: 1px solid #000; border-radius: 6px; display: flex; flex-direction: column; }
        .sign-col.left { flex: 1.5; }
        .sign-col.right { flex: 1; }
        .sign-company { font-weight: 700; }
        .sign-text { margin-top: 1mm; font-size: 10px; line-height: 1.3; }
        .sign-grid { display: flex; gap: 4mm; margin-top: 4mm; }
        .sign-grid .sign-stack { flex: 1; }
        .sign-stack { line-height: 1.4; }
        .sign-stack .lbl-line { font-style: italic; }
        .sign-row { display: flex; align-items: baseline; gap: 1.5mm; margin-top: 0.5mm; }
        .dots { flex: 1; border-bottom: 1px dotted #000; min-width: 20mm; }
        .sign-col.right .sign-title { text-align: center; font-weight: 700; font-size: 11px; }
        .sign-col.right .sign-company { text-align: center; margin-top: 1mm; }
        .sign-company-en { font-size: 9px; text-align: center; color: #333; }
        .sign-line { display: flex; align-items: baseline; gap: 1.5mm; margin-top: 14mm; }
        .sign-line.center { justify-content: center; }
        .sign-end { text-align: center; margin-top: 1mm; font-style: italic; font-size: 9.5px; }

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
          .cn-page { margin: 0; box-shadow: none; padding: 8mm 10mm; }
          @page { size: A4; margin: 0; }
        }
      `}</style>
    </>
  );
}
