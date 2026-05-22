import {
  pgTable,
  bigserial,
  text,
  varchar,
  integer,
  numeric,
  boolean,
  timestamp,
  date,
  jsonb,
  pgEnum,
  index,
  uniqueIndex,
  bigint,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ============================================================
// ENUMS
// ============================================================
export const documentTypeEnum = pgEnum("document_type", [
  "invoice",
  "quotation",
  "billing_slip",
  "receipt",
  "credit_note",
  "debit_note",
]);

export const documentStatusEnum = pgEnum("document_status", [
  "draft",
  "issued",
  "cancelled",
  "voided",
]);

export const arStatusEnum = pgEnum("ar_status", [
  "pending",
  "partial",
  "paid",
  "overdue",
  "cancelled",
]);

export const userRoleEnum = pgEnum("user_role", [
  "admin",
  "manager",
  "staff",
  "viewer",
]);

export const journalActionEnum = pgEnum("journal_action", [
  "create",
  "update",
  "cancel",
  "void",
  "print",
  "email",
  "restore",
]);

export const attachmentKindEnum = pgEnum("attachment_kind", [
  "company_logo",
  "company_signature",
  "document_attachment",
  "user_avatar",
  "product_image",
]);

// ============================================================
// 1. COMPANIES (mirrors invoice.exe "บันทึกข้อมูลกิจการ" 4 tabs)
// ============================================================
export const companies = pgTable("companies", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  code: varchar("code", { length: 16 }),

  // ----- Tab 1: ชื่อที่อยู่ภาษาไทย -----
  nameTh: text("name_th").notNull(),
  buildingTh: text("building_th"),       // เลขที่/อาคาร
  mooTh: varchar("moo_th", { length: 30 }),
  soiTh: varchar("soi_th", { length: 100 }), // ตรอก/ซอย
  roadTh: varchar("road_th", { length: 100 }),
  subDistrictTh: varchar("sub_district_th", { length: 100 }), // แขวง/ตำบล
  districtTh: varchar("district_th", { length: 100 }),         // เขต/อำเภอ
  provinceTh: varchar("province_th", { length: 100 }),
  postcode: varchar("postcode", { length: 10 }),
  tel: varchar("tel", { length: 100 }),
  fax: varchar("fax", { length: 50 }),
  email: varchar("email", { length: 100 }),
  website: varchar("website", { length: 100 }),
  taxId: varchar("tax_id", { length: 13 }),
  branchCode: varchar("branch_code", { length: 5 }).default("00000").notNull(),
  vatRate: numeric("vat_rate", { precision: 5, scale: 2 }).notNull().default("7.00"),
  logoPath: text("logo_path"),

  // ----- Tab 2: ชื่อที่อยู่ภาษาอังกฤษ -----
  nameEn: text("name_en"),
  buildingEn: text("building_en"),
  mooEn: varchar("moo_en", { length: 30 }),
  soiEn: varchar("soi_en", { length: 100 }),
  roadEn: varchar("road_en", { length: 100 }),
  subDistrictEn: varchar("sub_district_en", { length: 100 }),
  districtEn: varchar("district_en", { length: 100 }),
  provinceEn: varchar("province_en", { length: 100 }),

  // ----- Tab 3: รูปแบบเอกสาร -----
  paperSize: varchar("paper_size", { length: 4 }).default("A4").notNull(),       // 'A4' | 'A5'
  businessType: varchar("business_type", { length: 20 }).default("goods_service").notNull(), // 'goods_service' | 'service_only'
  saleType: varchar("sale_type", { length: 20 }).default("cash").notNull(),       // 'cash' | 'credit_1'..'credit_4' | 'no_a4'

  // ----- Tab 4: รูปแบบเลข Invoice -----
  docNumberFormat: integer("doc_number_format").default(3).notNull(), // 1-7
  docNumberYearBe: varchar("doc_number_year_be", { length: 2 }),
  docNumberMonth: varchar("doc_number_month", { length: 2 }),
  invoicePrefix: varchar("invoice_prefix", { length: 10 }).default("IV").notNull(),
  quotationPrefix: varchar("quotation_prefix", { length: 10 }).default("QT").notNull(),
  billingPrefix: varchar("billing_prefix", { length: 10 }).default("IN").notNull(),
  debitNotePrefix: varchar("debit_note_prefix", { length: 10 }).default("DN").notNull(),
  lastInvoiceNo: integer("last_invoice_no").default(0).notNull(),
  lastQuotationNo: integer("last_quotation_no").default(0).notNull(),
  lastBillingNo: integer("last_billing_no").default(0).notNull(),
  lastDebitNoteNo: integer("last_debit_note_no").default(0).notNull(),

  // ----- legacy / misc -----
  defaultPaymentTermsDays: integer("default_payment_terms_days").default(30),
  fiscalYearStartMonth: integer("fiscal_year_start_month").default(1),
  signatureAttachmentId: bigint("signature_attachment_id", { mode: "number" }),
  // legacy combined address (for backward compat)
  addressTh: text("address_th"),
  addressEn: text("address_en"),
  logoAttachmentId: bigint("logo_attachment_id", { mode: "number" }),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ============================================================
// 2. COMPANY BRANCHES
// ============================================================
export const companyBranches = pgTable(
  "company_branches",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    companyId: bigint("company_id", { mode: "number" }).notNull().references(() => companies.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 10 }).notNull().default("00000"),
    name: text("name").notNull(),
    isHeadOffice: boolean("is_head_office").default(false).notNull(),
    address: text("address"),
    tel: varchar("tel", { length: 50 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("uniq_company_branch").on(t.companyId, t.code)],
);

// ============================================================
// 3. USERS
// ============================================================
export const users = pgTable(
  "users",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    username: varchar("username", { length: 50 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    fullName: text("full_name"),
    email: varchar("email", { length: 100 }),
    role: userRoleEnum("role").notNull().default("staff"),
    permissions: jsonb("permissions").$type<Record<string, boolean>>(),
    isActive: boolean("is_active").default(true).notNull(),
    mustChangePassword: boolean("must_change_password").default(false).notNull(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    failedLoginCount: integer("failed_login_count").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("uniq_username").on(t.username)],
);

// ============================================================
// 4. CUSTOMERS
// ============================================================
export const customers = pgTable(
  "customers",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    code: varchar("code", { length: 20 }).notNull(),
    name: text("name").notNull(),
    nameEn: text("name_en"),
    taxId: varchar("tax_id", { length: 13 }),
    defaultBranchCode: varchar("default_branch_code", { length: 10 }),
    province: varchar("province", { length: 50 }),
    address1: text("address1"),
    address2: text("address2"),
    address3: text("address3"),
    tel: varchar("tel", { length: 50 }),
    fax: varchar("fax", { length: 50 }),
    email: varchar("email", { length: 100 }),
    website: varchar("website", { length: 100 }),
    contactName: text("contact_name"),
    contactNick: varchar("contact_nick", { length: 50 }),
    contactMobile: varchar("contact_mobile", { length: 50 }),
    contactEmail: varchar("contact_email", { length: 100 }),
    defaultSalemanName: text("default_saleman_name"),
    defaultSalemanTel: varchar("default_saleman_tel", { length: 50 }),
    defaultSalemanEmail: varchar("default_saleman_email", { length: 100 }),
    defaultPaymentTermsDays: integer("default_payment_terms_days"),
    notes: text("notes"),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("uniq_customer_code").on(t.code),
    index("idx_customer_name").on(t.name),
    index("idx_customer_taxid").on(t.taxId),
  ],
);

// ============================================================
// 5. CUSTOMER BRANCHES (multi-branch per customer)
// ============================================================
export const customerBranches = pgTable("customer_branches", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  customerId: bigint("customer_id", { mode: "number" }).notNull().references(() => customers.id, { onDelete: "cascade" }),
  code: varchar("code", { length: 10 }).notNull(),
  name: text("name"),
  address: text("address"),
  tel: varchar("tel", { length: 50 }),
  taxId: varchar("tax_id", { length: 13 }),
});

// ============================================================
// 6. PRODUCT CATEGORIES
// ============================================================
export const productCategories = pgTable("product_categories", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  name: text("name").notNull(),
  parentId: bigint("parent_id", { mode: "number" }),
  sortOrder: integer("sort_order").default(0).notNull(),
});

// ============================================================
// 7. PRODUCTS
// ============================================================
export const products = pgTable(
  "products",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    code: varchar("code", { length: 30 }).notNull(),
    name: text("name").notNull(),
    nameEn: text("name_en"),
    unit: varchar("unit", { length: 20 }),
    price: numeric("price", { precision: 12, scale: 2 }).default("0"),
    categoryId: bigint("category_id", { mode: "number" }).references(() => productCategories.id),
    isService: boolean("is_service").default(false).notNull(),
    notes: text("notes"),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("uniq_product_code").on(t.code), index("idx_product_name").on(t.name)],
);

