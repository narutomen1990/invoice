import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { sql } from "drizzle-orm";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { QuotationForm } from "@/components/forms/quotation-form";
import { getCustomerOptions, getProductOptions } from "@/lib/queries/form-data";
import { db } from "@/db/client";

export const dynamic = "force-dynamic";

type QuotationLegacyData = {
  quotationTerms?: {
    validityDays?: number;
    deliveryDays?: number;
    warrantyMonths?: number;
    agingDays?: number;
    customerEmail?: string | null;
  };
};

async function getQuotationForEdit(id: number) {
  const docRaw = await db.execute<any>(sql`
    SELECT * FROM documents
     WHERE id = ${id} AND document_type = 'quotation'
     LIMIT 1
  `);
  const d = docRaw[0];
  if (!d) return null;

  const itemsRaw = await db.execute<any>(sql`
    SELECT line_no, product_code_snapshot, description, quantity::text, unit,
           unit_price::text, amount::text
      FROM document_items
     WHERE document_id = ${id}
     ORDER BY line_no
  `);

  return { doc: d, items: itemsRaw };
}

export default async function EditQuotationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numId = parseInt(id, 10);
  if (Number.isNaN(numId)) notFound();

  const [data, customers, products] = await Promise.all([
    getQuotationForEdit(numId),
    getCustomerOptions(),
    getProductOptions(),
  ]);

  if (!data) notFound();
  const { doc, items } = data;

  if (doc.status === "cancelled") {
    return (
      <AppShell>
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          ใบเสนอราคานี้ถูกยกเลิกแล้ว ไม่สามารถแก้ไขได้
        </div>
      </AppShell>
    );
  }

  const legacy = (doc.legacy_data as QuotationLegacyData | null) ?? {};
  const terms = legacy.quotationTerms ?? {};

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
          mode="edit"
          customers={customers}
          products={products}
          initial={{
            id: Number(doc.id),
            docNo: doc.doc_no,
            docDate: doc.doc_date,
            dueDate: doc.due_date,
            paymentTermsDays: doc.payment_terms_days ?? 0,
            customerId: doc.customer_id,
            customerCode: doc.customer_code_snapshot ?? "",
            customerName: doc.customer_name_snapshot ?? "",
            customerTaxId: doc.customer_tax_id_snapshot,
            customerBranch: doc.customer_branch_snapshot,
            customerAddress: doc.customer_address_snapshot,
            customerTel: doc.customer_tel_snapshot,
            customerProvince: doc.customer_province_snapshot,
            customerEmail: terms.customerEmail ?? null,
            preparedBy: doc.saleman_name,
            shippingMethod: doc.shipping_method,
            purchaseOrderNo: doc.reference_quotation_no,
            discount: Number(doc.discount ?? 0),
            vatRate: Number(doc.vat_rate ?? 7),
            withholdingTaxRate: Number(doc.withholding_tax_rate ?? 0),
            validityDays: Number(terms.validityDays ?? 30),
            agingDays: Number(terms.agingDays ?? 0),
            deliveryDays: Number(terms.deliveryDays ?? 15),
            warrantyMonths: Number(terms.warrantyMonths ?? 3),
            memo: doc.memo,
            remark1: doc.remark1,
            remark2: doc.remark2,
            items: items.map((it: any) => ({
              productCode: it.product_code_snapshot ?? "",
              description: it.description ?? "",
              quantity: String(it.quantity),
              unit: it.unit ?? "",
              unitPrice: String(it.unit_price),
            })),
          }}
        />
      </div>
    </AppShell>
  );
}
