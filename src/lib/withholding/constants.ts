// ค่าคงที่สำหรับหนังสือรับรองการหักภาษี ณ ที่จ่าย (50 ทวิ)

export type WhtFormType =
  | "pnd1a"
  | "pnd1a_special"
  | "pnd2"
  | "pnd2a"
  | "pnd3"
  | "pnd3a"
  | "pnd53";

export const WHT_FORM_TYPES: { value: WhtFormType; label: string }[] = [
  { value: "pnd1a", label: "ภ.ง.ด. 1ก" },
  { value: "pnd1a_special", label: "ภ.ง.ด. 1ก พิเศษ" },
  { value: "pnd2", label: "ภ.ง.ด. 2" },
  { value: "pnd2a", label: "ภ.ง.ด. 2ก" },
  { value: "pnd3", label: "ภ.ง.ด. 3" },
  { value: "pnd3a", label: "ภ.ง.ด. 3ก" },
  { value: "pnd53", label: "ภ.ง.ด. 53" },
];

export function whtFormLabel(v: string): string {
  return WHT_FORM_TYPES.find((f) => f.value === v)?.label ?? v;
}

// ประเภทเงินได้พึงประเมิน (หมวด 1-6 ของฟอร์ม 50 ทวิ)
export type WhtCategory =
  | "40_1"
  | "40_2"
  | "40_3"
  | "40_4a"
  | "40_4b"
  | "sec3tres"
  | "other";

export const WHT_CATEGORIES: { value: WhtCategory; label: string }[] = [
  { value: "40_1", label: "1. เงินเดือน ค่าจ้าง เบี้ยเลี้ยง โบนัส ฯลฯ ตามมาตรา 40(1)" },
  { value: "40_2", label: "2. ค่าธรรมเนียม ค่านายหน้า ฯลฯ ตามมาตรา 40(2)" },
  { value: "40_3", label: "3. ค่าแห่งลิขสิทธิ์ ฯลฯ ตามมาตรา 40(3)" },
  { value: "40_4a", label: "4(ก). ค่าดอกเบี้ย ฯลฯ ตามมาตรา 40(4)(ก)" },
  { value: "40_4b", label: "4(ข). เงินปันผล ส่วนแบ่งกำไร ฯลฯ ตามมาตรา 40(4)(ข)" },
  {
    value: "sec3tres",
    label: "5. ค่าบริการ/ค่าจ้าง/ค่าเช่า ฯลฯ (มาตรา 3 เตรส)",
  },
  { value: "other", label: "6. อื่นๆ" },
];

export function whtCategoryLabel(v: string): string {
  return WHT_CATEGORIES.find((c) => c.value === v)?.label ?? v;
}

// เงื่อนไขการหักภาษี
export type WhtCondition = "withhold" | "pay_always" | "pay_once" | "other";

export const WHT_CONDITIONS: { value: WhtCondition; label: string }[] = [
  { value: "withhold", label: "หักภาษี ณ ที่จ่าย" },
  { value: "pay_always", label: "ออกภาษีให้ตลอดไป" },
  { value: "pay_once", label: "ออกภาษีให้ครั้งเดียว" },
  { value: "other", label: "อื่นๆ" },
];

export type WhtItem = {
  category: string;
  description: string;
  datePaid: string;
  amount: number;
  tax: number;
};
