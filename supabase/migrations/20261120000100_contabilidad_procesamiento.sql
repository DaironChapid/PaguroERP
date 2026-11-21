-- =====================================================================
-- Módulo de contabilidad · Procesamiento (fase 3)
-- TRM, filtro de carpetas del Drive, cola de archivos y reintentos.
-- =====================================================================

-- Tasas de cambio a COP (caché de la TRM oficial)
create table contabilidad.tasas_cambio (
  fecha      date not null,
  moneda     text not null check (moneda ~ '^[A-Z]{3}$'),
  valor      numeric(14, 4) not null check (valor > 0),
  fuente     text not null default 'datos.gov.co',
  creado_en  timestamptz not null default now(),
  primary key (fecha, moneda)
);

alter table contabilidad.tasas_cambio enable row level security;
create policy lectura_tasas_cambio on contabilidad.tasas_cambio
  for select to authenticated using (contabilidad.puede_leer());
create policy edicion_tasas_cambio on contabilidad.tasas_cambio
  for all to authenticated using (contabilidad.puede_editar()) with check (contabilidad.puede_editar());

-- Qué partes del Drive se procesan. Por defecto solo las carpetas de primer
-- nivel cuyo nombre contiene un año (01_2025, 02_2026…), para que documentos
-- legales u otros archivos sueltos nunca se envíen a la IA.
insert into contabilidad.configuracion (clave, valor, descripcion) values
  ('drive_filtro', '{
     "solo_carpetas_con_anio": true,
     "incluir_raiz": false,
     "excluir": ["90_DOCUMENTOS_LEGALES", "91_CONTADOR", "SOPs"]
   }'::jsonb,
   'Carpetas del Drive que se procesan: solo las de año, sin archivos sueltos de la raíz y sin las excluidas'),
  ('nombre_empresa', '"Paguro Corp"'::jsonb, 'Nombre de la empresa que se le indica a la IA');

-- Toma un lote de archivos para procesar y los marca como 'procesando'.
-- SKIP LOCKED evita que dos procesos tomen el mismo archivo.
-- También recupera archivos que quedaron colgados en 'procesando' y errores
-- con reintento automático programado.
create or replace function contabilidad.tomar_archivos_pendientes(p_limite integer)
returns setof contabilidad.archivos_drive
language sql
set search_path = ''
as $$
  update contabilidad.archivos_drive a
  set estado = 'procesando', intentos = a.intentos + 1
  where a.id in (
    select x.id
    from contabilidad.archivos_drive x
    where x.estado = 'pendiente'
       or (x.estado = 'procesando' and x.actualizado_en < now() - interval '15 minutes')
       or (x.estado = 'error' and x.reintentar_desde is not null and x.reintentar_desde <= now() and x.intentos < 5)
    order by x.id
    limit p_limite
    for update skip locked
  )
  returning a.*
$$;

-- Devuelve a la cola los archivos con error (todos o los de un código),
-- por ejemplo después de que se renuevan los créditos de la API.
create or replace function contabilidad.reintentar_archivos(p_codigo text default null)
returns integer
language sql
set search_path = ''
as $$
  with actualizados as (
    update contabilidad.archivos_drive
    set estado = 'pendiente', reintentar_desde = null, intentos = 0
    where estado = 'error' and (p_codigo is null or error_codigo = p_codigo)
    returning 1
  )
  select count(*)::integer from actualizados
$$;

-- Resumen del estado de la cola para la UI
create view contabilidad.v_estado_archivos
with (security_invoker = true) as
select
  estado,
  error_codigo,
  count(*) as cantidad
from contabilidad.archivos_drive
group by estado, error_codigo;

grant select, insert, update, delete on contabilidad.tasas_cambio to authenticated;
grant all on contabilidad.tasas_cambio to service_role;
grant select on contabilidad.v_estado_archivos to authenticated, service_role;
revoke execute on all functions in schema contabilidad from public;
grant execute on all functions in schema contabilidad to authenticated, service_role;
