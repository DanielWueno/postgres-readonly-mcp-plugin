# postgres-readonly-mcp

Plugin de Claude Code que otorga acceso de **solo lectura** a una base
PostgreSQL, reforzado en dos capas independientes que impiden cualquier
escritura. Orientado a auditorías de esquema, exploración de datos y
extracción de DDL/configuración previa a una migración a producción.

Cada proyecto de Claude Code registra sus propias conexiones (una entrada
por base de datos, en el `.mcp.json` de ese proyecto) y cada conexión
depende de una variable de entorno que el propio usuario configura en su
máquina. Ni la cadena de conexión ni ninguna credencial pasan nunca por la
conversación con el modelo, ni quedan guardadas en ningún archivo
versionado.

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
   [`db/create_readonly_role.sql`](db/create_readonly_role.sql), o generar
   ese SQL con `/postgres-readonly-mcp:crear-rol` (ver más abajo). Es la
   capa determinante: aunque el cliente MCP presentara un defecto, la base
   de datos rechaza cualquier escritura a nivel de permisos.
2. **[postgres-mcp](https://github.com/crystaldba/postgres-mcp) en modo
   `--access-mode=restricted`** — rechaza sentencias de escritura y
   `COMMIT`/`ROLLBACK` a nivel de parser SQL, antes de que lleguen a la
   base de datos.

## Qué no hace

- No otorga acceso de escritura bajo ninguna circunstancia: no hay comando ni
  configuración de este plugin que habilite `INSERT`/`UPDATE`/`DELETE`/`DDL`.
  Si se necesita escritura, este plugin no es la herramienta adecuada.
- No impide que el contenido devuelto por un `SELECT` llegue a la conversación
  con el modelo (ver "Consideraciones de seguridad" más abajo) — solo-lectura
  no significa datos ocultos.
- No limita ni reescribe las consultas que el usuario escribe: no agrega
  `LIMIT` automático ni trunca resultados grandes, así que una consulta sin
  filtrar puede devolver un volumen de datos considerable.
- No gestiona ni rota credenciales: la cadena de conexión se configura a mano,
  como variable de entorno, en la máquina de cada persona; el plugin nunca la
  pide, la guarda ni la transmite.
- No crea el rol de solo lectura por sí solo: `/postgres-readonly-mcp:crear-rol`
  solo imprime el SQL — hace falta correrlo a mano contra la base con un
  usuario administrador.

## Cómo comprobar que funciona

Para verificar, contra una base real, que el modo de solo lectura efectivamente
bloquea escrituras:

1. Sembrar una conexión de prueba: `/postgres-readonly-mcp:sembrar prueba` y
   configurar la variable de entorno que imprime, apuntando a una base de
   pruebas (no producción).
2. Desde Claude Code, con el servidor `pg-ro-prueba` activo, pedir una consulta
   de lectura simple, por ejemplo `SELECT 1` o `SELECT * FROM information_schema.tables LIMIT 5`
   — debe devolver resultados normalmente.
3. Pedir luego una escritura, por ejemplo
   `INSERT INTO alguna_tabla DEFAULT VALUES` o `CREATE TABLE prueba_ro (id int)`
   — debe ser rechazada, ya sea por `postgres-mcp --access-mode=restricted`
   (a nivel de parser, antes de tocar la base) o por el rol de PostgreSQL si el
   parser la dejara pasar (`permission denied`).
4. Si algo no funciona en el camino, correr `/postgres-readonly-mcp:doctor`
   para diagnosticar si falta `uv`/`uvx` en `PATH` o si la variable de entorno
   esperada no está seteada en la sesión actual.

## Requisitos

- Claude Code con soporte de plugins y servidores MCP.
- [`uv`](https://docs.astral.sh/uv/) disponible en `PATH` (que incluye
  `uvx`). El plugin no instala ni requiere un entorno virtual de Python:
  cada servidor MCP se arranca bajo demanda con
  `uvx --system-certs --from postgres-mcp==0.3.0 --with "mcp<2" postgres-mcp --access-mode=restricted`.
  El flag `--system-certs` es necesario en redes con proxy o inspección
  TLS corporativa — sin él, `uvx` puede fallar con un error de tipo
  `UnknownIssuer` al intentar descargar el paquete desde pypi.org.
- `node` disponible en `PATH` (los comandos del plugin ejecutan scripts
  de Node para leer y escribir `.mcp.json`).

## Instalación

```
/plugin marketplace add DanielWueno/dweno-forge
/plugin install postgres-readonly-mcp@dweno-forge
```

Alternativa sin marketplace: clonar este repositorio directamente.

## Comandos disponibles

Todos los comandos viven bajo el namespace `/postgres-readonly-mcp:` (por
ejemplo, `/postgres-readonly-mcp:sembrar`). Operan siempre sobre el
proyecto actual — la carpeta desde donde se está corriendo Claude Code —
y nunca sobre otro proyecto ni sobre configuración global.

### 1. `/postgres-readonly-mcp:crear-rol` (opcional)

Genera, como bloque de SQL impreso en el chat, el `CREATE ROLE` y los
`GRANT` necesarios para un rol de solo lectura sobre uno o más esquemas,
incluyendo un `statement_timeout` conservador para evitar que una consulta
pesada acapare recursos de la base. No se conecta a ninguna base de datos
ni ejecuta nada — el SQL resultante se corre a mano (psql, pgAdmin,
DBeaver, etc.) con un usuario administrador.

### 2. `/postgres-readonly-mcp:sembrar <alias>`

Registra una conexión nueva en el `.mcp.json` del proyecto actual, con
nombre de servidor `pg-ro-<alias>`. La entrada generada usa una
**referencia** a una variable de entorno, nunca un secreto en texto:

```json
{
  "mcpServers": {
    "pg-ro-<alias>": {
      "command": "uvx",
      "args": ["--system-certs", "--from", "postgres-mcp==0.3.0", "--with", "mcp<2", "postgres-mcp", "--access-mode=restricted"],
      "env": { "DATABASE_URI": "${PGRO_<PROYECTO>_<ALIAS>}" }
    }
  }
}
```

El nombre de la variable sigue el patrón `PGRO_<PROYECTO>_<ALIAS>`, donde
`<PROYECTO>` sale del nombre de la carpeta del proyecto actual. El comando
nunca pide ni acepta una cadena de conexión real — solo el alias corto — y
al terminar imprime las líneas listas para copiar en PowerShell para
completar el paso siguiente.

### 3. Configurar la variable de entorno (paso manual, en tu propia terminal)

Después de sembrar una conexión, la cadena de conexión real a la base de
datos se configura **en tu propia máquina**, como variable de entorno, con
el nombre exacto que imprimió `/postgres-readonly-mcp:sembrar`. Este dato
nunca se pega en el chat ni se guarda en ningún archivo del repositorio.

En PowerShell, para la sesión actual:

```powershell
$env:PGRO_<PROYECTO>_<ALIAS> = "postgresql://usuario:contraseña@host:puerto/basedatos"
```

Para que quede guardada de forma permanente en Windows (requiere abrir una
terminal nueva para que surta efecto):

```powershell
setx PGRO_<PROYECTO>_<ALIAS> "postgresql://usuario:contraseña@host:puerto/basedatos"
```

**Advertencia sobre contraseñas con caracteres especiales**: si la contraseña
contiene alguno de estos caracteres — `@ : / # % espacio "` — puede romper el
parseo de la cadena `postgresql://usuario:contraseña@host:puerto/basedatos`.
Por ejemplo, una `@` dentro de la contraseña se confunde con el separador
entre credenciales y host; una `:` adicional se confunde con el separador
entre usuario y contraseña; y un `#` puede truncarse como si fuera un
fragmento de URL. Además, `setx` puede corromper valores con comillas u otros
caracteres especiales si el argumento no queda bien delimitado.

Para evitarlo: URL-encodeá solo la contraseña (no la cadena completa) antes
de armar la URI. En PowerShell:

```powershell
[uri]::EscapeDataString("p@ss:word")
```

Eso devuelve `p%40ss%3Aword`, que es lo que va en el lugar de la contraseña
dentro de la cadena de conexión. Además, envolvé siempre el valor completo de
la URI entre comillas dobles al usar `$env:` o `setx`, tal como se muestra en
los ejemplos.

### 4. `/postgres-readonly-mcp:listar`

Lista las conexiones `pg-ro-*` sembradas en el `.mcp.json` del proyecto
actual: alias y nombre de la variable de entorno que cada una espera.
Nunca muestra contraseñas ni cadenas de conexión reales, porque nunca las
lee ni las guarda.

### 5. `/postgres-readonly-mcp:quitar <alias>`

Elimina del `.mcp.json` del proyecto actual la entrada `pg-ro-<alias>`
correspondiente, sin tocar el resto del archivo. No borra la variable de
entorno configurada en la máquina — eso se hace aparte, si se desea.

### 6. `/postgres-readonly-mcp:doctor`

Diagnostica por qué una conexión sembrada podría no estar funcionando, sin
conectarse a ninguna base de datos real. Revisa, en orden: si `uv`/`uvx`
está disponible en `PATH` (bloqueante si falta, porque sin eso ningún
servidor MCP de este plugin puede arrancar), qué conexiones `pg-ro-*` hay
sembradas en el proyecto actual, y para cada una si su variable de entorno
está seteada en la sesión actual — una variable sin setear es señalada
como primera sospechosa de un fallo, porque sin ella la conexión queda
apuntando literalmente al texto `${NOMBRE_DE_VARIABLE}` en vez de a una
base real.

### 7. `/postgres-readonly-mcp:ayuda`

Resume, dentro del propio chat, los comandos disponibles y el orden
recomendado para usarlos, sin necesidad de salir a leer este README.

## Atajo de terminal: `pgro`

`/postgres-readonly-mcp:atajo` instala un lanzador llamado `pgro` en
`~/.local/bin` (con su correspondiente `.cmd` en Windows), para usar este
plugin desde una terminal normal sin tener Claude Code abierto. Es
idempotente y no sobrescribe un `pgro` que no haya instalado este mismo
plugin. Subcomandos disponibles:

- `pgro sembrar <alias>` — igual que `/postgres-readonly-mcp:sembrar`.
- `pgro listar` — igual que `/postgres-readonly-mcp:listar`.
- `pgro quitar <alias>` — igual que `/postgres-readonly-mcp:quitar`.
- `pgro doctor` — igual que `/postgres-readonly-mcp:doctor`.
- `pgro crear-rol` — no genera SQL desde la terminal: avisa que esa
  función depende del modelo y solo existe dentro de Claude Code, vía
  `/postgres-readonly-mcp:crear-rol`. No es un error, es una limitación de
  diseño esperada.
- `pgro ayuda` / `pgro --help` / `pgro -h` — muestra esta misma lista.

Cada subcomando de `pgro` llama exactamente al mismo script bajo
`scripts/` que su comando `/postgres-readonly-mcp:*` correspondiente — no
hay lógica duplicada entre los dos caminos.

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
- **La cadena de conexión real no debe colocarse en `.mcp.json` ni en
  ningún archivo versionado.** Ese archivo solo contiene una referencia
  `${VAR}` al nombre de una variable de entorno; el valor real vive
  exclusivamente en la máquina de cada persona, configurado a mano según
  las instrucciones que imprime `/postgres-readonly-mcp:sembrar`.
- Revisar [`db/create_readonly_role.sql`](db/create_readonly_role.sql) (o
  el SQL generado por `/postgres-readonly-mcp:crear-rol`): incluye la
  corrección de un comportamiento conocido de PostgreSQL — en versiones
  anteriores a la 15, el esquema `public` concede `CREATE` a `PUBLIC` por
  defecto, de modo que un rol de "solo lectura" podría de todas formas
  crear tablas si ese privilegio no se revoca explícitamente.

## Licencia

MIT
