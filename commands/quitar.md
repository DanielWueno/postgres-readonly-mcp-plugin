---
description: Quita una conexión Postgres de solo lectura (pg-ro-<alias>) del proyecto actual
---

Alias pedido: `$ARGUMENTS`

Si no viene un alias en `$ARGUMENTS`, pregúntamelo antes de seguir: el nombre corto que se le dio
a la conexión cuando se sembró (por ejemplo `prod`, `staging`). Si no lo recordás, podés correr
`/listar` primero para ver qué alias hay sembrados en este proyecto.

Con el alias en mano, ejecuta:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/quitar.js" <alias>
```

Este comando solo modifica el archivo `.mcp.json` del proyecto actual (la carpeta desde donde se
corre Claude Code ahora mismo) — nunca toca otro proyecto. Quita únicamente la entrada de ese
alias; cualquier otra conexión de este plugin, cualquier otro servidor MCP configurado ahí, y
cualquier otra parte del archivo quedan exactamente igual que estaban.

El script puede terminar de dos formas distintas:

1. **Si el alias no está sembrado en este proyecto** (no existe `.mcp.json`, o existe pero no
   tiene esa entrada): un mensaje explicando que no hay nada que quitar con ese nombre. Esto no
   modifica ningún archivo — no es un error grave, simplemente ese alias no existe acá (podés
   correr `/listar` para ver los que sí hay).

2. **Si el alias sí estaba sembrado**: se elimina esa entrada de `.mcp.json` y el script confirma
   qué alias quitó y de qué archivo. Esto no borra la variable de entorno que hayas configurado en
   tu máquina (con `$env:` o `setx`) — si querés limpiarla también, eso lo hacés vos aparte, este
   comando no la toca.

Después de correr el script, resumime el resultado en lenguaje llano usando lo que imprimió, sin
inventar alias que no hayan aparecido literalmente en la salida.
