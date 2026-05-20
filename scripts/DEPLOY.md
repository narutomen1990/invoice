# Deploy Invoice App ไป Hostinger VPS

## สิ่งที่ต้องเตรียม

- [ ] VPS Ubuntu 24.04 LTS ที่ Hostinger
- [ ] SSH access (root)
- [ ] Domain name พร้อมชี้ A record มา IP ของ VPS
- [ ] Source code (GitHub repo หรือ zip)
- [ ] Database backup: `invoice_db_backup.sql.gz`

## ขั้นตอนทั้งหมด (~30-45 นาที)

### 1. ชี้ DNS A record

ที่ผู้ให้บริการ domain (Hostinger หรืออื่น):
- `invoice.yourdomain.com` → IP ของ VPS

รอ DNS propagate ~5-30 นาที (เช็คได้ที่ https://dnschecker.org)

---

### 2. SSH เข้า VPS

```bash
ssh root@<vps-ip>
```

---

### 3. รัน setup-ubuntu.sh

Copy script ขึ้น VPS:
```bash
# วิธี A: scp จากเครื่อง dev
scp scripts/setup-ubuntu.sh root@<vps-ip>:/root/

# วิธี B: pull จาก GitHub
wget https://raw.githubusercontent.com/<user>/<repo>/main/scripts/setup-ubuntu.sh
```

รัน:
```bash
sudo bash setup-ubuntu.sh
```

ใช้เวลา ~5-10 นาที — จะติดตั้ง:
- Node.js 22 LTS
- PostgreSQL 16
- Caddy
- Chromium dependencies
- Firewall (ufw)
- สร้าง user `invoice` + database + DB user
- พิมพ์ `DATABASE_URL` ตอนจบ → **จดเก็บไว้**

---

### 4. ย้ายข้อมูลเดิม (ถ้ามี)

จากเครื่อง dev:
```bash
scp invoice_db_backup.sql.gz root@<vps-ip>:/tmp/
```

บน VPS:
```bash
gunzip -c /tmp/invoice_db_backup.sql.gz | sudo -u postgres psql -d invoice_db
```

---

### 5. Clone source code

บน VPS:
```bash
su - invoice
cd ~
git clone https://github.com/<user>/<repo>.git invoice-app
cd invoice-app
```

(หรือ scp source code ที่ zip มาแล้วแตก)

---

### 6. สร้าง .env

```bash
cp .env.example .env
nano .env
```

แก้ค่า:
```env
DATABASE_URL=postgresql://invoice_app:<password-from-step-3>@localhost:5432/invoice_db
AUTH_SECRET=<random-32-bytes>     # สร้างด้วย: openssl rand -base64 32
AUTH_URL=https://invoice.yourdomain.com
NEXT_PUBLIC_APP_URL=https://invoice.yourdomain.com
TZ=Asia/Bangkok
```

Save (Ctrl+O, Enter, Ctrl+X)

---

### 7. Deploy

```bash
bash scripts/deploy-app.sh
```

ใช้เวลา ~3-5 นาที — จะ:
- npm install
- db:push (schema)
- npm run build
- pm2 start + auto-restart

ทดสอบ:
```bash
curl localhost:3000  # ควรได้ HTML กลับมา
```

---

### 8. ตั้ง Caddy (HTTPS)

```bash
exit  # ออกจาก user invoice กลับเป็น root

# แก้ Caddyfile ใส่ domain ของคุณ
sudo nano /home/invoice/invoice-app/scripts/Caddyfile
# แก้ "invoice.example.com" เป็น "invoice.yourdomain.com"

# วาง config
sudo cp /home/invoice/invoice-app/scripts/Caddyfile /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Caddy จะขอ Let's Encrypt SSL อัตโนมัติ (~30 วินาที)

เปิด: **https://invoice.yourdomain.com** → ใช้งานได้!

---

## คำสั่งที่ใช้บ่อย

```bash
# ดูสถานะแอป
pm2 status

# ดู log สด
pm2 logs invoice-app

# Restart แอป
pm2 restart invoice-app

# ดู log Caddy
sudo journalctl -u caddy -f

# Backup DB
sudo -u postgres pg_dump invoice_db | gzip > /backup/$(date +%F).sql.gz
```

---

## Update version ใหม่

บน VPS:
```bash
su - invoice
cd ~/invoice-app
git pull
bash scripts/deploy-app.sh
```

จบ — แอปจะ restart พร้อม version ใหม่อัตโนมัติ
