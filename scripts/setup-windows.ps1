# ============================================================
# setup-windows.ps1
# ติดตั้งทุกอย่างที่ Invoice App ต้องการ บนเครื่อง Windows ใหม่
# ใช้: เปิด PowerShell (Run as Administrator) แล้วรันสคริปต์นี้
#
#   powershell -ExecutionPolicy Bypass -File setup-windows.ps1
#
# ติดตั้ง:
#   - Node.js 22 LTS
#   - PostgreSQL 16
#   - Google Chrome
#   - Git for Windows
#   - NSSM (Windows Service manager — สำหรับ auto-start)
#
# Script นี้ "idempotent" — รันซ้ำได้ ไม่ติดตั้งซ้ำของที่มีอยู่แล้ว
# ============================================================

# --- 1. ตรวจสอบสิทธิ์ Administrator ---
if (-not ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Host "[!] ต้องรันด้วยสิทธิ์ Administrator" -ForegroundColor Red
    Write-Host "    คลิกขวาที่ PowerShell -> Run as Administrator แล้วลองใหม่" -ForegroundColor Yellow
    exit 1
}

$ErrorActionPreference = "Stop"

function Write-Step($msg) {
    Write-Host ""
    Write-Host "==> $msg" -ForegroundColor Cyan
}

function Test-Command($cmd) {
    try { Get-Command $cmd -ErrorAction Stop | Out-Null; return $true }
    catch { return $false }
}

# --- 2. ตรวจสอบ winget (ต้องมีในตัว Win 10/11) ---
Write-Step "ตรวจสอบ winget"
if (-not (Test-Command "winget")) {
    Write-Host "[!] ไม่พบ winget — กรุณาอัปเดต Windows หรือติดตั้ง App Installer จาก Microsoft Store" -ForegroundColor Red
    Write-Host "    https://aka.ms/getwinget" -ForegroundColor Yellow
    exit 1
}
Write-Host "    [OK] winget พร้อมใช้งาน" -ForegroundColor Green

# --- 3. ติดตั้ง Node.js 22 LTS ---
Write-Step "ติดตั้ง Node.js 22 LTS"
if (Test-Command "node") {
    $ver = & node --version
    Write-Host "    [OK] Node.js ติดตั้งอยู่แล้ว ($ver)" -ForegroundColor Green
} else {
    winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
    Write-Host "    [OK] ติดตั้ง Node.js เสร็จ" -ForegroundColor Green
}

# --- 4. ติดตั้ง PostgreSQL 16 ---
Write-Step "ติดตั้ง PostgreSQL 16"
$pgService = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue
if ($pgService) {
    Write-Host "    [OK] PostgreSQL ติดตั้งอยู่แล้ว (service: $($pgService.Name))" -ForegroundColor Green
} else {
    winget install -e --id PostgreSQL.PostgreSQL.16 --accept-source-agreements --accept-package-agreements
    Write-Host "    [!] ระหว่างติดตั้ง PostgreSQL จะให้ตั้งรหัสผ่าน superuser (postgres)" -ForegroundColor Yellow
    Write-Host "    [!] **จดรหัสผ่านนี้ไว้** จะใช้สร้าง user สำหรับแอป" -ForegroundColor Yellow
    Write-Host "    [OK] ติดตั้ง PostgreSQL เสร็จ" -ForegroundColor Green
}

# --- 5. ติดตั้ง Google Chrome (สำหรับ Puppeteer) ---
Write-Step "ติดตั้ง Google Chrome"
$chromePath = "${env:ProgramFiles}\Google\Chrome\Application\chrome.exe"
$chromePathX86 = "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe"
if ((Test-Path $chromePath) -or (Test-Path $chromePathX86)) {
    Write-Host "    [OK] Chrome ติดตั้งอยู่แล้ว" -ForegroundColor Green
} else {
    winget install -e --id Google.Chrome --accept-source-agreements --accept-package-agreements
    Write-Host "    [OK] ติดตั้ง Chrome เสร็จ" -ForegroundColor Green
}

# --- 6. ติดตั้ง Git for Windows ---
Write-Step "ติดตั้ง Git for Windows"
if (Test-Command "git") {
    $ver = & git --version
    Write-Host "    [OK] Git ติดตั้งอยู่แล้ว ($ver)" -ForegroundColor Green
} else {
    winget install -e --id Git.Git --accept-source-agreements --accept-package-agreements
    Write-Host "    [OK] ติดตั้ง Git เสร็จ" -ForegroundColor Green
}

# --- 7. ติดตั้ง NSSM (Windows Service manager) ---
Write-Step "ติดตั้ง NSSM"
if (Test-Command "nssm") {
    Write-Host "    [OK] NSSM ติดตั้งอยู่แล้ว" -ForegroundColor Green
} else {
    winget install -e --id NSSM.NSSM --accept-source-agreements --accept-package-agreements
    Write-Host "    [OK] ติดตั้ง NSSM เสร็จ" -ForegroundColor Green
}

# --- 8. รีเฟรช PATH เพื่อให้คำสั่งใหม่ใช้ได้ทันที ---
Write-Step "รีเฟรช PATH"
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
Write-Host "    [OK]" -ForegroundColor Green

# --- 9. สรุป ---
Write-Step "ตรวจสอบเวอร์ชันที่ติดตั้ง"
try { Write-Host "    Node.js: $(node --version)" } catch { Write-Host "    Node.js: [!] ไม่พบ" -ForegroundColor Red }
try { Write-Host "    npm:     $(npm --version)" } catch { Write-Host "    npm:     [!] ไม่พบ" -ForegroundColor Red }
try { Write-Host "    Git:     $(git --version)" } catch { Write-Host "    Git:     [!] ไม่พบ" -ForegroundColor Red }

$pg = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue
if ($pg) {
    Write-Host "    Postgres: $($pg.Name) [$($pg.Status)]"
    if ($pg.Status -ne "Running") {
        Write-Host "    [!] PostgreSQL service ไม่ทำงาน — กำลังพยายาม start..." -ForegroundColor Yellow
        Start-Service -Name $pg.Name
    }
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host " ติดตั้งโปรแกรมหลักเสร็จ!" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "ขั้นตอนถัดไป:" -ForegroundColor Cyan
Write-Host "  1) ปิด PowerShell แล้วเปิดใหม่ (ให้ PATH refresh)"
Write-Host "  2) สร้าง database สำหรับแอป (script install-app.ps1)"
Write-Host "  3) Clone โปรเจกต์ + npm install + npm run build"
Write-Host "  4) ตั้ง Windows Service ผ่าน NSSM ให้ auto-start"
Write-Host ""
Write-Host "หาก install-app.ps1 มีให้ใช้ ให้รันต่อ:" -ForegroundColor Yellow
Write-Host "  powershell -ExecutionPolicy Bypass -File install-app.ps1" -ForegroundColor Yellow
Write-Host ""
