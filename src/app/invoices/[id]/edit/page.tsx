import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { InvoiceForm } from "@/components/forms/invoice-form";
import { getInvoiceById } from "@/lib/queries/invoices";
import { getCustomerOptions, getProductOptions } from "@/lib/queries/form-data";

export const dynamic = "force-dynamic";

export default async function EditInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numId = parseInt(id, 10);
  if (Number.isNaN(numId)) notFound();

  const [data, customers, products] = await Promise.all([
    getInvoiceById(numId),
    getCustomerOptions(),
    getProductOptions(),
  ]);

  if (!data) notFound();
  const { doc, items } = data;

  if (doc.status === "cancelled") {
    return (
      <AppShell>
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          ใบนี้ถูกยกเลิกแล้ว ไม่สามารถแก้ไขได้
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Link href={`/invoices/${doc.id}`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
              กลับ
            </Button>
          </Link>
        </div>

        <InvoiceForm
          mode="edit"
          customers={customers}
          products={products}
          initial={{
            id: doc.id,
            docNo: doc.docNo,
            docDate: doc.docDate,
            dueDate: doc.dueDate,
            paymentTermsDays: doc.paymentTermsDays,
            customerId: doc.customerId,
            customerCode: doc.customerCode ?? "",
            customerName: doc.customerName ?? "",
            customerTaxId: doc.customerTaxId,
            customerBranch: doc.customerBranch,
            customerAddress: doc.customerAddress,
            customerTel: doc.customerTel,
            customerProvince: doc.customerProvince,
            salemanName: doc.salemanName,
            shippingMethod: doc.shippingMethod,
            referenceQuotationNo: doc.referenceQuotationNo,
            discount: doc.discount,
            vatRate: doc.vatRate,
            withholdingTaxRate: 0,
            memo: doc.memo,
            remark1: doc.remark1,
            remark2: doc.remark2,
            items: items.map((it) => ({
              productCode: it.productCode ?? "",
              description: it.description ?? "",
              quantity: String(it.quantity),
              unit: it.unit ?? "",
              unitPrice: String(it.unitPrice),
            })),
          }}
        />
      </div>
    </AppShell>
  );
}
