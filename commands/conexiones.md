---
description: Muestra las conexiones activas en pg_stat_activity de una conexión Postgres de solo lectura (pg-ro-<alias>) del proyecto actual
---

Alias pedido: `$ARGUMENTS`

Este comando es puramente de **diagnóstico de lectura**: solo muestra qué conexiones hay abiertas
en la base de datos ahora mismo. No cierra, cancela ni modifica ninguna conexión — eso no es parte
de este comando.

## Paso 1: elegí el alias, nunca lo asumas

Este comando nunca debe correr ni conectarse a nada por su cuenta (no ejecuta ningún script Node
que abra una conexión de red): la consulta la corre Claude Code a través del servidor MCP
`pg-ro-<alias>` ya sembrado, igual que con cualquier otra herramienta MCP.

Si en `$ARGUMENTS` vino un alias, usalo. Si no vino nada:

1. Mirá qué conexiones `pg-ro-*` hay sembradas en el `.mcp.json` de este proyecto (podés leer el
   archivo directamente, o correr `node "${CLAUDE_PLUGIN_ROOT}/scripts/listar.js"`).
2. Si no hay ninguna sembrada, decímelo y sugerime `/sembrar` — no sigas.
3. Si hay una sola, **igual preguntame si es esa la que quiero usar** antes de correr nada. Nunca
   asumas un alias solo porque exista uno solo sembrado.
4. Si hay varias, mostrame la lista de alias disponibles y preguntame cuál de todos quiero usar.
   No sigas hasta que te confirme uno.

## Paso 2: corré la consulta, estrictamente de solo lectura

Con el alias `pg-ro-<alias>` ya elegido y confirmado, usá esa conexión MCP para correr **exactamente
esta consulta** (o una equivalente que respete las mismas restricciones) contra `pg_stat_activity`.
Es un `SELECT` puro: no ejecutes ningún verbo de escritura (`INSERT`, `UPDATE`, `DELETE`, `DROP`,
`ALTER`, etc.) ni ninguna función con efecto secundario sobre la conexión de otro proceso — en
particular, **nunca llames a `pg_terminate_backend` ni a `pg_cancel_backend`**. Este comando no
propone ni explica cómo cerrar conexiones; eso es tema de otro comando, todavía no implementado.

```sql
SELECT
    pid,
    usename,
    application_name,
    client_addr,
    state,
    query_start,
    LEFT(query, 100) AS query_preview
FROM pg_stat_activity
WHERE pid <> pg_backend_pid()
ORDER BY query_start ASC NULLS LAST;
```

Notas sobre esta consulta:

- `LEFT(query, 100)` trunca la consulta en curso a los primeros 100 caracteres. Esto sigue el mismo
  criterio de "saturación de contexto" (`SECURITY.md`, sección 4.2): una consulta larga podría traer
  literales embebidos (nombres, correos, tokens, condiciones con datos sensibles) y no tiene sentido
  volcar ese texto completo en el chat para un diagnóstico de conexiones. Nunca reemplaces
  `LEFT(query, 100)` por `query` sin truncar.
- `pid <> pg_backend_pid()` excluye la propia conexión de diagnóstico que abre este comando, para no
  mostrarte tu propia sesión como si fuera otra conexión activa.
- Si el usuario no pidió explícitamente ver conexiones inactivas, podés agregar
  `AND state <> 'idle'` al `WHERE` para no llenar la tabla de sesiones sin actividad — usá tu
  criterio, y si lo hacés, aclaralo en la respuesta ("se excluyeron las conexiones idle; pedime
  verlas todas si las necesitás").

## Paso 3: mostrá el resultado en una tabla legible

Presentá las filas devueltas como una tabla markdown en el chat, con columnas: `pid`, `usename`,
`application_name`, `client_addr`, `state`, `query_start`, `query_preview`. Si `query_preview` quedó
truncado (la consulta original tenía más de 100 caracteres), no intentes completarlo ni lo
seguido pidas de nuevo sin truncar — el truncado es intencional.

Si no hay filas (además de la propia conexión, ya excluida), decilo en lenguaje llano: no hay otras
conexiones activas en este momento contra esa base.

No sugieras, ni en la tabla ni en el texto que la acompaña, ninguna acción para cerrar, cancelar o
terminar alguna de las conexiones listadas.
