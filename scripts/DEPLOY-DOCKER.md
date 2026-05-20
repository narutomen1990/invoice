# Deploy Invoice App ไป Hostinger VPS (Docker + Traefik)

VPS Hostinger ตัวนี้ใช้ pattern **Docker + Traefik** อยู่แล้ว (มี service-center, n8n เป็นเพื่อนบ้าน) — แอปนี้จะ deploy แบบเดียวกัน เกาะ Traefik ที่มีอยู่

## สิ่งที่ต้องเตรียม

- [ ] VPS Hostinger (Ubuntu 24.04 + Docker + Traefik) ← มีอยู่แล้ว
- [ ] Subdomain เช่น `invoice.yourdomain.com` ชี้ A record มา VPS IP
- [ ] Source code (push GitHub แล้ว: https://github.com/narutomen1990/invoice)
- [ ] Database backup: `invoice_db_backup.sql.gz` (~1.9 MB)

---

## Step 1: ชี้ DNS A record

ที่ผู้ให้บริการ domain:
- `invoice.yourdomain.com` → **187.77.152.71** (IP ของ VPS)

รอ DNS propagate 5-30 นาที (เช็คที่ https://dnschecker.org)

---

## Step 2: ตรวจชื่อ Traefik network

SSH เข้า VPS แล้วรัน:
```bash
docker inspect service-center-app-1 --format '{{json .Config.Labels}}' | python3 -m json.tool
```

ดูค่า `traefik.docker.network` — ต้องตรงกับใน `docker-compose.production.yml` (ปัจจุบันตั้งไว้ที่ `openclaw-ulvd_default`)

ถ้าไม่ตรง แก้ทั้ง 2 จุดใน docker-compose:
- `traefik.docker.network=...` (ใน labels)
- `name: ...` (ใน networks → traefik_proxy)

---

## Step 3: Clone repo บน VPS

```bash
ssh root@187.77.152.71

# สร้างโฟลเดอร์เก็บ app
mkdir -p /opt/invoice
cd /opt/invoice

# Clone
git clone https://github.com/narutomen1990/invoice.git .
```

---

## Step 4: ตรวจ network name (เผื่อ Hostinger เปลี่ยน)

```bash
docker network ls | grep openclaw
```

ถ้า `openclaw-ulvd_default` ไม่มี → แก้ใน docker-compose.production.yml ทั้ง 2 จุด

---

## Step 5: สร้าง .env

```bash
cp .env.production.example .env
nano .env
```

แก้ค่า:
```env
DOMAIN=invoice.yourdomain.com
DB_PASSWORD=<โปรด generate: openssl rand -base64 24>
AUTH_SECRET=<โปรด generate: openssl rand -base64 32>
```

Save (Ctrl+O, Enter, Ctrl+X)

---

## Step 6: Build + Start

```bash
docker compose -f docker-compose.production.yml up -d --build
```

ใช้เวลา **5-15 นาที** ครั้งแรก (build image ~600 MB):
- Stage 1: npm install + download Chromium
- Stage 2: next build (standalone)
- Stage 3: install Chromium runtime deps

ตรวจสถานะ:
```bash
docker compose -f docker-compose.production.yml ps
docker compose -f docker-compose.production.yml logs -f invoice-app
```

ถ้า logs แสดง `▲ Next.js 15.5.15 ... Ready in XXXms` → สำเร็จ

---

## Step 7: ย้ายข้อมูลเดิม (ถ้าต้องการ)

จากเครื่อง Mac:
```bash
scp invoice_db_backup.sql.gz root@187.77.152.71:/tmp/
```

บน VPS — import เข้า container:
```bash
cd /opt/invoice
docker compose -f docker-compose.production.yml exec -T invoice-db \
  sh -c "gunzip -c | psql -U invoice_app -d invoice_db" < /tmp/invoice_db_backup.sql.gz

# หรือถ้า exec ไม่รับ stdin บน VPS:
gunzip -c /tmp/invoice_db_backup.sql.gz > /tmp/invoice.sql
docker cp /tmp/invoice.sql invoice-db:/tmp/
docker compose -f docker-compose.production.yml exec invoice-db \
  psql -U invoice_app -d invoice_db -f /tmp/invoice.sql
rm /tmp/invoice.sql
```

(ถ้าไม่ย้ายข้อมูล — drizzle จะ push schema ใหม่อัตโนมัติตอน app start)

---

## Step 8: ทดสอบ

เปิด **https://invoice.yourdomain.com** — Traefik จะขอ Let's Encrypt SSL ครั้งแรก (~30 วินาที)

ถ้าผ่าน:
- HTTP → HTTPS redirect ✓
- HTTPS + valid cert ✓
- Login page โผล่ ✓

---

## คำสั่งที่ใช้บ่อย

```bash
cd /opt/invoice

# ดูสถานะ
docker compose -f docker-compose.production.yml ps

# ดู log สด (Ctrl+C เพื่อออก)
docker compose -f docker-compose.production.yml logs -f invoice-app

# Restart แอป (ไม่ rebuild)
docker compose -f docker-compose.production.yml restart invoice-app

# Update version ใหม่ (pull + rebuild + restart)
git pull
docker compose -f docker-compose.production.yml up -d --build

# Stop ทั้งหมด
docker compose -f docker-compose.production.yml down

# Stop + ลบ volume (⚠️ ข้อมูลหาย)
docker compose -f docker-compose.production.yml down -v
```

---

## Backup DB

ตั้ง cron บน VPS:
```bash
crontab -e
```

เพิ่ม:
```cron
# Backup ทุกคืน 02:00 → เก็บ 30 วัน
0 2 * * * docker compose -f /opt/invoice/docker-compose.production.yml exec -T invoice-db pg_dump -U invoice_app invoice_db | gzip > /var/backups/invoice/invoice_$(date +\%F).sql.gz && find /var/backups/invoice/ -name "*.sql.gz" -mtime +30 -delete
```

สร้างโฟลเดอร์ backup:
```bash
mkdir -p /var/backups/invoice
```

---

## Troubleshooting

### Traefik routes 404
- ตรวจ network name ใน docker-compose ตรงกับชื่อจริงไหม
- ตรวจ DNS ชี้มา VPS แล้วหรือยัง: `dig invoice.yourdomain.com`

### Container restart ตลอด
- ดู log: `docker compose -f docker-compose.production.yml logs invoice-app`
- เช็ค DB connection: `docker compose -f docker-compose.production.yml exec invoice-db psql -U invoice_app -d invoice_db -c "\dt"`

### PDF download error (Puppeteer)
- เข้า container ดู: `docker compose -f docker-compose.production.yml exec invoice-app sh`
- ทดสอบ chromium: `node -e "const p = require('puppeteer'); p.launch().then(b => b.close())"`

### RAM ไม่พอตอน build
- บิลด์บนเครื่อง local แล้ว push image ขึ้น Docker Hub แทน
- หรือเพิ่ม swap ชั่วคราว: `fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile`
