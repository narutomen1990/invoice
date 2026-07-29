"use server";

import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { getSession } from "@/lib/auth/session";
import { todayBE } from "@/lib/thai/date";

export type DocFormatSummaryItem = {
  documentType: string;
  label: string;
  prefix: string;
  formatExample: string;
  nextDocNo: string;
};

const COUNTER_TYPES: { documentType: string; label: string; prefix: string }[] = [
  { documentType: "invoice", label: "ใบกำกับภาษีขาย", prefix: "IV" },
  { documentType: "quotation", label: "ใบเสนอราคา", prefix: "QT" },
  { documentType: "billing_slip", label: "ใบวางบิล / ใบแจ้งหนี้", prefix: "BS" },
  { documentType: "credit_note", label: "ใบลดหนี้", prefix: "CN" },
];

/** Read-only summary of the doc-number scheme + next number (this month) for every document type. Admin only. */
export async function getDocNumberSummaryAction(): Promise<{
  error?: string;
  items?: DocFormatSummaryItem[];
}> {
  const session = await getSession();
  if (!session) return { error: "session หมดอายุ" };
  if (session.role !== "admin") return { error: "เฉพาะ admin เท่านั้น" };

  const [yyyy, mm] = todayBE().split("-");
  const yearBe = (yyyy ?? "0000").slice(-2);
  const month = (mm ?? "01").padStart(2, "0");

  const items: DocFormatSummaryItem[] = [];
  for (const t of COUNTER_TYPES) {
    const key = `${t.documentType}:${yearBe}:${month}`;
    const [row] = await db.execute<{ current_value: string | null }>(sql`
      SELECT current_value::text FROM counters WHERE key = ${key} LIMIT 1
    `);
    const next = (Number(row?.current_value ?? 0) || 0) + 1;
    items.push({
      documentType: t.documentType,
      label: t.label,
      prefix: t.prefix,
      formatExample: `${t.prefix}yy/mm-#####`,
      nextDocNo: `${t.prefix}${yearBe}/${month}-${String(next).padStart(5, "0")}`,
    });
  }

  // Withholding certs use their own table + a Gregorian-dated issue date input, so
  // compute yy/mm from the wall-clock date directly rather than todayBE().
  const now = new Date();
  const whtYearBe = String((now.getFullYear() + 543) % 100).padStart(2, "0");
  const whtMonth = String(now.getMonth() + 1).padStart(2, "0");
  const [whtRow] = await db.execute<{ next: string | number }>(sql`
    SELECT COALESCE(MAX(sequence_no), 0) + 1 AS next
      FROM withholding_certificates
     WHERE doc_no LIKE ${"WHT" + whtYearBe + whtMonth + "-%"}
  `);
  const whtNext = Number(whtRow?.next ?? 1);
  items.push({
    documentType: "withholding",
    label: "หนังสือรับรองหัก ณ ที่จ่าย",
    prefix: "WHT",
    formatExample: "WHTyymm-###",
    nextDocNo: `WHT${whtYearBe}${whtMonth}-${String(whtNext).padStart(3, "0")}`,
  });

  return { items };
}
