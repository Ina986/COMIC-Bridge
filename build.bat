@echo off
chcp 65001 > nul
echo ========================================
echo   COMIC-Bridge ビルド
echo ========================================
echo.

cd /d "%~dp0"

echo npm run tauri build を実行中...
echo.

npm run tauri build

echo.
echo ビルド完了！
echo 出力先: src-tauri\target\release
pause
