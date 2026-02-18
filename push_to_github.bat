@echo off
setlocal enabledelayedexpansion

echo ========================================
echo   🚀 MONEY TRACKER - GITHUB AUTOMATOR
echo ========================================
echo.

echo [1/3] Staging changes...
:: Ensure sensitive files are NOT tracked if they were accidentally added
git rm --cached Yoggie.json 2>nul
git rm --cached credentials.json 2>nul
git rm --cached service_account.json 2>nul
git add .

echo.
set msg=Auto-update: %date% %time%

echo.
echo [2/3] Committing changes...
git commit -m "!msg!"

echo.
echo [3/3] Pushing to GitHub...
git push origin main

if %errorlevel% neq 0 (
    echo.
    echo ❌ ERROR: Push failed. Attempting to fix with a rebase...
    git pull --rebase origin main
    git push origin main
)

if %errorlevel% equ 0 (
    echo.
    echo ✅ SUCCESS! Your changes are now on GitHub.
) else (
    echo.
    echo ❌ STILL FAILING: Please check your internet or GitHub login.
)

echo.
timeout /t 3
