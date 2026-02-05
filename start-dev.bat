@echo off
chcp 65001 > nul
echo ========================================
echo   COMIC-Bridge 開発サーバー起動
echo ========================================
echo.

cd /d "%~dp0"

echo npm run tauri dev を実行中...
echo.

npm run tauri dev

pause
