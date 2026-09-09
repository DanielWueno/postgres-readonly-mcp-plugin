---
description: Genera el SQL para crear un rol de solo lectura en PostgreSQL (no se conecta a ninguna base)
---

Esquema(s) pedidos: `$ARGUMENTS`

Si no vienen uno o más esquemas en `$ARGUMENTS`, pregúntamelos antes de seguir: los nombres de
los esquemas de PostgreSQL sobre los que se quiere dar acceso de solo lectura (por ejemplo
`public`, `ventas`). Nunca me pidas ni aceptes que pegue aquí una cadena de conexión, un usuario
admin, ni ninguna contraseña real — este comando nunca se conecta a ninguna base de datos, solo
genera texto SQL.

También preguntame, si no lo dijo ya, dos cosas más (con valores por defecto razonables si no le
importa elegir):

- El nombre del rol a crear (por defecto `readonly_user`).
- El nombre de la base de datos sobre la que va el `GRANT CONNECT` (si no lo sabe, pedile que
  ponga el nombre que ve en su cliente al conectarse, o dejalo como placeholder `<nombre_de_tu_base>`
  que él mismo reemplace).

Con esos datos, generá y mostrame **en la consola del chat, como bloque de código SQL listo para
copiar** (nunca lo escribas a un archivo nuevo) algo con esta forma, reemplazando `<rol>`,
`<base>` y `<esquema>` (repetí las líneas de `GRANT USAGE`, `GRANT SELECT` y
`ALTER DEFAULT PRIVILEGES` una vez por cada esquema pedido):

```sql
-- 1. Crear el rol de solo lectura. Reemplazá 'CAMBIA_ESTA_CONTRASEÑA' por una
--    contraseña propia antes de ejecutar esto — nunca uses la que aparece acá tal cual.
CREATE ROLE <rol> WITH LOGIN PASSWORD 'CAMBIA_ESTA_CONTRASEÑA';

-- 2. Permitir que el rol se conecte a la base.
GRANT CONNECT ON DATABASE <base> TO <rol>;

-- 3. Permitir ver el/los esquema(s) indicados.
GRANT USAGE ON SCHEMA <esquema> TO <rol>;

-- 4. Dar SELECT sobre todas las tablas que ya existen en el esquema.
GRANT SELECT ON ALL TABLES IN SCHEMA <esquema> TO <rol>;

-- 5. Asegurar que las tablas que se creen en el futuro en ese esquema
--    también queden visibles para el rol, sin tener que repetir el paso 4.
ALTER DEFAULT PRIVILEGES IN SCHEMA <esquema> GRANT SELECT ON TABLES TO <rol>;

-- 6. Límite de tiempo por consulta: 30 segundos es un valor conservador para
--    evitar que una consulta pesada de solo lectura (por ejemplo, un SELECT
--    sin filtrar sobre una tabla enorme) acapare CPU/IO y afecte al resto de
--    la base mientras se investiga algo desde el chat. Ajustalo si tu caso
--    necesita consultas más largas.
ALTER ROLE <rol> SET statement_timeout = '30s';
```

Después del bloque SQL, explicame el resultado en lenguaje llano, sin asumir que quien lee ya
sabe qué es un rol de base de datos, qué es psql, o SQL:

1. **Qué es este rol y para qué sirve**: es una "llave" separada, distinta de tu usuario admin,
   que solo puede leer datos (SELECT) y no puede insertar, modificar ni borrar nada. Es la llave
   que se usa para conectar el MCP de este plugin a tu base de datos.

2. **Por qué tiene que ser de solo lectura**: si esta llave se usa desde una conversación con un
   modelo de IA y por error (un malentendido, una instrucción ambigua, un bug) se intentara borrar
   o modificar algo, el rol de solo lectura simplemente no lo permite — la base queda protegida de
   cambios accidentales o no deseados.

3. **Cómo correr este SQL**: no hace falta saber programar. Se puede usar:
   - **Un cliente gráfico** (si ya tenés uno instalado, como pgAdmin, DBeaver o TablePlus): abrilo,
     conectate a tu base usando tu usuario administrador de siempre, abrí una ventana nueva de
     consulta ("SQL editor" o "Query"), pegá el bloque de arriba (ya con la contraseña real que
     elegiste en vez de `CAMBIA_ESTA_CONTRASEÑA`) y ejecutalo.
   - **psql** (la herramienta de línea de comandos que viene con PostgreSQL): conectate con
     `psql "<tu-cadena-de-conexion-admin>"`, pegá el bloque de SQL en la terminal y presioná Enter.

   En cualquiera de los dos casos, necesitás conectarte con un usuario que tenga permisos de
   administrador (el mismo que usás para crear tablas o usuarios) — el rol de solo lectura que
   estás creando todavía no existe, así que no podés usarlo para este paso.

Después, agregá SIEMPRE, de forma bien visible (por ejemplo con un encabezado tipo
"⚠️ Importante"), estas dos advertencias:

- **El modo solo lectura no es lo mismo que "datos seguros"**: evita que se dañe o borre
  información, pero **no** evita que datos sensibles (nombres, correos, montos, información
  financiera, cualquier PII) aparezcan expuestos dentro de una conversación con un modelo de IA,
  si ese modelo hace un SELECT sobre una tabla o columna que los contiene. Antes de dar por bueno
  este rol, revisá qué tablas y columnas quedan visibles en los esquemas que elegiste, y si hay
  columnas sensibles considerá una de estas dos opciones en vez del GRANT genérico de la tabla
  completa:
  - Dar acceso solo a columnas puntuales: `GRANT SELECT (columna1, columna2) ON tabla TO <rol>;`
  - Crear una vista que oculte las columnas sensibles y dar el GRANT sobre esa vista en vez de
    sobre la tabla original.

- **Esto es para uso en desarrollo.** Es responsabilidad tuya no correr este SQL, ni conectar
  este rol, contra una base de datos de producción.

Por último, recordame que este comando solo generó texto — en ningún momento se conectó a una
base de datos ni ejecutó nada por vos.
