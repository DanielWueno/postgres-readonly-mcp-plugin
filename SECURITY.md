# Política de seguridad

## Cómo reportar

En la pestaña **Security** del repositorio, con **Report a vulnerability**. El
aviso llega en privado y no queda publicado mientras se trabaja.

No abras una issue pública para esto: las issues de este repositorio son
visibles para cualquiera.

## Qué versiones reciben arreglos

Sólo la última publicada. No hay ramas de mantenimiento: un arreglo sale como
una versión nueva.

## Qué importa en este proyecto

Este plugin conecta Claude Code a una base de datos real con una credencial
que el usuario ingresa. El riesgo no está tanto en el código del plugin —que
es corto y no ejecuta nada dinámico— como en cómo esa credencial y el modo
restringido se usan en la práctica:

- **Que `-s local` deje el connection string en texto plano en un archivo
  versionado.** El patrón documentado para múltiples bases de datos
  (`claude mcp add ... -e DATABASE_URI=postgresql://usuario:password@...`)
  escribe la credencial completa en la configuración local de MCP del
  proyecto destino. Antes de usar ese patrón, confirma que el archivo donde
  Claude Code guarda los servidores de alcance local en ese proyecto está
  excluido de git — no es responsabilidad de este plugin, pero es la forma
  más directa en que una credencial de este flujo termina en un commit.
- **Que la versión fijada de `postgres-mcp` (`0.3.0`) deje de ser la que
  realmente se instala.** El pin existe para evitar depender de lo que haya
  publicado PyPI en el momento de ejecutar `setup.ps1`; si el entorno virtual
  local (`.venv`) contiene una versión distinta a la declarada, es una señal
  de que algo en la instalación no se comportó como se documenta.
- **Que el rol de solo lectura pueda escribir.** `db/create_readonly_role.sql`
  incluye consultas de verificación al final precisamente para esto — un
  reporte de que el rol creado con ese script permite `INSERT`/`UPDATE`/
  `CREATE` en la práctica es una vulnerabilidad real de este proyecto.

## Qué no es una vulnerabilidad

- **Que el contenido de las tablas consultadas llegue al modelo.** Es el
  comportamiento esperado de un acceso de lectura vía MCP y está documentado
  en el README como decisión de gobierno de datos de cada equipo, no como
  algo que este plugin deba impedir.
- **Que la credencial no tenga fecha de caducidad si el equipo que la creó no
  se la puso.** El README recomienda `VALID UNTIL`; que no se use es una
  decisión operativa de quien administra la base, no un defecto del plugin.
