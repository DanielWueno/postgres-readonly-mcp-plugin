# Política de seguridad

## Cómo reportar

En la pestaña **Security** del repositorio, con **Report a vulnerability**. El
aviso llega en privado y no queda publicado mientras se trabaja.

No abras una issue pública para esto: las issues de este repositorio son
visibles para cualquiera.

## Qué versiones reciben arreglos

Sólo la última publicada. No hay ramas de mantenimiento: un arreglo sale como
una versión nueva.

## Modelo de amenaza

Este plugin conecta Claude Code a una base PostgreSQL real usando una
credencial que vive en la máquina del usuario. El diseño se apoya en tres
mecanismos concretos, verificables en el código de este repositorio:

1. El secreto (`DATABASE_URI`) nunca se escribe en un archivo versionado ni
   se pega en la conversación con el modelo — solo existe como variable de
   entorno en la máquina de cada persona.
2. `/postgres-readonly-mcp:crear-rol` nunca ejecuta SQL ni se conecta a
   ninguna base — solo imprime texto.
3. Doble capa contra escritura: rol de Postgres con `GRANT SELECT` únicamente,
   más `postgres-mcp --access-mode=restricted`, que rechaza escrituras a
   nivel de parser.

Ninguna de estas garantías cubre el contenido devuelto por un `SELECT`: ese
dato sí llega a la conversación con el modelo (ver más abajo).

## Qué importa en este proyecto

- **Que el secreto pase por la conversación con el modelo o por un archivo
  versionado.** El riesgo concreto es pegar una cadena de conexión
  (`postgresql://usuario:contraseña@host:puerto/basedatos`) en el chat de
  Claude Code, o dejarla escrita en `.mcp.json`. El mecanismo que lo evita es
  el que produce `/postgres-readonly-mcp:sembrar`: la entrada que agrega a
  `.mcp.json` del proyecto usa siempre una referencia `${PGRO_<PROYECTO>_<ALIAS>}`
  en `env.DATABASE_URI`, nunca un valor literal, y el comando nunca pide ni
  acepta una cadena de conexión real — solo el alias corto. El valor real se
  configura después, a mano, como variable de entorno en la terminal del
  usuario (`$env:PGRO_<PROYECTO>_<ALIAS> = "..."` o `setx` para que persista),
  fuera de cualquier archivo del repositorio y fuera de la conversación con el
  modelo. Un reporte de que `.mcp.json` o cualquier comando de este plugin
  llegan a contener un secreto en texto plano es una vulnerabilidad real.
- **Que `/postgres-readonly-mcp:crear-rol` ejecute SQL o se conecte a una
  base.** Por diseño, este comando solo genera el bloque `CREATE ROLE` /
  `GRANT` (basado en `db/create_readonly_role.sql`) como texto impreso en el
  chat, para que el usuario lo corra a mano con sus propias credenciales de
  administrador (psql, pgAdmin, DBeaver, etc.). Si en algún momento este
  comando ejecutara SQL directamente o abriera una conexión de red, es una
  vulnerabilidad real: rompe la garantía de que ningún credential de
  administrador pasa por el plugin.
- **Que el rol de solo lectura pueda escribir.** `db/create_readonly_role.sql`
  incluye consultas de verificación al final precisamente para esto — un
  reporte de que el rol creado con ese script permite `INSERT`/`UPDATE`/
  `CREATE` en la práctica es una vulnerabilidad real de este proyecto.
- **Que `postgres-mcp --access-mode=restricted` acepte una sentencia de
  escritura o un `COMMIT`/`ROLLBACK`.** Es la segunda capa de la garantía de
  solo lectura; un reporte reproducible de que el modo restringido deja pasar
  una de estas sentencias es una vulnerabilidad real, incluso si el rol de
  base de datos igual la hubiera rechazado.

## Exposición de datos sensibles vía consultas de lectura

El modo restringido evita la escritura, pero no evita que el **contenido**
devuelto por un `SELECT` llegue a la conversación con el modelo — incluyendo
PII u otros datos sensibles, aunque la base de datos nunca sea modificada.
Esto no es un defecto a corregir en el código del plugin: es una propiedad
inherente de exponer resultados de consultas a través de MCP, y por eso se
trata como parte del modelo de amenaza, no como "no es una vulnerabilidad".

