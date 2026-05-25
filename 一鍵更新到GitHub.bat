@echo off
:: 設定編碼為 CP950 (繁體中文 ANSI)
chcp 950 >nul
title 第17小隊打卡系統 - 一鍵部署工具

echo ===================================================
echo   [DEPLOY] 第17小隊親證定課打卡系統 - 一鍵更新到 GitHub
echo ===================================================
echo.

:: ================= 智慧偵測 Git 絕對路徑 =================
:: 防範剛安裝完 Git，Windows 環境變數尚未重新載入快取的問題
set "GIT_CMD=git"

if exist "C:\Program Files\Git\cmd\git.exe" (
    set "GIT_CMD=C:\Program Files\Git\cmd\git.exe"
) else if exist "C:\Program Files (x86)\Git\cmd\git.exe" (
    set "GIT_CMD=C:\Program Files (x86)\Git\cmd\git.exe"
) else if exist "%LocalAppData%\Programs\Git\cmd\git.exe" (
    set "GIT_CMD=%LocalAppData%\Programs\Git\cmd\git.exe"
)

:: 測試偵測出的 Git 指令是否能執行
"%GIT_CMD%" --version >nul 2>&1
if errorlevel 1 goto error_no_git

:: 檢查是否設定了 Git 使用者身分
"%GIT_CMD%" config user.email >nul 2>&1
if errorlevel 1 goto error_no_identity
:: =========================================================

:: 1. 加入暫存區
echo [1/3] 正在將所有修改的檔案加入暫存區...
"%GIT_CMD%" add .
if errorlevel 1 goto error

:: 2. 建立提交
echo.
echo [2/3] 正在建立 Git 提交紀錄...
"%GIT_CMD%" commit -m "update: checkin system auto-updated via one-click tool"
if errorlevel 1 (
    echo.
    echo [INFO] 偵測結果：本地程式沒有任何新修改，無需上傳更新。
    goto nochange
)

:: 3. 推送到雲端
echo.
echo [3/3] 正在推送到 GitHub 雲端 (GitHub Pages 將自動在背景更新)...
"%GIT_CMD%" push origin main
if errorlevel 1 (
    echo.
    echo [WARN] 嘗試推送至 main 分支失敗，正在嘗試推送至 master 分支...
    "%GIT_CMD%" push origin master
    if errorlevel 1 goto error
)

:success
echo.
echo ===================================================
echo   [SUCCESS] 恭喜您！程式碼已成功推送上傳至 GitHub！
echo   [TIPS] 請等待約 30 秒至 1 分鐘，您手機上的打卡網頁就會更新完成！
echo ===================================================
goto end

:nochange
echo.
echo ===================================================
echo   [INFO] 您的打卡系統已經是最新狀態，不需進行上傳部署。
echo ===================================================
goto end

:error
echo.
echo ===================================================
echo   [ERROR] 部署失敗！請檢查以下事項：
echo   1. 您的電腦是否已經連線上網？
echo   2. 此資料夾是否已與 GitHub 儲存庫完成初次連線？
echo ===================================================
goto end

:error_no_git
echo.
echo ===================================================
echo   [ERROR] 系統找不到 Git 程式！請確認：
echo   - 您是否剛才完成了 Git 安裝？如果是，請試著「重新開機」讓系統讀取路徑。
echo   - 或者，您可以直接用「網頁拖曳檔案上傳」進行快速部署。
echo ===================================================
goto end

:error_no_identity
echo.
echo ===================================================
echo   [ERROR] 偵測到您尚未設定 Git 使用者身分！
echo   請在您的終端機（Terminal）中執行以下兩行指令設定您的身分：
echo.
echo   git config --global user.email "您的 GitHub 信箱"
echo   git config --global user.name "您的 GitHub 帳號"
echo ===================================================
goto end

:end
echo.
echo 請按任意鍵關閉此視窗...
pause >nul
