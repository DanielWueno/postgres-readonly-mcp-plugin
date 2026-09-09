#!/bin/bash
# ============================================================
# instalar-atajo.sh — instala `pgro`, un lanzador de pocas
#                     líneas para scripts/{sembrar,listar,quitar,doctor}.js
#                     en tu PATH.
# ============================================================
# Uso:
#   /postgres-readonly-mcp:atajo        # desde Claude Code: sin rutas
#   bash "$CLAUDE_PLUGIN_ROOT/scripts/instalar-atajo.sh"
#   bash scripts/instalar-atajo.sh      # a mano, parado en el repo
#
# Por qué existe: la forma documentada de usar estos scripts fuera de una
# sesión de Claude Code es `node scripts/doctor.js` (o sembrar.js, etc.),
# y eso obliga a saber dónde quedó instalado el plugin -- un path con el
# número de versión adentro (`.../cache/.../postgres-readonly-mcp/1.0.1/...`),
# que cambia en cada `claude plugin update`. Este script instala un
# lanzador que resuelve esa ruta EN CADA EJECUCIÓN, así que sobrevive a
# todas las actualizaciones sin que nadie lo vuelva a tocar.
#
# Es idempotente: correrlo dos veces no hace daño, y nunca pisa un
# `pgro` que no haya puesto este mismo plugin.
# ============================================================

set -euo pipefail

GREEN=$'\033[0;32m'; YELLOW=$'\033[1;33m'; RED=$'\033[0;31m'
NC=$'\033[0m'; BOLD=$'\033[1m'; DIM=$'\033[2m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

command -v node >/dev/null 2>&1 || {
  echo "instalar-atajo: no encuentro node en el PATH -- es requisito del plugin." >&2
  exit 127
}

case "${OSTYPE:-}" in
  msys*|cygwin*|win32*) ES_WINDOWS=1 ;;
  *)                    ES_WINDOWS=0 ;;
esac

# ~/.local/bin: es donde vive el propio `claude`, así que quien tenga
# Claude Code ya lo tiene en el PATH -- no hay un segundo paso escondido.
BIN_DIR="$HOME/.local/bin"
ATAJO_RUTA="$BIN_DIR/pgro"
FIRMA="# postgres-readonly-mcp:atajo"

VERSION="$(node -e '
  const p = require(process.argv[1]);
  process.stdout.write(p.version || "?");
' "$PLUGIN_ROOT/.claude-plugin/plugin.json" 2>/dev/null || echo '?')"

if [[ -e "$ATAJO_RUTA" ]] && ! grep -q "$FIRMA" "$ATAJO_RUTA" 2>/dev/null; then
  echo -e "${YELLOW}⚠${NC}  Ya hay un ${BOLD}pgro${NC} en $BIN_DIR que no es de este plugin. No lo toco."
  echo -e "${DIM}   Usa \`node scripts/sembrar.js\` (o listar/quitar/doctor) con la ruta larga, o renombra el tuyo si quieres el atajo.${NC}"
  exit 0
fi

mkdir -p "$BIN_DIR"

# Cabecera SIN comillas (se sustituye $VERSION); cuerpo entrecomillado, que
# es lo que mantiene intactos los `$` propios del lanzador.
cat > "$ATAJO_RUTA" <<CABECERA
#!/bin/bash
# postgres-readonly-mcp:atajo -- lanzador de scripts/{sembrar,listar,quitar,doctor}.js
# atajo-version: $VERSION
CABECERA
cat >> "$ATAJO_RUTA" <<'CUERPO'
# No clava ninguna ruta: resuelve la instalación en cada ejecución, así
# que sigue funcionando después de cada `claude plugin update`. Si lo
# borras, se vuelve a crear con `/postgres-readonly-mcp:atajo`.
set -euo pipefail

resolver_plugin() {
  local salida
  # Lo autoritativo es el CLI.
  salida="$(claude plugin list --json 2>/dev/null | node -e '
    let d = "";
    process.stdin.on("data", c => d += c);
    process.stdin.on("end", () => {
      try {
        const lista = JSON.parse(d);
        const hit = (Array.isArray(lista) ? lista : [])
          .find(x => (x.id || "").startsWith("postgres-readonly-mcp"));
        if (hit && hit.installPath) process.stdout.write(hit.installPath);
      } catch {}
    });
  ' 2>/dev/null)" || true
  [[ -n "${salida:-}" && -d "$salida" ]] && { printf '%s' "$salida"; return 0; }

  # Respaldo: el registro que escribe el propio CLI, por si `claude` no
  # está en el PATH de este shell.
  salida="$(node -e '
    const fs = require("fs"), os = require("os"), path = require("path");
    const r = path.join(os.homedir(), ".claude", "plugins", "installed_plugins.json");
    try {
      const d = JSON.parse(fs.readFileSync(r, "utf8"));
      for (const entradas of Object.values(d.plugins || {})) {
        for (const e of entradas) {
          if (e && e.installPath) { process.stdout.write(e.installPath); process.exit(0); }
        }
      }
    } catch {}
  ' postgres-readonly-mcp 2>/dev/null)" || true
  [[ -n "${salida:-}" && -d "$salida" ]] && { printf '%s' "$salida"; return 0; }
  return 1
}

DIR="$(resolver_plugin)" || {
  echo "pgro: no encuentro el plugin instalado." >&2
  echo "      Instálalo con: /plugin install postgres-readonly-mcp@dweno-forge" >&2
  exit 127
}

