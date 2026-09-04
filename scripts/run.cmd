@echo off
setlocal
set "VENV_DIR=%~dp0..\.venv"

if not exist "%VENV_DIR%\Scripts\postgres-mcp.exe" (
  python -m venv "%VENV_DIR%" || exit /b 1
  "%VENV_DIR%\Scripts\python.exe" -m pip install --quiet "postgres-mcp==0.3.0" "mcp<2" || exit /b 1
)

"%VENV_DIR%\Scripts\postgres-mcp.exe" --access-mode=restricted
