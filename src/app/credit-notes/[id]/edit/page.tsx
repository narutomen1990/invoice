import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import {
  CreditNoteForm,
  type CreditNoteFormInitial,
} from "@/components/forms/credit-note-form";
import {
  getCustomerOptions,
  getProductOptions,
} from "@/lib/queries/form-data";
import { getInvoiceById } from "@/lib/queries/invoices";

export const dynamic = "force-dynamic";

function splitAddress(addr: string | null): [string, string, string] {
  if (!addr) return ["", "", ""];
  const parts = addr.split("\n");
  return [parts[0] ?? "", parts[1] ?? "", parts[2] ?? ""];
}

type CreditNoteLegacy = {
  originalAmount?: number;
  correctAmount?: number;
  referenceInvoiceNo?: string | null;
  referenceInvoiceDate?: string | null;
  reason?: string;
};

export default async function EditCreditNotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numId = parseInt(id, 10);
  if (Number.isNaN(numId)) notFound();

  // getInvoiceById works for any document type — schema is shared
  const data = await getInvoiceById(numId);
  if (!data) notFound();
  const { doc, items } = data;

  const [customers, products] = await Promise.all([
    getCustomerOptions(),
    getProductOptions(),
  ]);

  const [a1, a2, a3] = splitAddress(doc.customerAddress);

  // legacyData may carry credit-note-specific fields from createCreditNoteAction.
  // For FoxPro-imported CN rows that legacyData is empty — fall back to
  // remark1 / remark2 / referenceQuotationNo which the import has populated.
  const legacy = (doc as unknown as {
    legacyData?: { creditNote?: CreditNoteLegacy };
    remark1?: string | null;
    remark2?: string | null;
  });
  const cnLegacy = legacy.legacyData?.creditNote ?? {};

  const initial: CreditNoteFormInitial = {
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
    referenceInvoiceNo:
      cnLegacy.referenceInvoiceNo ?? doc.referenceQuotationNo ?? "",
    referenceInvoiceDate: cnLegacy.referenceInvoiceDate ?? "",
    reason: cnLegacy.reason ?? legacy.remark2 ?? legacy.remark1 ?? "",
    originalAmount: cnLegacy.originalAmount ?? 0,
    correctAmount: cnLegacy.correctAmount ?? 0,
    vatRate: doc.vatRate,
    items: items.map((it) => ({
      productCode: it.productCode ?? "",
      description: it.description ?? "",
      quantity: it.quantity,
      unit: it.unit ?? "",
      unitPrice: it.unitPrice,
    })),
  };

  return (
    <AppShell>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Link href="/credit-notes">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
              กลับ
            </Button>
          </Link>
          <span className="text-[12px] text-zinc-500">
            แก้ไขใบลดหนี้{" "}
            <span className="font-mono font-semibold text-amber-700">
              {doc.docNo}
            </span>
          </span>
        </div>

        <CreditNoteForm
          mode="edit"
          editId={numId}
          existingDocNo={doc.docNo}
          customers={customers}
          products={products}
          previewDocNo={doc.docNo}
          initialDocDate={doc.docDate}
          initial={initial}
        />
      </div>
    </AppShell>
  );
}
