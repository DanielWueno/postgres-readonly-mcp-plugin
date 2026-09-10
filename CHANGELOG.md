# Changelog

Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).
Versionado: [SemVer](https://semver.org/lang/es/).

## [2.1.0] — 2026-09-10

### Agregado

- `SECURITY.md` documenta que el modo de solo lectura no impide que un
  `SELECT` dispare funciones con efectos secundarios (`SECURITY DEFINER`,
  `pg_notify`, procedimientos que auditan o notifican), ni que una consulta
  analítica pesada agote CPU o memoria antes de llegar al
  `statement_timeout` configurado por `crear-rol` -- ninguno de los dos
  riesgos es mitigable desde este plugin porque dependen del parser interno
  de `postgres-mcp` (paquete externo).
- `SECURITY.md` documenta el riesgo de saturación de contexto ("context
  flood"): el plugin no impone `LIMIT` ni trunca el tamaño de la respuesta
  de una consulta, por lo que un `SELECT` sin filtrar sobre una tabla
  grande puede saturar la ventana de contexto del modelo y el consumo de
  tokens de la sesión.
- `README.md`, `commands/sembrar.md` y `commands/ayuda.md` advierten, en
  el paso de exportar la variable de entorno con `$env:`/`setx`, que una
  contraseña con caracteres especiales (`@ : / # %` espacio o comillas)
  puede romper el parseo de la URI `postgresql://` o corromperse al pasar
  por `setx`, y dan el paso concreto para evitarlo (URL-encodear la
  contraseña o envolver el valor completo entre comillas).
- `scripts/sembrar.js` detecta cuando el nombre de variable de entorno
  derivado de un alias nuevo ya está en uso por otra entrada `pg-ro-*`
  existente bajo un alias distinto, y bloquea la siembra con un mensaje
  explícito en vez de crear en silencio dos servidores que terminarían
  compartiendo el mismo secreto.

## [2.0.0] — 2026-09-09

### Roto

- El plugin ya no registra ningún servidor MCP automáticamente al
  instalarse: se eliminaron `mcpServers` y `userConfig` de `plugin.json`, y
  ya no existe `.mcp.json` en la raíz del plugin. Quien ya tenía el plugin
  instalado en el modo anterior pierde el registro global al actualizar y
  debe correr `/postgres-readonly-mcp:sembrar <alias>` en cada proyecto
  donde quiera volver a usarlo.
- `scripts/setup.ps1` y `scripts/run.cmd` fueron eliminados, junto con el
  entorno virtual Python local (`.venv`) que ambos gestionaban.

### Cambiado

- El servidor MCP ahora se agrega por proyecto, no de forma global: el
  comando `/postgres-readonly-mcp:sembrar <alias>` (o `pgro sembrar <alias>`
  desde una terminal normal) añade una entrada `pg-ro-<alias>` al
  `.mcp.json` del proyecto actual, lanzando `postgres-mcp` vía `uvx` con
  versiones fijadas, en vez de depender de un entorno virtual local.
- La cadena de conexión ya no se pide como `userConfig` ni se guarda en
  ningún archivo versionado: la entrada generada usa
  `env.DATABASE_URI="${PGRO_<PROYECTO>_<ALIAS>}"`, una referencia a una
  variable de entorno que el propio usuario exporta en su terminal o
  perfil de shell. El secreto nunca pasa por la conversación con el modelo.
- Se agregan los comandos `/postgres-readonly-mcp:sembrar`, `listar`,
  `quitar`, `doctor` y `crear-rol`, además de `ayuda`.
- Se agrega el atajo de terminal `pgro`, con los mismos subcomandos, para
  administrar el plugin sin tener Claude Code abierto.

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