Mitigación recomendada (ya documentada en el README, sección "Consideraciones
de seguridad"): excluir del `GRANT` las columnas o tablas sensibles al
definir el rol de solo lectura, otorgando `SELECT` por columna o a través de
vistas que omitan esos campos, en lugar de `GRANT SELECT ON ALL TABLES IN
SCHEMA`. Para tareas que no requieren ver contenido real, escribir la consulta
para que devuelva un veredicto o diferencias agregadas (`COUNT`, `IS DISTINCT
FROM`, hashes) en vez de las filas completas reduce lo que efectivamente llega
al modelo.

## Efectos secundarios y agotamiento de recursos en consultas de solo lectura

Distinto del riesgo de exposición de datos de la sección anterior: "solo
lectura" garantiza que no se ejecuta `INSERT`/`UPDATE`/`DELETE`/`COMMIT`, pero
no garantiza que un `SELECT` sea inofensivo en sí mismo.

- **Funciones con efectos secundarios ejecutables dentro de un `SELECT`.**
  PostgreSQL permite invocar funciones desde un `SELECT` (`SELECT
  mi_funcion(...)`). Si alguna de esas funciones está marcada
  `SECURITY DEFINER`, llama a `pg_notify`, escribe a una tabla de auditoría, o
  dispara cualquier otro efecto secundario, ese efecto ocurre igual aunque la
  sentencia en sí sea sintácticamente un `SELECT` y el rol no tenga `GRANT` de
  escritura sobre ninguna tabla. Ni el rol de solo lectura ni
  `postgres-mcp --access-mode=restricted` inspeccionan el cuerpo de las
  funciones que el rol tiene permiso de ejecutar — ambos verifican la forma de
  la sentencia entrante (parser), no el comportamiento interno de las
  funciones que esa sentencia invoca.
- **Agotamiento de CPU o memoria antes de llegar a `statement_timeout`.** El
  `ALTER ROLE ... SET statement_timeout` que genera
  `/postgres-readonly-mcp:crear-rol` corta una consulta que sigue corriendo
  después de ese tiempo, pero no impide que una consulta analítica pesada
  (un `JOIN` grande sin índice, una agregación sobre una tabla enorme) consuma
  toda la CPU o memoria disponible del servidor mientras corre, incluso dentro
  del límite de tiempo configurado.

Ninguno de los dos es mitigable desde el código de este plugin: ambos
dependen de qué sentencia concreta arma y envía `postgres-mcp` (paquete
externo fijado por el pin de versión, ver más abajo) contra la base, y de qué
funciones y qué volumen de datos expone el rol — decisiones de quien
administra la base, no de este plugin. La mitigación real está en manos de
esa persona: revisar qué funciones son ejecutables por el rol de solo lectura
antes de otorgar `GRANT EXECUTE`, y dimensionar o filtrar las consultas que se
esperan correr contra tablas grandes.

## Saturación de contexto por volumen de resultados ("context flood")

Distinto de los dos riesgos anteriores: aquí no importa qué tan sensible es el
dato ni qué efecto secundario dispara la consulta, sino cuántas filas devuelve.
Una consulta sin filtrar — por ejemplo un `SELECT *` sobre una tabla con miles
o millones de filas, sin `WHERE` ni `LIMIT` — puede devolver un volumen de
datos que satura la ventana de contexto del modelo y dispara un consumo de
tokens grande en la sesión de Claude Code.

Este plugin no impone ningún `LIMIT` sobre las consultas que el usuario escribe
ni trunca el tamaño del payload de respuesta antes de que llegue al modelo. No
existe ninguna protección de código, en este plugin ni en la invocación de
`postgres-mcp` que genera, contra este escenario: la sentencia que arma y envía
`postgres-mcp` es la que el usuario escribió, sin interceptarla ni reescribirla
— y así debe ser, porque este plugin no debe alterar las consultas del usuario.

Mitigación recomendada, a cargo de quien escribe la consulta:

- Agregar `LIMIT` y condiciones `WHERE` que acoten el resultado antes de
  correr una consulta exploratoria sobre una tabla de tamaño desconocido o
  grande.
- Paginar consultas que necesiten recorrer una tabla completa, en vez de
  pedir todas las filas en una sola sentencia.
- Revisar si la versión de `postgres-mcp` en uso ofrece alguna opción propia
  de límite de filas o de tamaño de respuesta configurable — no se afirma
  aquí que exista tal opción; es algo a comprobar contra la documentación de
  ese paquete antes de asumirlo.

La responsabilidad de acotar el volumen de una consulta es de quien la escribe,
no de este plugin: el mismo principio de diseño que impide a este plugin
interceptar o reescribir sentencias SQL (ver "Efectos secundarios y
agotamiento de recursos" arriba) aplica aquí — el plugin no decide por el
usuario qué tan grande debe ser un resultado.

## Revisión del pin de `postgres-mcp`

Este plugin fija `postgres-mcp==0.3.0` junto con `"mcp<2"` al invocar
`uvx --system-certs --from postgres-mcp==0.3.0 --with "mcp<2" postgres-mcp --access-mode=restricted`.
Ese pin debe revisarse por vulnerabilidades conocidas bajo estas dos
condiciones, no de forma ad hoc:

1. **Antes de cada release de este plugin** — como parte de preparar la
   versión nueva, antes de publicar el tag.
2. **Ante cualquier CVE o advisory reportado contra `postgres-mcp` o contra
   `mcp` dentro del rango de versión fijado** (`postgres-mcp==0.3.0`,
   `mcp<2`), apenas se tenga noticia de él — sin esperar al próximo release
   programado del plugin.

Si la revisión encuentra una vulnerabilidad aplicable, el arreglo es subir el
pin a una versión corregida (o fijar un rango que la excluya) en todos los
lugares donde aparece: este documento, el README y `commands/sembrar.md` (que
es de donde sale el `.mcp.json` generado).

## Qué no es una vulnerabilidad

- **Que el rol de solo lectura no tenga fecha de caducidad si quien lo creó no
  se la puso.** El README recomienda `ALTER ROLE ... VALID UNTIL`; que no se
  use es una decisión operativa de quien administra la base, no un defecto de
  este plugin.
- **Que el contenido de las tablas consultadas llegue al modelo.** Es el
  comportamiento esperado y documentado de un acceso de lectura vía MCP (ver
  "Exposición de datos sensibles" arriba), no algo que este plugin deba
  impedir por sí solo.
- **Que una conexión sembrada falle por falta de `uv`/`uvx` en `PATH`, o
  porque la variable de entorno esperada no está seteada en la sesión
  actual.** `/postgres-readonly-mcp:doctor` diagnostica exactamente estos dos
  casos; son errores de entorno local, no fallas de este plugin.
