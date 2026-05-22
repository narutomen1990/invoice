import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { db } from "@/db/client";
import { companies } from "@/db/schema";
import { WhtForm } from "../wht-form";

export const dynamic = "force-dynamic";

export default async function NewWithholdingPage() {
  const [company] = await db.select().from(companies).limit(1);
  const companyInfo = {
    name: company?.nameTh ?? "",
    taxId: company?.taxId ?? "",
    address: company?.addressTh ?? "",
  };
  const today = new Date().toISOString().slice(0, 10);

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
              สร้างหนังสือรับรองหัก ณ ที่จ่าย
            </h1>
            <p className="text-sm text-zinc-500">50 ทวิ — ฉบับใหม่</p>
          </div>
        </div>

        <WhtForm
          mode="new"
          company={companyInfo}
          initial={{
            issueDate: today,
            volumeNo: "",
            sequenceInForm: "",
            formType: "pnd53",
            payerName: "",
            payerTaxId: "",
            payerAddress: "",
            payeeName: "",
            payeeTaxId: "",
            payeeAddress: "",
            items: [],
            taxCondition: "withhold",
            taxConditionOther: "",
            pensionFund: "",
            pensionFundLicense: "",
            socialSecurity: "",
            employerAccountNo: "",
            note: "",
            stampEnabled: false,
          }}
        />
      </div>
    </AppShell>
  );
}
