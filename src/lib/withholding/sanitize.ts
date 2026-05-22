// ตัด null byte (0x00) + C0 control characters ที่ PostgreSQL เก็บไม่ได้
// (มักติดมาตอน copy ข้อความจาก PDF) — เก็บ tab(9)/newline(10)/CR(13) ไว้
export function cleanText(v: string): string {
  let out = "";
  for (let i = 0; i < v.length; i++) {
    const c = v.charCodeAt(i);
    // ลบ 0x00-0x1F ยกเว้น tab/LF/CR, และ 0x7F (DEL)
    if (c === 9 || c === 10 || c === 13 || (c >= 32 && c !== 127)) {
      out += v[i];
    }
  }
  return out;
}
