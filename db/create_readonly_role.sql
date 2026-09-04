-- Crea un rol de solo lectura para usar con el MCP de Postgres.
-- Reemplaza los valores entre <> y ejecuta como un usuario con privilegios
-- suficientes (owner de los esquemas o superuser) contra la base destino.
--
-- Incluye el fix de la trampa clasica de Postgres: en versiones anteriores a
-- la 15, el esquema "public" concede CREATE a PUBLIC por defecto, lo que le
-- daria a este rol permiso para crear tablas aunque solo se le otorgue SELECT
-- explicitamente. Por eso se revoca CREATE de forma explicita al final.

\set role_name '<nombre_rol>'
\set role_password '<password_fuerte>'
\set db_name '<nombre_base>'
\set schemas '<esquema1>,<esquema2>'

CREATE ROLE :role_name WITH LOGIN PASSWORD :'role_password'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION
  CONNECTION LIMIT 5;

ALTER ROLE :role_name SET statement_timeout = '60s';

GRANT CONNECT ON DATABASE :db_name TO :role_name;

-- Repite este bloque por cada esquema (psql \gexec o manualmente):
-- GRANT USAGE ON SCHEMA "<esquema>" TO :role_name;
-- GRANT SELECT ON ALL TABLES IN SCHEMA "<esquema>" TO :role_name;
-- GRANT SELECT ON ALL SEQUENCES IN SCHEMA "<esquema>" TO :role_name;
-- ALTER DEFAULT PRIVILEGES FOR ROLE <owner_de_las_tablas> IN SCHEMA "<esquema>"
--   GRANT SELECT ON TABLES TO :role_name;
-- REVOKE CREATE ON SCHEMA "<esquema>" FROM :role_name;
-- REVOKE CREATE ON SCHEMA "<esquema>" FROM PUBLIC;

-- Verificacion obligatoria despues de crear el rol (conexion establecida con el rol recien creado):
--   SELECT count(*) FROM information_schema.tables WHERE table_schema = '<esquema>';  -- debe funcionar
--   CREATE TABLE <esquema>.__ro_probe(id int);                                        -- debe fallar
--   INSERT INTO <esquema>.<alguna_tabla> DEFAULT VALUES;                              -- debe fallar
