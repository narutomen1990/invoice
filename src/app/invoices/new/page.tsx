import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { InvoiceForm } from "@/components/forms/invoice-form";
import { getCustomerOptions, getProductOptions } from "@/lib/queries/form-data";
import { previewNextDocNoAction } from "@/app/invoices/actions";
import { todayBE } from "@/lib/thai/date";

export const dynamic = "force-dynamic";

export default async function NewInvoicePage() {
  const today = todayBE();
  const [customers, products, preview] = await Promise.all([
    getCustomerOptions(),
    getProductOptions(),
    previewNextDocNoAction(today),
  ]);

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
        </div>

        <InvoiceForm
          mode="new"
          previewDocNo={preview.docNo}
          customers={customers}
          products={products}
          initial={{
            docDate: today,
            dueDate: null,
            paymentTermsDays: 30,
            customerId: null,
            customerCode: "",
            customerName: "",
            customerTaxId: null,
            customerBranch: null,
            customerAddress: null,
            customerTel: null,
            customerProvince: null,
            salemanName: null,
            shippingMethod: null,
            referenceQuotationNo: null,
            discount: 0,
            vatRate: 7,
            withholdingTaxRate: 0,
            memo: null,
            remark1: null,
            remark2: null,
            items: [],
          }}
        />
      </div>
    </AppShell>
  );
}
