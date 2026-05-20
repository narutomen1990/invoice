import { sql } from "drizzle-orm";
import type { DB } from "@/db/client";

type DocType = "invoice" | "quotation" | "billing_slip" | "credit_note" | "debit_note";

const DEFAULT_PREFIX: Record<DocType, string> = {
  invoice: "IV",
  quotation: "QT",
  billing_slip: "BS",
  credit_note: "CN",
  debit_note: "DN",
};

export type DocNoParts = {
  prefix: string;
  yearBe: string;
  month: string;
  value: number;
  docNo: string;
};

/** Build doc_no string in standard format: IV69/05-17805 */
export function buildDocNo(prefix: string, yearBe: string, month: string, value: number): string {
  return `${prefix}${yearBe}/${month}-${String(value).padStart(5, "0")}`;
}

/** Parse doc_no like 'IV69/05-17805' → parts. Returns null if invalid format. */
export function parseDocNo(docNo: string): DocNoParts | null {
  const trimmed = docNo.trim();
  // pattern: <prefix><yy>/<mm>-<value>
  const m = /^([A-Za-z]+)(\d{2})\/(\d{2})-(\d+)$/.exec(trimmed);
  if (!m) return null;
  return {
    prefix: m[1]!,
    yearBe: m[2]!,
    month: m[3]!,
    value: parseInt(m[4]!, 10),
    docNo: trimmed,
  };
}

/**
 * Reserve next AUTO doc_no for the given month (BE year).
 * Uses advisory lock + atomic increment.
 */
export async function reserveNextDocNo(
  tx: DB,
  opts: {
    documentType: DocType;
    docDateBE: string;
    prefix?: string;
  },
): Promise<DocNoParts> {
  const [yyyy, mm] = opts.docDateBE.split("-");
  const yearBe = (yyyy ?? "0000").slice(-2);
  const month = (mm ?? "01").padStart(2, "0");
  const prefix = opts.prefix ?? DEFAULT_PREFIX[opts.documentType];
  const key = `${opts.documentType}:${yearBe}:${month}`;

  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${key}))`);
  const [row] = await tx.execute<{ current_value: number }>(sql`
    INSERT INTO counters (key, document_type, year_be, month, current_value, prefix, updated_at)
    VALUES (${key}, ${opts.documentType}::document_type, ${yearBe}, ${month}, 1, ${prefix}, now())
    ON CONFLICT (key) DO UPDATE
      SET current_value = counters.current_value + 1,
          updated_at = now()
    RETURNING current_value
  `);
  const value = Number(row.current_value);
  return { prefix, yearBe, month, value, docNo: buildDocNo(prefix, yearBe, month, value) };
}

/**
 * Use a CUSTOM doc_no provided by user.
 *  - validate format
 *  - take advisory lock to serialize with auto-reserve
 *  - if value > current counter → bump counter forward (skip ahead allowed)
 *  - if value <= counter → leave counter alone (filling a gap)
 *  - DB unique constraint catches actual duplicates → caller must handle
 */
export async function useCustomDocNo(
  tx: DB,
  opts: {
    documentType: DocType;
    customDocNo: string;
  },
): Promise<DocNoParts> {
  const parts = parseDocNo(opts.customDocNo);
  if (!parts) {
    throw new Error(
      `รูปแบบเลขที่เอกสารไม่ถูกต้อง: "${opts.customDocNo}" — ต้องเป็นรูป IV69/05-17805`,
    );
  }
  const key = `${opts.documentType}:${parts.yearBe}:${parts.month}`;

  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${key}))`);

  // bump counter to max(existing, custom value); insert if missing
  await tx.execute(sql`
    INSERT INTO counters (key, document_type, year_be, month, current_value, prefix, updated_at)
    VALUES (${key}, ${opts.documentType}::document_type, ${parts.yearBe}, ${parts.month},
            ${parts.value}, ${parts.prefix}, now())
    ON CONFLICT (key) DO UPDATE
      SET current_value = GREATEST(counters.current_value, ${parts.value}),
          updated_at = now()
  `);

  return parts;
}
