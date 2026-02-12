# MONEY TRACKER - GITHUB AUTOMATOR (PowerShell)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  🚀 MONEY TRACKER - GITHUB AUTOMATOR" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/3] Staging changes..." -ForegroundColor Yellow
git add .

Write-Host ""
$msg = Read-Host "Enter commit message (press Enter for default)"
if ([string]::IsNullOrWhiteSpace($msg)) {
    $msg = "Auto-update: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
}

Write-Host ""
Write-Host "[2/3] Committing changes..." -ForegroundColor Yellow
git commit -m $msg

Write-Host ""
Write-Host "[3/3] Pushing to GitHub..." -ForegroundColor Yellow
git push origin main

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "⚠️  Push failed. Attempting to fix with a rebase..." -ForegroundColor Magenta
    git pull --rebase origin main
    git push origin main
}

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ SUCCESS! Your changes are now on GitHub." -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "❌ STILL FAILING: Please check your internet or GitHub login." -ForegroundColor Red
}

Write-Host ""
Read-Host "Press Enter to exit"
