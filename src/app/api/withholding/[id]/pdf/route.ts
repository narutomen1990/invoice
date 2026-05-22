import { NextResponse } from "next/server";
import { getWithholdingById } from "@/lib/queries/withholding";
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

  const wht = await getWithholdingById(numId);
  if (!wht) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const reqUrl = new URL(req.url);
  const download = reqUrl.searchParams.get("download") === "1";

  const cookieHeader = req.headers.get("cookie") || "";
  const sessionMatch = cookieHeader.match(
    new RegExp(`(?:^|; *)${AUTH_COOKIE_NAME}=([^;]+)`),
  );
  const sessionValue = sessionMatch?.[1];
  if (!sessionValue) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  // Puppeteer runs *inside* the container — render via localhost, never the
  // public domain (Docker has no NAT hairpin back to the public host).
  const origin = `http://127.0.0.1:${process.env.PORT ?? "3000"}`;
  const targetUrl = `${origin}/withholding/${numId}/print`;

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
    // make sure bundled Sarabun is fully applied before snapshotting the PDF
    await page.evaluate(async () => {
      await document.fonts.ready;
    });
    // print page is A4 landscape (@page) — CSS controls the size
    const pdf = await page.pdf({
      format: "A4",
      landscape: true,
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });

    const safeName = wht.docNo.replace(/[\/\\]/g, "_");
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