// ============================================================
// 8. DOCUMENTS (invoice / quotation / billing_slip / ...)
// ============================================================
export const documents = pgTable(
  "documents",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    documentType: documentTypeEnum("document_type").notNull(),
    docNo: varchar("doc_no", { length: 30 }).notNull(),
    internalSeq: varchar("internal_seq", { length: 20 }),
    refDocumentId: bigint("ref_document_id", { mode: "number" }),

    // dates
    docDate: date("doc_date").notNull(),
    dueDate: date("due_date"),
    paymentTermsDays: integer("payment_terms_days").default(0).notNull(),

    // company snapshot
    companyId: bigint("company_id", { mode: "number" }).notNull().references(() => companies.id),
    companyBranchId: bigint("company_branch_id", { mode: "number" }).references(() => companyBranches.id),
    companyNameSnapshot: text("company_name_snapshot"),
    companyTaxIdSnapshot: varchar("company_tax_id_snapshot", { length: 13 }),

    // customer snapshot
    customerId: bigint("customer_id", { mode: "number" }).references(() => customers.id),
    customerBranchId: bigint("customer_branch_id", { mode: "number" }).references(() => customerBranches.id),
    customerCodeSnapshot: varchar("customer_code_snapshot", { length: 20 }),
    customerNameSnapshot: text("customer_name_snapshot"),
    customerTaxIdSnapshot: varchar("customer_tax_id_snapshot", { length: 13 }),
    customerBranchSnapshot: varchar("customer_branch_snapshot", { length: 10 }),
    customerAddressSnapshot: text("customer_address_snapshot"),
    customerTelSnapshot: varchar("customer_tel_snapshot", { length: 50 }),
    customerProvinceSnapshot: varchar("customer_province_snapshot", { length: 50 }),

    // sales / shipping
    salemanName: text("saleman_name"),
    shippingMethod: text("shipping_method"),
    referenceQuotationNo: varchar("reference_quotation_no", { length: 30 }),

    // amounts (numeric for precision)
    subtotal: numeric("subtotal", { precision: 14, scale: 2 }).default("0").notNull(),
    discount: numeric("discount", { precision: 14, scale: 2 }).default("0").notNull(),
    amountBeforeVat: numeric("amount_before_vat", { precision: 14, scale: 2 }).default("0").notNull(),
    vatRate: numeric("vat_rate", { precision: 5, scale: 2 }).default("7.00").notNull(),
    vatAmount: numeric("vat_amount", { precision: 14, scale: 2 }).default("0").notNull(),
    total: numeric("total", { precision: 14, scale: 2 }).default("0").notNull(),
    withholdingTaxRate: numeric("withholding_tax_rate", { precision: 5, scale: 2 }).default("0").notNull(),
    withholdingTaxAmount: numeric("withholding_tax_amount", { precision: 14, scale: 2 }).default("0").notNull(),
    netTotal: numeric("net_total", { precision: 14, scale: 2 }).default("0").notNull(),
    totalInWordsTh: text("total_in_words_th"),

    // notes
    memo: text("memo"),
    remark1: text("remark1"),
    remark2: text("remark2"),

    // status
    status: documentStatusEnum("status").default("issued").notNull(),
    arStatus: arStatusEnum("ar_status").default("pending").notNull(),

    // print / audit
    printCount: integer("print_count").default(0).notNull(),
    printedAt: timestamp("printed_at", { withTimezone: true }),

    createdByUserId: bigint("created_by_user_id", { mode: "number" }).references(() => users.id),
    updatedByUserId: bigint("updated_by_user_id", { mode: "number" }).references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),

    // legacy fields preserved from DBF (for audit / debug)
    legacyRunning: varchar("legacy_running", { length: 20 }),
    legacyType: varchar("legacy_type", { length: 5 }),
    legacyMonthyear: varchar("legacy_monthyear", { length: 10 }),
    legacyText2: text("legacy_text2"),
    legacyText2Jnv: text("legacy_text2_jnv"),
    legacyChk1: boolean("legacy_chk1"),
    legacyChkAr: boolean("legacy_chk_ar"),
    legacyCashDraw: text("legacy_cash_draw"),
    legacyBranch2: varchar("legacy_branch2", { length: 10 }),
    legacyBranch2Detail: text("legacy_branch2_detail"),
    legacyData: jsonb("legacy_data"),
  },
  (t) => [
    uniqueIndex("uniq_doc_no").on(t.documentType, t.docNo),
    index("idx_doc_date").on(t.docDate),
    index("idx_doc_customer").on(t.customerId, t.docDate),
    index("idx_doc_type_status").on(t.documentType, t.status),
    index("idx_doc_monthyear").on(t.legacyMonthyear),
    index("idx_doc_running").on(t.legacyRunning),
    index("idx_doc_ar_status").on(t.arStatus),
  ],
);

