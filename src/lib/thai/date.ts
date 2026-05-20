/**
 * Thai date utilities
 *  - convert between Gregorian (ค.ศ.) and Buddhist Era (พ.ศ.) — diff 543 years
 *  - format Thai month names
 */
export const THAI_MONTHS_FULL = [
  "",
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
] as const;

export const THAI_MONTHS_SHORT = [
  "",
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
] as const;

/** convert Gregorian year → Buddhist year */
export function toBE(year: number): number {
  return year + 543;
}

/** convert Buddhist year → Gregorian year */
export function toCE(year: number): number {
  return year - 543;
}

/** ISO date string 'YYYY-MM-DD' (Buddhist year) → '9 มกราคม 2562' */
export function formatThaiDateFull(iso?: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  if (!y || !m || !d) return iso;
  const month = THAI_MONTHS_FULL[parseInt(m, 10)];
  return `${parseInt(d, 10)} ${month} ${y}`;
}

/** ISO date string → 'DD/MM/YYYY' */
export function formatThaiDateShort(iso?: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  if (!y || !m || !d) return iso;
  return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
}

/** today as Buddhist-era ISO 'YYYY-MM-DD' */
export function todayBE(): string {
  const t = new Date();
  const y = toBE(t.getFullYear());
  const m = String(t.getMonth() + 1).padStart(2, "0");
  const d = String(t.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
