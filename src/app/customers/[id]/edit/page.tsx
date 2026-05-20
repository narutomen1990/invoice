import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { CustomerForm } from "@/components/forms/customer-form";
import { getCustomerById } from "@/lib/queries/customers";

export const dynamic = "force-dynamic";

export default async function EditCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numId = parseInt(id, 10);
  if (Number.isNaN(numId)) notFound();
  const c = await getCustomerById(numId);
  if (!c) notFound();

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Link href={`/customers/${c.id}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">แก้ไขลูกค้า</h1>
            <p className="text-sm text-zinc-500 font-mono">{c.code} — {c.name}</p>
          </div>
        </div>
        <CustomerForm
          mode="edit"
          initial={{
            id: c.id,
            code: c.code,
            name: c.name,
            nameEn: c.nameEn ?? "",
            taxId: c.taxId ?? "",
            defaultBranchCode: c.defaultBranchCode ?? "",
            province: c.province ?? "",
            address1: c.address1 ?? "",
            address2: c.address2 ?? "",
            address3: c.address3 ?? "",
            tel: c.tel ?? "",
            fax: c.fax ?? "",
            email: c.email ?? "",
            website: c.website ?? "",
            contactName: c.contactName ?? "",
            contactNick: c.contactNick ?? "",
            contactMobile: c.contactMobile ?? "",
            contactEmail: c.contactEmail ?? "",
            defaultSalemanName: c.defaultSalemanName ?? "",
            defaultSalemanTel: c.defaultSalemanTel ?? "",
            defaultSalemanEmail: c.defaultSalemanEmail ?? "",
            notes: c.notes ?? "",
            isActive: c.isActive,
          }}
        />
      </div>
    </AppShell>
  );
}
