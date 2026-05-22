import { NextResponse } from "next/server";
import { getInvoiceById } from "@/lib/queries/invoices";
import { AUTH_COOKIE_NAME } from "@/lib/auth/session";
import { getBrowser } from "@/lib/pdf/browser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
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

  const reqUrl = new URL(req.url);
  const sp = reqUrl.searchParams;
  const download = sp.get("download") === "1";

  const printParams = new URLSearchParams();
  if (sp.get("form")) printParams.set("form", sp.get("form")!);
  if (sp.get("copy")) printParams.set("copy", sp.get("copy")!);
  if (sp.get("stamp")) printParams.set("stamp", sp.get("stamp")!);
  const qs = printParams.toString();
  const printPath = `/invoices/${numId}/print${qs ? `?${qs}` : ""}`;

  const cookieHeader = req.headers.get("cookie") || "";
  const sessionMatch = cookieHeader.match(
    new RegExp(`(?:^|; *)${AUTH_COOKIE_NAME}=([^;]+)`),
  );
  const sessionValue = sessionMatch?.[1];
  if (!sessionValue) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  // Puppeteer runs *inside* the container — render the print page via localhost,
  // never the public domain. Docker has no NAT hairpin back to the public host,
  // so page.goto() to invoice.vmcamera.com hangs and the PDF download fails
  // ("site wasn't available"). 127.0.0.1 talks straight to this same server.
  const origin = `http://127.0.0.1:${process.env.PORT ?? "3000"}`;
  const targetUrl = `${origin}${printPath}`;

  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setCookie({
      name: AUTH_COOKIE_NAME,
      value: sessionValue,
      url: origin,
      httpOnly: true,
      sameSite: "Lax",
    });
    await page.emulateMediaType("print");
    await page.goto(targetUrl, { waitUntil: "networkidle0", timeout: 30000 });
    // CSS @page (A4, margin 0) คุมขนาดเอง — ห้ามใส่ margin ซ้ำ
    // ไม่งั้นพื้นที่พิมพ์จะเล็กลง ฟอร์ม 210mm จะล้น
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });

    const safeName = data.doc.docNo.replace(/[\/\\]/g, "_");
    const disposition = download ? "attachment" : "inline";
    return new NextResponse(pdf as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${disposition}; filename="${safeName}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } finally {
    await page.close().catch(() => {});
  }
}
