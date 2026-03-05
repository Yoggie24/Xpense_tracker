@echo off
setlocal enabledelayedexpansion

echo ========================================
echo   🚀 MONEY TRACKER - GITHUB AUTOMATOR
echo ========================================
echo.

echo [1/4] Removing sensitive cached files...
git rm --cached Yoggie.json 2>nul
git rm --cached credentials.json 2>nul
git rm --cached service_account.json 2>nul
git rm --cached scripts/service_account.json 2>nul
git rm --cached scripts/config.json 2>nul
git rm --cached config.json 2>nul

echo [2/4] Staging all changes...
git add .
echo ✔ Files staged.

echo.
echo [3/4] Committing changes...
set "msg=Auto-update: %date% %time%"
git commit -m "%msg%"
if %errorlevel% neq 0 (
    echo ℹ️  Nothing new to commit - will push existing commits.
)

echo.
echo [4/4] Pushing to GitHub (local code overwrites remote)...
git push --force-with-lease origin main
set PUSH_RESULT=%errorlevel%

if %PUSH_RESULT% neq 0 (
    echo ⚠️  Retrying with force push...
    git push --force origin main
    set PUSH_RESULT=%errorlevel%
)

echo.
if %PUSH_RESULT% equ 0 (
    echo ✅ SUCCESS! Your local code is now live on GitHub.
) else (
    echo ❌ PUSH FAILED. Check your internet connection or GitHub login.
    echo    Tip: Run  git credential-manager-core erase  to reset login.
)

echo.
pause
