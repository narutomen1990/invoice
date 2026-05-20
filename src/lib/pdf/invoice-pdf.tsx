import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import path from "node:path";
import fs from "node:fs";
import type { InvoiceDetail } from "@/lib/queries/invoices";
import { formatMoney, bahtText } from "@/lib/thai/number";
import { formatThaiDateShort } from "@/lib/thai/date";

const fontDir = path.join(process.cwd(), "public", "fonts");
Font.register({
  family: "Sarabun",
  fonts: [
    { src: path.join(fontDir, "Sarabun-Regular.ttf") },
    { src: path.join(fontDir, "Sarabun-Bold.ttf"), fontWeight: 700 },
    { src: path.join(fontDir, "Sarabun-Italic.ttf"), fontStyle: "italic" },
    {
      src: path.join(fontDir, "Sarabun-BoldItalic.ttf"),
      fontStyle: "italic",
      fontWeight: 700,
    },
  ],
});

const TARGET_ROWS = 12;

function branchLabel(code: string | null | undefined): string {
  if (!code) return "";
  const c = code.trim();
  if (!c || c === "00000") return "สำนักงานใหญ่";
  const n = parseInt(c, 10);
  if (n === 0) return "สำนักงานใหญ่";
  if (Number.isNaN(n)) return c;
  return `สาขา ${n}`;
}

