---
description: Agrega una conexión Postgres de solo lectura (pg-ro-<alias>) al proyecto actual
---

Alias pedido: `$ARGUMENTS`

Si no viene un alias en `$ARGUMENTS`, pregúntamelo antes de seguir: un nombre corto para esta
conexión (por ejemplo `prod`, `staging`), solo letras, números, `-` y `_`. Nunca me pidas ni
aceptes que pegue aquí una cadena de conexión, usuario o contraseña — este comando jamás toca un
secreto real, solo el nombre de una variable de entorno.

Con el alias en mano, ejecuta:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/sembrar.js" <alias>
```

El script imprime dos líneas: el nombre del servidor que quedó registrado en `.mcp.json` de este
proyecto, y el nombre exacto de la variable de entorno que espera (algo como
`PGRO_MIPROYECTO_PROD`). Tomá ese nombre de variable tal cual lo imprime el script — no lo
inventes ni lo abrevies.

Después, explicame el resultado en dos partes, sin asumir que quien lee ya sabe qué es una
variable de entorno:

1. **Qué acaba de pasar**: se agregó (o actualizó) la conexión en el archivo `.mcp.json` de este
   proyecto, pero todavía le falta un dato — la cadena de conexión real a la base de datos — y ese
   dato nunca se guarda en ningún archivo del repo ni pasa por este chat. Vos sos quien la va a
   guardar, en tu propia máquina, como una variable de entorno.

2. **Qué falta hacer, con las dos líneas listas para copiar** (usando el nombre de variable que
   imprimió el script, reemplazando `<VAR>` por ese nombre y `<tu-cadena-de-conexion>` por la URI
   real de tu base):

   - Para que quede disponible cada vez que abrís PowerShell (agregar a tu perfil):
     ```powershell
     $env:<VAR> = "<tu-cadena-de-conexion>"
     ```
   - Para que quede guardada de forma permanente en Windows, sin tener que repetir el paso
     anterior en cada sesión:
     ```powershell
     setx <VAR> "<tu-cadena-de-conexion>"
     ```

   Aclarame que `setx` requiere abrir una terminal nueva para que el valor surta efecto, y que la
   cadena de conexión la tiene que completar la persona que lea esto — nunca yo.
