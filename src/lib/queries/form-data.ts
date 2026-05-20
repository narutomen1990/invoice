import { db } from "@/db/client";
import { sql } from "drizzle-orm";

export type CustomerOption = {
  id: number;
  code: string;
  name: string;
  taxId: string | null;
  defaultBranchCode: string | null;
  address1: string | null;
  address2: string | null;
  address3: string | null;
  province: string | null;
  tel: string | null;
};

export type ProductOption = {
  id: number;
  code: string;
  name: string;
  unit: string | null;
  price: number;
};

export async function getCustomerOptions(): Promise<CustomerOption[]> {
  const rows = await db.execute<any>(sql`
    SELECT id, code, name, tax_id, default_branch_code, address1, address2, address3, province, tel
      FROM customers
     WHERE deleted_at IS NULL AND is_active = true
     ORDER BY name
  `);
  return rows.map((r) => ({
    id: Number(r.id),
    code: r.code,
    name: r.name,
    taxId: r.tax_id,
    defaultBranchCode: r.default_branch_code,
    address1: r.address1,
    address2: r.address2,
    address3: r.address3,
    province: r.province,
    tel: r.tel,
  }));
}

export async function getProductOptions(): Promise<ProductOption[]> {
  const rows = await db.execute<any>(sql`
    SELECT id, code, name, unit, price::text
      FROM products
     WHERE deleted_at IS NULL AND is_active = true
     ORDER BY name
  `);
  return rows.map((r) => ({
    id: Number(r.id),
    code: r.code,
    name: r.name,
    unit: r.unit,
    price: Number(r.price),
  }));
}
