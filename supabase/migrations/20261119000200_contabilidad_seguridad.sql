-- =====================================================================
-- Módulo de contabilidad · Seguridad (RLS y permisos)
--
-- Roles del módulo (tabla contabilidad.usuarios):
--   lector  → solo consulta
--   editor  → revisa, corrige, aprueba y rechaza facturas
--   admin   → además administra plan de cuentas, categorías, configuración,
--             saldos iniciales y usuarios
-- Los procesos internos (IA, sincronización) usan la service role, que no
-- pasa por RLS.
-- =====================================================================

create or replace function contabilidad.rol_actual()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select u.rol
  from contabilidad.usuarios u
  where u.email = lower(coalesce(auth.jwt() ->> 'email', ''))
    and u.activo
$$;

create or replace function contabilidad.puede_leer()
returns boolean
language sql
stable
set search_path = ''
as $$
  select contabilidad.rol_actual() is not null
$$;

create or replace function contabilidad.puede_editar()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(contabilidad.rol_actual() in ('admin', 'editor'), false)
$$;

create or replace function contabilidad.es_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(contabilidad.rol_actual() = 'admin', false)
$$;

do $$
declare
  t text;
begin
  -- Lectura para cualquier usuario autorizado
  foreach t in array array[
    'usuarios', 'configuracion', 'cuentas', 'categorias', 'terceros', 'archivos_drive',
    'facturas', 'factura_items', 'asientos', 'asiento_lineas', 'revisiones',
    'procesamientos', 'saldos_iniciales'
  ] loop
    execute format('alter table contabilidad.%I enable row level security', t);
    execute format(
      'create policy %I on contabilidad.%I for select to authenticated using (contabilidad.puede_leer())',
      'lectura_' || t, t
    );
  end loop;

  -- Escritura operativa: editores y administradores
  foreach t in array array[
    'terceros', 'archivos_drive', 'facturas', 'factura_items', 'asientos', 'asiento_lineas', 'revisiones'
  ] loop
    execute format(
      'create policy %I on contabilidad.%I for all to authenticated '
      'using (contabilidad.puede_editar()) with check (contabilidad.puede_editar())',
      'edicion_' || t, t
    );
  end loop;

  -- Escritura de configuración: solo administradores
  foreach t in array array[
    'usuarios', 'configuracion', 'cuentas', 'categorias', 'saldos_iniciales'
  ] loop
    execute format(
      'create policy %I on contabilidad.%I for all to authenticated '
      'using (contabilidad.es_admin()) with check (contabilidad.es_admin())',
      'admin_' || t, t
    );
  end loop;
end
$$;

-- Permisos. `anon` no tiene acceso al módulo.
revoke all on schema contabilidad from public;
revoke execute on all functions in schema contabilidad from public;

grant usage on schema contabilidad to authenticated, service_role;
grant select, insert, update, delete on all tables in schema contabilidad to authenticated;
grant all on all tables in schema contabilidad to service_role;
grant usage, select on all sequences in schema contabilidad to authenticated, service_role;
grant execute on all functions in schema contabilidad to authenticated, service_role;

alter default privileges in schema contabilidad
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema contabilidad
  grant all on tables to service_role;
alter default privileges in schema contabilidad
  grant usage, select on sequences to authenticated, service_role;
alter default privileges in schema contabilidad
  revoke execute on functions from public;
alter default privileges in schema contabilidad
  grant execute on functions to authenticated, service_role;
