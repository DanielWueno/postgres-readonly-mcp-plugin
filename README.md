# postgres-readonly-mcp

Plugin de Claude Code para dar acceso de **solo lectura** a bases PostgreSQL,
sin reconfigurar el servidor MCP en cada proyecto. Pensado para analisis de
esquema, auditorias y extraccion de DDL antes de pasar cosas a produccion,
sin riesgo de escribir por accidente.

Protege en dos capas independientes:

1. **Rol de base de datos con `GRANT SELECT` unicamente** (ver `db/create_readonly_role.sql`).
   Es la capa que de verdad importa: aunque el cliente MCP tuviera un bug,
   la base rechaza cualquier escritura.
2. **[postgres-mcp](https://github.com/crystaldba/postgres-mcp) en `--access-mode=restricted`**,
   que ademas bloquea a nivel de parser SQL cualquier sentencia de escritura,
   `COMMIT`/`ROLLBACK` incluidos.

## Por que un venv local y no `uvx`/`npx -y`

En redes corporativas con inspeccion TLS (Netskope, CrowdStrike, etc.) las
descargas "al vuelo" de paquetes pueden fallar de forma intermitente o
romper la verificacion de hashes de pip. Este plugin instala una vez un
entorno virtual local con versiones fijadas (`postgres-mcp==0.3.0`, `mcp<2`
por un conflicto de dependencias conocido) y lo reutiliza en cada sesion.

## Uso

1. Clona este repo una sola vez por maquina.
2. Corre `scripts/setup.ps1` (crea el venv local, una sola vez por maquina).
3. Crea un rol de solo lectura en la base que quieras consultar con
   `db/create_readonly_role.sql` (adaptalo al esquema de esa base) y
   **verifica** que de verdad no pueda escribir (el script incluye los
   queries de verificacion al final).
4. En cualquier proyecto de Claude Code, habilita el plugin y pega la
   connection URI del rol de solo lectura cuando se te pida
   (`postgresql://usuario:password@host:puerto/basededatos`). Se guarda
   de forma segura (Keychain / credentials file), no en texto plano en el repo.

## Seguridad

- Nunca uses la cuenta de la aplicacion (suele tener permisos de escritura).
- Nunca pongas la connection URI directamente en `.mcp.json` o en cualquier
  archivo versionado — siempre via el prompt de `userConfig` del plugin.
- Revisa `db/create_readonly_role.sql`: incluye el fix para la trampa de
  Postgres donde el esquema `public` concede `CREATE` a `PUBLIC` por defecto
  en versiones anteriores a la 15 (si no se revoca, el rol "solo lectura"
  igual podria crear tablas).
