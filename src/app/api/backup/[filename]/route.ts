import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { resolveBackupPath } from "@/lib/backup/core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ filename: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "session หมดอายุ" }, { status: 401 });
  }
  if (session.role !== "admin") {
    return NextResponse.json({ error: "เฉพาะ admin เท่านั้น" }, { status: 403 });
  }

  const { filename } = await params;
  let filepath: string;
  try {
    filepath = resolveBackupPath(decodeURIComponent(filename));
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "ชื่อไฟล์ไม่ถูกต้อง" },
      { status: 400 },
    );
  }

  let buf: Buffer;
  try {
    buf = await readFile(filepath);
  } catch {
    return NextResponse.json({ error: "ไม่พบไฟล์สำรองนี้" }, { status: 404 });
  }

  return new NextResponse(buf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