const s = StyleSheet.create({
  page: { padding: 18, fontFamily: "Sarabun", fontSize: 9, color: "#000" },

  // ---- Top: logo + company ----
  top: { flexDirection: "row", gap: 12, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: "#000" },
  logoBox: {
    width: 80, height: 68,
    alignItems: "center", justifyContent: "center",
  },
  logoImg: { width: 80, height: 68, objectFit: "contain" },
  logoVm: { fontSize: 16, fontWeight: 700, color: "#c00" },
  logoCam: { fontSize: 9, color: "#c00", letterSpacing: 1 },
  logoPro: { fontSize: 11, color: "#fff", backgroundColor: "#c00", paddingHorizontal: 8, marginTop: 2, fontWeight: 700 },
  companyInfo: { flex: 1 },
  companyTh: { fontSize: 14, fontWeight: 700 },
  companyEn: { fontSize: 11, fontWeight: 700, marginBottom: 2, fontStyle: "italic" },
  companyAddr: { fontSize: 8.5 },
  companyAddrEn: { fontSize: 8, color: "#444", fontStyle: "italic" },
  companyContact: { fontSize: 7.5, marginTop: 2 },

  // ---- Title ----
  titleBlock: { alignItems: "center", marginVertical: 2 },
  titleTh: { fontSize: 14, fontWeight: 700, fontStyle: "italic" },
  titleEn: { fontSize: 12, fontWeight: 700, fontStyle: "italic", letterSpacing: 1 },

  // ---- Tax info row ----
  taxInfo: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3, fontSize: 8 },
  taxCell: { flexDirection: "row", gap: 4, alignItems: "flex-start" },
  taxLblStack: { flexDirection: "column" },
  taxLbl: { fontStyle: "italic" },
  taxLblEn: { fontStyle: "italic", fontSize: 7, color: "#555" },
  taxVal: { fontWeight: 700 },

  // ---- Body: customer + doc-info (2 separate boxes) ----
  body: {
    flexDirection: "row",
    gap: 4,
    marginBottom: 3,
  },
  customerBox: {
    flex: 1.4,
    padding: 5,
    borderWidth: 1, borderColor: "#000", borderRadius: 6,
  },
  custTopRow: {
    flexDirection: "row", alignItems: "baseline",
    paddingBottom: 2, fontSize: 9,
  },
  custTaxRow: {
    flexDirection: "row", flexWrap: "wrap", alignItems: "baseline",
    paddingBottom: 3, marginBottom: 2,
    fontSize: 9,
  },
  custTopGroup: { flexDirection: "row", alignItems: "baseline", marginRight: 10 },
  custTopLblTh: { fontStyle: "italic", color: "#333", fontWeight: 600, fontSize: 10, marginRight: 2 },
  custTopLblEn: { fontStyle: "italic", color: "#555", fontSize: 7, marginRight: 4 },
  custTopLblMid: { fontStyle: "italic", color: "#333", fontSize: 9, marginRight: 3 },
  custTopVal: { fontWeight: 700, fontSize: 10 },
  custRow: { flexDirection: "row", marginBottom: 2, alignItems: "flex-start" },
  custLbl: {
    fontStyle: "italic", color: "#333",
    marginRight: 8,
  },
  custLblNarrow: { width: 45, fontStyle: "italic", color: "#333" },
  custLblEn: { fontSize: 7.5, fontStyle: "italic" },
  custVal: { flex: 1, fontWeight: 600 },
  custValBold: { flex: 1, fontWeight: 700, fontSize: 10 },
  docInfo: {
    flex: 1,
    borderWidth: 1, borderColor: "#000", borderRadius: 6,
  },
  docRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#000" },
  docCellLeft: {
    flex: 1, padding: 4, fontSize: 8.5,
    borderRightWidth: 1, borderRightColor: "#000",
  },
  docCellRight: { flex: 1, padding: 4, fontSize: 8.5 },
  docCellFull: { padding: 4, fontSize: 8.5 },
  docLbl: { fontStyle: "italic", color: "#444", fontSize: 8 },
  docVal: { fontWeight: 600, marginTop: 1, textAlign: "center" },
  docValBold: { fontWeight: 700, marginTop: 1, textAlign: "center", fontSize: 10 },

  // ---- Items table ----
  table: {
    borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1,
    borderBottomWidth: 0,                                /* ใช้ border-top ของ notes/totals แทน */
    borderColor: "#000",
    borderTopLeftRadius: 6, borderTopRightRadius: 6,
    overflow: "hidden",
  },
  thead: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#000", backgroundColor: "#f3f4f6" },
  th: { padding: 4, fontWeight: 700, textAlign: "center", borderRightWidth: 1, borderRightColor: "#000", fontStyle: "italic" },
  thLast: { padding: 4, fontWeight: 700, textAlign: "center", fontStyle: "italic" },
  thTh: { fontSize: 9 },
  thEn: { fontSize: 7, color: "#444" },
  tr: { flexDirection: "row", minHeight: 16 },
  trLast: { flexDirection: "row", minHeight: 16 },
  td: { padding: 3, borderRightWidth: 1, borderRightColor: "#000", fontSize: 9, fontStyle: "italic" },
  tdLast: { padding: 3, fontSize: 9, fontStyle: "italic" },
  colNo: { width: 36, textAlign: "center" },
  colDesc: { flex: 1 },
  colQty: { width: 60, textAlign: "center" },
  colPrice: { width: 75, textAlign: "right" },
  colAmt: { width: 75, textAlign: "right" },

  // ---- Footer — Notes ติด Totals ไม่มี gap ----
  footerRow: { flexDirection: "row", marginTop: 0, gap: 0, alignItems: "flex-start" },
  notes: {
    flex: 1, padding: 5, fontSize: 7.5, lineHeight: 1.4,
    borderTopWidth: 1, borderBottomWidth: 1, borderLeftWidth: 1, borderRightWidth: 1,
    borderColor: "#000",
    borderBottomLeftRadius: 6,
  },
  wordsBlock: {
    marginTop: 8, paddingTop: 5,
    marginLeft: -5, marginRight: -5,
    paddingLeft: 5, paddingRight: 5,
    borderTopWidth: 1, borderTopColor: "#000",
    fontSize: 9, fontStyle: "italic",
  },
  wordsTextBold: {
    fontWeight: 700, fontSize: 11, fontStyle: "italic",
  },
  totals: {
    width: 200,
    borderTopWidth: 1, borderBottomWidth: 1, borderRightWidth: 1, borderColor: "#000",
    borderBottomRightRadius: 6,
    overflow: "hidden",
  },
  totalRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#000" },
  totalRowMid: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#000" },
  totalRowLast: { flexDirection: "row" },
  totalLbl: { width: 90, padding: 3, borderRightWidth: 1, borderRightColor: "#000" },
  totalLblEn: { fontWeight: 700, fontStyle: "italic", fontSize: 9 },
  totalLblTh: { fontSize: 8 },
  totalVal: { flex: 1, padding: 3, textAlign: "right", fontStyle: "italic", fontWeight: 600 },
  totalValBig: { flex: 1, padding: 3, textAlign: "right", fontStyle: "italic", fontWeight: 700, fontSize: 11 },


  // ---- Signatures (left+mid touching, right with gap) ----
  signBlock: {
    flexDirection: "row",
    marginTop: 3,
  },
  signColLeft: {
    flex: 0.85, padding: 5, fontSize: 8,                /* แคบสุด */
    borderTopWidth: 1, borderBottomWidth: 1, borderLeftWidth: 1,
    borderRightWidth: 1, borderColor: "#000",
    borderTopLeftRadius: 6, borderBottomLeftRadius: 6,
    flexDirection: "column", justifyContent: "space-between",
  },
  signCol: {
    flex: 0.9, padding: 5, fontSize: 8,                  /* ลดลง */
    borderTopWidth: 1, borderBottomWidth: 1, borderRightWidth: 1, borderColor: "#000",
    borderTopRightRadius: 6, borderBottomRightRadius: 6,
    flexDirection: "column", justifyContent: "space-between",
  },
  signColLast: {
    flex: 1.5, padding: 5, fontSize: 8,                  /* ขยายชดเชย */
    borderWidth: 1, borderColor: "#000", borderRadius: 6,
    marginLeft: 3,
  },
  forTitleBig: { textAlign: "center", fontWeight: 700, fontSize: 11, marginBottom: 4 },
  signTitle: { fontWeight: 600 },
  signTitleEn: { fontStyle: "italic", fontSize: 7.5, color: "#444", marginBottom: 1 },
  signLine: { flexDirection: "row", marginTop: 3, alignItems: "flex-end" },
  lblLine: { fontStyle: "italic", fontSize: 8 },
  lblEn: { fontStyle: "italic", fontSize: 7, color: "#444", marginLeft: 2 },
  dots: { flex: 1, borderBottomWidth: 0.5, borderBottomColor: "#000", borderStyle: "dashed", marginLeft: 3, height: 12 },
  payRow: { flexDirection: "row", alignItems: "center" },
  payRowEn: {
    flexDirection: "row", marginBottom: 4,
    fontSize: 7, color: "#555", fontStyle: "italic",
  },
  payCellLbl: { width: 32 },                                 /* tighter */
  payCellCash: { width: 35, paddingLeft: 4, flexDirection: "row", alignItems: "center" },
  payCellChq: { width: 30, paddingLeft: 4, flexDirection: "row", alignItems: "center" },
  payCellTrf: { width: 40, paddingLeft: 4, flexDirection: "row", alignItems: "center" },
  ck: { fontSize: 8 },
  cbx: {
    width: 8, height: 8,
    borderWidth: 0.8, borderColor: "#000",
    borderRadius: 1,
    marginRight: 3,
  },
  signCompany: { fontWeight: 700, textAlign: "center", marginTop: 2, fontSize: 9 },
  signCompanyEn: { fontSize: 7.5, textAlign: "center", color: "#333", fontStyle: "italic" },
  signEnd: { textAlign: "center", marginTop: 6, fontStyle: "italic", fontSize: 8 },
});