// ============================================================
// 9. DOCUMENT ITEMS
// ============================================================
export const documentItems = pgTable(
  "document_items",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    documentId: bigint("document_id", { mode: "number" }).notNull().references(() => documents.id, { onDelete: "cascade" }),
    lineNo: integer("line_no").notNull(),
    productId: bigint("product_id", { mode: "number" }).references(() => products.id),
    productCodeSnapshot: varchar("product_code_snapshot", { length: 30 }),
    description: text("description"),
    quantity: numeric("quantity", { precision: 14, scale: 3 }).default("0").notNull(),
    unit: varchar("unit", { length: 20 }),
    unitPrice: numeric("unit_price", { precision: 14, scale: 2 }).default("0").notNull(),
    discountPercent: numeric("discount_percent", { precision: 5, scale: 2 }).default("0").notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }).default("0").notNull(),
    notes: text("notes"),
  },
  (t) => [
    index("idx_items_doc").on(t.documentId),
    index("idx_items_product").on(t.productId),
    uniqueIndex("uniq_doc_line").on(t.documentId, t.lineNo),
  ],
);

// ============================================================
// 10. DOCUMENT JOURNALS (audit log)
// ============================================================
export const documentJournals = pgTable(
  "document_journals",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    documentId: bigint("document_id", { mode: "number" }).notNull().references(() => documents.id, { onDelete: "cascade" }),
    action: journalActionEnum("action").notNull(),
    userId: bigint("user_id", { mode: "number" }).references(() => users.id),
    userNameSnapshot: text("user_name_snapshot"),
    changes: jsonb("changes"),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("idx_journal_doc").on(t.documentId, t.occurredAt)],
);

