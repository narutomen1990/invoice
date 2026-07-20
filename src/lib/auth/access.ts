// Route-level access control by user role.
// Only "staff" is restricted today — admin/manager/viewer keep full access
// until product asks otherwise.

export const STAFF_HOME = "/invoices";

const STAFF_ALLOWED_PREFIXES = [
  "/invoices", // บันทึกรายการใบกำกับภาษี
  "/withholding", // หนังสือรับรองหัก ณ ที่จ่าย
  "/customers", // บันทึกรายชื่อลูกค้า
  "/account", // เปลี่ยนรหัสผ่านของตัวเอง — ทุก role ต้องทำได้
  "/api/invoices",
  "/api/withholding",
];

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isPathAllowedForRole(role: string, pathname: string): boolean {
  if (role !== "staff") return true;
  return STAFF_ALLOWED_PREFIXES.some((p) => matchesPrefix(pathname, p));
}

export function defaultHomeForRole(role: string): string {
  return role === "staff" ? STAFF_HOME : "/";
}
