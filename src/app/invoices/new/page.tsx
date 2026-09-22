import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { InvoiceForm } from "@/components/forms/invoice-form";
import {
  getCustomerOptions,
  getProductOptions,
  getSalesmanOptions,
} from "@/lib/queries/form-data";
import { previewNextDocNoAction } from "@/app/invoices/actions";
import { todayBE } from "@/lib/thai/date";
import { getSession } from "@/lib/auth/session";
import { getInvoiceById } from "@/lib/queries/invoices";

export const dynamic = "force-dynamic";

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ docNo?: string; fromBilling?: string }>;
}) {
  const sp = await searchParams;
  const today = todayBE();
  const [session, customers, products, salesmen, preview] = await Promise.all([
    getSession(),
    getCustomerOptions(),
    getProductOptions(),
    getSalesmanOptions(),
    previewNextDocNoAction(today),
  ]);
  const myName = session?.fullName?.trim() || session?.username || null;

  // pre-fill customer + items from a billing note (ใบแจ้งหนี้/ใบวางบิล) when
  // launched from /billing via "ออกใบกำกับจากใบแจ้งหนี้นี้"
  const fromBillingId = sp.fromBilling ? parseInt(sp.fromBilling, 10) : NaN;
  const fromBilling = Number.isNaN(fromBillingId)
    ? null
    : await getInvoiceById(fromBillingId);

  return (
    <AppShell>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Link href="/invoices">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
              กลับ
            </Button>
          </Link>
          {fromBilling && (
            <span className="text-[12px] text-zinc-500">
              สร้างใบกำกับจากใบแจ้งหนี้{" "}
              <span className="font-mono font-semibold text-blue-700">
                {fromBilling.doc.docNo}
              </span>
            </span>
          )}
        </div>

        <InvoiceForm
          mode="new"
          previewDocNo={preview.docNo}
          customers={customers}
          products={products}
          salesmen={salesmen}
          lockSalesman={session?.role === "staff"}
          initial={{
            docNo: sp.docNo || undefined,
            docDate: today,
            dueDate: null,
            paymentTermsDays: 30,
            customerId: fromBilling?.doc.customerId ?? null,
            customerCode: fromBilling?.doc.customerCode ?? "",
            customerName: fromBilling?.doc.customerName ?? "",
            customerTaxId: fromBilling?.doc.customerTaxId ?? null,
            customerBranch: fromBilling?.doc.customerBranch ?? null,
            customerAddress: fromBilling?.doc.customerAddress ?? null,
            customerTel: fromBilling?.doc.customerTel ?? null,
            customerProvince: fromBilling?.doc.customerProvince ?? null,
            salemanName: fromBilling?.doc.salemanName || myName,
            shippingMethod: null,
            referenceQuotationNo: null,
            discount: 0,
            vatRate: fromBilling?.doc.vatRate ?? 7,
            withholdingTaxRate: 0,
            memo: null,
            remark1: null,
            remark2: null,
            items: fromBilling
              ? fromBilling.items.map((it) => ({
                  lineNo: String(it.lineNo ?? ""),
                  productCode: it.productCode ?? "",
                  description: it.description ?? "",
                  quantity: String(it.quantity),
                  unit: it.unit ?? "",
                  unitPrice: String(it.unitPrice),
                }))
              : [],
          }}
        />
      </div>
    </AppShell>
  );
}
