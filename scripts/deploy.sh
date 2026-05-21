#!/usr/bin/env bash
# ============================================================
# deploy.sh — Pull update + rebuild + restart (Hostinger VPS)
#
# ใช้บน VPS:
#   cd /opt/apps/invoice
#   ./scripts/deploy.sh
#
# ครั้งแรกต้อง: chmod +x scripts/deploy.sh
# ============================================================

set -e

COMPOSE_FILE="docker-compose.production.yml"
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'
step() { echo -e "\n${CYAN}==> $1${NC}"; }
ok()   { echo -e "    ${GREEN}[OK]${NC} $1"; }
err()  { echo -e "    ${RED}[ERR]${NC} $1"; }

# ต้องอยู่ในโฟลเดอร์ที่มี docker-compose
cd "$(dirname "$0")/.."
if [ ! -f "$COMPOSE_FILE" ]; then
  err "ไม่พบ $COMPOSE_FILE — รัน script นี้จากโฟลเดอร์ /opt/apps/invoice"
  exit 1
fi
if [ ! -f ".env" ]; then
  err "ไม่พบ .env"
  exit 1
fi

# ---- 1. Pull ----
step "ดึงโค้ดใหม่จาก GitHub"
BEFORE=$(git rev-parse --short HEAD)
git pull --ff-only
AFTER=$(git rev-parse --short HEAD)
if [ "$BEFORE" = "$AFTER" ]; then
  ok "ไม่มี commit ใหม่ (ยังเป็น $AFTER) — rebuild ต่อ"
else
  ok "อัปเดต $BEFORE -> $AFTER"
  git --no-pager log --oneline "$BEFORE..$AFTER" | sed 's/^/      /'
fi

# ---- 2. Build + restart ----
step "Build + restart container"
docker compose -f "$COMPOSE_FILE" up -d --build

# ---- 3. รอ container พร้อม ----
step "รอ container พร้อม (สูงสุด 60 วินาที)"
for i in $(seq 1 30); do
  STATUS=$(docker inspect --format '{{.State.Status}}' invoice-app 2>/dev/null || echo "missing")
  if [ "$STATUS" = "running" ]; then
    ok "invoice-app: running"
    break
  fi
  sleep 2
  if [ "$i" = "30" ]; then
    err "invoice-app ไม่ขึ้นภายใน 60 วินาที — ดู log ด้านล่าง"
  fi
done

# ---- 4. สถานะ ----
step "สถานะ container"
docker compose -f "$COMPOSE_FILE" ps

# ---- 5. Health check ----
step "ทดสอบ response (HTTP ภายใน)"
sleep 2
CODE=$(curl -s -o /dev/null -w "%{http_code}" -H "Host: invoice.vmcamera.com" http://localhost 2>/dev/null || echo "000")
if [ "$CODE" = "200" ] || [ "$CODE" = "307" ] || [ "$CODE" = "308" ]; then
  ok "ตอบกลับ HTTP $CODE — แอปทำงาน"
else
  err "HTTP $CODE — แอปอาจมีปัญหา ดู log:"
fi

# ---- 6. Log ล่าสุด ----
step "Log ล่าสุด 15 บรรทัด"
docker compose -f "$COMPOSE_FILE" logs --tail 15 invoice-app

echo ""
echo -e "${GREEN}============================================================${NC}"
echo -e "${GREEN} Deploy เสร็จ — https://invoice.vmcamera.com${NC}"
echo -e "${GREEN}============================================================${NC}"
echo ""
echo -e "${YELLOW}ดู log สด:${NC}  docker compose -f $COMPOSE_FILE logs -f invoice-app"
echo ""
