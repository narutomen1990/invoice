import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { db } from "@/db/client";
import { sql } from "drizzle-orm";
import { getTaxMonthly, normalizeDocType } from "@/lib/queries/reports";

const DOC_LABELS: Record<string, string> = {
  invoice: "ใบกำกับภาษีขาย",
  quotation: "ใบเสนอราคา",
  billing_slip: "ใบแจ้งหนี้",
};
import { THAI_MONTHS_FULL, formatThaiDateShort } from "@/lib/thai/date";

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
  const rightAlign = { horizontal: "right" as const };
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

  const monthName = THAI_MONTHS_FULL[parseInt(month, 10)];

  // Title row
  ws.mergeCells("A1:I1");
  ws.getCell("A1").value = `รายงาน${docLabel} ประจำเดือน ${monthName} ${year}`;
  ws.getCell("A1").font = fontTitle;
  ws.getCell("A1").alignment = center;

  ws.mergeCells("A2:I2");
  ws.getCell("A2").value = `${comp?.name_th ?? "-"}    เลขประจำตัวผู้เสียภาษี ${comp?.tax_id ?? "-"}`;
  ws.getCell("A2").font = fontTHBold;
  ws.getCell("A2").alignment = center;

  // Headers
  const headers = [
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
  let sumABV = 0,
    sumVAT = 0,
    sumTotal = 0;
  for (const [idx, row] of result.rows.entries()) {
    const xlRow = ws.getRow(r);
    xlRow.getCell(1).value = idx + 1;
    xlRow.getCell(1).alignment = center;
    xlRow.getCell(2).value = formatThaiDateShort(row.docDate);
    xlRow.getCell(2).alignment = center;
    xlRow.getCell(3).value = row.docNo;
    xlRow.getCell(3).alignment = center;
    xlRow.getCell(4).value = row.customerName ?? "";
    xlRow.getCell(5).value = row.customerTaxId ?? "";
    xlRow.getCell(5).alignment = center;
    xlRow.getCell(6).value = branchLabel(row.customerBranch);
    xlRow.getCell(6).alignment = center;
    xlRow.getCell(7).value = row.amountBeforeVat;
    xlRow.getCell(7).numFmt = "#,##0.00";
    xlRow.getCell(8).value = row.vatAmount;
    xlRow.getCell(8).numFmt = "#,##0.00";
    xlRow.getCell(9).value = row.total;
    xlRow.getCell(9).numFmt = "#,##0.00";
    for (let c = 1; c <= 9; c++) {
      const cell = xlRow.getCell(c);
      cell.font = fontTH;
      cell.border = border;
    }
    sumABV += row.amountBeforeVat;
    sumVAT += row.vatAmount;
    sumTotal += row.total;
    r++;
  }

  // Total row
  const totalRow = ws.getRow(r);
  ws.mergeCells(r, 1, r, 6);
  totalRow.getCell(1).value = "รวมทั้งหมด";
  totalRow.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
  totalRow.getCell(7).value = sumABV;
  totalRow.getCell(7).numFmt = "#,##0.00";
  totalRow.getCell(8).value = sumVAT;
  totalRow.getCell(8).numFmt = "#,##0.00";
  totalRow.getCell(9).value = sumTotal;
  totalRow.getCell(9).numFmt = "#,##0.00";
  for (let c = 1; c <= 9; c++) {
    const cell = totalRow.getCell(c);
    cell.font = fontTHBold;
    cell.border = border;
    cell.fill = headerFill;
  }

  // Column widths
  const widths = [6, 12, 18, 50, 18, 16, 16, 14, 16];
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
