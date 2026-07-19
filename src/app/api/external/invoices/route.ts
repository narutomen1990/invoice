import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { documents, users } from "@/db/schema";
import { InvoiceInput, createInvoiceCore, type InvoiceInputData } from "@/lib/invoices/create-core";
import { toBE } from "@/lib/thai/date";

// ผู้ใช้ระบบที่ใช้เป็น createdByUserId/audit สำหรับใบกำกับที่สร้างผ่าน API นี้
// ต้องสร้างแถวนี้ไว้ล่วงหน้าด้วย SQL (ดู setup notes) — isActive=false กัน login ได้จริง
const SYSTEM_USERNAME = "service-center-api";

const ExternalItemInput = z.object({
  description: z.string().min(1),
  quantity: z.coerce.number().min(0).default(1),
  unit: z.string().nullable().optional(),
  unitPrice: z.coerce.number().min(0).default(0),
  amount: z.coerce.number(),
});

// docDate เป็นปี ค.ศ. ปกติ ("YYYY-MM-DD") — แปลงเป็น พ.ศ. ก่อนส่งต่อ เพราะ
// documents.docDate ในแอปนี้เก็บเป็นปี พ.ศ. เสมอ (ดู src/lib/thai/date.ts::todayBE
// ที่ใช้ตั้งค่าเริ่มต้นของฟอร์มสร้างใบกำกับปกติ)
const ExternalInvoiceInput = z.object({
  externalRef: z.string().min(1).max(100),
  docDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "docDate ต้องเป็นรูปแบบ YYYY-MM-DD (ปี ค.ศ.)"),
  customerName: z.string().min(1, "กรุณาระบุชื่อลูกค้า"),
  customerTaxId: z.string().nullable().optional(),
  customerAddress: z.string().nullable().optional(),
  customerTel: z.string().nullable().optional(),
  discount: z.coerce.number().min(0).default(0),
  vatRate: z.coerce.number().min(0).max(100).default(7),
  memo: z.string().nullable().optional(),
  remark1: z.string().nullable().optional(),
  items: z.array(ExternalItemInput).min(1, "ต้องมีอย่างน้อย 1 รายการ"),
});

function toBEDateString(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${toBE(Number(y))}-${m}-${d}`;
}

export async function GET() {
  return NextResponse.json({ ok: true });
}

// สร้างใบกำกับภาษีแบบ "draft" จากระบบภายนอก (เช่น service-center) — ต้อง
// ตรวจ/เติมข้อมูลลูกค้าและกด "ออกจริง" (issued) เองในระบบนี้เสมอ ไม่ auto-issue
export async function POST(req: NextRequest) {
  const key = process.env.EXTERNAL_API_KEY;
  const authHeader = req.headers.get("authorization");
  if (!key || authHeader !== `Bearer ${key}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: z.infer<typeof ExternalInvoiceInput>;
  try {
    body = ExternalInvoiceInput.parse(await req.json());
  } catch (e: any) {
    const msg = e?.errors?.[0]?.message ?? e?.message ?? "ข้อมูลไม่ถูกต้อง";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  // idempotent — เคยสร้างจาก externalRef นี้แล้ว คืนของเดิม ไม่สร้างซ้ำ
  const [existing] = await db
    .select({ id: documents.id, docNo: documents.docNo, status: documents.status })
    .from(documents)
    .where(eq(documents.externalRef, body.externalRef))
    .limit(1);
  if (existing) {
    return NextResponse.json({ ok: true, alreadyExists: true, ...existing });
  }

  const [systemUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, SYSTEM_USERNAME))
    .limit(1);
  if (!systemUser) {
    return NextResponse.json(
      { error: `ยังไม่ได้สร้าง system user "${SYSTEM_USERNAME}" — ดูขั้นตอน setup` },
      { status: 500 },
    );
  }

  const input: InvoiceInputData = InvoiceInput.parse({
    docDate: toBEDateString(body.docDate),
    customerName: body.customerName,
    customerTaxId: body.customerTaxId ?? null,
    customerAddress: body.customerAddress ?? null,
    customerTel: body.customerTel ?? null,
    discount: body.discount,
    vatRate: body.vatRate,
    memo: body.memo ?? null,
    remark1: body.remark1 ?? null,
    items: body.items,
  });

  try {
    const result = await createInvoiceCore(input, {
      userId: systemUser.id,
      userNameSnapshot: "service-center (API)",
      status: "draft",
      externalRef: body.externalRef,
    });
    return NextResponse.json({ ok: true, id: result.id, docNo: result.docNo, status: "draft" });
  } catch (e: any) {
    // race: อีก request สร้าง externalRef เดียวกันไปพร้อมกัน — ดึงอันที่มีอยู่มาคืนแทน
    if (e?.code === "23505") {
      const [race] = await db
        .select({ id: documents.id, docNo: documents.docNo, status: documents.status })
        .from(documents)
        .where(eq(documents.externalRef, body.externalRef))
        .limit(1);
      if (race) return NextResponse.json({ ok: true, alreadyExists: true, ...race });
    }
    return NextResponse.json({ error: e?.message ?? "สร้างใบกำกับไม่สำเร็จ" }, { status: 500 });
  }
}
