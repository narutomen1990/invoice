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

type LegacyData = {
  payment?: {
    paymentDate?: string | null;
    receiptNo?: string | null;
    paidAmount?: number;
    paymentMethod?: string | null;
    remark?: string | null;
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

async function loadDoc(id: number) {
  const docRaw = await db.execute<any>(sql`
    SELECT * FROM documents
     WHERE id = ${id} AND document_type IN ('billing_slip', 'receipt')
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

async function loadCompanyLogo(company: any): Promise<string | null> {
  if (!company.logoPath) return null;
  try {
    const lp = company.logoPath.startsWith("/")
      ? path.join(process.cwd(), "public", company.logoPath)
      : company.logoPath;
    const buf = await fs.readFile(lp);
    const ext = path.extname(lp).slice(1).toLowerCase();
    const mime =
      ext === "png" ? "image/png" : ext === "gif" ? "image/gif" : "image/jpeg";
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

export default async function ReceiptPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const numId = parseInt(id, 10);
  if (Number.isNaN(numId)) notFound();
  const data = await loadDoc(numId);
  if (!data) notFound();
  const { doc, items } = data;

  const [company] = await db.select().from(companies).limit(1);
  if (!company) notFound();

  const isCopy = sp.copy === "1";
  const isReceipt = sp.type === "receipt";
  const docTitleTh = isReceipt
    ? isCopy ? "สำเนาใบเสร็จรับเงิน" : "ใบเสร็จรับเงิน"
    : isCopy ? "สำเนาใบวางบิล" : "ใบวางบิล";
  const docTitleEn = isReceipt ? "RECEIPT" : "BILL NOTE";
  const variantLabel = isReceipt
    ? isCopy ? "สำเนาใบเสร็จรับเงิน" : "ใบเสร็จรับเงิน"
    : isCopy ? "สำเนาใบวางบิล" : "ใบวางบิล";

  const total = Number(doc.total ?? 0);
  const amountBeforeVat = Number(doc.amount_before_vat ?? 0);
  const vatAmount = Number(doc.vat_amount ?? 0);
  const alphaText =
    (doc.total_in_words_th as string | null)?.trim() || bahtText(total);

  const legacy = (doc.legacy_data as LegacyData | null) ?? {};
  const pay = legacy.payment ?? {};
  const paidAmount = Number(pay.paidAmount ?? total);

  const logoDataUrl = await loadCompanyLogo(company);

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
      <PrintActions docNo={doc.doc_no} variant={variantLabel} />
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
              {company.website && <span>Website : {company.website}</span>}
              {company.email && <span>email : {company.email}</span>}
            </div>
          </div>
        </div>


        {/* TITLE */}
        <div className="title-block">
          <div className="title-th">{docTitleTh}</div>
          <div className="title-en">{docTitleEn}</div>
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
            <span className="val rate">{Number(doc.vat_rate ?? 7)}</span>
          </div>
        </div>

        {/* CUSTOMER + DOC INFO */}
        <div className="body">
          <div className="customer-box">
            <div className="cust-tax-row">
              <span className="cust-lbl-mid">เลขประจำตัวผู้เสียภาษีผู้ซื้อ :</span>
              <span className="cust-val-tight">
                {doc.customer_tax_id_snapshot ?? "-"}
              </span>
              <span className="cust-lbl-mid">สาขาของผู้ซื้อ :</span>
              <span className="cust-val-tight">
                {branchLabel(doc.customer_branch_snapshot)}
              </span>
            </div>
            <table className="customer">
              <tbody>
                <tr>
                  <td className="lbl">
                    <div>นามผู้ซื้อ</div>
                    <div className="lbl-en">SOLD TO</div>
                  </td>
                  <td className="val bold">
                    {doc.customer_name_snapshot ?? "-"}
                    {doc.customer_code_snapshot && (
                      <span className="cust-code">
                        {" "}
                        (รหัส: {doc.customer_code_snapshot})
                      </span>
                    )}
                  </td>
                </tr>
                <tr>
                  <td className="lbl">
                    <div>ที่อยู่</div>
                    <div className="lbl-en">ADDRESS</div>
                  </td>
                  <td className="val">
                    {(doc.customer_address_snapshot as string | null)?.replace(
                      /\n/g,
                      " ",
                    ) ?? "-"}
                  </td>
                </tr>
                <tr>
                  <td className="lbl">
                    <div>โทรศัพท์</div>
                    <div className="lbl-en">TEL</div>
                  </td>
                  <td className="val">{doc.customer_tel_snapshot ?? "-"}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="doc-info">
            <div className="doc-grid">
              <div className="doc-cell">
                <div className="doc-lbl">วันที่ / Date</div>
                <div className="doc-val">
                  {formatThaiDateShort(doc.doc_date)}
                </div>
              </div>
              <div className="doc-cell">
                <div className="doc-lbl">
                  {isReceipt
                    ? "เลขที่ใบเสร็จรับเงิน / Receipt No."
                    : "เลขที่ใบวางบิล / Bill No."}
                </div>
                <div className="doc-val mono bold">{doc.doc_no}</div>
              </div>
              <div className="doc-cell">
                <div className="doc-lbl">วันครบกำหนด / Due Date</div>
                <div className="doc-val">
                  {doc.due_date ? formatThaiDateShort(doc.due_date) : " "}
                </div>
              </div>
              <div className="doc-cell">
                <div className="doc-lbl">พนักงานขาย / Sale By</div>
                <div className="doc-val">{doc.saleman_name ?? " "}</div>
              </div>
            </div>
          </div>
        </div>

        {/* ITEMS TABLE */}
        <div className="items-wrap">
          {isReceipt ? (
            <table className="items">
              <thead>
                <tr>
                  <th className="col-no">ลำดับ<div className="ital-en">No.</div></th>
                  <th>เลขที่ใบวางบิล<div className="ital-en">Bill No.</div></th>
                  <th>เลขที่ใบกำกับภาษี<div className="ital-en">Tax Invoice</div></th>
                  <th>ทะเบียนรถ<div className="ital-en">Plate</div></th>
                  <th>วันเดือนปี<div className="ital-en">Date</div></th>
                  <th>วันครบกำหนด<div className="ital-en">Due Date</div></th>
                  <th className="col-amt">รวมเงินทั้งสิ้น<div className="ital-en">Total</div></th>
                  <th className="col-amt">รวมเงินที่ชำระ<div className="ital-en">Paid</div></th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="ctr">1</td>
                  <td className="ctr mono">{doc.doc_no}</td>
                  <td className="ctr mono">
                    {doc.reference_quotation_no ?? "-"}
                  </td>
                  <td className="ctr">{doc.customer_code_snapshot ?? "-"}</td>
                  <td className="ctr">{formatThaiDateShort(doc.doc_date)}</td>
                  <td className="ctr">
                    {doc.due_date ? formatThaiDateShort(doc.due_date) : "-"}
                  </td>
                  <td className="rt">{formatMoney(total)}</td>
                  <td className="rt">{formatMoney(paidAmount)}</td>
                </tr>
                {Array.from({ length: 22 }).map((_, i) => (
                  <tr key={`b${i}`} className="blank">
                    <td>&nbsp;</td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="bill-table">
              {/* จ่ายให้ ... เช็คธนาคาร ... เลขที่ ... */}
              <div className="bill-pay-line">
                <span>จ่ายให้</span>
                <span className="bold">{company.nameTh}</span>
                <span className="ml">เช็คธนาคาร</span>
                <span className="dots-inline" />
                <span>เลขที่</span>
                <span className="dots-inline" />
              </div>

              {/* HEADER row — labels with EN subtitle */}
              <div className="bill-header-row">
                <div className="bcol col-no">
                  <div>ลำดับ</div>
                  <div className="ital-en">No.</div>
                </div>
                <div className="bcol col-doc">
                  <div>เลขที่ใบกำกับภาษี</div>
                  <div className="ital-en">Tax Invoice</div>
                </div>
                <div className="bcol col-date">
                  <div>วันเดือนปี</div>
                  <div className="ital-en">Date</div>
                </div>
                <div className="bcol col-date">
                  <div>วันครบกำหนดชำระ</div>
                  <div className="ital-en">Due Date</div>
                </div>
                <div className="bcol col-amt rt">
                  <div>จำนวนเงิน</div>
                  <div className="ital-en">Amount</div>
                </div>
                <div className="bcol col-amt rt">
                  <div>ภาษีมูลค่าเพิ่ม</div>
                  <div className="ital-en">VAT</div>
                </div>
                <div className="bcol col-amt rt last">
                  <div>รวมเงิน</div>
                  <div className="ital-en">Total</div>
                </div>
              </div>

              {/* DATA ROW */}
              <div className="bill-row">
                <div className="bcol col-no ctr">1</div>
                <div className="bcol col-doc ctr mono">
                  {doc.reference_quotation_no ?? "-"}
                </div>
                <div className="bcol col-date ctr">
                  {formatThaiDateShort(doc.doc_date)}
                </div>
                <div className="bcol col-date ctr">
                  {doc.due_date ? formatThaiDateShort(doc.due_date) : "-"}
                </div>
                <div className="bcol col-amt rt">
                  {formatMoney(amountBeforeVat)}
                </div>
                <div className="bcol col-amt rt">{formatMoney(vatAmount)}</div>
                <div className="bcol col-amt rt last">{formatMoney(total)}</div>
              </div>

              {/* SUBTOTAL — right-aligned, only label + amount visible */}
              <div className="bill-subtotal">
                <span className="sub-lbl">รวมเป็นเงิน</span>
                <span className="sub-val">{formatMoney(total)}</span>
              </div>
            </div>
          )}
        </div>

        {/* FOOTER */}
        {isReceipt ? (
          <div className="receipt-footer">
            <div className="remark-block">
              <div className="bold">หมายเหตุ / Remark :</div>
              <div className="rk-line">
                1. ในกรณีชำระด้วยเช็ค โปรดสั่งจ่ายเช็คขีดคร่อมในนาม{" "}
                <span className="ital">{company.nameTh}</span> เท่านั้น
              </div>
              <div className="rk-line">
                2. ในกรณีที่จ่ายเช็ค ใบเสร็จรับเงินนี้จะสมบูรณ์ต่อเมื่อเช็คได้เรียกเก็บเงินจากธนาคารแล้ว
              </div>
              <div className="rk-summary">
                <span>จำนวน 1 ฉบับ</span>
                <span className="ml">
                  จำนวนเงิน(บาท)&nbsp;
                  <span className="ital">({alphaText})</span>
                </span>
                <span className="net-total">
                  รวมสุทธิ (Net Total){" "}
                  <span className="bold">{formatMoney(paidAmount)}</span>
                </span>
              </div>
            </div>

            <div className="payment-grid">
              <div className="pay-left">
                <div className="bold">รายละเอียดการชำระเงิน</div>
                <div className="pay-ck-row">
                  <span className="ck">
                    <span className="cbx" /> เงินสด
                  </span>
                </div>
                <div className="pay-ck-row">
                  <span className="ck">
                    <span className="cbx" /> เช็คธนาคาร
                  </span>
                  <span className="ck">
                    <span className="cbx" /> โอนเงิน
                  </span>
                  <span className="ck">
                    <span className="cbx" /> บัตรเครดิต
                  </span>
                </div>
                <div className="pay-line">
                  ธนาคาร/สาขา <span className="dots-inline flex" />
                </div>
                <div className="pay-line">
                  ลงวันที่ <span className="dots-inline" />
                  จำนวนเงิน <span className="dots-inline flex" />
                </div>
              </div>
              <div className="pay-right">
                <div className="sig-line">
                  <span className="dots-inline flex" />
                </div>
                <div className="sig-lbl">ผู้รับเงิน / Collector</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bill-footer">
            <div className="remark-line">
              <span className="bold">หมายเหตุใบวางบิล :</span>{" "}
              {doc.remark1 ?? "—"}
            </div>
            <div className="bill-summary">
              <span>จำนวน 1 ฉบับ</span>
              <span className="bold">รวมเงินทั้งสิ้น</span>
              <span className="bold rt">{formatMoney(total)}</span>
            </div>
          </div>
        )}

        <div className="page-marker">Page 1</div>
      </div>

      <style>{`
        :root { color-scheme: light; }
        body { margin: 0; background: #e5e5e5; }
        .invoice-page {
          position: relative;
          width: 210mm;
          min-height: 297mm;
          margin: 1rem auto;
          padding: 7mm 7mm;
          background: #fff;
          color: #000;
          font-family: "Sarabun", "Noto Sans Thai", sans-serif;
          font-size: 10.5px;
          line-height: 1.25;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
        }
        /* push footer to bottom of A4 — eliminate blank space at the bottom */
        .receipt-footer { margin-top: auto; }
        .bill-footer { margin-top: auto; }
        .copy-watermark {
          position: absolute; top: 50%; left: 50%;
          transform: translate(-50%, -50%) rotate(-30deg);
          font-size: 110px; font-weight: 900; font-style: italic;
          color: rgba(220, 38, 38, 0.18);
          letter-spacing: 6px; pointer-events: none; z-index: 0; white-space: nowrap;
        }

        /* TOP */
        .top { display: flex; gap: 5mm; align-items: flex-start; padding-bottom: 2mm; border-bottom: 1px solid #000; }
        .logo-box {
          width: 26mm; height: 22mm;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          color: #c00; font-weight: 700; overflow: hidden;
        }
        .logo-img { max-width: 100%; max-height: 100%; object-fit: contain; }
        .logo-vm { font-size: 16px; line-height: 1; }
        .logo-cam { font-size: 10px; letter-spacing: 1px; }
        .logo-pro { font-size: 12px; background: #c00; color: #fff; padding: 1px 6px; margin-top: 2px; }
        .company-info { flex: 1; }
        .company-th { font-size: 14px; font-weight: 700; line-height: 1.2; }
        .company-en { font-size: 11.5px; font-style: italic; font-weight: 600; margin-bottom: 1mm; }
        .company-addr { font-size: 9.5px; }
        .company-addr-en { font-size: 9px; font-style: italic; color: #444; }
        .company-contact { font-size: 8.5px; margin-top: 0.8mm; display: flex; gap: 3mm; flex-wrap: wrap; }

        /* TITLE */
        .title-block { text-align: center; margin: 1.5mm 0 0.5mm; }
        .title-th { font-size: 18px; font-weight: 700; line-height: 1.1; }
        .title-en { font-size: 12px; font-weight: 700; font-style: italic; letter-spacing: 1.5px; color: #444; }

        /* TAX INFO */
        .tax-info {
          display: flex; justify-content: space-between; align-items: baseline;
          font-size: 9.5px; padding-bottom: 1.5mm; gap: 3mm;
        }
        .tax-cell { display: flex; gap: 2mm; align-items: flex-start; }
        .tax-lbl-stack { display: flex; flex-direction: column; line-height: 1.1; }
        .tax-cell.right { margin-left: auto; }
        .tax-cell .lbl { font-style: italic; }
        .tax-cell .lbl-en { font-style: italic; font-size: 9px; color: #555; }
        .tax-cell .val { font-weight: 700; }
        .tax-cell .val.rate { background: #fff; padding: 0 4mm; }
        .ital { font-style: italic; }

        /* BODY */
        .body { display: flex; gap: 2mm; margin-bottom: 2mm; }
        .customer-box { flex: 1.4; padding: 1.5mm 2.5mm; border: 1px solid #000; border-radius: 5px; }
        .doc-info { flex: 1; padding: 0; border: 1px solid #000; border-radius: 5px; overflow: hidden; }
        .cust-tax-row { display: flex; flex-wrap: wrap; align-items: baseline; gap: 1.5mm 5mm; padding: 0 0 1mm; font-size: 9.5px; }
        .cust-lbl-mid { font-style: italic; color: #333; font-size: 9.5px; }
        .cust-val-tight { font-weight: 700; }
        .customer { width: 100%; border-collapse: collapse; font-size: 10px; }
        .customer td { padding: 1mm 1mm; vertical-align: top; }
        .customer td.lbl { font-style: italic; color: #333; width: 1%; white-space: nowrap; padding-right: 2.5mm; }
        .customer td.lbl .lbl-en { font-size: 8.5px; font-style: italic; }
        .customer td.val { font-weight: 600; }
        .customer td.val.bold { font-weight: 700; font-size: 10.5px; }
        .doc-grid { display: grid; grid-template-columns: 1fr 1fr; font-size: 9.5px; height: 100%; }
        .doc-cell { padding: 1mm 2.5mm 1.2mm; border-bottom: 1px solid #000; border-right: 1px solid #000; }
        .doc-cell:nth-child(2n) { border-right: 0; }
        .doc-cell:nth-last-child(-n+2) { border-bottom: 0; }
        .doc-lbl { font-style: italic; color: #444; font-size: 8.5px; line-height: 1.1; }
        .doc-val { font-weight: 600; text-align: center; margin-top: 0.4mm; min-height: 3.5mm; }
        .doc-val.mono { font-family: "Sarabun", monospace; }
        .doc-val.bold { font-weight: 700; font-size: 10.5px; }
        .mono { font-family: "Sarabun", monospace; }

        /* ITEMS (receipt mode uses table) */
        .items-wrap {
          border: 1px solid #000;
          border-radius: 5px; overflow: hidden;
          margin-bottom: 2mm;
        }
        .dots-inline { display: inline-block; min-width: 24mm; border-bottom: 1px dotted #000; height: 3.5mm; }
        .dots-inline.flex { flex: 1; }
        .items { width: 100%; border-collapse: collapse; font-size: 10px; table-layout: fixed; }
        .items th, .items td { border-right: 1px solid #000; padding: 1mm 1.2mm; vertical-align: middle; word-wrap: break-word; }
        .items th:last-child, .items td:last-child { border-right: 0; }
        .items thead th { background: #f3f4f6; font-weight: 700; text-align: center; padding: 1.5mm 1mm; border-bottom: 1px solid #000; font-size: 9.5px; line-height: 1.15; }
        .items thead th .ital-en { font-style: italic; font-size: 8.5px; color: #444; font-weight: 400; }
        .items .col-no { width: 11mm; text-align: center; }
        .items .col-amt { width: 22mm; text-align: right; }
        .items td.ctr { text-align: center; }
        .items td.rt { text-align: right; font-variant-numeric: tabular-nums; }
        .items td.bold { font-weight: 700; }
        .items tr.blank td { height: 5mm; }

        /* BILL NOTE — clean borderless table per PDF */
        .bill-table {
          padding: 2mm 3mm 3mm;
          font-size: 10.5px;
        }
        .bill-pay-line {
          display: flex; align-items: baseline; gap: 2mm;
          padding-bottom: 1.5mm; border-bottom: 1px solid #000;
          font-size: 10.5px;
        }
        .bill-pay-line .ml { margin-left: 5mm; }
        .bill-pay-line .bold { font-weight: 700; }

        .bill-header-row {
          display: grid;
          grid-template-columns: 14mm 1fr 20mm 26mm 22mm 20mm 24mm;
          align-items: end;
          padding: 1.2mm 0 1mm;
          border-bottom: 1px solid #000;
        }
        .bill-header-row .bcol {
          padding: 0 1.5mm;
          text-align: center;
          font-weight: 700;
          line-height: 1.15;
          font-size: 10px;
        }
        .bill-header-row .ital-en {
          font-style: italic; font-weight: 400; color: #444; font-size: 9px;
        }
        .bcol.rt { text-align: right; }

        .cust-code {
          font-family: "Sarabun", monospace;
          font-weight: 600;
          color: #555;
          font-size: 10px;
        }

        .bill-row {
          display: grid;
          grid-template-columns: 14mm 1fr 20mm 26mm 22mm 20mm 24mm;
          padding: 1mm 0;
        }
        .bill-row .bcol {
          padding: 0 1.5mm;
          font-size: 10.5px;
        }
        .bill-row .bcol.ctr { text-align: center; }
        .bill-row .bcol.rt {
          text-align: right;
          font-variant-numeric: tabular-nums;
        }

        .bill-subtotal {
          display: flex; justify-content: flex-end; align-items: baseline;
          gap: 5mm;
          padding: 1mm 1.5mm 1mm 0;
          border-top: 1px solid #000;
          margin-top: 0.5mm;
        }
        .bill-subtotal .sub-lbl { font-size: 10.5px; }
        .bill-subtotal .sub-val {
          font-weight: 700; font-size: 11.5px;
          min-width: 24mm; text-align: right;
          font-variant-numeric: tabular-nums;
        }

        /* RECEIPT FOOTER */
        .receipt-footer { margin-top: 1.5mm; }
        .remark-block { padding: 1.5mm 2.5mm; border: 1px solid #000; border-radius: 5px; font-size: 9.5px; }
        .remark-block .bold { font-weight: 700; }
        .rk-line { margin-top: 0.4mm; }
        .rk-summary { display: flex; align-items: baseline; gap: 5mm; margin-top: 1.5mm; padding-top: 1.2mm; border-top: 1px solid #000; }
        .rk-summary .ml { flex: 1; }
        .rk-summary .net-total { font-size: 10.5px; }
        .rk-summary .net-total .bold { font-size: 12.5px; }

        .payment-grid { display: grid; grid-template-columns: 1fr 46mm; gap: 2mm; margin-top: 1.5mm; }
        .pay-left { padding: 1.5mm 2.5mm; border: 1px solid #000; border-radius: 5px; font-size: 9.5px; }
        .pay-right { padding: 1.5mm 2.5mm; border: 1px solid #000; border-radius: 5px; display: flex; flex-direction: column; justify-content: space-between; align-items: center; }
        .pay-ck-row { display: flex; gap: 3mm; margin-top: 1.2mm; }
        .ck { display: inline-flex; align-items: center; gap: 1.2mm; }
        .cbx { display: inline-block; width: 3mm; height: 3mm; border: 1px solid #000; }
        .pay-line { display: flex; align-items: baseline; gap: 1.5mm; margin-top: 1.2mm; }
        .sig-line { width: 100%; padding: 6mm 0 1mm; }
        .sig-lbl { font-style: italic; font-size: 9.5px; }

        /* BILL FOOTER */
        .bill-footer { display: flex; align-items: stretch; border: 1px solid #000; border-radius: 5px; padding: 1.5mm 2.5mm; gap: 3mm; }
        .remark-line { flex: 1; font-size: 10px; }
        .remark-line .bold { font-weight: 700; }
        .bill-summary { display: flex; align-items: center; gap: 3mm; font-size: 11.5px; }
        .bill-summary .bold { font-weight: 700; }
        .bill-summary .rt { min-width: 22mm; text-align: right; font-variant-numeric: tabular-nums; }

        .page-marker { margin-top: 3mm; font-size: 8.5px; font-style: italic; color: #555; }

        @media print {
          body { background: #fff; }
          .invoice-page { margin: 0; box-shadow: none; padding: 7mm 8mm; }
          @page { size: A4; margin: 0; }
        }
      `}</style>
    </>
  );
}