// ============================================================
// 11. COUNTERS (auto doc_no)
// ============================================================
export const counters = pgTable(
  "counters",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    key: varchar("key", { length: 50 }).notNull(),
    documentType: documentTypeEnum("document_type").notNull(),
    yearBe: varchar("year_be", { length: 2 }).notNull(),
    month: varchar("month", { length: 2 }).notNull(),
    currentValue: integer("current_value").default(0).notNull(),
    prefix: varchar("prefix", { length: 10 }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("uniq_counter_key").on(t.key)],
);

// ============================================================
// 12. SETTINGS (key-value)
// ============================================================
export const settings = pgTable("settings", {
  key: varchar("key", { length: 100 }).primaryKey(),
  value: jsonb("value"),
  description: text("description"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedByUserId: bigint("updated_by_user_id", { mode: "number" }).references(() => users.id),
});

// ============================================================
// 13. ATTACHMENTS
// ============================================================
export const attachments = pgTable("attachments", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  kind: attachmentKindEnum("kind").notNull(),
  documentId: bigint("document_id", { mode: "number" }).references(() => documents.id, { onDelete: "set null" }),
  filename: text("filename").notNull(),
  mimeType: varchar("mime_type", { length: 100 }),
  sizeBytes: integer("size_bytes"),
  storagePath: text("storage_path").notNull(),
  uploadedByUserId: bigint("uploaded_by_user_id", { mode: "number" }).references(() => users.id),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).defaultNow().notNull(),
});

// ============================================================
// 14. MIGRATION LOG
// ============================================================
export const migrationLog = pgTable("migration_log", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  sourceTable: text("source_table"),
  targetTable: text("target_table"),
  rowsIn: integer("rows_in"),
  rowsOut: integer("rows_out"),
  rowsSkipped: integer("rows_skipped").default(0),
  notes: text("notes"),
  metadata: jsonb("metadata"),
  ranAt: timestamp("ran_at", { withTimezone: true }).defaultNow().notNull(),
});

// ============================================================
// RELATIONS
// ============================================================
export const companiesRelations = relations(companies, ({ many }) => ({
  branches: many(companyBranches),
  documents: many(documents),
}));

export const customersRelations = relations(customers, ({ many }) => ({
  branches: many(customerBranches),
  documents: many(documents),
}));

