# Preparacion unica por maquina: crea el entorno virtual y deja el servidor
# listo, de forma que el primer arranque del MCP no dependa de instalar
# paquetes en tiempo de ejecucion.
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$venv = Join-Path $root ".venv"

if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Error "No se encontro 'python' en PATH. Se requiere Python 3.10 o superior."
    exit 1
}

if (-not (Test-Path "$venv\Scripts\postgres-mcp.exe")) {
    Write-Host "Creando entorno virtual en $venv ..."
    python -m venv $venv

    Write-Host "Instalando postgres-mcp (version fijada para evitar conflictos con mcp 2.x)..."
    & "$venv\Scripts\python.exe" -m pip install --quiet "postgres-mcp==0.3.0" "mcp<2"
} else {
    Write-Host "Ya existe un entorno preparado en $venv"
}

Write-Host ""
Write-Host "Instalacion completa. Para activarlo, habilitar el plugin"
Write-Host "'postgres-readonly-mcp' en Claude Code e ingresar el connection URI"
Write-Host "de solo lectura correspondiente (postgresql://usuario:password@host:puerto/bd)."
Write-Host "Ese usuario debe crearse con db/create_readonly_role.sql; no debe"
Write-Host "reutilizarse la cuenta de la aplicacion."
