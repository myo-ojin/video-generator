@echo off
REM AI News Video Generator - Setup Script (Windows)
REM This script sets up the project environment

echo ==========================================
echo AI News Video Generator - Setup
echo ==========================================
echo.

REM Check Node.js
echo Checking Node.js version...
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Error: Node.js is not installed
    echo Please install Node.js v18.0.0 or higher
    exit /b 1
)

for /f "tokens=1" %%i in ('node -v') do set NODE_VERSION=%%i
echo [32m✓[0m Node.js version: %NODE_VERSION%
echo.

REM Install dependencies
echo Installing dependencies...
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo Error: Failed to install dependencies
    exit /b 1
)
echo [32m✓[0m Dependencies installed
echo.

REM Create directories
echo Creating directories...
if not exist "output" mkdir output
if not exist "cache" mkdir cache
if not exist "logs" mkdir logs
if not exist "assets" mkdir assets
echo [32m✓[0m Directories created
echo.

REM Copy configuration files
echo Setting up configuration files...

if not exist "config\pipeline-config.json" (
    copy "config\pipeline-config.example.json" "config\pipeline-config.json" >nul
    echo [32m✓[0m Created config\pipeline-config.json
) else (
    echo   config\pipeline-config.json already exists
)

if not exist "config\research-config.json" (
    copy "config\research-config.example.json" "config\research-config.json" >nul
    echo [32m✓[0m Created config\research-config.json
) else (
    echo   config\research-config.json already exists
)

if not exist "config\script-generation-config.json" (
    copy "config\script-generation-config.example.json" "config\script-generation-config.json" >nul
    echo [32m✓[0m Created config\script-generation-config.json
) else (
    echo   config\script-generation-config.json already exists
)

if not exist "config\subtitle-generation-config.json" (
    copy "config\subtitle-generation-config.example.json" "config\subtitle-generation-config.json" >nul
    echo [32m✓[0m Created config\subtitle-generation-config.json
) else (
    echo   config\subtitle-generation-config.json already exists
)

if not exist "config\voice-synthesis-config.json" (
    copy "config\voice-synthesis-config.example.json" "config\voice-synthesis-config.json" >nul
    echo [32m✓[0m Created config\voice-synthesis-config.json
) else (
    echo   config\voice-synthesis-config.json already exists
)

if not exist "config\video-composition-config.json" (
    copy "config\video-composition-config.example.json" "config\video-composition-config.json" >nul
    echo [32m✓[0m Created config\video-composition-config.json
) else (
    echo   config\video-composition-config.json already exists
)

if not exist "config\youtube-upload-config.json" (
    copy "config\youtube-upload-config.example.json" "config\youtube-upload-config.json" >nul
    echo [32m✓[0m Created config\youtube-upload-config.json
) else (
    echo   config\youtube-upload-config.json already exists
)

if not exist "config\credentials.json" (
    copy "config\credentials.example.json" "config\credentials.json" >nul
    echo [32m✓[0m Created config\credentials.json [33m(PLEASE UPDATE WITH YOUR CREDENTIALS)[0m
) else (
    echo   config\credentials.json already exists
)

echo.

REM Build TypeScript
echo Building TypeScript...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo Error: Build failed
    exit /b 1
)
echo [32m✓[0m Build completed
echo.

REM Check external tools
echo Checking external tools...

where codex >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [32m✓[0m Codex CLI: Found
) else (
    echo [33m⚠[0m Codex CLI: Not found (required for Research Node)
)

where claude >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [32m✓[0m Claude CLI: Found
) else (
    echo [33m⚠[0m Claude CLI: Not found (required for Script Generation Node)
)

where ffmpeg >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    for /f "tokens=*" %%i in ('ffmpeg -version 2^>^&1 ^| findstr /C:"ffmpeg version"') do echo [32m✓[0m FFmpeg: %%i
) else (
    echo [33m⚠[0m FFmpeg: Not found (required for Video Composition Node)
)

echo.
echo ==========================================
echo Setup completed!
echo ==========================================
echo.
echo Next steps:
echo 1. Update config\credentials.json with your YouTube API credentials
echo 2. Start VOICEVOX (http://localhost:50021)
echo 3. Run the pipeline: npm run run:pipeline
echo.
echo For more information, see README.md
echo.

pause
