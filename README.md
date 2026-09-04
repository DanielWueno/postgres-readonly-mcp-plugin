# postgres-readonly-mcp

Plugin de Claude Code que otorga acceso de **solo lectura** a una base
PostgreSQL, reforzado en dos capas independientes que impiden cualquier
escritura. Orientado a auditorías de esquema, exploración de datos y
extracción de DDL/configuración previa a una migración a producción.

Se instala una vez por máquina y se habilita en cualquier proyecto
mediante un connection string, sin reconfigurar el servidor MCP por
repositorio.

## Cómo se garantiza el acceso de solo lectura

```mermaid
flowchart LR
    A[Claude Code] -->|MCP stdio| B[postgres-mcp<br/>--access-mode=restricted]
    B -->|SQL parseado: escrituras<br/>y COMMIT/ROLLBACK rechazados| C[(PostgreSQL)]
    C -->|rol: solo SELECT<br/>CREATE revocado| C

    style B fill:#2d5,stroke:#333
    style C fill:#48f,stroke:#333
```

Dos capas independientes, de forma que una falla en una no compromete la
garantía:

1. **Rol de base de datos con `GRANT SELECT` únicamente** — ver
   [`db/create_readonly_role.sql`](db/create_readonly_role.sql). Es la
   capa determinante: aunque el cliente MCP presentara un defecto, la base
   de datos rechaza cualquier escritura a nivel de permisos.
2. **[postgres-mcp](https://github.com/crystaldba/postgres-mcp) en modo
   `--access-mode=restricted`** — rechaza sentencias de escritura y
   `COMMIT`/`ROLLBACK` a nivel de parser SQL, antes de que lleguen a la
   base de datos.

## Justificación del entorno virtual local

En redes con inspección TLS (proxys corporativos, agentes EDR), las
descargas de paquetes en tiempo de ejecución pueden fallar de forma
intermitente o invalidar la verificación de hashes de pip. Este plugin
instala una única vez un entorno virtual local con versiones fijadas
(`postgres-mcp==0.3.0`, `mcp<2` — fijado para evitar un conflicto de
dependencias con versiones más recientes de `mcp`) y lo reutiliza en cada
sesión, en lugar de resolver paquetes por red en cada arranque.

## Requisitos

- Claude Code con soporte de plugins y servidores MCP.
- Python 3.10 o superior disponible en `PATH`.

## Instalación y uso

1. Clonar este repositorio una vez por máquina.
2. Ejecutar `scripts/setup.ps1` (crea el entorno virtual local — una sola
   vez por máquina).
3. Crear un rol de solo lectura en la base destino con
   [`db/create_readonly_role.sql`](db/create_readonly_role.sql), adaptado
   a los esquemas correspondientes. Verificar que el rol no pueda escribir
   — el script incluye las consultas de verificación al final.
4. En cualquier proyecto de Claude Code, habilitar el plugin e ingresar el
   connection string del rol de solo lectura cuando se solicite
   (`postgresql://usuario:password@host:puerto/basededatos`). El valor se
   almacena de forma segura (keychain del sistema o archivo de
   credenciales), nunca en un archivo versionado.

## Proyectos con múltiples bases de datos

El `userConfig` del plugin cubre el caso simple: un proyecto, una base de
datos. Para proyectos que combinan varias bases o varios ambientes, no se
debe reconfigurar el plugin — se registra un servidor MCP por base, en
alcance local del proyecto, reutilizando el entorno virtual ya instalado:

```bash
claude mcp add pg-ro-<alias> -s local \
  -e DATABASE_URI=postgresql://usuario:password@host:puerto/basededatos \
  -- "<ruta-al-repositorio-del-plugin>\.venv\Scripts\postgres-mcp.exe" --access-mode=restricted
```

Se repite con un `<alias>` distinto por cada base (por ejemplo,
`pg-ro-xafsuite`, `pg-ro-facturacion`). Todos los servidores comparten el
mismo entorno virtual y el mismo modo restringido; únicamente cambia el
connection string. Cada rol de solo lectura se crea de la misma forma, con
`db/create_readonly_role.sql` contra su base correspondiente.

## Consideraciones de seguridad

- **El contenido de las tablas sí llega al modelo.** El modo de solo
  lectura impide la escritura, pero no impide que los resultados de una
  consulta `SELECT` salgan de la red de la organización hacia la API del
  proveedor de IA. Esta es una decisión de gobierno de datos de cada
  equipo, no algo que este plugin resuelva por sí solo — debe confirmarse
  con el equipo de seguridad o cumplimiento antes de usarlo contra datos
  sensibles o de producción.
- Para tareas que no requieren ver contenido real (por ejemplo, validar
  que dos sistemas registran la misma información para una misma
  entidad), se recomienda escribir la consulta de forma que devuelva un
  veredicto o diferencias agregadas (`COUNT`, `IS DISTINCT FROM`, hashes)
  en lugar de las filas completas, reduciendo lo que efectivamente llega
  al modelo.
- **El rol debe tener fecha de caducidad** (`ALTER ROLE ... VALID UNTIL`).
  Lo que permanece abierto indefinidamente si no se actúa no es una
  conexión TCP, sino la credencial: el servidor MCP solo abre conexiones
  mientras la sesión está activa, pero la credencial sigue siendo válida
  hasta que alguien la revoque, salvo que tenga fecha de vencimiento.
- No debe reutilizarse la cuenta de la aplicación — habitualmente cuenta
  con permisos de escritura.
- El connection string no debe colocarse en `.mcp.json` ni en ningún
  archivo versionado — únicamente a través del prompt de `userConfig` del
  plugin.
- Revisar [`db/create_readonly_role.sql`](db/create_readonly_role.sql):
  incluye la corrección de un comportamiento conocido de PostgreSQL — en
  versiones anteriores a la 15, el esquema `public` concede `CREATE` a
  `PUBLIC` por defecto, de modo que un rol de "solo lectura" podría de
  todas formas crear tablas si ese privilegio no se revoca explícitamente.

## Licencia

MIT
