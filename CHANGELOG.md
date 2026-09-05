# Changelog

Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).
Versionado: [SemVer](https://semver.org/lang/es/).

## [1.0.0] — 2026-09-04

### Añadido

- Servidor MCP `postgres-readonly` en modo `--access-mode=restricted`
  ([postgres-mcp](https://github.com/crystaldba/postgres-mcp)), reforzado
  con un rol de base de datos de solo `SELECT` (`db/create_readonly_role.sql`)
  como segunda capa independiente.
- `scripts/setup.ps1` para crear una única vez por máquina un entorno
  virtual local con versiones fijadas (`postgres-mcp==0.3.0`, `mcp<2`).
- Soporte para proyectos con varias bases de datos mediante múltiples
  registros `claude mcp add` de alcance local, reutilizando el mismo
  entorno virtual.
- Sección de consideraciones de seguridad en el README: gobierno de datos
  sobre el contenido que llega al modelo, caducidad recomendada del rol,
  y la corrección del `CREATE` por defecto de `PUBLIC` en PostgreSQL
  anterior a la versión 15.
