$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  MONEY TRACKER - PUBLISH TO GITHUB" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

git rev-parse --show-toplevel | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: This folder is not inside a Git repository." -ForegroundColor Red
    exit 1
}

$branch = (git branch --show-current).Trim()
if ($LASTEXITCODE -ne 0 -or $branch -ne 'main') {
    Write-Host "ERROR: Switch to the main branch before publishing (current: $branch)." -ForegroundColor Red
    exit 1
}

Write-Host "[1/4] Staging local website and asset changes..." -ForegroundColor Yellow
git rm --cached --ignore-unmatch Yoggie.json credentials.json service_account.json scripts/service_account.json scripts/config.json config.json
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Could not remove ignored credential files from the Git index." -ForegroundColor Red
    exit 1
}
git add --all
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Could not stage local changes." -ForegroundColor Red
    exit 1
}

git diff --cached --quiet
if ($LASTEXITCODE -eq 1) {
    $message = Read-Host "Commit message (press Enter for default)"
    if ([string]::IsNullOrWhiteSpace($message)) {
        $message = "Sync website assets $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    }
    git commit -m $message
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Commit failed." -ForegroundColor Red
        exit 1
    }
} elseif ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Could not inspect staged changes." -ForegroundColor Red
    exit 1
} else {
    Write-Host "[2/4] No local changes to commit." -ForegroundColor Green
}

Write-Host "[3/4] Updating from GitHub..." -ForegroundColor Yellow
git pull --rebase origin main
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Pull/rebase failed. Resolve the issue, then run this script again." -ForegroundColor Red
    exit 1
}

Write-Host "[4/4] Pushing local main to GitHub..." -ForegroundColor Yellow
git push origin main
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Push failed. Check your connection and GitHub permissions." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "SUCCESS: Local main is synced to GitHub." -ForegroundColor Green
Write-Host "GitHub Pages: https://yoggie24.github.io/Xpense_tracker/" -ForegroundColor Cyan
Write-Host "Allow a few minutes for Pages to publish."
Read-Host "Press Enter to exit"
