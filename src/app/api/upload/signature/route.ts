import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { getSession } from "@/lib/auth/session";

const ALLOWED_ROLES = [
  "authorized",
  "receiver",
  "presenter",
  "billing",
  "stamp",
] as const;
type Role = (typeof ALLOWED_ROLES)[number];
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "session หมดอายุ" }, { status: 401 });
  }
  if (session.role !== "admin") {
    return NextResponse.json(
      { error: "เฉพาะ admin เท่านั้น" },
      { status: 403 },
    );
  }

  const url = new URL(req.url);
  const role = url.searchParams.get("role") as Role | null;
  if (!role || !ALLOWED_ROLES.includes(role)) {
    return NextResponse.json({ error: "role ไม่ถูกต้อง" }, { status: 400 });
  }

  const fd = await req.formData();
  const file = fd.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "ไม่พบไฟล์" }, { status: 400 });
  }
  if (file.size === 0 || file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "ขนาดไฟล์ต้องไม่เกิน 2 MB" },
      { status: 400 },
    );
  }
  const ext = (() => {
    const t = file.type.toLowerCase();
    if (t.includes("png")) return "png";
    if (t.includes("gif")) return "gif";
    if (t.includes("webp")) return "webp";
    return "jpg";
  })();

  const filename = `${role}-${Date.now()}.${ext}`;
  const dir = path.join(process.cwd(), "public", "uploads", "signatures");
  await fs.mkdir(dir, { recursive: true });
  const buf = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(dir, filename), buf);

  return NextResponse.json({
    path: `/uploads/signatures/${filename}`,
    role,
  });
}
