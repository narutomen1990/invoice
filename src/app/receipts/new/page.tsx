import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { BillingSlipForm } from "@/components/forms/billing-slip-form";
import { getCustomerOptions } from "@/lib/queries/form-data";
import { previewNextBillingNoAction } from "@/app/receipts/actions";
import { todayBE } from "@/lib/thai/date";

export const dynamic = "force-dynamic";

export default async function NewBillingSlipPage() {
  const today = todayBE();
  const [customers, preview] = await Promise.all([
    getCustomerOptions(),
    previewNextBillingNoAction(today),
  ]);

  return (
    <AppShell>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Link href="/receipts">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
              กลับ
            </Button>
          </Link>
        </div>

        <BillingSlipForm
          mode="new"
          previewDocNo={preview.docNo}
          customers={customers}
          initial={{
            docDate: today,
            dueDate: null,
            paymentTermsDays: 0,
            customerId: null,
            customerCode: "",
            customerName: "",
            customerTaxId: null,
            customerBranch: null,
            customerAddress: null,
            customerTel: null,
            customerProvince: null,
            customerEmail: null,
            contactName: null,
            contactTel: null,
            preparedBy: null,
            shippingMethod: null,
            referenceDocNo: null,
            discount: 0,
            vatRate: 7,
            withholdingTaxRate: 0,
            paymentDate: null,
            receiptNo: null,
            paidAmount: 0,
            paymentMethod: "Not Yet",
            remark: null,
            memo: null,
            remark1: null,
            items: [],
          }}
        />
      </div>
    </AppShell>
  );
}
