import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { db } from "@/db/client";
import { sql } from "drizzle-orm";
import { getServiceCenterTaxMonthly } from "@/lib/queries/reports";
import { THAI_MONTHS_FULL, formatThaiDateShort } from "@/lib/thai/date";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  draft: "ร่าง",
  issued: "ออกแล้ว",
  cancelled: "ยกเลิก",
  voided: "โมฆะ",
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

export async function GET(req: Request) {
  const url = new URL(req.url);
  const year = url.searchParams.get("year");
  const month = url.searchParams.get("month");
  if (!year || !month) {
    return NextResponse.json({ error: "year+month required" }, { status: 400 });
  }

  const result = await getServiceCenterTaxMonthly({ year, month });
  const [comp] = await db.execute<{ name_th: string; tax_id: string | null }>(
    sql`SELECT name_th, tax_id FROM companies LIMIT 1`,
  );

  const wb = new ExcelJS.Workbook();
  wb.creator = "Invoice App";
  wb.created = new Date();
  const ws = wb.addWorksheet(`งานซ่อม ${month}-${year.slice(-2)}`);

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

  const monthName = THAI_MONTHS_FULL[parseInt(month, 10)];

  const headers = [
    "ลำดับ",
    "สถานะ",
    "วันที่",
    "เลขที่ใบกำกับ",
    "ชื่อลูกค้า",
    "เลขผู้เสียภาษี",
    "สาขา",
    "อ้างอิง service-center",
    "มูลค่าก่อน VAT",
    "VAT",
    "รวมทั้งสิ้น",
  ];
  const NCOL = headers.length;
  const COL_ABV = NCOL - 2;
  const COL_VAT = NCOL - 1;
  const COL_TOT = NCOL;

  // Title rows
  ws.mergeCells(1, 1, 1, NCOL);
  ws.getCell("A1").value = `รายงานภาษีงานซ่อม (service-center) ประจำเดือน ${monthName} ${year}`;
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
    const xlRow = ws.getRow(r);
    let c = 1;
    xlRow.getCell(c++).value = idx + 1;
    xlRow.getCell(c++).value = STATUS_LABELS[row.status] ?? row.status;
    xlRow.getCell(c++).value = formatThaiDateShort(row.docDate);
    xlRow.getCell(c++).value = row.docNo;
    xlRow.getCell(c++).value = row.customerName ?? "";
    xlRow.getCell(c++).value = row.customerTaxId ?? "";
    xlRow.getCell(c++).value = branchLabel(row.customerBranch);
    xlRow.getCell(c++).value = row.externalRef ?? "";
    xlRow.getCell(c++).value = row.amountBeforeVat;
    xlRow.getCell(c++).value = row.vatAmount;
    xlRow.getCell(c).value = row.total;

    xlRow.getCell(1).alignment = center;
    xlRow.getCell(2).alignment = center;
    xlRow.getCell(3).alignment = center;
    xlRow.getCell(4).alignment = center;
    xlRow.getCell(6).alignment = center;
    xlRow.getCell(7).alignment = center;
    xlRow.getCell(COL_ABV).numFmt = "#,##0.00;-#,##0.00";
    xlRow.getCell(COL_VAT).numFmt = "#,##0.00;-#,##0.00";
    xlRow.getCell(COL_TOT).numFmt = "#,##0.00;-#,##0.00";

    for (let cc = 1; cc <= NCOL; cc++) {
      const cell = xlRow.getCell(cc);
      cell.font = fontTH;
      cell.border = border;
    }
    r++;
  }

  // Summary row
  const summaryRow = ws.getRow(r);
  ws.mergeCells(r, 1, r, NCOL - 3);
  summaryRow.getCell(1).value = `รวม ${result.summary.count} ใบ`;
  summaryRow.getCell(1).alignment = { horizontal: "right", vertical: "middle" };
  summaryRow.getCell(COL_ABV).value = result.summary.amountBeforeVat;
  summaryRow.getCell(COL_VAT).value = result.summary.vatAmount;
  summaryRow.getCell(COL_TOT).value = result.summary.total;
  summaryRow.getCell(COL_ABV).numFmt = "#,##0.00;-#,##0.00";
  summaryRow.getCell(COL_VAT).numFmt = "#,##0.00;-#,##0.00";
  summaryRow.getCell(COL_TOT).numFmt = "#,##0.00;-#,##0.00";
  for (let cc = 1; cc <= NCOL; cc++) {
    const cell = summaryRow.getCell(cc);
    cell.font = { ...fontTH, bold: true };
    cell.border = border;
    cell.fill = netFill;
  }

  // Column widths
  const widths = [6, 10, 12, 18, 38, 16, 14, 20, 16, 14, 16];
  widths.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });

  const buf = await wb.xlsx.writeBuffer();
  const filename = `service-center_${month}-${year.slice(-2)}.xlsx`;

  return new NextResponse(buf as unknown as BodyInit, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
