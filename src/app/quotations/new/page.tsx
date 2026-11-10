import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { QuotationForm } from "@/components/forms/quotation-form";
import {
  getCustomerOptions,
  getProductOptions,
  getSalesmanOptions,
} from "@/lib/queries/form-data";
import { previewNextQuotationNoAction } from "@/app/quotations/actions";
import { todayBE } from "@/lib/thai/date";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function NewQuotationPage() {
  const today = todayBE();
  const [session, customers, products, salesmen, preview] = await Promise.all([
    getSession(),
    getCustomerOptions(),
    getProductOptions(),
    getSalesmanOptions(),
    previewNextQuotationNoAction(today),
  ]);
  const myName = session?.fullName?.trim() || session?.username || null;

  return (
    <AppShell>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Link href="/quotations">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
              กลับ
            </Button>
          </Link>
        </div>

        <QuotationForm
          mode="new"
          previewDocNo={preview.docNo}
          customers={customers}
          products={products}
          salesmen={salesmen}
          lockSalesman={session?.role === "staff"}
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
            customerEmail: null,
            preparedBy: myName,
            shippingMethod: null,
            purchaseOrderNo: null,
            discount: 0,
            vatRate: 7,
            withholdingTaxRate: 0,
            validityDays: 30,
            agingDays: 0,
            deliveryDays: 15,
            warrantyMonths: 3,
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
