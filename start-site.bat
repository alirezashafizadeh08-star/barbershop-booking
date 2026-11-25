@echo off
setlocal
chcp 65001 >nul

set "ROOT_DIR=%~dp0"
set "SERVER_DIR=%ROOT_DIR%server"
set "CLIENT_DIR=%ROOT_DIR%client"

echo ===================================================
echo   Barbershop Booking - Local Launcher
echo ===================================================
echo.

:: Check Backend (port 3000)
powershell -NoProfile -ExecutionPolicy Bypass -Command "if (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }"
if %errorlevel%==0 (
    echo [Backend]  Port 3000 is already running.
) else (
    echo [Backend]  Starting Express server on port 3000...
    start "Barbershop Backend" /D "%SERVER_DIR%" cmd /k "npm.cmd run dev"
)

:: Check Frontend (port 5173)
powershell -NoProfile -ExecutionPolicy Bypass -Command "if (Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }"
if %errorlevel%==0 (
    echo [Frontend] Port 5173 is already running.
) else (
    echo [Frontend] Starting Vite client on http://127.0.0.1:5173 ...
    start "Barbershop Frontend" /D "%CLIENT_DIR%" cmd /k "npx.cmd vite --host 127.0.0.1"
)

echo.
echo Waiting for services to become ready...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$deadline = (Get-Date).AddSeconds(20); " ^
  "$beOk = $false; $feOk = $false; " ^
  "while ((Get-Date) -lt $deadline) { " ^
  "  if (-not $beOk) { try { $r = Invoke-WebRequest -Uri 'http://localhost:3000/api/health' -UseBasicParsing -TimeoutSec 2; if ($r.StatusCode -eq 200) { $beOk = $true } } catch {} } " ^
  "  if (-not $feOk) { try { $r = Invoke-WebRequest -Uri 'http://127.0.0.1:5173' -UseBasicParsing -TimeoutSec 2; if ($r.StatusCode -eq 200) { $feOk = $true } } catch {} } " ^
  "  if ($beOk -and $feOk) { break } " ^
  "  Start-Sleep -Milliseconds 500 " ^
  "} " ^
  "Write-Host ('Backend  (http://localhost:3000/api/health): ' + ($(if ($beOk) { 'READY' } else { 'STARTING...' }))); " ^
  "Write-Host ('Frontend (http://127.0.0.1:5173):           ' + ($(if ($feOk) { 'READY' } else { 'STARTING...' })));"

echo.
echo Customer URL: http://127.0.0.1:5173
echo Admin URL:    http://127.0.0.1:5173/admin
echo.
echo Opening browser...
start "" "http://127.0.0.1:5173"

echo.
echo Both services run in independent windows.
echo To stop them safely later, run stop-site.bat.
endlocal
