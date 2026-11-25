@echo off
setlocal
chcp 65001 >nul

set "ROOT_DIR=%~dp0"
if "%ROOT_DIR:~-1%"=="\" set "ROOT_DIR=%ROOT_DIR:~0,-1%"

echo ===================================================
echo   Barbershop Booking - Safe Stop
echo ===================================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$root = $env:ROOT_DIR.ToLowerInvariant(); " ^
  "$projectName = (Split-Path $root -Leaf).ToLowerInvariant(); " ^
  "$procs = Get-CimInstance Win32_Process; " ^
  "$byPid = @{}; foreach ($p in $procs) { $byPid[[int]$p.ProcessId] = $p }; " ^
  "$targets = New-Object System.Collections.Generic.HashSet[int]; " ^
  "$portPids = Get-NetTCPConnection -LocalPort 3000, 5173 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique; " ^
  "foreach ($portPid in $portPids) { " ^
  "  $cur = $byPid[[int]$portPid]; " ^
  "  $belongsToProject = $false; " ^
  "  $walk = $cur; " ^
  "  while ($walk) { " ^
  "    $wCmd = ($walk.CommandLine + '').ToLowerInvariant(); " ^
  "    if ($wCmd.Contains($root) -or $wCmd.Contains($projectName) -or $wCmd.Contains('barbershop backend') -or $wCmd.Contains('barbershop frontend')) { $belongsToProject = $true; break } " ^
  "    if ($walk.ParentProcessId -and $byPid.ContainsKey([int]$walk.ParentProcessId)) { $walk = $byPid[[int]$walk.ParentProcessId] } else { $walk = $null } " ^
  "  } " ^
  "  if ($belongsToProject -and $cur) { [void]$targets.Add([int]$cur.ProcessId) } " ^
  "} " ^
  "foreach ($p in $procs) { " ^
  "  $pName = ($p.Name + '').ToLowerInvariant(); " ^
  "  $cmd = ($p.CommandLine + '').ToLowerInvariant(); " ^
  "  if ($pName -in @('cmd.exe','node.exe') -and ($cmd.Contains('barbershop backend') -or $cmd.Contains('barbershop frontend') -or ($cmd.Contains($root) -and ($cmd.Contains('src/server.ts') -or $cmd.Contains('vite') -or $cmd.Contains('scripts\dev.mjs') -or $cmd.Contains('scripts/dev.mjs') -or $cmd.Contains('npm.cmd run dev'))))) { " ^
  "    [void]$targets.Add([int]$p.ProcessId); " ^
  "  } " ^
  "} " ^
  "if ($targets.Count -eq 0) { " ^
  "  Write-Host 'No running Barbershop Booking processes were found.'; " ^
  "} else { " ^
  "  foreach ($id in $targets) { " ^
  "    $procInfo = $byPid[$id]; " ^
  "    if ($procInfo -and $id -ne $PID) { " ^
  "      try { Stop-Process -Id $id -Force -ErrorAction SilentlyContinue; Write-Host ('Stopped ' + $procInfo.Name + ' (PID ' + $id + ')') } catch {} " ^
  "    } " ^
  "  } " ^
  "}"

echo.
echo Done.
endlocal
