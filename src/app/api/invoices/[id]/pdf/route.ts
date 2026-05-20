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

  const origin = `${reqUrl.protocol}//${reqUrl.host}`;
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
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "8mm", right: "8mm", bottom: "8mm", left: "8mm" },
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
