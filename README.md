# Invoice App — ระบบใบกำกับภาษี

ระบบออกใบกำกับภาษี / ใบเสนอราคา / ใบวางบิล สำหรับใช้งานหลายเครื่องผ่าน LAN
แทน `invoice.exe` (Visual FoxPro) เดิม

## Tech Stack

- **Frontend**: Next.js 15 + React 19 + TypeScript + Tailwind CSS 4
- **Database**: PostgreSQL 17 + Drizzle ORM
- **Auth**: Auth.js (NextAuth) v5 + bcrypt
- **PDF**: @react-pdf/renderer
- **Excel**: exceljs
- **ETL**: Python (dbfread) → JSON → TypeScript → Postgres

## Project Structure

```
invoice-app/
├── src/
│   ├── app/                  # Next.js App Router
│   │   ├── login/
│   │   ├── dashboard/
│   │   ├── invoices/
│   │   ├── quotations/
│   │   ├── billing/
│   │   ├── customers/
│   │   ├── products/
│   │   ├── reports/
│   │   ├── settings/
│   │   └── api/
│   ├── components/           # UI components (shadcn)
│   ├── lib/
│   │   ├── thai/             # date, number → Thai
│   │   ├── pdf/              # PDF templates
│   │   ├── excel/            # Excel exports
│   │   └── auth.ts
│   └── db/
│       ├── schema.ts         # Drizzle schema (14 tables)
│       ├── client.ts
│       ├── migrate.ts
│       └── migrations/       # generated SQL
├── etl/
│   ├── 01-dbf-to-json.py     # DBF → JSON intermediate
│   ├── 02-json-to-postgres.ts # JSON → Postgres
│   ├── 03-validate.ts        # verify counts + sums
│   ├── output/               # JSON files (gitignored)
│   └── snapshots/            # tar.gz of original DBF (gitignored)
├── docker/
│   ├── docker-compose.yml    # local Postgres
│   └── init.sql
├── docs/
└── public/
```

## Database Schema (14 tables)

```
companies, company_branches
users
customers, customer_branches
products, product_categories
documents (invoice/quotation/billing_slip รวมกัน)
document_items
document_journals (audit log)
counters (auto doc_no — transactional)
settings (key-value)
attachments (logo, signature, files)
migration_log
```

## Quick Start (Mac dev)

```bash
# 1. ติดตั้ง dependencies
npm install
pip3 install -r etl/requirements.txt

# 2. ตั้ง env
cp .env.example .env
# แก้ DATABASE_URL ตามต้องการ

# 3. เปิด Postgres ผ่าน Docker
npm run docker:up

# 4. สร้าง schema
npm run db:generate     # สร้าง SQL migration จาก schema.ts
npm run db:migrate      # apply migrations

# 5. Import ข้อมูล DBF เดิม
npm run etl:dbf         # DBF → JSON (ใช้เวลาสักครู่)
npm run etl:import      # JSON → Postgres
npm run etl:verify      # ตรวจสอบ count/sum

# 6. รัน dev server
npm run dev
# เปิด http://localhost:3000
```

## Deploy บน Windows Server

ดู [setup-windows-server.md](../setup-windows-server.md)

```
Server PC (Windows) :3000
   ↑       ↑       ↑
Mac    PC#1    PC#2    ← เปิดผ่าน Browser
```

## NPM Scripts

| Command | คำอธิบาย |
|---------|----------|
| `npm run dev` | dev server (Turbo) |
| `npm run build` | production build |
| `npm run start` | production server |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |
| `npm run db:generate` | สร้าง migration SQL จาก schema.ts |
| `npm run db:migrate` | apply migrations |
| `npm run db:push` | push schema ตรงๆ (dev only) |
| `npm run db:studio` | เปิด Drizzle Studio |
| `npm run etl:dbf` | DBF → JSON |
| `npm run etl:import` | JSON → Postgres |
| `npm run etl:verify` | ตรวจสอบ migration |
| `npm run docker:up` | เปิด Postgres container |
| `npm run docker:down` | ปิด Postgres container |
| `npm run test` | vitest |

## Roadmap

- [x] Phase 0 — Setup project scaffold
- [ ] Phase 1 — Schema + ETL (next)
- [ ] Phase 2 — Auth + Settings
- [ ] Phase 3 — Customers + Products CRUD
- [ ] Phase 4 — Invoice CRUD + auto doc_no
- [ ] Phase 5 — Print templates + PDF
- [ ] Phase 6 — Quotation + Billing
- [ ] Phase 7 — Reports + Excel
- [ ] Phase 8 — Backup + Deploy

ดูแผนงานละเอียด: [../design.md](../design.md), [../STATUS.md](../STATUS.md)
