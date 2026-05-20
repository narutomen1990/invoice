import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { ProductForm } from "@/components/forms/product-form";
import { getProductById } from "@/lib/queries/products";

export const dynamic = "force-dynamic";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numId = parseInt(id, 10);
  if (Number.isNaN(numId)) notFound();
  const p = await getProductById(numId);
  if (!p) notFound();

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Link href={`/products/${p.id}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">แก้ไขสินค้า</h1>
            <p className="text-sm text-zinc-500 font-mono">
              {p.code} — {p.name}
            </p>
          </div>
        </div>
        <ProductForm
          mode="edit"
          initial={{
            id: p.id,
            code: p.code,
            name: p.name,
            nameEn: p.nameEn ?? "",
            unit: p.unit ?? "",
            price: String(p.price),
            isService: p.isService,
            isActive: p.isActive,
            notes: p.notes ?? "",
          }}
        />
      </div>
    </AppShell>
  );
}
