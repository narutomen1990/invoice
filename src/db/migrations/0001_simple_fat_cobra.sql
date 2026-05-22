ALTER TABLE "companies" ALTER COLUMN "tel" SET DATA TYPE varchar(100);--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "building_th" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "moo_th" varchar(30);--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "soi_th" varchar(100);--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "road_th" varchar(100);--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "sub_district_th" varchar(100);--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "district_th" varchar(100);--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "province_th" varchar(100);--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "branch_code" varchar(5) DEFAULT '00000' NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "logo_path" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "building_en" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "moo_en" varchar(30);--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "soi_en" varchar(100);--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "road_en" varchar(100);--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "sub_district_en" varchar(100);--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "district_en" varchar(100);--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "province_en" varchar(100);--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "paper_size" varchar(4) DEFAULT 'A4' NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "business_type" varchar(20) DEFAULT 'goods_service' NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "sale_type" varchar(20) DEFAULT 'cash' NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "doc_number_format" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "doc_number_year_be" varchar(2);--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "doc_number_month" varchar(2);--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "invoice_prefix" varchar(10) DEFAULT 'IV' NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "quotation_prefix" varchar(10) DEFAULT 'QT' NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "billing_prefix" varchar(10) DEFAULT 'IN' NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "debit_note_prefix" varchar(10) DEFAULT 'DN' NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "last_invoice_no" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "last_quotation_no" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "last_billing_no" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "last_debit_note_no" integer DEFAULT 0 NOT NULL;