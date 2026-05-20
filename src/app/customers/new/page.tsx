import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { CustomerForm } from "@/components/forms/customer-form";
import { nextCustomerCodeAction } from "@/app/customers/actions";

export const dynamic = "force-dynamic";

export default async function NewCustomerPage() {
  const { code } = await nextCustomerCodeAction();
  return (
    <AppShell>
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Link href="/customers">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-blue-900">
              บันทึกเพิ่มเติมข้อมูลลูกค้า{" "}
              <span className="italic">/ Add New Customer</span>
            </h1>
            <p className="text-[11px] text-zinc-500">รหัสถัดไป: {code}</p>
          </div>
        </div>
        <CustomerForm
          mode="new"
          initial={{
            code,
            name: "",
            nameEn: "",
            taxId: "",
            defaultBranchCode: "00000",
            province: "",
            address1: "",
            address2: "",
            address3: "",
            tel: "",
            fax: "",
            email: "",
            website: "",
            contactName: "",
            contactNick: "",
            contactMobile: "",
            contactEmail: "",
            defaultSalemanName: "",
            defaultSalemanTel: "",
            defaultSalemanEmail: "",
            notes: "",
            isActive: true,
          }}
        />
      </div>
    </AppShell>
  );
}