export function InvoicePDF({ data, company }: { data: InvoiceDetail; company?: any }) {
  const { doc, items } = data;
  const blankRows = Math.max(0, TARGET_ROWS - items.length);
  const alphaText = doc.totalInWordsTh?.trim() || bahtText(doc.total);

  const compTh = company?.nameTh || data.company.nameTh;
  const compEn = company?.nameEn || "";
  const compTaxId = company?.taxId || data.company.taxId;
  const compBranch = company?.branchCode || "00000";
  const compTel = company?.tel || data.company.tel;
  const compWebsite = company?.website || "";
  const compEmail = company?.email || "";

  // Resolve logo path → absolute path or null
  let logoSrc: string | null = null;
  if (company?.logoPath) {
    try {
      const lp = company.logoPath.startsWith("/")
        ? path.join(process.cwd(), "public", company.logoPath)
        : company.logoPath;
      if (fs.existsSync(lp)) logoSrc = lp;
    } catch {
      logoSrc = null;
    }
  }

  const withPfx = (v: string | null | undefined, pfx: string): string | null => {
    if (!v) return null;
    return v.startsWith(pfx) ? v : `${pfx}${v}`;
  };

  const addrTh =
    [
      company?.buildingTh,
      company?.mooTh ? `หมู่ ${company.mooTh}` : null,
      withPfx(company?.soiTh, "ซอย"),
      withPfx(company?.roadTh, "ถนน"),
      withPfx(company?.subDistrictTh, "แขวง"),
      withPfx(company?.districtTh, "เขต"),
      company?.provinceTh,
      company?.postcode,
    ]
      .filter(Boolean)
      .join(" ") ||
    data.company.addressTh ||
    "";

  const addrEn = [
    company?.buildingEn,
    company?.mooEn,
    company?.soiEn,
    company?.roadEn,
    company?.subDistrictEn,
    company?.districtEn,
    company?.provinceEn,
    company?.postcode,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Document title={`${doc.docNo} — ใบกำกับภาษี`} author={compTh}>
      <Page size="A4" style={s.page}>
        {/* TOP */}
        <View style={s.top}>
          <View style={s.logoBox}>
            {logoSrc ? (
              <Image src={logoSrc} style={s.logoImg} />
            ) : (
              <>
                <Text style={s.logoVm}>VM</Text>
                <Text style={s.logoCam}>camera</Text>
                <Text style={s.logoPro}>PRO</Text>
              </>
            )}
          </View>
          <View style={s.companyInfo}>
            <Text style={s.companyTh}>{compTh}</Text>
            {compEn ? <Text style={s.companyEn}>{compEn}</Text> : null}
            {addrTh ? <Text style={s.companyAddr}>{addrTh}</Text> : null}
            {addrEn ? <Text style={s.companyAddrEn}>{addrEn}</Text> : null}
            <Text style={s.companyContact}>
              {compTel ? `โทรศัพท์ / Telephone : ${compTel}` : ""}
              {compWebsite ? `   Website : ${compWebsite}` : ""}
              {compEmail ? `   email : ${compEmail}` : ""}
            </Text>
          </View>
        </View>

        {/* TITLE */}
        <View style={s.titleBlock}>
          <Text style={s.titleTh}>ใบกำกับภาษี / ใบเสร็จรับเงิน</Text>
          <Text style={s.titleEn}>TAX INVOICE / RECEIPT</Text>
        </View>

        {/* TAX INFO */}
        <View style={s.taxInfo}>
          <View style={s.taxCell}>
            <View style={s.taxLblStack}>
              <Text style={s.taxLbl}>เลขประจำตัวผู้เสียภาษี</Text>
              <Text style={s.taxLblEn}>TAX IDENTIFICATION</Text>
            </View>
            <Text style={s.taxVal}>{compTaxId ?? "-"}</Text>
          </View>
          <View style={s.taxCell}>
            <Text>สาขาที่ออกใบกำกับภาษี/Branch :</Text>
            <Text style={s.taxVal}>{branchLabel(compBranch)}</Text>
          </View>
          <View style={s.taxCell}>
            <Text style={s.taxLbl}>อัตราภาษีร้อยละ /TAX RATE</Text>
            <Text style={s.taxVal}>{Number(doc.vatRate)}</Text>
          </View>
        </View>

        {/* BODY */}
        <View style={s.body}>
          <View style={s.customerBox}>
            {/* Row 1: รหัส [val] */}
            <View style={s.custTopRow}>
              <View style={s.custTopGroup}>
                <Text style={s.custTopLblTh}>รหัส</Text>
                <Text style={s.custTopLblEn}>CODE</Text>
                <Text style={s.custTopVal}>{doc.customerCode ?? "-"}</Text>
              </View>
            </View>
            {/* Row 2: เลขผู้เสียภาษีผู้ซื้อ + สาขา */}
            <View style={s.custTaxRow}>
              <View style={s.custTopGroup}>
                <Text style={s.custTopLblMid}>เลขประจำตัวผู้เสียภาษีผู้ซื้อ :</Text>
                <Text style={s.custTopVal}>{doc.customerTaxId ?? "-"}</Text>
              </View>
              <View style={s.custTopGroup}>
                <Text style={s.custTopLblMid}>สาขาที่ :</Text>
                <Text style={s.custTopVal}>{branchLabel(doc.customerBranch)}</Text>
              </View>
            </View>

            <View style={s.custRow}>
              <View style={s.custLbl}>
                <Text>นามผู้ซื้อ</Text>
                <Text style={s.custLblEn}>SOLD TO</Text>
              </View>
              <Text style={s.custValBold}>{doc.customerName ?? "-"}</Text>
            </View>
            <View style={s.custRow}>
              <View style={s.custLbl}>
                <Text>ที่อยู่</Text>
                <Text style={s.custLblEn}>ADDRESS</Text>
              </View>
              <Text style={s.custVal}>
                {doc.customerAddress?.replace(/\n/g, " ") ?? "-"}
              </Text>
            </View>
          </View>

          <View style={s.docInfo}>
            <View style={s.docRow}>
              <View style={s.docCellLeft}>
                <Text style={s.docLbl}>วันที่ / Date</Text>
                <Text style={s.docVal}>{formatThaiDateShort(doc.docDate)}</Text>
              </View>
              <View style={s.docCellRight}>
                <Text style={s.docLbl}>เลขที่ใบกำกับภาษี / Tax Invoice</Text>
                <Text style={s.docValBold}>{doc.docNo}</Text>
              </View>
            </View>
            <View style={s.docRow}>
              <View style={s.docCellLeft}>
                <Text style={s.docLbl}>ใบสั่งซื้อเลขที่ / Purchase Order</Text>
                <Text style={s.docVal}>{doc.referenceQuotationNo ?? " "}</Text>
              </View>
              <View style={s.docCellRight}>
                <Text style={s.docLbl}>ขายโดย / Sale By</Text>
                <Text style={s.docVal}>{doc.salemanName ?? " "}</Text>
              </View>
            </View>
            <View style={s.docRow}>
              <View style={s.docCellLeft}>
                <Text style={s.docLbl}>กำหนดชำระ CREDIT TERM</Text>
                <Text style={s.docVal}>{doc.paymentTermsDays} วัน DAY</Text>
              </View>
              <View style={s.docCellRight}>
                <Text style={s.docLbl}>วันครบกำหนดชำระ / Due Date</Text>
                <Text style={s.docVal}>
                  {doc.dueDate ? formatThaiDateShort(doc.dueDate) : " "}
                </Text>
              </View>
            </View>
            <View style={s.docCellFull}>
              <Text style={s.docLbl}>อ้างอิง / REFERENCE</Text>
              <Text style={s.docVal}> </Text>
            </View>
          </View>
        </View>

        {/* ITEMS TABLE */}
        <View style={s.table}>
          <View style={s.thead}>
            <View style={[s.th, s.colNo]}>
              <Text style={s.thTh}>ลำดับ</Text>
              <Text style={s.thEn}>NO.</Text>
            </View>
            <View style={[s.th, s.colDesc]}>
              <Text style={s.thTh}>รายการสินค้า</Text>
              <Text style={s.thEn}>DESCRIPTION GOODS</Text>
            </View>
            <View style={[s.th, s.colQty]}>
              <Text style={s.thTh}>จำนวน</Text>
              <Text style={s.thEn}>QUANTITY</Text>
            </View>
            <View style={[s.th, s.colPrice]}>
              <Text style={s.thTh}>ราคาต่อหน่วย</Text>
              <Text style={s.thEn}>UNIT PRICE</Text>
            </View>
            <View style={[s.thLast, s.colAmt]}>
              <Text style={s.thTh}>จำนวนเงิน</Text>
              <Text style={s.thEn}>AMOUNT</Text>
            </View>
          </View>
          {items.map((it) => (
            <View key={it.lineNo} style={s.tr}>
              <Text style={[s.td, s.colNo]}>{it.lineNo}</Text>
              <Text style={[s.td, s.colDesc]}>{it.description ?? ""}</Text>
              <Text style={[s.td, s.colQty]}>
                {it.quantity ? formatMoney(it.quantity, it.quantity % 1 === 0 ? 0 : 2) : ""}
              </Text>
              <Text style={[s.td, s.colPrice]}>
                {it.unitPrice ? formatMoney(it.unitPrice) : ""}
              </Text>
              <Text style={[s.tdLast, s.colAmt]}>
                {it.amount ? formatMoney(it.amount) : ""}
              </Text>
            </View>
          ))}
          {Array.from({ length: blankRows }).map((_, i) => (
            <View key={`b${i}`} style={s.tr}>
              <Text style={[s.td, s.colNo]}> </Text>
              <Text style={[s.td, s.colDesc]}> </Text>
              <Text style={[s.td, s.colQty]}> </Text>
              <Text style={[s.td, s.colPrice]}> </Text>
              <Text style={[s.tdLast, s.colAmt]}> </Text>
            </View>
          ))}
        </View>

        {/* FOOTER: Notes+Words | Totals (2 cols) */}
        <View style={s.footerRow}>
          <View style={s.notes}>
            <Text>1. ในกรณีชำระด้วยเช็ค โปรดสั่งจ่ายเช็คขีดคร่อมในนาม {compTh} เท่านั้น</Text>
            <Text>2. ในกรณีที่จ่ายเช็ค ใบเสร็จรับเงินนี้จะสมบูรณ์ต่อเมื่อเช็คได้เรียกเก็บเงินจากธนาคารแล้ว</Text>
            <View style={s.wordsBlock}>
              <Text style={{ fontWeight: 600 }}>บาท</Text>
              <Text style={s.wordsTextBold}>ตัวอักษร ({alphaText})</Text>
            </View>
          </View>
          <View style={s.totals}>
            <View style={s.totalRow}>
              <View style={s.totalLbl}>
                <Text style={s.totalLblEn}>AMOUNT</Text>
                <Text style={s.totalLblTh}>รวมมูลค่า</Text>
              </View>
              <Text style={s.totalVal}>{formatMoney(doc.amountBeforeVat)}</Text>
            </View>
            <View style={s.totalRowMid}>
              <View style={s.totalLbl}>
                <Text style={s.totalLblEn}>VAT</Text>
                <Text style={s.totalLblTh}>ภาษีมูลค่าเพิ่ม {Number(doc.vatRate)}%</Text>
              </View>
              <Text style={s.totalVal}>{formatMoney(doc.vatAmount)}</Text>
            </View>
            <View style={s.totalRowLast}>
              <View style={s.totalLbl}>
                <Text style={s.totalLblEn}>TOTAL</Text>
                <Text style={s.totalLblTh}>รวมทั้งสิ้น</Text>
              </View>
              <Text style={s.totalValBig}>{formatMoney(doc.total)}</Text>
            </View>
          </View>
        </View>

        {/* SIGNATURES */}
        <View style={s.signBlock}>
          <View style={s.signColLeft}>
            <Text style={s.signTitle}>ได้รับสินค้าแล้วในสภาพที่เรียบร้อยและถูกต้อง</Text>
            <Text style={s.signTitleEn}>Goods Received In Good Order And Condition</Text>
            <View style={s.signLine}>
              <Text style={s.lblLine}>ผู้รับสินค้า</Text>
              <Text style={s.lblEn}>Received By</Text>
              <View style={s.dots} />
            </View>
            <View style={s.signLine}>
              <Text style={s.lblLine}>วันที่</Text>
              <Text style={s.lblEn}>Date</Text>
              <View style={s.dots} />
            </View>
            <View style={s.signLine}>
              <Text style={s.lblLine}>ผู้ส่งสินค้า</Text>
              <Text style={s.lblEn}>Delivery By</Text>
              <View style={s.dots} />
            </View>
            <View style={s.signLine}>
              <Text style={s.lblLine}>วันที่</Text>
              <Text style={s.lblEn}>Date</Text>
              <View style={s.dots} />
            </View>
          </View>

          <View style={s.signCol}>
            <View style={s.payRow}>
              <Text style={[s.signTitle, s.payCellLbl]}>ชำระโดย</Text>
              <View style={s.payCellCash}>
                <View style={s.cbx} />
                <Text style={s.ck}>เงินสด</Text>
              </View>
              <View style={s.payCellChq}>
                <View style={s.cbx} />
                <Text style={s.ck}>เช็ค</Text>
              </View>
              <View style={s.payCellTrf}>
                <View style={s.cbx} />
                <Text style={s.ck}>เงินโอน</Text>
              </View>
            </View>
            <View style={s.payRowEn}>
              <Text style={s.payCellLbl}>Paid By</Text>
              <Text style={s.payCellCash}>Cash</Text>
              <Text style={s.payCellChq}>Cheque</Text>
              <Text style={s.payCellTrf}>Transfer</Text>
            </View>
            <View style={s.signLine}>
              <Text>ธนาคาร</Text>
              <View style={[s.dots, { minWidth: 40 }]} />
              <Text>สาขา</Text>
              <View style={[s.dots, { minWidth: 40 }]} />
            </View>
            <View style={s.signLine}>
              <Text>เลขที่เช็ค</Text>
              <View style={[s.dots, { minWidth: 40 }]} />
              <Text>ลงวันที่</Text>
              <View style={[s.dots, { minWidth: 40 }]} />
            </View>
            <View style={s.signLine}>
              <Text>จำนวนเงิน</Text>
              <View style={s.dots} />
            </View>
            <View style={s.signLine}>
              <Text style={s.lblLine}>ผู้รับเงิน</Text>
              <Text style={s.lblEn}>Collector</Text>
              <View style={[s.dots, { minWidth: 30 }]} />
              <Text>วันที่</Text>
              <View style={[s.dots, { minWidth: 30 }]} />
            </View>
          </View>

          <View style={s.signColLast}>
            <Text style={s.forTitleBig}>ในนาม / For</Text>
            <Text style={s.signCompany}>{compTh}</Text>
            {compEn ? <Text style={s.signCompanyEn}>{compEn}</Text> : null}
            <View style={[s.signLine, { justifyContent: "center", marginTop: 56 }]}>
              <View style={[s.dots, { minWidth: 60 }]} />
            </View>
            <View style={s.signEnd}>
              <Text>ผู้มีอำนาจลงนาม</Text>
              <Text style={s.signTitleEn}>Authorized Signature</Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}
