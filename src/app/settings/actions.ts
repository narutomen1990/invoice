"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { companies, settings } from "@/db/schema";
import { getSession } from "@/lib/auth/session";

const SIGNATURES_KEY = "signatures";

type SignerSlot = {
  enabled: boolean;
  path: string | null;
  nameEnabled: boolean;
  name: string;
};

type StampSlot = {
  enabled: boolean;
  path: string | null;
};

export type SignaturesValue = {
  authorized: SignerSlot;
  receiver: SignerSlot;
  presenter: SignerSlot;
  billing: SignerSlot;
  stamp: StampSlot;
  receiverDateEnabled: boolean;
  presenterDateEnabled: boolean;
};

const emptySlot = (): SignerSlot => ({
  enabled: false,
  path: null,
  nameEnabled: false,
  name: "",
});

const emptyStamp = (): StampSlot => ({ enabled: false, path: null });

const slotFromRaw = (raw: any): SignerSlot => ({
  enabled: !!raw?.enabled,
  path: raw?.path ?? null,
  nameEnabled: !!raw?.nameEnabled,
  name: String(raw?.name ?? ""),
});

const stampFromRaw = (raw: any): StampSlot => ({
  enabled: !!raw?.enabled,
  path: raw?.path ?? null,
});

export async function getSignaturesAction(): Promise<SignaturesValue> {
  const [row] = await db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, SIGNATURES_KEY))
    .limit(1);
  const v = (row?.value as any) ?? {};
  return {
    authorized: slotFromRaw(v.authorized) ?? emptySlot(),
    receiver: slotFromRaw(v.receiver) ?? emptySlot(),
    presenter: slotFromRaw(v.presenter) ?? emptySlot(),
    billing: slotFromRaw(v.billing) ?? emptySlot(),
    stamp: v.stamp ? stampFromRaw(v.stamp) : emptyStamp(),
    receiverDateEnabled: !!v.receiverDateEnabled,
    presenterDateEnabled: !!v.presenterDateEnabled,
  };
}

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const sn = (fd: FormData, k: string) => s(fd, k) || null;
const i = (fd: FormData, k: string, def = 0) => {
  const v = parseInt(s(fd, k), 10);
  return Number.isNaN(v) ? def : v;
};

