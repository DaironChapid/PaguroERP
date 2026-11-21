-- =====================================================================
-- Módulo de contabilidad · Errores reintentables y consumo de IA
--
-- Los créditos de la API pueden agotarse (se renuevan cada mes). En ese
-- caso el archivo queda en estado 'error' con un código, no se pierde
-- nada y se reintenta después.
-- =====================================================================

alter table contabilidad.archivos_drive
  add column error_codigo text,
  add column reintentar_desde timestamptz;

comment on column contabilidad.archivos_drive.error_codigo is
  'sin_creditos | limite_tasa | sobrecargado | autenticacion | solicitud_invalida | archivo_ilegible | desconocido';
comment on column contabilidad.archivos_drive.reintentar_desde is
  'Si tiene valor, el archivo no se reintenta antes de esa fecha';

create index archivos_drive_reintento_idx on contabilidad.archivos_drive (estado, reintentar_desde);

alter table contabilidad.procesamientos
  add column error_codigo text,
  add column reintentable boolean;

-- Consumo mensual de la IA por modelo
create view contabilidad.v_consumo_ia_mensual
with (security_invoker = true) as
select
  date_trunc('month', p.creado_en)::date as periodo,
  coalesce(p.modelo, 'sin modelo')       as modelo,
  count(*)                               as intentos,
  count(*) filter (where p.estado = 'exito')                     as exitos,
  count(*) filter (where p.estado = 'error')                     as errores,
  count(*) filter (where p.error_codigo = 'sin_creditos')        as errores_sin_creditos,
  coalesce(sum(p.tokens_entrada), 0)                             as tokens_entrada,
  coalesce(sum(p.tokens_salida), 0)                              as tokens_salida,
  coalesce(sum(p.tokens_entrada), 0) + coalesce(sum(p.tokens_salida), 0) as tokens_total,
  round(avg(p.tokens_entrada + p.tokens_salida) filter (where p.estado = 'exito'))  as tokens_promedio_por_factura,
  sum(p.costo_usd)                                               as costo_usd_estimado
from contabilidad.procesamientos p
where p.metodo = 'ia' or p.metodo is null
group by 1, 2;

grant select on contabilidad.v_consumo_ia_mensual to authenticated, service_role;