imprimir_ayuda() {
  echo "pgro sembrar <alias>   agrega una conexión Postgres de solo lectura al proyecto actual"
  echo "pgro listar            lista las conexiones pg-ro-* sembradas en el proyecto actual"
  echo "pgro quitar <alias>    quita una conexión del proyecto actual"
  echo "pgro doctor            diagnostica por qué una conexión sembrada podría no funcionar"
  echo "pgro crear-rol         explica cómo generar el SQL de rol de solo lectura (solo dentro de Claude Code)"
  echo "pgro ayuda | --help | -h   esto mismo"
}

case "${1:-}" in
  ""|-h|--help|ayuda|help)
    imprimir_ayuda
    ;;
  sembrar) shift; exec node "$DIR/scripts/sembrar.js" "$@" ;;
  listar) shift; exec node "$DIR/scripts/listar.js" "$@" ;;
  quitar) shift; exec node "$DIR/scripts/quitar.js" "$@" ;;
  doctor) shift; exec node "$DIR/scripts/doctor.js" "$@" ;;
  crear-rol)
    echo "pgro: 'crear-rol' no está disponible como comando de terminal."
    echo "      Esa función genera y explica el SQL apoyándose en el propio modelo de Claude Code"
    echo "      (rellena una plantilla según lo que le pidas), así que solo existe dentro de una"
    echo "      sesión de Claude Code. Usala ahí con:"
    echo "        /postgres-readonly-mcp:crear-rol"
    exit 0
    ;;
  *)
    echo "pgro: subcomando desconocido: ${1}" >&2
    imprimir_ayuda >&2
    exit 1
    ;;
esac
CUERPO
chmod +x "$ATAJO_RUTA"

# PowerShell y cmd no ejecutan bash directamente: necesitan un .cmd que
# se lo pase, igual que resuelve arnes-plan/credential-read-guard para el
# mismo problema.
if [[ $ES_WINDOWS -eq 1 ]]; then
  cat > "$BIN_DIR/pgro.cmd" <<'CMD_FIN'
@echo off
setlocal
REM postgres-readonly-mcp:atajo -- envoltorio para PowerShell y cmd.
set "PGRO_BASH="
for %%B in (
  "%ProgramFiles%\Git\bin\bash.exe"
  "%ProgramFiles(x86)%\Git\bin\bash.exe"
  "%LOCALAPPDATA%\Programs\Git\bin\bash.exe"
) do if not defined PGRO_BASH if exist %%B set "PGRO_BASH=%%~B"
if not defined PGRO_BASH for /f "delims=" %%G in ('where git 2^>nul') do (
  if not defined PGRO_BASH if exist "%%~dpG..\bin\bash.exe" set "PGRO_BASH=%%~dpG..\bin\bash.exe"
)
if not defined PGRO_BASH for %%B in (bash.exe) do (
  if not defined PGRO_BASH if not "%%~$PATH:B"=="" set "PGRO_BASH=%%~$PATH:B"
)
if not defined PGRO_BASH (
  echo pgro: no encuentro bash. Instala Git for Windows, o usa git-bash directamente. 1>&2
  exit /b 127
)
"%PGRO_BASH%" "%~dp0pgro" %*
exit /b %ERRORLEVEL%
CMD_FIN
  echo -e "${GREEN}✓${NC} Envoltorio ${BOLD}pgro.cmd${NC} escrito para PowerShell y cmd."
fi

echo -e "${GREEN}✓${NC} Atajo instalado. Desde cualquier proyecto, en la terminal:"
echo
echo -e "  ${BOLD}pgro sembrar <alias>${NC}   agrega una conexión Postgres de solo lectura al proyecto actual"
echo -e "  ${BOLD}pgro listar${NC}            lista las conexiones sembradas en el proyecto actual"
echo -e "  ${BOLD}pgro quitar <alias>${NC}    quita una conexión del proyecto actual"
echo -e "  ${BOLD}pgro doctor${NC}            diagnostica por qué una conexión podría no funcionar"
echo -e "  ${BOLD}pgro crear-rol${NC}         explica cómo generarlo (solo funciona dentro de Claude Code)"
echo -e "  ${BOLD}pgro --help${NC}            esto mismo"
echo

if ! command -v pgro >/dev/null 2>&1; then
  if [[ $ES_WINDOWS -eq 1 ]]; then
    ps="$(command -v powershell.exe || command -v pwsh.exe \
          || command -v powershell || command -v pwsh || true)"
    if [[ -n "$ps" ]]; then
      win="$(cygpath -w "$BIN_DIR" 2>/dev/null || printf '%s' "$BIN_DIR")"
      PGRO_BIN_WIN="$win" "$ps" -NoProfile -NonInteractive -Command '
        $dir = $env:PGRO_BIN_WIN
        $u = [Environment]::GetEnvironmentVariable("Path", "User")
        if (($u -split ";") -contains $dir) { exit 0 }
        $nuevo = if ([string]::IsNullOrEmpty($u)) { $dir } else { $u.TrimEnd(";") + ";" + $dir }
        [Environment]::SetEnvironmentVariable("Path", $nuevo, "User")
      ' >/dev/null 2>&1 && {
        echo -e "${GREEN}✓${NC} $BIN_DIR añadido a tu ${BOLD}PATH de usuario${NC}."
        echo -e "${DIM}   Ábrelo en una consola nueva: la actual no hereda el cambio.${NC}"
      } || {
        echo -e "${YELLOW}⚠${NC}  $BIN_DIR no está en tu PATH. Agrégalo a mano desde"
        echo -e "${DIM}   Variables de entorno del usuario → Path.${NC}"
      }
    fi
  else
    echo -e "${YELLOW}⚠${NC}  $BIN_DIR no está en tu PATH en esta terminal. Añade a tu"
    echo -e "${DIM}   ~/.zshrc o ~/.bashrc: export PATH=\"\$HOME/.local/bin:\$PATH\"${NC}"
  fi
fi
