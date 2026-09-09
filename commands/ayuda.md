---
description: Explica los comandos disponibles y el orden recomendado para usar el plugin
---

# Orden recomendado para usar este plugin

Este plugin agrega conexiones de solo lectura a PostgreSQL en tu proyecto. Aquí están los comandos en el orden que se recomienda usarlos:

## 1. `/crear-rol` (opcional)

Genera el SQL necesario para crear un rol de solo lectura en PostgreSQL.

**Cuándo usarlo**: solo la primera vez que vayas a conectar esta base de datos. Ejecutá el SQL resultante en tu base de datos usando un cliente PostgreSQL (pgAdmin, DBeaver, psql, o el que ya uses). Después, podés reutilizar ese rol para varias conexiones.

## 2. `/sembrar`

Agrega una conexión Postgres de solo lectura al proyecto actual.

**Qué hace**: registra el nombre de la conexión en el archivo `.mcp.json` de tu proyecto y te dice qué variable de entorno necesitas configurar.

## 3. Configurar la variable de entorno en tu terminal

Después de `/sembrar`, tenés que guardar la cadena de conexión de tu base de datos en tu máquina, en una variable de entorno. Es un valor que vive solo en tu computadora, nunca se guarda en este repo ni pasa por este chat.

**En PowerShell, opción rápida** (solo esta sesión):
```powershell
$env:NOMBRE_DE_VARIABLE = "postgresql://usuario:contraseña@host:puerto/basedatos"
```

**En PowerShell, opción permanente** (guardado en Windows):
```powershell
setx NOMBRE_DE_VARIABLE "postgresql://usuario:contraseña@host:puerto/basedatos"
```
(Después de ejecutar `setx`, abrí una terminal nueva para que surta efecto.)

**Advertencia sobre contraseñas con caracteres especiales**: si la contraseña
contiene alguno de estos caracteres — `@ : / # % espacio "` — puede romper el
parseo de la cadena de conexión. Por ejemplo, una `@` dentro de la contraseña
se confunde con el separador entre credenciales y host; una `:` adicional se
confunde con el separador entre usuario y contraseña; y un `#` puede
truncarse como si fuera un fragmento de URL. Además, `setx` puede corromper
valores con comillas u otros caracteres especiales si el argumento no queda
bien delimitado.

Para evitarlo: URL-encodeá solo la contraseña (no la cadena completa) antes
de armarla. En PowerShell:
```powershell
[uri]::EscapeDataString("p@ss:word")
```
Eso devuelve `p%40ss%3Aword`, que es lo que va en el lugar de la contraseña
dentro de la cadena de conexión. Envolvé siempre el valor completo de la URI
entre comillas dobles al usar `$env:` o `setx`.

El nombre exacto de la variable te lo dice el script de `/sembrar` — copiar tal cual.

## 4. `/listar`

Lista las conexiones Postgres de solo lectura que ya están sembradas en el proyecto actual.

**Cuándo usarlo**: para verificar qué alias hay configurados y qué variables de entorno necesitan estar seteadas.

## 5. `/quitar`

Quita una conexión Postgres del proyecto actual.

**Qué hace**: la elimina del archivo `.mcp.json`. No toca la variable de entorno que hayas configurado en tu máquina.

## 6. `/doctor`

Diagnostica por qué una conexión podría no estar funcionando.

**Cuándo usarlo**: si alguna conexión `pg-ro-*` no responde. Te muestra si `uv` está instalado, qué conexiones hay sembradas, y si las variables de entorno están seteadas en esta sesión.

---

**Nota**: los comandos solo leen y modifican tu proyecto actual. Si trabajás en varios proyectos, cada uno tiene su propia configuración independiente.
