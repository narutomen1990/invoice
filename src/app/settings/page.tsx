import { db } from "@/db/client";
import { companies } from "@/db/schema";
import { AppShell } from "@/components/app-shell";
import { SettingsForm } from "./settings-form";
import { getSignaturesAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [company] = await db.select().from(companies).limit(1);
  const sigs = await getSignaturesAction();

  return (
    <AppShell>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">บันทึกข้อมูลกิจการ</h1>
          <p className="text-sm text-zinc-500">
            ข้อมูลบริษัท / รูปแบบเอกสาร / รูปแบบเลขที่ใบกำกับ
          </p>
        </div>
        <SettingsForm
          initial={
            company
              ? {
                  code: company.code ?? "",
                  // Thai address
                  nameTh: company.nameTh,
                  buildingTh: company.buildingTh ?? "",
                  mooTh: company.mooTh ?? "",
                  soiTh: company.soiTh ?? "",
                  roadTh: company.roadTh ?? "",
                  subDistrictTh: company.subDistrictTh ?? "",
                  districtTh: company.districtTh ?? "",
                  provinceTh: company.provinceTh ?? "",
                  postcode: company.postcode ?? "",
                  tel: company.tel ?? "",
                  fax: company.fax ?? "",
                  email: company.email ?? "",
                  website: company.website ?? "",
                  taxId: company.taxId ?? "",
                  branchCode: company.branchCode ?? "00000",
                  vatRate: company.vatRate,
                  logoPath: company.logoPath ?? "",
                  // English address
                  nameEn: company.nameEn ?? "",
                  buildingEn: company.buildingEn ?? "",
                  mooEn: company.mooEn ?? "",
                  soiEn: company.soiEn ?? "",
                  roadEn: company.roadEn ?? "",
                  subDistrictEn: company.subDistrictEn ?? "",
                  districtEn: company.districtEn ?? "",
                  provinceEn: company.provinceEn ?? "",
                  // Document format
                  paperSize: company.paperSize ?? "A4",
                  businessType: company.businessType ?? "goods_service",
                  saleType: company.saleType ?? "cash",
                  // Number format
                  docNumberFormat: company.docNumberFormat ?? 3,
                  docNumberYearBe: company.docNumberYearBe ?? "",
                  docNumberMonth: company.docNumberMonth ?? "",
                  invoicePrefix: company.invoicePrefix ?? "IV",
                  quotationPrefix: company.quotationPrefix ?? "QT",
                  billingPrefix: company.billingPrefix ?? "IN",
                  debitNotePrefix: company.debitNotePrefix ?? "DN",
                  lastInvoiceNo: company.lastInvoiceNo ?? 0,
                  lastQuotationNo: company.lastQuotationNo ?? 0,
                  lastBillingNo: company.lastBillingNo ?? 0,
                  lastDebitNoteNo: company.lastDebitNoteNo ?? 0,
                  defaultPaymentTermsDays: company.defaultPaymentTermsDays ?? 30,
                  // Signatures (image)
                  sigAuthorizedEnabled: sigs.authorized.enabled,
                  sigAuthorizedPath: sigs.authorized.path ?? "",
                  sigReceiverEnabled: sigs.receiver.enabled,
                  sigReceiverPath: sigs.receiver.path ?? "",
                  sigPresenterEnabled: sigs.presenter.enabled,
                  sigPresenterPath: sigs.presenter.path ?? "",
                  sigBillingEnabled: sigs.billing.enabled,
                  sigBillingPath: sigs.billing.path ?? "",
                  // Print name (text)
                  sigAuthorizedNameEnabled: sigs.authorized.nameEnabled,
                  sigAuthorizedName: sigs.authorized.name,
                  sigReceiverNameEnabled: sigs.receiver.nameEnabled,
                  sigReceiverName: sigs.receiver.name,
                  sigPresenterNameEnabled: sigs.presenter.nameEnabled,
                  sigPresenterName: sigs.presenter.name,
                  sigBillingNameEnabled: sigs.billing.nameEnabled,
                  sigBillingName: sigs.billing.name,
                  // Date toggles
                  sigReceiverDateEnabled: sigs.receiverDateEnabled,
                  sigPresenterDateEnabled: sigs.presenterDateEnabled,
                  // Stamp
                  stampEnabled: sigs.stamp.enabled,
                  stampPath: sigs.stamp.path ?? "",
                }
              : null
          }
        />
      </div>
    </AppShell>
  );
}