export async function updateCompanyAction(formData: FormData): Promise<{ error?: string; ok?: boolean }> {
  const session = await getSession();
  if (!session) return { error: "session หมดอายุ" };
  if (session.role !== "admin") return { error: "เฉพาะ admin เท่านั้น" };

  const nameTh = s(formData, "nameTh");
  if (!nameTh) return { error: "ชื่อกิจการ (ไทย) ห้ามว่าง" };

  // Build combined addresses from parts (for backward-compat printing)
  const addressTh = [
    sn(formData, "buildingTh"),
    sn(formData, "mooTh") ? `หมู่ ${sn(formData, "mooTh")}` : null,
    sn(formData, "soiTh") ? `ซอย${sn(formData, "soiTh")}` : null,
    sn(formData, "roadTh") ? `ถนน${sn(formData, "roadTh")}` : null,
    sn(formData, "subDistrictTh") ? `แขวง/ตำบล${sn(formData, "subDistrictTh")}` : null,
    sn(formData, "districtTh") ? `เขต/อำเภอ${sn(formData, "districtTh")}` : null,
    sn(formData, "provinceTh") ? `จังหวัด${sn(formData, "provinceTh")}` : null,
    sn(formData, "postcode"),
  ]
    .filter(Boolean)
    .join(" ");

  const addressEn = [
    sn(formData, "buildingEn"),
    sn(formData, "mooEn"),
    sn(formData, "soiEn"),
    sn(formData, "roadEn"),
    sn(formData, "subDistrictEn"),
    sn(formData, "districtEn"),
    sn(formData, "provinceEn"),
    sn(formData, "postcode"),
  ]
    .filter(Boolean)
    .join(" ");

  const data = {
    code: sn(formData, "code"),
    nameTh,
    // Tab 1: Thai address
    buildingTh: sn(formData, "buildingTh"),
    mooTh: sn(formData, "mooTh"),
    soiTh: sn(formData, "soiTh"),
    roadTh: sn(formData, "roadTh"),
    subDistrictTh: sn(formData, "subDistrictTh"),
    districtTh: sn(formData, "districtTh"),
    provinceTh: sn(formData, "provinceTh"),
    postcode: sn(formData, "postcode"),
    tel: sn(formData, "tel"),
    fax: sn(formData, "fax"),
    email: sn(formData, "email"),
    website: sn(formData, "website"),
    taxId: sn(formData, "taxId"),
    branchCode: s(formData, "branchCode") || "00000",
    vatRate: (parseFloat(s(formData, "vatRate")) || 7).toFixed(2),
    logoPath: sn(formData, "logoPath"),
    // Tab 2: English address
    nameEn: sn(formData, "nameEn"),
    buildingEn: sn(formData, "buildingEn"),
    mooEn: sn(formData, "mooEn"),
    soiEn: sn(formData, "soiEn"),
    roadEn: sn(formData, "roadEn"),
    subDistrictEn: sn(formData, "subDistrictEn"),
    districtEn: sn(formData, "districtEn"),
    provinceEn: sn(formData, "provinceEn"),
    // Tab 3: Document format
    paperSize: s(formData, "paperSize") || "A4",
    businessType: s(formData, "businessType") || "goods_service",
    saleType: s(formData, "saleType") || "cash",
    // Tab 4: Number format
    docNumberFormat: i(formData, "docNumberFormat", 3),
    docNumberYearBe: sn(formData, "docNumberYearBe"),
    docNumberMonth: sn(formData, "docNumberMonth"),
    invoicePrefix: s(formData, "invoicePrefix") || "IV",
    quotationPrefix: s(formData, "quotationPrefix") || "QT",
    billingPrefix: s(formData, "billingPrefix") || "IN",
    debitNotePrefix: s(formData, "debitNotePrefix") || "DN",
    lastInvoiceNo: i(formData, "lastInvoiceNo"),
    lastQuotationNo: i(formData, "lastQuotationNo"),
    lastBillingNo: i(formData, "lastBillingNo"),
    lastDebitNoteNo: i(formData, "lastDebitNoteNo"),
    // legacy combined
    addressTh: addressTh || null,
    addressEn: addressEn || null,
    defaultPaymentTermsDays: i(formData, "defaultPaymentTermsDays", 30),
    updatedAt: new Date(),
  };

  const [existing] = await db.select({ id: companies.id }).from(companies).limit(1);
  if (existing) {
    await db.update(companies).set(data).where(eq(companies.id, existing.id));
  } else {
    await db.insert(companies).values(data);
  }

  // ----- Signatures -----
  const sigBool = (k: string) => s(formData, k) === "true";
  const sigVal: SignaturesValue = {
    authorized: {
      enabled: sigBool("sigAuthorizedEnabled"),
      path: sn(formData, "sigAuthorizedPath"),
      nameEnabled: sigBool("sigAuthorizedNameEnabled"),
      name: s(formData, "sigAuthorizedName"),
    },
    receiver: {
      enabled: sigBool("sigReceiverEnabled"),
      path: sn(formData, "sigReceiverPath"),
      nameEnabled: sigBool("sigReceiverNameEnabled"),
      name: s(formData, "sigReceiverName"),
    },
    presenter: {
      enabled: sigBool("sigPresenterEnabled"),
      path: sn(formData, "sigPresenterPath"),
      nameEnabled: sigBool("sigPresenterNameEnabled"),
      name: s(formData, "sigPresenterName"),
    },
    billing: {
      enabled: sigBool("sigBillingEnabled"),
      path: sn(formData, "sigBillingPath"),
      nameEnabled: sigBool("sigBillingNameEnabled"),
      name: s(formData, "sigBillingName"),
    },
    stamp: {
      // auto-enable: stamp is "available" whenever an image is uploaded;
      // per-document on/off is controlled on the invoice form
      enabled: !!sn(formData, "stampPath"),
      path: sn(formData, "stampPath"),
    },
    receiverDateEnabled: sigBool("sigReceiverDateEnabled"),
    presenterDateEnabled: sigBool("sigPresenterDateEnabled"),
  };
  await db
    .insert(settings)
    .values({
      key: SIGNATURES_KEY,
      value: sigVal,
      updatedByUserId: session.userId,
    })
    .onConflictDoUpdate({
      target: settings.key,
      set: {
        value: sigVal,
        updatedAt: new Date(),
        updatedByUserId: session.userId,
      },
    });

  revalidatePath("/settings");
  revalidatePath("/");
  return { ok: true };
}
