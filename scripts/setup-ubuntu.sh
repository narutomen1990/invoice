#!/usr/bin/env bash
# ============================================================
# setup-ubuntu.sh
# ติดตั้งระบบบน Ubuntu 24.04 LTS สำหรับ Invoice App
#
# ใช้: SSH เข้า VPS แล้วรันด้วย sudo
#   curl -fsSL https://your-server/setup-ubuntu.sh | sudo bash
#   หรือ scp ไฟล์ไปแล้ว: sudo bash setup-ubuntu.sh
#
# ติดตั้ง:
#   - Node.js 22 LTS (NodeSource)
#   - PostgreSQL 16
#   - Caddy (HTTPS reverse proxy)
#   - Chromium (สำหรับ Puppeteer)
#   - Git, build-essential, ufw, fail2ban
# ============================================================

set -e

# ---- ต้องรันแบบ root/sudo ----
if [[ $EUID -ne 0 ]]; then
   echo "❌ ต้องรันด้วย sudo" >&2
   exit 1
fi

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'
step() { echo -e "\n${CYAN}==> $1${NC}"; }
ok()   { echo -e "    ${GREEN}[OK]${NC} $1"; }
warn() { echo -e "    ${YELLOW}[!] $1${NC}"; }

# ---- 1. Update apt ----
step "อัปเดต apt"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -qq -y
ok "apt updated"

# ---- 2. ติดตั้ง dependencies พื้นฐาน ----
step "ติดตั้ง dependencies พื้นฐาน"
apt-get install -qq -y \
  curl wget git \
  build-essential \
  ca-certificates \
  gnupg lsb-release \
  ufw fail2ban \
  unzip
ok "พื้นฐานครบ"

# ---- 3. ติดตั้ง Node.js 22 LTS (NodeSource) ----
step "ติดตั้ง Node.js 22 LTS"
if command -v node >/dev/null && node -v | grep -q "^v22"; then
  ok "Node.js 22 มีอยู่แล้ว ($(node -v))"
else
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -qq -y nodejs
  ok "Node.js: $(node -v), npm: $(npm -v)"
fi

# ---- 4. ติดตั้ง PostgreSQL 16 ----
step "ติดตั้ง PostgreSQL 16"
if systemctl list-units --type=service | grep -q postgresql; then
  ok "PostgreSQL มีอยู่แล้ว"
else
  install -d /usr/share/postgresql-common/pgdg
  curl -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
    --fail https://www.postgresql.org/media/keys/ACCC4CF8.asc
  echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
    > /etc/apt/sources.list.d/pgdg.list
  apt-get update -qq
  apt-get install -qq -y postgresql-16 postgresql-contrib-16
  systemctl enable --now postgresql
  ok "PostgreSQL 16 พร้อมใช้"
fi

# ---- 5. ติดตั้ง Caddy (HTTPS reverse proxy อัตโนมัติ) ----
step "ติดตั้ง Caddy"
if command -v caddy >/dev/null; then
  ok "Caddy มีอยู่แล้ว ($(caddy version | head -1))"
else
  apt-get install -qq -y debian-keyring debian-archive-keyring apt-transport-https
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -qq
  apt-get install -qq -y caddy
  ok "Caddy พร้อม"
fi

# ---- 6. ติดตั้ง Chromium dependencies (สำหรับ Puppeteer) ----
step "ติดตั้ง Chromium dependencies (Puppeteer)"
apt-get install -qq -y \
  fonts-liberation libasound2t64 libatk-bridge2.0-0 libatk1.0-0 \
  libatspi2.0-0 libcairo2 libcups2 libdbus-1-3 libdrm2 libgbm1 \
  libglib2.0-0 libgtk-3-0 libnspr4 libnss3 libpango-1.0-0 \
  libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxdamage1 libxext6 \
  libxfixes3 libxkbcommon0 libxrandr2 xdg-utils
ok "Chromium deps ครบ — Puppeteer จะ download chromium ของมันเองตอน npm install"

# ---- 7. สร้าง app user (ไม่ใช้ root รันแอป) ----
step "สร้าง user 'invoice' สำหรับรันแอป"
if id invoice >/dev/null 2>&1; then
  ok "user 'invoice' มีอยู่แล้ว"
else
  useradd -m -s /bin/bash invoice
  ok "สร้าง user 'invoice' แล้ว"
fi

# ---- 8. สร้าง database + user (Postgres) ----
step "สร้าง database invoice_db + user invoice_app"
DB_PASS_FILE=/root/.invoice_db_pass
if [ -f "$DB_PASS_FILE" ]; then
  DB_PASS=$(cat "$DB_PASS_FILE")
  ok "ใช้รหัสผ่าน DB ที่มีอยู่ (เก็บที่ $DB_PASS_FILE)"
else
  DB_PASS=$(openssl rand -base64 24 | tr -d '/+=' | cut -c1-24)
  echo "$DB_PASS" > "$DB_PASS_FILE"
  chmod 600 "$DB_PASS_FILE"
  ok "สร้างรหัสผ่าน DB ใหม่ + เก็บที่ $DB_PASS_FILE"
fi

sudo -u postgres psql <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'invoice_app') THEN
    CREATE USER invoice_app WITH PASSWORD '$DB_PASS';
  ELSE
    ALTER USER invoice_app WITH PASSWORD '$DB_PASS';
  END IF;
END \$\$;
SELECT 'CREATE DATABASE invoice_db OWNER invoice_app'
  WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'invoice_db')\gexec
SQL
ok "database + user พร้อม"

# ---- 9. ตั้ง Firewall ----
step "ตั้ง Firewall (ufw)"
ufw allow OpenSSH >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
echo "y" | ufw enable >/dev/null 2>&1 || true
ok "firewall: SSH + HTTP + HTTPS"

# ---- 10. สรุป ----
echo ""
echo -e "${GREEN}============================================================${NC}"
echo -e "${GREEN} ติดตั้งระบบเสร็จ!${NC}"
echo -e "${GREEN}============================================================${NC}"
echo ""
echo -e "${CYAN}ข้อมูลสำคัญ:${NC}"
echo "  Database name:      invoice_db"
echo "  Database user:      invoice_app"
echo "  Database password:  $DB_PASS"
echo "  รหัสเก็บที่:          $DB_PASS_FILE (เฉพาะ root อ่านได้)"
echo ""
echo -e "${CYAN}DATABASE_URL สำหรับ .env:${NC}"
echo "  postgresql://invoice_app:$DB_PASS@localhost:5432/invoice_db"
echo ""
echo -e "${YELLOW}ขั้นตอนถัดไป:${NC}"
echo "  1) su - invoice"
echo "  2) git clone <your-repo> ~/invoice-app  (หรือ scp source code มา)"
echo "  3) cd ~/invoice-app && bash scripts/deploy-app.sh"
echo ""
