import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { ProductForm } from "@/components/forms/product-form";

export default function NewProductPage() {
  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Link href="/products">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">เพิ่มสินค้า/บริการ</h1>
        </div>
        <ProductForm
          mode="new"
          initial={{
            code: "",
            name: "",
            nameEn: "",
            unit: "",
            price: "0",
            isService: false,
            isActive: true,
            notes: "",
          }}
        />
      </div>
    </AppShell>
  );
}
