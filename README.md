# postgres-readonly-mcp

Plugin de Claude Code que le da a Claude acceso **de solo lectura** a una
base PostgreSQL — ninguna escritura es posible, reforzado en dos capas
independientes. Pensado para auditorias de esquema, exploracion de datos y
extraer DDL/configuracion antes de una migracion a produccion, sin riesgo de
escribir por accidente.

Se instala una vez por maquina y luego se habilita en cualquier proyecto
pegando un connection string — sin reconfigurar el MCP en cada repo.

## Como se mantiene de solo lectura

```mermaid
flowchart LR
    A[Claude Code] -->|MCP stdio| B[postgres-mcp<br/>--access-mode=restricted]
    B -->|SQL parseado: escrituras<br/>y COMMIT/ROLLBACK rechazados| C[(PostgreSQL)]
    C -->|rol: solo SELECT<br/>CREATE revocado| C

    style B fill:#2d5,stroke:#333
    style C fill:#48f,stroke:#333
```

Dos capas, para que un bug en una no importe:

1. **Rol de base de datos con `GRANT SELECT` unicamente** — ver
   [`db/create_readonly_role.sql`](db/create_readonly_role.sql). Es la capa
   que de verdad importa: aunque el cliente MCP tuviera un bug, la base
   rechaza cualquier escritura.
2. **[postgres-mcp](https://github.com/crystaldba/postgres-mcp) en
   `--access-mode=restricted`** — rechaza sentencias de escritura y
   `COMMIT`/`ROLLBACK` a nivel de parser SQL, antes de que lleguen a la base.

## Por que un venv local y no `uvx`/`npx -y`

En redes con inspeccion TLS (proxys corporativos, agentes EDR), las
descargas de paquetes al vuelo pueden fallar de forma intermitente o romper
la verificacion de hashes de pip. Este plugin instala una vez un entorno
virtual local con versiones fijadas (`postgres-mcp==0.3.0`, `mcp<2` — fijado
para evitar un conflicto de dependencias con versiones mas nuevas de `mcp`)
y lo reutiliza en cada sesion, en vez de resolver paquetes por red en cada
arranque.

## Uso

1. Clona este repo una vez por maquina.
2. Corre `scripts/setup.ps1` (crea el venv local — una sola vez por maquina).
3. Crea un rol de solo lectura en la base destino con
   [`db/create_readonly_role.sql`](db/create_readonly_role.sql), adaptado a
   los esquemas de esa base. **Verifica que no pueda escribir** — el script
   termina con los queries exactos para comprobarlo.
4. En cualquier proyecto de Claude Code, habilita el plugin y pega el
   connection string del rol de solo lectura cuando se te pida
   (`postgresql://usuario:password@host:puerto/basededatos`). Se guarda de
   forma segura (keychain del sistema / archivo de credenciales), nunca en
   un archivo versionado.

## Proyectos que usan varias bases a la vez

El `userConfig` del plugin cubre el caso simple: un proyecto, una base. Para
proyectos que combinan varias bases (o varios ambientes), no reconfigures el
plugin — registra un servidor MCP por base, en alcance local del proyecto,
reutilizando el mismo venv que ya instalaste:

```bash
claude mcp add pg-ro-<alias> -s local \
  -e DATABASE_URI=postgresql://usuario:password@host:puerto/basededatos \
  -- "<ruta-al-repo-del-plugin>\.venv\Scripts\postgres-mcp.exe" --access-mode=restricted
```

Repite con un `<alias>` distinto por cada base (ej. `pg-ro-xafsuite`,
`pg-ro-facturacion`). Todas comparten el mismo venv y el mismo modo
restringido; solo cambia el connection string. Cada rol de solo lectura se
crea igual, con `db/create_readonly_role.sql` contra su propia base.

## Notas de seguridad

- **El contenido de las tablas si pasa por el modelo.** Solo lectura evita
  que se escriba, no evita que los resultados de un `SELECT` salgan de la
  red de la empresa hacia la API del proveedor de IA. Es una decision de
  gobierno de datos de cada equipo, no algo que este plugin resuelva por si
  solo — confirma con seguridad/cumplimiento si aplica antes de usarlo
  contra datos sensibles o de produccion.
- Para tareas que no necesitan ver contenido real (ej. comparar si dos
  sistemas registran lo mismo para una misma entidad), preferir escribir el
  query de forma que devuelva el veredicto/diferencias agregadas
  (`COUNT`, `IS DISTINCT FROM`, hashes) en vez de las filas completas —
  reduce lo que efectivamente le llega al modelo.
- **Pon fecha de caducidad al rol** (`ALTER ROLE ... VALID UNTIL`). Lo que
  queda "abierto para siempre" si no se hace nada no es una conexion TCP —
  es la credencial. El servidor MCP solo abre conexiones mientras la sesion
  esta activa; la credencial en cambio sigue siendo valida hasta que alguien
  la revoque, a menos que tenga fecha de vencimiento.
- Nunca reutilices la cuenta de la aplicacion — normalmente tiene permisos
  de escritura.
- Nunca pongas el connection string en `.mcp.json` ni en ningun archivo
  versionado — siempre a traves del prompt de `userConfig` del plugin.
- Lee [`db/create_readonly_role.sql`](db/create_readonly_role.sql): incluye
  el fix de una trampa clasica de Postgres — en versiones anteriores a la
  15, el esquema `public` concede `CREATE` a `PUBLIC` por defecto, asi que
  un rol "de solo lectura" igual podria crear tablas si no se revoca ese
  privilegio de forma explicita.

## Licencia

MIT