export const documentsRelations = relations(documents, ({ one, many }) => ({
  company: one(companies, { fields: [documents.companyId], references: [companies.id] }),
  customer: one(customers, { fields: [documents.customerId], references: [customers.id] }),
  items: many(documentItems),
  journals: many(documentJournals),
  createdBy: one(users, { fields: [documents.createdByUserId], references: [users.id] }),
}));

export const documentItemsRelations = relations(documentItems, ({ one }) => ({
  document: one(documents, { fields: [documentItems.documentId], references: [documents.id] }),
  product: one(products, { fields: [documentItems.productId], references: [products.id] }),
}));

export const documentJournalsRelations = relations(documentJournals, ({ one }) => ({
  document: one(documents, { fields: [documentJournals.documentId], references: [documents.id] }),
  user: one(users, { fields: [documentJournals.userId], references: [users.id] }),
}));

// ============================================================
// WITHHOLDING TAX CERTIFICATES (หนังสือรับรองการหักภาษี ณ ที่จ่าย - 50 ทวิ)
// ============================================================
export const withholdingCertificates = pgTable(
  "withholding_certificates",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    docNo: varchar("doc_no", { length: 30 }).notNull(),
    sequenceNo: integer("sequence_no").default(0).notNull(),
    issueDate: date("issue_date").notNull(),

    // หัวเอกสารตามแบบ 50 ทวิ
    volumeNo: varchar("volume_no", { length: 20 }),         // เล่มที่
    sequenceInForm: varchar("sequence_in_form", { length: 20 }), // ลำดับที่ ในแบบ

    // ฟอร์มภาษี: pnd1a | pnd1a_special | pnd2 | pnd2a | pnd3 | pnd3a | pnd53
    formType: varchar("form_type", { length: 20 }).notNull().default("pnd53"),

    // ผู้มีหน้าที่หักภาษี ณ ที่จ่าย (payer / withholding agent)
    payerName: text("payer_name").notNull(),
    payerTaxId: varchar("payer_tax_id", { length: 13 }),
    payerAddress: text("payer_address"),

    // ผู้ถูกหักภาษี ณ ที่จ่าย (payee)
    payeeName: text("payee_name").notNull(),
    payeeTaxId: varchar("payee_tax_id", { length: 13 }),
    payeeAddress: text("payee_address"),

    // รายการเงินได้: [{ category, description, datePaid, amount, tax }]
    items: jsonb("items").$type<
      {
        category: string;
        description: string;
        datePaid: string;
        amount: number;
        tax: number;
      }[]
    >(),

    totalPaid: numeric("total_paid", { precision: 14, scale: 2 }).default("0").notNull(),
    totalTax: numeric("total_tax", { precision: 14, scale: 2 }).default("0").notNull(),
    totalTaxWords: text("total_tax_words"),

    // เงื่อนไขการหัก: withhold | pay_always | pay_once | other
    taxCondition: varchar("tax_condition", { length: 20 }).default("withhold").notNull(),
    taxConditionOther: text("tax_condition_other"),

    // กองทุน (optional)
    pensionFund: numeric("pension_fund", { precision: 14, scale: 2 }),
    pensionFundLicense: varchar("pension_fund_license", { length: 50 }), // ใบอนุญาตเลขที่
    socialSecurity: numeric("social_security", { precision: 14, scale: 2 }),
    employerAccountNo: varchar("employer_account_no", { length: 50 }), // เลขที่บัญชีนายจ้าง

    note: text("note"),
    status: varchar("status", { length: 16 }).default("issued").notNull(),

    // พิมพ์ตราประทับบริษัทลงเอกสารหรือไม่
    stampEnabled: boolean("stamp_enabled").default(false).notNull(),

    createdByUserId: bigint("created_by_user_id", { mode: "number" }).references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("uniq_wht_doc_no").on(t.docNo),
    index("idx_wht_issue_date").on(t.issueDate),
  ],
);

// ============================================================
// TYPE EXPORTS
// ============================================================
export type Company = typeof companies.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type DocumentItem = typeof documentItems.$inferSelect;
export type DocumentJournal = typeof documentJournals.$inferSelect;
export type User = typeof users.$inferSelect;

export type WithholdingCertificate = typeof withholdingCertificates.$inferSelect;

export type NewCompany = typeof companies.$inferInsert;
export type NewCustomer = typeof customers.$inferInsert;
export type NewProduct = typeof products.$inferInsert;
export type NewDocument = typeof documents.$inferInsert;
export type NewDocumentItem = typeof documentItems.$inferInsert;
export type NewWithholdingCertificate = typeof withholdingCertificates.$inferInsert;
