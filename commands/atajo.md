---
description: Instala `pgro`, un lanzador en tu PATH para scripts/sembrar.js, listar.js, quitar.js y doctor.js -- gestiona conexiones Postgres de solo lectura desde cualquier terminal, sin buscar la ruta del plugin instalado
---

Ejecuta, sin preguntarme nada primero:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/instalar-atajo.sh"
```

Existe para que usar este plugin desde una terminal normal no exija encontrar a mano la ruta
donde quedó instalado -- ese path lleva el número de versión adentro y cambia en cada
`claude plugin update`. El script instala un lanzador en `~/.local/bin` (donde ya vive el propio
`claude`) que resuelve la instalación en cada ejecución, así que sigue funcionando después de
cualquier actualización sin que nadie lo vuelva a tocar.

Una vez instalado, desde cualquier terminal (no hace falta Claude Code):

- `pgro sembrar <alias>` — agrega una conexión Postgres de solo lectura al proyecto actual.
- `pgro listar` — lista las conexiones `pg-ro-*` sembradas en el proyecto actual.
- `pgro quitar <alias>` — quita una conexión del proyecto actual.
- `pgro doctor` — diagnostica por qué una conexión sembrada podría no funcionar.
- `pgro crear-rol` — avisa que esa función solo existe dentro de Claude Code (vía
  `/postgres-readonly-mcp:crear-rol`), porque genera el SQL apoyándose en el propio modelo, no en
  un script determinista. No es un error, es una limitación de diseño esperada.
- `pgro ayuda` / `pgro --help` / `pgro -h` — muestra esta misma lista.

Cada subcomando de `pgro` llama exactamente al mismo `scripts/*.js` que su comando
`/postgres-readonly-mcp:*` correspondiente -- no hay lógica duplicada entre los dos caminos.

Es idempotente y nunca sobrescribe un `pgro` que no haya puesto este mismo plugin.

Después, muéstrame su salida tal cual y resume en una línea si el atajo quedó instalado y listo
para usar, o si hace falta abrir una terminal nueva (o agregar `~/.local/bin` al PATH a mano) para
que surta efecto.

No ejecutes ningún subcomando de `pgro` ni ningún script del proyecto -- este comando solo
instala el atajo.
