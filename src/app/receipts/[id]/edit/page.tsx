import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { sql } from "drizzle-orm";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { BillingSlipForm } from "@/components/forms/billing-slip-form";
import { getCustomerOptions } from "@/lib/queries/form-data";
import { db } from "@/db/client";

export const dynamic = "force-dynamic";

type LegacyData = {
  payment?: {
    paymentDate?: string | null;
    receiptNo?: string | null;
    paidAmount?: number;
    paymentMethod?: string | null;
    remark?: string | null;
  };
  contact?: {
    name?: string | null;
    tel?: string | null;
  };
};

async function getBillingForEdit(id: number) {
  const docRaw = await db.execute<any>(sql`
    SELECT * FROM documents
     WHERE id = ${id} AND document_type IN ('billing_slip', 'receipt')
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

export default async function EditBillingSlipPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numId = parseInt(id, 10);
  if (Number.isNaN(numId)) notFound();

  const [data, customers] = await Promise.all([
    getBillingForEdit(numId),
    getCustomerOptions(),
  ]);

  if (!data) notFound();
  const { doc, items } = data;

  if (doc.status === "cancelled") {
    return (
      <AppShell>
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          เอกสารนี้ถูกยกเลิกแล้ว ไม่สามารถแก้ไขได้
        </div>
      </AppShell>
    );
  }

  const legacy = (doc.legacy_data as LegacyData | null) ?? {};
  const pay = legacy.payment ?? {};
  const contact = legacy.contact ?? {};

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
          mode="edit"
          customers={customers}
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
            customerEmail: null,
            contactName: contact.name ?? null,
            contactTel: contact.tel ?? null,
            preparedBy: doc.saleman_name,
            shippingMethod: doc.shipping_method,
            referenceDocNo: doc.reference_quotation_no,
            discount: Number(doc.discount ?? 0),
            vatRate: Number(doc.vat_rate ?? 7),
            withholdingTaxRate: Number(doc.withholding_tax_rate ?? 0),
            paymentDate: pay.paymentDate ?? null,
            receiptNo: pay.receiptNo ?? null,
            paidAmount: Number(pay.paidAmount ?? 0),
            paymentMethod: pay.paymentMethod ?? "Not Yet",
            remark: pay.remark ?? null,
            memo: doc.memo,
            remark1: doc.remark1,
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
