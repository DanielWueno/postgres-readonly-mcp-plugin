---
description: Propone (sin ejecutar) el SQL para cerrar una conexión puntual identificada por su pid en pg_stat_activity
---

pid pedido: `$ARGUMENTS`

Este comando **nunca ejecuta nada**: solo genera el SQL que el propio usuario debería correr, con
sus propias credenciales, si decide cerrar esa conexión. No abre ninguna conexión MCP, no llama a
ningún servidor `pg-ro-<alias>`, y no corre ningún script Node.

## Paso 1: pedí el pid, nunca lo asumas

Si en `$ARGUMENTS` vino un número de pid, usalo. Si no vino nada, o no es un número, pedile al
usuario el pid concreto que quiere cerrar — por ejemplo, el que vio en la tabla de
`/postgres-readonly-mcp:conexiones`. No sigas sin un pid explícito.

## Paso 2: imprimí el SQL propuesto, sin correrlo

Con el pid confirmado, imprimí en el chat exactamente este SQL (sustituyendo `<pid>` por el valor
real):

```sql
SELECT pg_terminate_backend(<pid>);
```

Junto con el SQL, explicá en lenguaje llano y de forma explícita:

- Este plugin **no lo ejecuta**. No hay ninguna acción de este comando que abra una conexión y
  corra esa sentencia — es únicamente texto para que el usuario decida.
- El rol de solo lectura que siembra este plugin (`crear-rol`) **no tiene permiso** para ejecutar
  `pg_terminate_backend`: la conexión `pg-ro-<alias>` sembrada acá fallaría si se intentara correr
  esta sentencia a través de ella.
- Para cerrar la conexión de verdad, el usuario tiene que correr ese SQL él mismo, con
  credenciales propias de administrador (o con el permiso explícito necesario), fuera de esta
  conexión de solo lectura — por ejemplo desde `psql` o su cliente gráfico habitual.
- Cerrar una conexión activa puede interrumpir una transacción en curso de otra sesión; conviene
  confirmar que el pid corresponde a la conexión correcta (por ejemplo, revisando primero
  `/postgres-readonly-mcp:conexiones`) antes de correr el SQL propuesto.

No propongas ninguna alternativa que sí se ejecute desde este comando (ni `pg_cancel_backend`, ni
ninguna otra función con efecto): la única acción de este comando es imprimir el SQL y la
advertencia de arriba.
