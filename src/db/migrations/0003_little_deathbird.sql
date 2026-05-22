CREATE TABLE "withholding_certificates" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"doc_no" varchar(30) NOT NULL,
	"sequence_no" integer DEFAULT 0 NOT NULL,
	"issue_date" date NOT NULL,
	"volume_no" varchar(20),
	"sequence_in_form" varchar(20),
	"form_type" varchar(20) DEFAULT 'pnd53' NOT NULL,
	"payer_name" text NOT NULL,
	"payer_tax_id" varchar(13),
	"payer_address" text,
	"payee_name" text NOT NULL,
	"payee_tax_id" varchar(13),
	"payee_address" text,
	"items" jsonb,
	"total_paid" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_tax" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_tax_words" text,
	"tax_condition" varchar(20) DEFAULT 'withhold' NOT NULL,
	"tax_condition_other" text,
	"pension_fund" numeric(14, 2),
	"pension_fund_license" varchar(50),
	"social_security" numeric(14, 2),
	"employer_account_no" varchar(50),
	"note" text,
	"status" varchar(16) DEFAULT 'issued' NOT NULL,
	"stamp_enabled" boolean DEFAULT false NOT NULL,
	"created_by_user_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "withholding_certificates" ADD CONSTRAINT "withholding_certificates_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_wht_doc_no" ON "withholding_certificates" USING btree ("doc_no");--> statement-breakpoint
CREATE INDEX "idx_wht_issue_date" ON "withholding_certificates" USING btree ("issue_date");