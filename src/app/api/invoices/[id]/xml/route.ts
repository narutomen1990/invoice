import { NextResponse } from "next/server";
import { getInvoiceById } from "@/lib/queries/invoices";
import { buildEtaxInvoiceXml } from "@/lib/xml/etax-invoice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const numId = parseInt(id, 10);
  if (Number.isNaN(numId)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  const data = await getInvoiceById(numId);
  if (!data) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const xml = buildEtaxInvoiceXml(data);
  const safeName = data.doc.docNo.replace(/[\/\\]/g, "_");

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeName}.xml"`,
      "Cache-Control": "no-store",
    },
  });
}
