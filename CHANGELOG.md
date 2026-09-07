# Changelog

Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).
Versionado: [SemVer](https://semver.org/lang/es/).

## [1.0.1] — 2026-09-07

### Corregido

- `.mcp.json` apuntaba a `${CLAUDE_PLUGIN_DATA}\venv\Scripts\postgres-mcp.exe`,
  una ruta que nunca llega a existir: `${CLAUDE_PLUGIN_DATA}` solo se expone
  como variable de entorno a procesos que el propio Claude Code lanza (el
  servidor MCP, hooks), nunca a un script ejecutado a mano en una terminal
  normal — que es como se corre `scripts/setup.ps1` según el README. Ese
  script (y `run.cmd`) siempre crearon el entorno virtual en `.venv`, relativo
  a la carpeta del propio plugin, no en `${CLAUDE_PLUGIN_DATA}`. El resultado
  era que el servidor fallaba al reconectar (`-32000`) en cualquier máquina,
  incluida la del propio autor, porque el ejecutable nunca estaba en la ruta
  que `.mcp.json` esperaba. Ahora `.mcp.json` usa
  `${CLAUDE_PLUGIN_ROOT}\.venv\...`, que resuelve exactamente a la misma
  carpeta que ya usan `setup.ps1` y `run.cmd`, sin depender de una variable
  que esos scripts no pueden ver. Nota: como `${CLAUDE_PLUGIN_ROOT}` cambia en
  cada versión del plugin instalada vía marketplace, tras actualizar de
  versión hay que volver a correr `scripts/setup.ps1` una vez (el propio
  script ya detecta que falta el ejecutable y lo reinstala).

## [1.0.0] — 2026-09-04

### Añadido

- Servidor MCP `postgres-readonly` en modo `--access-mode=restricted`
  ([postgres-mcp](https://github.com/crystaldba/postgres-mcp)), reforzado
  con un rol de base de datos de solo `SELECT` (`db/create_readonly_role.sql`)
  como segunda capa independiente.
- `scripts/setup.ps1` para crear una única vez por máquina un entorno
  virtual local con versiones fijadas (`postgres-mcp==0.3.0`, `mcp<2`).
- Soporte para proyectos con varias bases de datos mediante múltiples
  registros `claude mcp add` de alcance local, reutilizando el mismo
  entorno virtual.
- Sección de consideraciones de seguridad en el README: gobierno de datos
  sobre el contenido que llega al modelo, caducidad recomendada del rol,
  y la corrección del `CREATE` por defecto de `PUBLIC` en PostgreSQL
  anterior a la versión 15.
