#!/usr/bin/env node
// quitar: elimina una entrada "pg-ro-<alias>" del mcpServers de .mcp.json
// del proyecto donde se corre (process.cwd(), no este repo del plugin).
// Deja intactas todas las demas entradas mcpServers (de este plugin u
// otras ajenas) y cualquier otra clave top-level del JSON. Nunca lee ni
// imprime un valor real de env.DATABASE_URI ni ninguna cadena de conexion
// -- solo trabaja con el nombre del alias/servidor.

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PREFIX = "pg-ro-";

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

function main() {
  const alias = process.argv[2];

  if (!alias) {
    fail("Uso: node scripts/quitar.js <alias>\nFalta el alias.");
  }

  const serverName = `${PREFIX}${alias}`;
  const cwd = process.cwd();
  const mcpJsonPath = path.join(cwd, ".mcp.json");

  if (!fs.existsSync(mcpJsonPath)) {
    console.log(
      `No hay nada que quitar: no existe ${mcpJsonPath} en este proyecto.`
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
    fail(`No se pudo leer ${mcpJsonPath} como JSON valido: ${err.message}`);
  }

  if (
    !config.mcpServers ||
    typeof config.mcpServers !== "object" ||
    !Object.prototype.hasOwnProperty.call(config.mcpServers, serverName)
  ) {
    fail(
      `El alias "${alias}" no esta sembrado en este proyecto (no hay entrada "${serverName}" en ${mcpJsonPath}).`
    );
  }

  // Se elimina solo la entrada pedida -- el resto de mcpServers (otras
  // conexiones pg-ro-* o servidores MCP ajenos) y cualquier otra clave
  // top-level del JSON quedan exactamente igual.
  delete config.mcpServers[serverName];

  // Escritura atomica: se escribe a un temporal en el mismo directorio y
  // se hace rename sobre .mcp.json, para que interrumpir el proceso a la
  // mitad no deje el archivo corrupto o a medio escribir.
  const tmpPath = path.join(
    cwd,
    `.mcp.json.tmp-${crypto.randomBytes(6).toString("hex")}`
  );
  fs.writeFileSync(tmpPath, JSON.stringify(config, null, 2) + "\n", "utf8");
  fs.renameSync(tmpPath, mcpJsonPath);

  console.log(`Quitado "${serverName}" de ${mcpJsonPath}`);
}

main();
