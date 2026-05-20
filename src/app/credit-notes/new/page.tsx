import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import {
  CreditNoteForm,
  type CreditNoteFormInitial,
} from "@/components/forms/credit-note-form";
import { getCustomerOptions, getProductOptions } from "@/lib/queries/form-data";
import { previewNextCreditNoteNoAction } from "@/app/credit-notes/actions";
import { getInvoiceById } from "@/lib/queries/invoices";
import { todayBE } from "@/lib/thai/date";

export const dynamic = "force-dynamic";

function splitAddress(addr: string | null): [string, string, string] {
  if (!addr) return ["", "", ""];
  const parts = addr.split("\n");
  return [parts[0] ?? "", parts[1] ?? "", parts[2] ?? ""];
}

export default async function NewCreditNotePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const today = todayBE();
  const fromInvoiceId = sp.fromInvoice
    ? parseInt(sp.fromInvoice, 10)
    : NaN;

  const [customers, products, preview] = await Promise.all([
    getCustomerOptions(),
    getProductOptions(),
    previewNextCreditNoteNoAction(today),
  ]);

  // pre-fill from selected invoice (when launched from /invoices)
  let initial: CreditNoteFormInitial | undefined;
  if (!Number.isNaN(fromInvoiceId)) {
    const data = await getInvoiceById(fromInvoiceId);
    if (data) {
      const { doc, items } = data;
      const [a1, a2, a3] = splitAddress(doc.customerAddress);
      initial = {
        customerId: doc.customerId,
        customerCode: doc.customerCode ?? "",
        customerName: doc.customerName ?? "",
        customerTaxId: doc.customerTaxId ?? "",
        customerBranch: doc.customerBranch ?? "",
        customerAddress1: a1,
        customerAddress2: a2,
        customerAddress3: a3,
        customerTel: doc.customerTel ?? "",
        salemanName: doc.salemanName ?? "",
        referenceInvoiceNo: doc.docNo,
        referenceInvoiceDate: doc.docDate,
        reason: "",
        originalAmount: doc.amountBeforeVat,
        correctAmount: 0,
        vatRate: doc.vatRate,
        items: items.map((it) => ({
          productCode: it.productCode ?? "",
          description: it.description ?? "",
          quantity: it.quantity,
          unit: it.unit ?? "",
          unitPrice: it.unitPrice,
        })),
      };
    }
  }

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
          {initial && (
            <span className="text-[12px] text-zinc-500">
              สร้างใบลดหนี้จากใบกำกับ{" "}
              <span className="font-mono font-semibold text-blue-700">
                {initial.referenceInvoiceNo}
              </span>
            </span>
          )}
        </div>

        <CreditNoteForm
          customers={customers}
          products={products}
          previewDocNo={preview.docNo}
          initialDocDate={today}
          initial={initial}
        />
      </div>
    </AppShell>
  );
}
