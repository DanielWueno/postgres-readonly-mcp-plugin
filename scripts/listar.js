#!/usr/bin/env node
// listar: muestra las conexiones "pg-ro-<alias>" ya sembradas en el
// mcpServers de .mcp.json del proyecto donde se corre (process.cwd(),
// nunca otro directorio ni el ~/.claude.json global). Nunca lee ni
// imprime un valor real de variable de entorno ni una cadena de
// conexion -- solo el nombre de la variable tal como aparece literal
// en el JSON, que es una referencia "${VAR}", no un secreto.

const fs = require("fs");
const path = require("path");

const PREFIX = "pg-ro-";

function main() {
  const cwd = process.cwd();
  const mcpJsonPath = path.join(cwd, ".mcp.json");

  if (!fs.existsSync(mcpJsonPath)) {
    console.log(
      `No hay conexiones sembradas en este proyecto: no existe ${mcpJsonPath}.`
    );
    return;
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
    console.log(`No hay conexiones sembradas en este proyecto (${mcpJsonPath} no tiene mcpServers).`);
    return;
  }

  // Solo nos interesan las entradas que este plugin creo -- cualquier
  // otro servidor MCP configurado en el mismo archivo es ajeno y se ignora.
  const nombres = Object.keys(config.mcpServers).filter((n) =>
    n.startsWith(PREFIX)
  );

  if (nombres.length === 0) {
    console.log(`No hay conexiones sembradas en este proyecto (${mcpJsonPath} no tiene entradas ${PREFIX}*).`);
    return;
  }

  console.log(`Conexiones sembradas en ${mcpJsonPath}:`);
  for (const nombre of nombres) {
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

    if (envVar) {
      console.log(`- ${alias}: espera la variable de entorno ${envVar}`);
    } else {
      console.log(`- ${alias}: no se pudo determinar el nombre de la variable de entorno esperada`);
    }
  }
}

main();
