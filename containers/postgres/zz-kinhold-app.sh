#!/bin/sh
# Creates the application's role and database on first start of the volume. In supabase/postgres the
# superuser is supabase_admin and "postgres" is a restricted role, and POSTGRES_USER can't be changed,
# so the services connect as their own non-superuser role (DB_USER). CREATEDB and CONNECT on "postgres"
# let pytest-django create and drop its throwaway test databases.
set -e
psql -v ON_ERROR_STOP=1 -U supabase_admin -d postgres \
  -v app_user="$APP_DB_USER" -v app_password="$APP_DB_PASSWORD" -v app_db="$APP_DB_NAME" <<'SQL'
SELECT format('CREATE ROLE %I LOGIN CREATEDB PASSWORD %L', :'app_user', :'app_password')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = :'app_user') \gexec
SELECT format('CREATE DATABASE %I OWNER %I', :'app_db', :'app_user')
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = :'app_db') \gexec
SELECT format('GRANT CONNECT ON DATABASE postgres TO %I', :'app_user') \gexec
SQL
