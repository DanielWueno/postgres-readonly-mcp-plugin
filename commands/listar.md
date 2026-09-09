---
description: Lista las conexiones Postgres de solo lectura (pg-ro-<alias>) sembradas en el proyecto actual
---

Ejecuta:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/listar.js"
```

Este comando solo mira el archivo `.mcp.json` del proyecto actual (la carpeta desde donde se corre
Claude Code ahora mismo) — nunca lee conexiones de otro proyecto ni de ninguna configuración
global. Si trabajás en varios proyectos, cada uno tiene su propia lista independiente.

El script puede imprimir dos cosas distintas:

1. **Si no hay conexiones sembradas** (no existe `.mcp.json`, o existe pero no tiene ninguna
   entrada de este plugin): un mensaje diciendo que no hay conexiones en este proyecto. Esto no es
   un error — simplemente todavía no se sembró ninguna acá (podés usar `/sembrar` para crear una).

2. **Si hay conexiones sembradas**: una línea por cada alias, con el nombre corto que se le dio a
   la conexión y el nombre de la variable de entorno que esa conexión necesita para funcionar (algo
   como `PGRO_MIPROYECTO_PROD`). Una "variable de entorno" es simplemente un valor que vive en tu
   propia máquina, fuera de este repo — el nombre que ves es solo una etiqueta; el dato real (la
   cadena de conexión a la base de datos) nunca se guarda en ningún archivo del proyecto ni pasa
   por este chat, así que este listado jamás muestra contraseñas ni cadenas de conexión reales.

Después de correr el script, resumime el resultado en lenguaje llano usando lo que imprimió, sin
inventar alias ni nombres de variable que no hayan aparecido literalmente en la salida.
