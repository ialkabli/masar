@echo off
cd /d "%~dp0"
if not exist node_modules (call npm ci)
if errorlevel 1 goto :error
call npm run build
if errorlevel 1 goto :error
call npm start
exit /b
:error
echo Local startup failed. See the message above.
pause
