---
description: Diagnostica por qué una conexión Postgres de solo lectura (pg-ro-<alias>) del proyecto actual podría no estar funcionando
---

Ejecuta:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/doctor.js"
```

Este comando solo revisa el proyecto actual (la carpeta desde donde se corre Claude Code ahora
mismo) — nunca otro proyecto ni ninguna configuración global. No se conecta a ninguna base de
datos real: solo verifica que las piezas necesarias estén en su lugar. Revisa, en este orden:

1. **Si el comando `uv` (y `uvx`) está disponible en el PATH del sistema.** Esto es lo primero
   que mira porque, sin `uv` instalado, ningún servidor MCP de este plugin puede arrancar, sin
   importar qué tan bien esté configurada cada conexión. Si falta, el script lo marca como
   **bloqueante** y da el paso concreto para instalarlo (la página oficial de uv o el gestor de
   paquetes del sistema) — si ves ese aviso, seguí esa instrucción antes de mirar cualquier otra
   cosa.

2. **Qué conexiones `pg-ro-*` hay sembradas** en el `.mcp.json` de este proyecto. Si no hay
   ninguna (o no existe el archivo), lo dice claramente — no es un error, solo que todavía no se
   sembró nada acá (se puede usar `/sembrar` para crear una).

3. **Para cada conexión sembrada, si la variable de entorno que espera está seteada en esta
   sesión.** Una variable sin setear es la primera sospechosa de un fallo: sin ella, la conexión
   queda apuntando literalmente al texto `${NOMBRE_DE_VARIABLE}` en vez de a una base de datos
   real, porque esa sustitución la hace Claude Code al arrancar el servidor, no este script. El
   script marca cada conexión así encontrada como "probable causa de fallo" en una frase en
   lenguaje llano.

Al final imprime un resumen: si todo está en orden (uv presente y todas las variables seteadas
en esta sesión) aclara que igual no puede garantizar que la base de datos en sí responda, solo que
la configuración local está completa.

Después de correr el script, resumime el resultado en lenguaje llano usando exactamente lo que
imprimió, sin inventar alias, nombres de variable ni diagnósticos que no hayan aparecido
literalmente en la salida.
