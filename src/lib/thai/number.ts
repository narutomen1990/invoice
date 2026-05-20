/**
 * Convert number → Thai amount in words (บาทถ้วน / สตางค์)
 *   2140.00  → 'สองพันหนึ่งร้อยสี่สิบบาทถ้วน'
 *   100.50   → 'หนึ่งร้อยบาทห้าสิบสตางค์'
 */
const DIGITS = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
const UNITS = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน", "ล้าน"];

function readInt(num: number): string {
  if (num === 0) return "ศูนย์";
  const str = String(num);

  if (str.length > 7) {
    const high = readInt(parseInt(str.slice(0, -6), 10));
    const lowNum = parseInt(str.slice(-6), 10);
    return high + "ล้าน" + (lowNum > 0 ? readInt(lowNum) : "");
  }

  let result = "";
  const n = str.length;
  for (let i = 0; i < n; i++) {
    const d = parseInt(str[i]!, 10);
    const pos = n - i - 1; // 0..6
    if (d === 0) continue;
    if (pos === 1 && d === 1) result += "สิบ";
    else if (pos === 1 && d === 2) result += "ยี่สิบ";
    else if (pos === 0 && d === 1 && n > 1) result += "เอ็ด";
    else result += DIGITS[d] + UNITS[pos];
  }
  return result;
}

export function bahtText(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || amount === "") return "";
  const amt = Math.round(parseFloat(String(amount)) * 100) / 100;
  if (Number.isNaN(amt)) return "";

  const baht = Math.floor(Math.abs(amt));
  const satang = Math.round((Math.abs(amt) - baht) * 100);
  const sign = amt < 0 ? "ลบ" : "";

  let text = sign + readInt(baht) + "บาท";
  text += satang === 0 ? "ถ้วน" : readInt(satang) + "สตางค์";
  return text;
}

export function formatMoney(n: number | string | null | undefined, decimals = 2): string {
  if (n === null || n === undefined || n === "") return "0.00";
  const num = Number(n);
  if (Number.isNaN(num)) return "0.00";
  return num.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
