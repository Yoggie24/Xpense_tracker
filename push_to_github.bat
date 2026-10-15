@echo off
chcp 65001 >nul 2>&1
setlocal
cd /d "%~dp0"

echo ========================================
echo   MONEY TRACKER - PUBLISH TO GITHUB
echo ========================================
echo.

git rev-parse --show-toplevel >nul 2>&1
if errorlevel 1 (
    echo ERROR: This folder is not inside a Git repository.
    goto failed
)

for /f "tokens=*" %%i in ('git branch --show-current') do set "BRANCH=%%i"
if not "%BRANCH%"=="main" (
    echo ERROR: Switch to the main branch before publishing.
    echo Current branch: %BRANCH%
    goto failed
)

echo [1/4] Staging local website and asset changes...
git rm --cached --ignore-unmatch Yoggie.json credentials.json service_account.json scripts/service_account.json scripts/config.json config.json
if errorlevel 1 (
    echo ERROR: Could not remove ignored credential files from the Git index.
    goto failed
)
git add --all
if errorlevel 1 (
    echo ERROR: Could not stage local changes.
    goto failed
)

git diff --cached --quiet
if errorlevel 2 (
    echo ERROR: Could not inspect staged changes.
    goto failed
)
if errorlevel 1 (
    echo [2/4] Committing changes...
    git commit -m "Sync website assets %date% %time%"
    if errorlevel 1 (
        echo ERROR: Commit failed.
        goto failed
    )
) else (
    echo [2/4] No local changes to commit.
)

echo [3/4] Updating from GitHub...
git pull --rebase origin main
if errorlevel 1 (
    echo ERROR: Pull/rebase failed. Resolve the issue, then run this script again.
    goto failed
)

echo [4/4] Pushing local main to GitHub...
git push origin main
if errorlevel 1 (
    echo ERROR: Push failed. Check your connection and GitHub permissions.
    goto failed
)

echo.
echo ========================================
echo   SUCCESS: Local main is synced to GitHub.
echo   GitHub Pages: https://yoggie24.github.io/Xpense_tracker/
echo   Allow a few minutes for Pages to publish.
echo ========================================
echo.
pause
exit /b 0

:failed
echo.
echo Publishing stopped. No force push was attempted.
echo.
pause
exit /b 1
