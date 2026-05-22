CREATE TYPE "public"."ar_status" AS ENUM('pending', 'partial', 'paid', 'overdue', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."attachment_kind" AS ENUM('company_logo', 'company_signature', 'document_attachment', 'user_avatar', 'product_image');--> statement-breakpoint
CREATE TYPE "public"."document_status" AS ENUM('draft', 'issued', 'cancelled', 'voided');--> statement-breakpoint
CREATE TYPE "public"."document_type" AS ENUM('invoice', 'quotation', 'billing_slip', 'receipt', 'credit_note', 'debit_note');--> statement-breakpoint
CREATE TYPE "public"."journal_action" AS ENUM('create', 'update', 'cancel', 'void', 'print', 'email', 'restore');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'manager', 'staff', 'viewer');--> statement-breakpoint
CREATE TABLE "attachments" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"kind" "attachment_kind" NOT NULL,
	"document_id" bigint,
	"filename" text NOT NULL,
	"mime_type" varchar(100),
	"size_bytes" integer,
	"storage_path" text NOT NULL,
	"uploaded_by_user_id" bigint,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"code" varchar(16),
	"name_th" text NOT NULL,
	"name_en" text,
	"tax_id" varchar(13),
	"address_th" text,
	"address_en" text,
	"postcode" varchar(10),
	"tel" varchar(50),
	"fax" varchar(50),
	"email" varchar(100),
	"website" varchar(100),
	"vat_rate" numeric(5, 2) DEFAULT '7.00' NOT NULL,
	"default_payment_terms_days" integer DEFAULT 30,
	"fiscal_year_start_month" integer DEFAULT 1,
	"logo_attachment_id" bigint,
	"signature_attachment_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_branches" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"company_id" bigint NOT NULL,
	"code" varchar(10) DEFAULT '00000' NOT NULL,
	"name" text NOT NULL,
	"is_head_office" boolean DEFAULT false NOT NULL,
	"address" text,
	"tel" varchar(50),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "counters" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"key" varchar(50) NOT NULL,
	"document_type" "document_type" NOT NULL,
	"year_be" varchar(2) NOT NULL,
	"month" varchar(2) NOT NULL,
	"current_value" integer DEFAULT 0 NOT NULL,
	"prefix" varchar(10),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_branches" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"customer_id" bigint NOT NULL,
	"code" varchar(10) NOT NULL,
	"name" text,
	"address" text,
	"tel" varchar(50),
	"tax_id" varchar(13)
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"code" varchar(20) NOT NULL,
	"name" text NOT NULL,
	"name_en" text,
	"tax_id" varchar(13),
	"default_branch_code" varchar(10),
	"province" varchar(50),
	"address1" text,
	"address2" text,
	"address3" text,
	"tel" varchar(50),
	"fax" varchar(50),
	"email" varchar(100),
	"website" varchar(100),
	"contact_name" text,
	"contact_nick" varchar(50),
	"contact_mobile" varchar(50),
	"contact_email" varchar(100),
	"default_saleman_name" text,
	"default_payment_terms_days" integer,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "document_items" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"document_id" bigint NOT NULL,
	"line_no" integer NOT NULL,
	"product_id" bigint,
	"product_code_snapshot" varchar(30),
	"description" text,
	"quantity" numeric(14, 3) DEFAULT '0' NOT NULL,
	"unit" varchar(20),
	"unit_price" numeric(14, 2) DEFAULT '0' NOT NULL,
	"discount_percent" numeric(5, 2) DEFAULT '0' NOT NULL,
	"amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "document_journals" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"document_id" bigint NOT NULL,
	"action" "journal_action" NOT NULL,
	"user_id" bigint,
	"user_name_snapshot" text,
	"changes" jsonb,
	"ip_address" varchar(45),
	"user_agent" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"document_type" "document_type" NOT NULL,
	"doc_no" varchar(30) NOT NULL,
	"internal_seq" varchar(20),
	"ref_document_id" bigint,
	"doc_date" date NOT NULL,
	"due_date" date,
	"payment_terms_days" integer DEFAULT 0 NOT NULL,
	"company_id" bigint NOT NULL,
	"company_branch_id" bigint,
	"company_name_snapshot" text,
	"company_tax_id_snapshot" varchar(13),
	"customer_id" bigint,
	"customer_branch_id" bigint,
	"customer_code_snapshot" varchar(20),
	"customer_name_snapshot" text,
	"customer_tax_id_snapshot" varchar(13),
	"customer_branch_snapshot" varchar(10),
	"customer_address_snapshot" text,
	"customer_tel_snapshot" varchar(50),
	"customer_province_snapshot" varchar(50),
	"saleman_name" text,
	"shipping_method" text,
	"reference_quotation_no" varchar(30),
	"subtotal" numeric(14, 2) DEFAULT '0' NOT NULL,
	"discount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"amount_before_vat" numeric(14, 2) DEFAULT '0' NOT NULL,
	"vat_rate" numeric(5, 2) DEFAULT '7.00' NOT NULL,
	"vat_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total" numeric(14, 2) DEFAULT '0' NOT NULL,
	"withholding_tax_rate" numeric(5, 2) DEFAULT '0' NOT NULL,
	"withholding_tax_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"net_total" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_in_words_th" text,
	"memo" text,
	"remark1" text,
	"remark2" text,
	"status" "document_status" DEFAULT 'issued' NOT NULL,
	"ar_status" "ar_status" DEFAULT 'pending' NOT NULL,
	"print_count" integer DEFAULT 0 NOT NULL,
	"printed_at" timestamp with time zone,
	"created_by_user_id" bigint,
	"updated_by_user_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"legacy_running" varchar(20),
	"legacy_type" varchar(5),
	"legacy_monthyear" varchar(10),
	"legacy_text2" text,
	"legacy_text2_jnv" text,
	"legacy_chk1" boolean,
	"legacy_chk_ar" boolean,
	"legacy_cash_draw" text,
	"legacy_branch2" varchar(10),
	"legacy_branch2_detail" text,
	"legacy_data" jsonb
);
--> statement-breakpoint
CREATE TABLE "migration_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"source_table" text,
	"target_table" text,
	"rows_in" integer,
	"rows_out" integer,
	"rows_skipped" integer DEFAULT 0,
	"notes" text,
	"metadata" jsonb,
	"ran_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_categories" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"parent_id" bigint,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"code" varchar(30) NOT NULL,
	"name" text NOT NULL,
	"name_en" text,
	"unit" varchar(20),
	"price" numeric(12, 2) DEFAULT '0',
	"category_id" bigint,
	"is_service" boolean DEFAULT false NOT NULL,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" varchar(100) PRIMARY KEY NOT NULL,
	"value" jsonb,
	"description" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by_user_id" bigint
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"username" varchar(50) NOT NULL,
	"password_hash" text NOT NULL,
	"full_name" text,
	"email" varchar(100),
	"role" "user_role" DEFAULT 'staff' NOT NULL,
	"permissions" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"must_change_password" boolean DEFAULT false NOT NULL,
	"last_login_at" timestamp with time zone,
	"failed_login_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_branches" ADD CONSTRAINT "company_branches_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_branches" ADD CONSTRAINT "customer_branches_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_items" ADD CONSTRAINT "document_items_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_items" ADD CONSTRAINT "document_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_journals" ADD CONSTRAINT "document_journals_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_journals" ADD CONSTRAINT "document_journals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_company_branch_id_company_branches_id_fk" FOREIGN KEY ("company_branch_id") REFERENCES "public"."company_branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_customer_branch_id_customer_branches_id_fk" FOREIGN KEY ("customer_branch_id") REFERENCES "public"."customer_branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_product_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."product_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_company_branch" ON "company_branches" USING btree ("company_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_counter_key" ON "counters" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_customer_code" ON "customers" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_customer_name" ON "customers" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_customer_taxid" ON "customers" USING btree ("tax_id");--> statement-breakpoint
CREATE INDEX "idx_items_doc" ON "document_items" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "idx_items_product" ON "document_items" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_doc_line" ON "document_items" USING btree ("document_id","line_no");--> statement-breakpoint
CREATE INDEX "idx_journal_doc" ON "document_journals" USING btree ("document_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_doc_no" ON "documents" USING btree ("document_type","doc_no");--> statement-breakpoint
CREATE INDEX "idx_doc_date" ON "documents" USING btree ("doc_date");--> statement-breakpoint
CREATE INDEX "idx_doc_customer" ON "documents" USING btree ("customer_id","doc_date");--> statement-breakpoint
CREATE INDEX "idx_doc_type_status" ON "documents" USING btree ("document_type","status");--> statement-breakpoint
CREATE INDEX "idx_doc_monthyear" ON "documents" USING btree ("legacy_monthyear");--> statement-breakpoint
CREATE INDEX "idx_doc_running" ON "documents" USING btree ("legacy_running");--> statement-breakpoint
CREATE INDEX "idx_doc_ar_status" ON "documents" USING btree ("ar_status");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_product_code" ON "products" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_product_name" ON "products" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_username" ON "users" USING btree ("username");