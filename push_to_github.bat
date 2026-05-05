@echo off
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion

echo ========================================
echo   MONEY TRACKER - GITHUB AUTOMATOR
echo ========================================
echo.

:: -----------------------------------------------
:: Step 0: Ensure credential helper is configured
:: -----------------------------------------------
echo [0/5] Checking Git credentials setup...
for /f "tokens=*" %%i in ('git config --global credential.helper 2^>nul') do set "CRED_HELPER=%%i"
if not defined CRED_HELPER (
    echo     No credential helper found. Setting up Git Credential Manager...
    git config --global credential.helper manager
    echo     Done - GCM will handle GitHub login.
) else (
    echo     Credential helper: !CRED_HELPER! - OK
)
echo.

:: -----------------------------------------------
:: Step 1: Remove sensitive cached files
:: -----------------------------------------------
echo [1/5] Removing sensitive cached files...
git rm --cached Yoggie.json 2>nul
git rm --cached credentials.json 2>nul
git rm --cached service_account.json 2>nul
git rm --cached scripts/service_account.json 2>nul
git rm --cached scripts/config.json 2>nul
git rm --cached config.json 2>nul
echo     Done.
echo.

:: -----------------------------------------------
:: Step 2: Stage all changes
:: -----------------------------------------------
echo [2/5] Staging all changes...
git add .
echo     Files staged.
echo.

:: -----------------------------------------------
:: Step 3: Commit
:: -----------------------------------------------
echo [3/5] Committing changes...
set "msg=Auto-update: %date% %time%"
git commit -m "!msg!"
if !errorlevel! neq 0 (
    echo     Nothing new to commit - will push existing commits.
)
echo.

:: -----------------------------------------------
:: Step 4: Pull remote changes first (avoid rejected push)
:: -----------------------------------------------
echo [4/5] Pulling remote changes...
git pull --rebase origin main 2>nul
if !errorlevel! neq 0 (
    echo     Pull failed or no remote changes. Continuing...
)
echo.

:: -----------------------------------------------
:: Step 5: Push
:: -----------------------------------------------
echo [5/5] Pushing to GitHub...
git push origin main 2>&1
set "PUSH_RESULT=!errorlevel!"

if !PUSH_RESULT! neq 0 (
    echo     Normal push failed. Trying force-with-lease...
    git push --force-with-lease origin main 2>&1
    set "PUSH_RESULT=!errorlevel!"
)

if !PUSH_RESULT! neq 0 (
    echo     Force-with-lease failed. Trying force push...
    git push --force origin main 2>&1
    set "PUSH_RESULT=!errorlevel!"
)

echo.
if !PUSH_RESULT! equ 0 (
    echo ===================================
    echo   SUCCESS! Code is live on GitHub.
    echo ===================================
) else (
    echo ===================================
    echo   PUSH FAILED!
    echo ===================================
    echo.
    echo   Possible fixes:
    echo     1. Check your internet connection
    echo     2. Run: git config --global credential.helper manager
    echo     3. Then try this script again - a browser login window should appear
    echo     4. Make sure you have push access to the repo
)

echo.
pause
