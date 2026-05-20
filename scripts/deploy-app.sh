#!/usr/bin/env bash
# ============================================================
# deploy-app.sh
# Deploy / Update Invoice App บน VPS Ubuntu
# รันในฐานะ user 'invoice' (ไม่ใช่ root)
#   su - invoice
#   cd ~/invoice-app
#   bash scripts/deploy-app.sh
# ============================================================

set -e

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'
step() { echo -e "\n${CYAN}==> $1${NC}"; }
ok()   { echo -e "    ${GREEN}[OK]${NC} $1"; }
warn() { echo -e "    ${YELLOW}[!] $1${NC}"; }
err()  { echo -e "    ${RED}[ERR]${NC} $1"; }

# ---- ต้องไม่ใช่ root ----
if [[ $EUID -eq 0 ]]; then
   err "อย่ารันด้วย root — ใช้ 'su - invoice' ก่อน"
   exit 1
fi

# ---- ตรวจสอบ .env ----
step "ตรวจสอบ .env"
if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    cp .env.example .env
    warn ".env ยังไม่มี — copy จาก .env.example แล้ว"
    warn "*** กรุณาแก้ .env ก่อน: DATABASE_URL, AUTH_SECRET, AUTH_URL, NEXT_PUBLIC_APP_URL"
    warn "    แล้วรัน script นี้ใหม่อีกครั้ง"
    exit 1
  else
    err "ไม่พบ .env และ .env.example"
    exit 1
  fi
fi
ok ".env มีอยู่"

# ---- ติดตั้ง dependencies ----
step "ติดตั้ง dependencies (npm install)"
npm install
ok "npm install เสร็จ"

# ---- Push schema ไป DB ----
step "Push schema ไปฐานข้อมูล (drizzle db:push)"
npm run db:push
ok "schema synced"

# ---- Build production ----
step "Build production"
npm run build
ok "build เสร็จ"

# ---- ติดตั้ง pm2 ถ้ายังไม่มี ----
step "ตั้ง pm2 ให้รันแอปแบบ auto-restart"
if ! command -v pm2 >/dev/null; then
  sudo npm install -g pm2
fi

# ---- start/restart แอป ----
if pm2 describe invoice-app >/dev/null 2>&1; then
  pm2 restart invoice-app
  ok "restart แอปแล้ว"
else
  pm2 start npm --name invoice-app -- start
  pm2 save
  # auto-start บน boot
  sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u $USER --hp $HOME
  pm2 save
  ok "start แอปแล้ว + ตั้ง auto-start"
fi

# ---- สรุป ----
echo ""
echo -e "${GREEN}============================================================${NC}"
echo -e "${GREEN} Deploy เสร็จ!${NC}"
echo -e "${GREEN}============================================================${NC}"
echo ""
echo -e "${CYAN}ตรวจสอบ:${NC}"
echo "  pm2 status              # ดูสถานะแอป"
echo "  pm2 logs invoice-app    # ดู log"
echo "  curl localhost:3000     # test response"
echo ""
echo -e "${YELLOW}ขั้นตอนถัดไป (Caddy + HTTPS):${NC}"
echo "  sudo cp scripts/Caddyfile /etc/caddy/Caddyfile"
echo "  sudo nano /etc/caddy/Caddyfile   # แก้ domain ของคุณ"
echo "  sudo systemctl reload caddy"
echo ""
