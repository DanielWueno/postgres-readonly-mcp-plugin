#!/usr/bin/env node
// doctor: diagnostica por que una conexion "pg-ro-<alias>" sembrada en
// .mcp.json del proyecto actual (process.cwd(), nunca otro directorio ni
// el ~/.claude.json global) podria no funcionar. Revisa tres cosas, en
// orden de prioridad:
//   1. Si el binario `uv`/`uvx` esta disponible (bloqueante: sin esto
//      ningun servidor MCP de este plugin puede arrancar).
//   2. Que conexiones pg-ro-* hay sembradas.
//   3. Para cada una, si la variable de entorno que espera esta seteada
//      en el entorno de ESTA sesion (process.env).
// Nunca intenta conectarse a una base de datos real ni invoca uvx ni
// postgres-mcp -- solo verifica presencia del binario `uv` y nombres de
// variables de entorno. Nunca lee ni imprime un valor real de conexion.

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const PREFIX = "pg-ro-";

function verificarUv() {
  // Se usa `uv --version` en vez de `which`/`where` porque esos comandos
  // difieren por plataforma (Unix vs Windows) y ademas solo confirman que
  // existe un archivo en el PATH, no que sea ejecutable de verdad.
  // spawnSync sin shell ya resuelve el PATH del sistema operativo (busca
  // "uv" o "uv.exe" segun corresponda) sin necesitar una shell intermedia.
  try {
    const resultado = spawnSync("uv", ["--version"], {
      stdio: "ignore",
      timeout: 5000,
    });
    // spawnSync no lanza -- guarda el error en resultado.error si el
    // comando no se pudo ejecutar (por ejemplo, no existe en el PATH).
    if (resultado.error) return false;
    if (resultado.status === 0) return true;
    return false;
  } catch (err) {
    return false;
  }
}

function leerConexiones(mcpJsonPath) {
  if (!fs.existsSync(mcpJsonPath)) {
    return { existeArchivo: false, conexiones: [] };
  }

  // Se quita un posible BOM inicial (frecuente en archivos escritos por
  // herramientas de Windows) para que JSON.parse no falle sobre un
  // archivo que en realidad es valido.
  const raw = fs.readFileSync(mcpJsonPath, "utf8").replace(/^﻿/, "");
  let config;
  try {
    config = raw.trim() ? JSON.parse(raw) : {};
  } catch (err) {
    console.error(`No se pudo leer ${mcpJsonPath} como JSON valido: ${err.message}`);
    process.exit(1);
  }

  if (!config.mcpServers || typeof config.mcpServers !== "object") {
    return { existeArchivo: true, conexiones: [] };
  }

  const nombres = Object.keys(config.mcpServers).filter((n) =>
    n.startsWith(PREFIX)
  );

  const conexiones = nombres.map((nombre) => {
    const alias = nombre.slice(PREFIX.length);
    const server = config.mcpServers[nombre];
    const uri = server && server.env && server.env.DATABASE_URI;

    // Se extrae solo el nombre de la variable de la referencia "${VAR}" --
    // jamas se imprime el valor real, que ni siquiera vive en este archivo.
    let envVar = null;
    if (typeof uri === "string") {
      const match = uri.match(/^\$\{([^}]+)\}$/);
      if (match) {
        envVar = match[1];
      }
    }

    return { alias, envVar };
  });

  return { existeArchivo: true, conexiones };
}

function main() {
  const cwd = process.cwd();
  const mcpJsonPath = path.join(cwd, ".mcp.json");

  console.log("Diagnostico de conexiones Postgres de solo lectura");
  console.log("---------------------------------------------------");

  // 1) uv/uvx es la base para que cualquier servidor de este plugin
  // arranque -- si falta, es la primera causa de fallo, antes de mirar
  // ninguna conexion sembrada.
  const uvDisponible = verificarUv();
  if (!uvDisponible) {
    console.log(
      "[BLOQUEANTE] No se encontro el comando `uv` (ni `uvx`) en el PATH del sistema."
    );
    console.log(
      "  Sin uv instalado, ningun servidor MCP de este plugin puede arrancar, sin importar" +
        " si las conexiones estan bien configuradas."
    );
    console.log(
      "  Para instalarlo: segui las instrucciones oficiales en" +
        " https://docs.astral.sh/uv/getting-started/installation/ (tambien disponible via" +
        " el gestor de paquetes de tu sistema, por ejemplo winget, brew o pipx)."
    );
    console.log(
      "  Una vez instalado uv, volve a correr este diagnostico para revisar las conexiones."
    );
    return;
  }
  console.log("[OK] El comando `uv` esta disponible en el PATH.");
  console.log("");

  // 2) que conexiones pg-ro-* hay sembradas en este proyecto.
  const { existeArchivo, conexiones } = leerConexiones(mcpJsonPath);

  if (!existeArchivo) {
    console.log(
      `No hay conexiones sembradas en este proyecto: no existe ${mcpJsonPath}.`
    );
    console.log("Podes usar /sembrar para crear una.");
    return;
  }

  if (conexiones.length === 0) {
    console.log(
      `No hay conexiones sembradas en este proyecto (${mcpJsonPath} no tiene entradas ${PREFIX}*).`
    );
    console.log("Podes usar /sembrar para crear una.");
    return;
  }

  console.log(`Conexiones encontradas en ${mcpJsonPath}:`);
  console.log("");

  // 3) para cada conexion, si su variable de entorno esta seteada en
  // ESTA sesion. Una variable sin setear es el sospechoso numero uno de
  // un fallo, porque Node nunca expande "${VAR}" -- esa resolucion la
  // hace Claude Code al lanzar el servidor MCP, no este script.
  let hayProblemas = false;
  for (const { alias, envVar } of conexiones) {
    if (!envVar) {
      hayProblemas = true;
      console.log(
        `- ${alias}: no se pudo determinar el nombre de la variable de entorno esperada.` +
          " Revisa manualmente la entrada en .mcp.json, puede estar mal formada."
      );
      continue;
    }

    const estaSeteada = Object.prototype.hasOwnProperty.call(
      process.env,
      envVar
    ) && process.env[envVar] !== "";

    if (estaSeteada) {
      console.log(`- ${alias}: OK. La variable ${envVar} esta seteada en esta sesion.`);
    } else {
      hayProblemas = true;
      console.log(
        `- ${alias}: PROBABLE CAUSA DE FALLO. Espera la variable de entorno ${envVar},` +
          " pero no esta seteada en esta sesion. Si esta conexion no funciona, es lo" +
          " primero a revisar: sin esa variable seteada, la conexion queda apuntando" +
          " literalmente al texto \"${" + envVar + "}\" en vez de a una base de datos real."
      );
    }
  }

  console.log("");
  if (hayProblemas) {
    console.log(
      "Resumen: al menos una conexion tiene su variable de entorno sin setear en esta" +
        " sesion (ver detalle arriba). Setealas y abri una terminal nueva (o reinicia" +
        " la sesion) antes de asumir que hay un problema mas profundo."
    );
  } else {
    console.log(
      "Resumen: uv esta disponible y todas las variables de entorno esperadas estan" +
        " seteadas en esta sesion. Este diagnostico no puede confirmar que la base de" +
        " datos en si responda -- solo que la configuracion local esta completa."
    );
  }
}

main();
