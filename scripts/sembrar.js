#!/usr/bin/env node
// sembrar: agrega (o actualiza) una entrada "pg-ro-<alias>" en el
// mcpServers de .mcp.json del proyecto donde se corre (process.cwd(),
// no este repo del plugin). Nunca toca, lee ni imprime una cadena de
// conexion real -- solo escribe la referencia literal "${VAR}", y quien
// resuelva esa variable es el entorno de quien use el MCP server despues.

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ALIAS_RE = /^[a-zA-Z0-9_-]+$/;

function sanitize(token) {
  return token.toUpperCase().replace(/[^A-Z0-9]+/g, "_");
}

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

function main() {
  const alias = process.argv[2];

  if (!alias) {
    fail("Uso: node scripts/sembrar.js <alias>\nFalta el alias.");
  }

  // Rechazo temprano de cualquier cosa que huela a connection string o
  // credencial real -- este script jamas debe aceptar ni propagar un
  // valor sensible, solo el nombre de una variable de entorno.
  if (alias.includes("://") || /password|:.*@/i.test(alias)) {
    fail(
      `El alias "${alias}" parece una cadena de conexion o credencial, no un nombre simple. ` +
        "Este script solo acepta un alias corto (letras, numeros, '-' y '_')."
    );
  }
  if (!ALIAS_RE.test(alias)) {
    fail(
      `Alias invalido: "${alias}". Solo se permiten letras, numeros, '-' y '_'.`
    );
  }

  const cwd = process.cwd();
  const proyecto = sanitize(path.basename(cwd));
  const aliasToken = sanitize(alias);
  const envVar = `PGRO_${proyecto}_${aliasToken}`;
  const serverName = `pg-ro-${alias}`;

  const mcpJsonPath = path.join(cwd, ".mcp.json");

  let config = {};
  if (fs.existsSync(mcpJsonPath)) {
    // Se quita un posible BOM inicial (frecuente en archivos escritos por
    // herramientas de Windows) para que JSON.parse no falle sobre un
    // archivo que en realidad es valido.
    const raw = fs.readFileSync(mcpJsonPath, "utf8").replace(/^﻿/, "");
    try {
      config = raw.trim() ? JSON.parse(raw) : {};
    } catch (err) {
      fail(`No se pudo leer ${mcpJsonPath} como JSON valido: ${err.message}`);
    }
  }

  if (!config.mcpServers || typeof config.mcpServers !== "object") {
    config.mcpServers = {};
  }

  // Deteccion de colision de variable de entorno: dos alias distintos
  // pueden sanitizar al mismo token (ej. "prod" y "prod!" -> "PROD"),
  // y hoy nada impide que compartan sin querer el mismo secreto. Se
  // busca otra entrada pg-ro-* (distinta a la que estamos por escribir,
  // para no bloquear un re-sembrado legitimo del mismo alias) cuyo
  // DATABASE_URI ya apunte a la misma variable.
  const expectedRef = `\${${envVar}}`;
  for (const [existingName, existingServer] of Object.entries(
    config.mcpServers
  )) {
    if (existingName === serverName) continue;
    if (!existingName.startsWith("pg-ro-")) continue;
    const existingRef = existingServer && existingServer.env && existingServer.env.DATABASE_URI;
    if (existingRef === expectedRef) {
      fail(
        `Colision de variable de entorno: "${existingName}" ya usa ${envVar}. ` +
          `Sembrar "${serverName}" con el mismo alias sanitizado haria que ambas conexiones ` +
          "compartan el mismo secreto sin que lo sepas. No se escribio nada en " +
          `${mcpJsonPath}. Si de verdad queres compartir la variable, resembra con un alias ` +
          "que no colisione, o renombra la variable manualmente."
      );
    }
  }

  config.mcpServers[serverName] = {
    command: "uvx",
    args: [
      "--system-certs",
      "--from",
      "postgres-mcp==0.3.0",
      "--with",
      "mcp<2",
      "postgres-mcp",
      "--access-mode=restricted",
    ],
    env: {
      DATABASE_URI: `\${${envVar}}`,
    },
  };

  // Escritura atomica: se escribe a un temporal en el mismo directorio y
  // se hace rename sobre .mcp.json, para que interrumpir el proceso a la
  // mitad no deje el archivo corrupto o a medio escribir.
  const tmpPath = path.join(
    cwd,
    `.mcp.json.tmp-${crypto.randomBytes(6).toString("hex")}`
  );
  fs.writeFileSync(tmpPath, JSON.stringify(config, null, 2) + "\n", "utf8");
  fs.renameSync(tmpPath, mcpJsonPath);

  console.log(`Sembrado "${serverName}" en ${mcpJsonPath}`);
  console.log(`Variable de entorno esperada: ${envVar}`);
}

main();
