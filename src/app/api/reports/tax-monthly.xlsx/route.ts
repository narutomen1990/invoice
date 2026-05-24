import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { db } from "@/db/client";
import { sql } from "drizzle-orm";
import { getTaxMonthly, normalizeDocType } from "@/lib/queries/reports";
import { THAI_MONTHS_FULL, formatThaiDateShort } from "@/lib/thai/date";

const DOC_LABELS: Record<string, string> = {
  invoice: "ใบกำกับภาษีขาย",
  quotation: "ใบเสนอราคา",
  billing_slip: "ใบแจ้งหนี้",
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function branchLabel(code: string | null): string {
  if (!code) return "";
  const c = code.trim();
  if (!c || c === "00000") return "สำนักงานใหญ่";
  const n = parseInt(c, 10);
  if (n === 0) return "สำนักงานใหญ่";
  if (Number.isNaN(n)) return c;
  return `สาขา ${n}`;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const year = url.searchParams.get("year");
  const month = url.searchParams.get("month");
  const docType = normalizeDocType(url.searchParams.get("type") ?? undefined);
  const docLabel = DOC_LABELS[docType];
  if (!year || !month) {
    return NextResponse.json({ error: "year+month required" }, { status: 400 });
  }

  const showKind = docType === "invoice";
  const result = await getTaxMonthly({ year, month, docType });
  const [comp] = await db.execute<{ name_th: string; tax_id: string | null }>(
    sql`SELECT name_th, tax_id FROM companies LIMIT 1`,
  );

  const wb = new ExcelJS.Workbook();
  wb.creator = "Invoice App";
  wb.created = new Date();
  const ws = wb.addWorksheet(`${docLabel} ${month}-${year.slice(-2)}`);

  const fontTH = { name: "TH Sarabun New", size: 14 };
  const fontTHBold = { name: "TH Sarabun New", size: 14, bold: true };
  const fontTitle = { name: "TH Sarabun New", size: 18, bold: true };
  const center = { horizontal: "center" as const, vertical: "middle" as const };
  const border = {
    top: { style: "thin" as const },
    bottom: { style: "thin" as const },
    left: { style: "thin" as const },
    right: { style: "thin" as const },
  };
  const headerFill = {
    type: "pattern" as const,
    pattern: "solid" as const,
    fgColor: { argb: "FFDDDDDD" },
  };
  const netFill = {
    type: "pattern" as const,
    pattern: "solid" as const,
    fgColor: { argb: "FFD1FAE5" },
  };
  const cnRowFill = {
    type: "pattern" as const,
    pattern: "solid" as const,
    fgColor: { argb: "FFFFF1F2" },
  };

  const monthName = THAI_MONTHS_FULL[parseInt(month, 10)];

  // Column layout
  const headers = showKind
    ? [
        "ลำดับ",
        "ประเภท",
        "วันที่",
        "เลขที่",
        "ชื่อลูกค้า",
        "เลขผู้เสียภาษี",
        "สาขา",
        "มูลค่าก่อน VAT",
        "VAT",
        "รวมทั้งสิ้น",
      ]
    : [
        "ลำดับ",
        "วันที่",
        `เลขที่${docLabel}`,
        "ชื่อลูกค้า",
        "เลขผู้เสียภาษี",
        "สาขา",
        "มูลค่าก่อน VAT",
        "VAT",
        "รวมทั้งสิ้น",
      ];
  const NCOL = headers.length;
  const COL_ABV = NCOL - 2; // ก่อน VAT
  const COL_VAT = NCOL - 1; // VAT
  const COL_TOT = NCOL; // รวม

  // Title rows
  ws.mergeCells(1, 1, 1, NCOL);
  ws.getCell("A1").value = `รายงาน${docLabel} ประจำเดือน ${monthName} ${year}`;
  ws.getCell("A1").font = fontTitle;
  ws.getCell("A1").alignment = center;

  ws.mergeCells(2, 1, 2, NCOL);
  ws.getCell("A2").value =
    `${comp?.name_th ?? "-"}    เลขประจำตัวผู้เสียภาษี ${comp?.tax_id ?? "-"}`;
  ws.getCell("A2").font = fontTHBold;
  ws.getCell("A2").alignment = center;

  // Header row
  const headerRow = ws.getRow(4);
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font = fontTHBold;
    cell.alignment = center;
    cell.border = border;
    cell.fill = headerFill;
  });

  // Data rows
  let r = 5;
  for (const [idx, row] of result.rows.entries()) {
    const isCn = row.kind === "credit_note";
    const sign = isCn ? -1 : 1;
    const xlRow = ws.getRow(r);
    let c = 1;
    xlRow.getCell(c++).value = idx + 1;
    if (showKind) {
      const kindCell = xlRow.getCell(c++);
      kindCell.value = isCn ? "ลดหนี้" : "ขาย";
    }
    xlRow.getCell(c++).value = formatThaiDateShort(row.docDate);
    xlRow.getCell(c++).value = row.docNo;
    xlRow.getCell(c++).value = row.customerName ?? "";
    xlRow.getCell(c++).value = row.customerTaxId ?? "";
    xlRow.getCell(c++).value = branchLabel(row.customerBranch);
    xlRow.getCell(c++).value = sign * row.amountBeforeVat;
    xlRow.getCell(c++).value = sign * row.vatAmount;
    xlRow.getCell(c).value = sign * row.total;

    // formatting
    xlRow.getCell(1).alignment = center;
    if (showKind) xlRow.getCell(2).alignment = center;
    const dateCol = showKind ? 3 : 2;
    const docNoCol = showKind ? 4 : 3;
    const taxIdCol = showKind ? 6 : 5;
    const branchCol = showKind ? 7 : 6;
    xlRow.getCell(dateCol).alignment = center;
    xlRow.getCell(docNoCol).alignment = center;
    xlRow.getCell(taxIdCol).alignment = center;
    xlRow.getCell(branchCol).alignment = center;
    xlRow.getCell(COL_ABV).numFmt = "#,##0.00;-#,##0.00";
    xlRow.getCell(COL_VAT).numFmt = "#,##0.00;-#,##0.00";
    xlRow.getCell(COL_TOT).numFmt = "#,##0.00;-#,##0.00";

    for (let cc = 1; cc <= NCOL; cc++) {
      const cell = xlRow.getCell(cc);
      cell.font = isCn ? { ...fontTH, color: { argb: "FFBE123C" } } : fontTH;
      cell.border = border;
      if (isCn) cell.fill = cnRowFill;
    }
    r++;
  }

  // Summary rows
  function pushSummary(label: string, abv: number, vat: number, tot: number, opts: { bold?: boolean; fill?: typeof headerFill; color?: string }) {
    const row = ws.getRow(r);
    ws.mergeCells(r, 1, r, NCOL - 3);
    row.getCell(1).value = label;
    row.getCell(1).alignment = { horizontal: "right", vertical: "middle" };
    row.getCell(COL_ABV).value = abv;
    row.getCell(COL_VAT).value = vat;
    row.getCell(COL_TOT).value = tot;
    row.getCell(COL_ABV).numFmt = "#,##0.00;-#,##0.00";
    row.getCell(COL_VAT).numFmt = "#,##0.00;-#,##0.00";
    row.getCell(COL_TOT).numFmt = "#,##0.00;-#,##0.00";
    for (let cc = 1; cc <= NCOL; cc++) {
      const cell = row.getCell(cc);
      const font = { ...fontTH, bold: opts.bold ?? true };
      if (opts.color) (font as { color?: { argb: string } }).color = { argb: opts.color };
      cell.font = font;
      cell.border = border;
      if (opts.fill) cell.fill = opts.fill;
    }
    r++;
  }

  if (showKind) {
    pushSummary(
      `ยอดขายรวม (${result.summary.invoice.count} ใบ)`,
      result.summary.invoice.amountBeforeVat,
      result.summary.invoice.vatAmount,
      result.summary.invoice.total,
      { fill: headerFill },
    );
    pushSummary(
      `หัก: ใบลดหนี้ (${result.summary.credit.count} ใบ)`,
      -result.summary.credit.amountBeforeVat,
      -result.summary.credit.vatAmount,
      -result.summary.credit.total,
      { fill: cnRowFill, color: "FFBE123C" },
    );
    pushSummary(
      "คงเหลือสุทธิ (ยอดที่ต้องนำส่ง ภพ.30)",
      result.summary.net.amountBeforeVat,
      result.summary.net.vatAmount,
      result.summary.net.total,
      { fill: netFill, color: "FF065F46" },
    );
  } else {
    pushSummary(
      `รวมทั้งหมด ${result.summary.count} รายการ`,
      result.summary.invoice.amountBeforeVat,
      result.summary.invoice.vatAmount,
      result.summary.invoice.total,
      { fill: headerFill },
    );
  }

  // Column widths
  const widths = showKind
    ? [6, 10, 12, 16, 38, 16, 16, 16, 14, 16]
    : [6, 12, 18, 50, 18, 16, 16, 14, 16];
  widths.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });

  const buf = await wb.xlsx.writeBuffer();
  const filename = `${docType}_${month}-${year.slice(-2)}.xlsx`;

  return new NextResponse(buf as unknown as BodyInit, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
