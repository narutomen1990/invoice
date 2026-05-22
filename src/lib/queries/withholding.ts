import { db } from "@/db/client";
import { sql } from "drizzle-orm";
import type { WhtItem } from "@/lib/withholding/constants";

export type WhtListRow = {
  id: number;
  docNo: string;
  issueDate: string;
  formType: string;
  payerName: string;
  payeeName: string;
  totalPaid: number;
  totalTax: number;
  status: string;
};

export type WhtListResult = {
  rows: WhtListRow[];
  total: number;
  sumPaid: number;
  sumTax: number;
};

export async function getWithholdingList(opts: {
  q?: string;
}): Promise<WhtListResult> {
  const conds = [sql`1=1`];
  if (opts.q) {
    const like = `%${opts.q}%`;
    conds.push(
      sql`(doc_no ILIKE ${like} OR payer_name ILIKE ${like} OR payee_name ILIKE ${like})`,
    );
  }
  const whereSql = sql.join(conds, sql` AND `);

  const rowsRaw = await db.execute<{
    id: number;
    doc_no: string;
    issue_date: string;
    form_type: string;
    payer_name: string;
    payee_name: string;
    total_paid: string;
    total_tax: string;
    status: string;
  }>(sql`
    SELECT id, doc_no, issue_date::text, form_type,
           payer_name, payee_name,
           total_paid::text, total_tax::text, status
      FROM withholding_certificates
     WHERE ${whereSql}
     ORDER BY issue_date DESC, id DESC
     LIMIT 200
  `);

  const [agg] = await db.execute<{ n: string; p: string; t: string }>(sql`
    SELECT COUNT(*)::text AS n,
           COALESCE(SUM(total_paid),0)::text AS p,
           COALESCE(SUM(total_tax),0)::text AS t
      FROM withholding_certificates
     WHERE ${whereSql}
  `);

  return {
    rows: rowsRaw.map((r) => ({
      id: Number(r.id),
      docNo: r.doc_no,
      issueDate: r.issue_date,
      formType: r.form_type,
      payerName: r.payer_name,
      payeeName: r.payee_name,
      totalPaid: Number(r.total_paid),
      totalTax: Number(r.total_tax),
      status: r.status,
    })),
    total: Number(agg?.n ?? 0),
    sumPaid: Number(agg?.p ?? 0),
    sumTax: Number(agg?.t ?? 0),
  };
}

export type WhtDetail = {
  id: number;
  docNo: string;
  issueDate: string;
  volumeNo: string | null;
  sequenceInForm: string | null;
  formType: string;
  payerName: string;
  payerTaxId: string | null;
  payerAddress: string | null;
  payeeName: string;
  payeeTaxId: string | null;
  payeeAddress: string | null;
  items: WhtItem[];
  totalPaid: number;
  totalTax: number;
  totalTaxWords: string | null;
  taxCondition: string;
  taxConditionOther: string | null;
  pensionFund: number | null;
  pensionFundLicense: string | null;
  socialSecurity: number | null;
  employerAccountNo: string | null;
  note: string | null;
  status: string;
  stampEnabled: boolean;
};

export async function getWithholdingById(
  id: number,
): Promise<WhtDetail | null> {
  const rows = await db.execute<any>(sql`
    SELECT * FROM withholding_certificates WHERE id = ${id} LIMIT 1
  `);
  const r = rows[0];
  if (!r) return null;
  return {
    id: Number(r.id),
    docNo: r.doc_no,
    issueDate: r.issue_date,
    volumeNo: r.volume_no,
    sequenceInForm: r.sequence_in_form,
    formType: r.form_type,
    payerName: r.payer_name,
    payerTaxId: r.payer_tax_id,
    payerAddress: r.payer_address,
    payeeName: r.payee_name,
    payeeTaxId: r.payee_tax_id,
    payeeAddress: r.payee_address,
    items: (r.items as WhtItem[] | null) ?? [],
    totalPaid: Number(r.total_paid),
    totalTax: Number(r.total_tax),
    totalTaxWords: r.total_tax_words,
    taxCondition: r.tax_condition,
    taxConditionOther: r.tax_condition_other,
    pensionFund: r.pension_fund != null ? Number(r.pension_fund) : null,
    pensionFundLicense: r.pension_fund_license,
    socialSecurity:
      r.social_security != null ? Number(r.social_security) : null,
    employerAccountNo: r.employer_account_no,
    note: r.note,
    status: r.status,
    stampEnabled: !!r.stamp_enabled,
  };
}
