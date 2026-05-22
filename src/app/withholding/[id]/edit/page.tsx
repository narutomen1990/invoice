import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { db } from "@/db/client";
import { companies } from "@/db/schema";
import { getWithholdingById } from "@/lib/queries/withholding";
import { WhtForm } from "../../wht-form";

export const dynamic = "force-dynamic";

export default async function EditWithholdingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numId = parseInt(id, 10);
  if (Number.isNaN(numId)) notFound();

  const wht = await getWithholdingById(numId);
  if (!wht) notFound();

  const [company] = await db.select().from(companies).limit(1);
  const companyInfo = {
    name: company?.nameTh ?? "",
    taxId: company?.taxId ?? "",
    address: company?.addressTh ?? "",
  };

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Link href="/withholding">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              แก้ไขหนังสือรับรองหัก ณ ที่จ่าย
            </h1>
            <p className="font-mono text-sm text-zinc-500">{wht.docNo}</p>
          </div>
        </div>

        <WhtForm
          mode="edit"
          company={companyInfo}
          initial={{
            id: wht.id,
            docNo: wht.docNo,
            issueDate: wht.issueDate,
            volumeNo: wht.volumeNo ?? "",
            sequenceInForm: wht.sequenceInForm ?? "",
            formType: wht.formType,
            payerName: wht.payerName,
            payerTaxId: wht.payerTaxId ?? "",
            payerAddress: wht.payerAddress ?? "",
            payeeName: wht.payeeName,
            payeeTaxId: wht.payeeTaxId ?? "",
            payeeAddress: wht.payeeAddress ?? "",
            items: wht.items,
            taxCondition: wht.taxCondition,
            taxConditionOther: wht.taxConditionOther ?? "",
            pensionFund: wht.pensionFund != null ? String(wht.pensionFund) : "",
            pensionFundLicense: wht.pensionFundLicense ?? "",
            socialSecurity:
              wht.socialSecurity != null ? String(wht.socialSecurity) : "",
            employerAccountNo: wht.employerAccountNo ?? "",
            note: wht.note ?? "",
            stampEnabled: wht.stampEnabled,
          }}
        />
      </div>
    </AppShell>
  );
}
