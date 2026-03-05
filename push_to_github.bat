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
git rm --cached scripts/service_account.json 2>nul
git add .

echo.
set "msg=Auto-update: %date% %time%"

echo.
echo [2/3] Committing changes...
git commit -m "%msg%"
if %errorlevel% neq 0 (
    echo. 
    echo ℹ️  No new changes to commit - pushing existing commits...
)

echo.
echo [3/3] Force pushing to GitHub (your local code wins)...
git push --force-with-lease origin main

if %errorlevel% neq 0 (
    echo.
    echo ⚠️  Force-with-lease failed (remote changed). Forcing push anyway...
    git push --force origin main
)

if %errorlevel% equ 0 (
    echo.
    echo ✅ SUCCESS! Your local code is now on GitHub.
) else (
    echo.
    echo ❌ STILL FAILING: Please check your internet or GitHub login.
)

echo.
pause
