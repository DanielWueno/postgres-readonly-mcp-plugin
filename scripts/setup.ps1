# Preparacion unica por maquina: crea el venv y deja el servidor listo,
# para que el primer arranque del MCP no dependa de instalar paquetes al vuelo.
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$venv = Join-Path $root ".venv"

if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Error "No se encontro 'python' en PATH. Instala Python 3.10+ antes de continuar."
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
Write-Host "Listo. En Claude Code, habilita el plugin 'postgres-readonly-mcp' y pega tu"
Write-Host "connection URI de solo lectura (postgresql://usuario:password@host:puerto/bd)."
Write-Host "Ese usuario DEBE crearse con db/create_readonly_role.sql -- nunca uses la cuenta de la app."
