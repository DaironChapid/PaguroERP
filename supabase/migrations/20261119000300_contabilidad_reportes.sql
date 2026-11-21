-- =====================================================================
-- Módulo de contabilidad · Reportes (vistas y funciones SQL) y
-- operaciones atómicas sobre asientos.
--
-- Las vistas usan security_invoker para que respeten el RLS del usuario.
-- Las funciones con parámetros (balance a una fecha, balance de
-- comprobación por rango) son equivalentes a vistas parametrizadas.
--
-- Nota V1: no hay asientos de cierre. El resultado del ejercicio y el de
-- ejercicios anteriores se calculan al vuelo en el balance general.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Movimientos: asientos + saldos iniciales en un solo origen
-- ---------------------------------------------------------------------
create view contabilidad.v_movimientos
with (security_invoker = true) as
select
  l.id            as linea_id,
  a.id            as asiento_id,
  a.fecha,
  coalesce(l.descripcion, a.descripcion) as descripcion,
  a.factura_id,
  l.cuenta_id,
  l.tercero_id,
  l.debito,
  l.credito,
  'asiento'::text as origen
from contabilidad.asiento_lineas l
join contabilidad.asientos a on a.id = l.asiento_id
union all
select
  null::bigint,
  null::bigint,
  s.fecha_corte,
  'Saldo inicial',
  null::bigint,
  s.cuenta_id,
  s.tercero_id,
  s.debito,
  s.credito,
  'saldo_inicial'::text
from contabilidad.saldos_iniciales s;

-- ---------------------------------------------------------------------
-- Libro mayor con saldo acumulado por cuenta
-- ---------------------------------------------------------------------
create view contabilidad.v_libro_mayor
with (security_invoker = true) as
select
  m.fecha,
  date_trunc('month', m.fecha)::date as periodo,
  c.codigo        as cuenta_codigo,
  c.nombre        as cuenta_nombre,
  c.naturaleza,
  m.origen,
  m.asiento_id,
  m.factura_id,
  m.descripcion,
  t.nit           as tercero_nit,
  t.razon_social  as tercero_nombre,
  m.debito,
  m.credito,
  sum(case when c.naturaleza = 'debito' then m.debito - m.credito else m.credito - m.debito end)
    over (
      partition by m.cuenta_id
      order by m.fecha, m.origen desc, m.linea_id nulls first
      rows between unbounded preceding and current row
    ) as saldo
from contabilidad.v_movimientos m
join contabilidad.cuentas c on c.id = m.cuenta_id
left join contabilidad.terceros t on t.id = m.tercero_id;

-- ---------------------------------------------------------------------
-- Movimiento mensual por cuenta (base del balance de comprobación y P&G)
-- ---------------------------------------------------------------------
create view contabilidad.v_balance_comprobacion_mensual
with (security_invoker = true) as
select
  date_trunc('month', m.fecha)::date as periodo,
  c.id          as cuenta_id,
  c.codigo      as cuenta_codigo,
  c.nombre      as cuenta_nombre,
  c.tipo,
  c.naturaleza,
  sum(m.debito)  as debitos,
  sum(m.credito) as creditos,
  sum(case when c.naturaleza = 'debito' then m.debito - m.credito else m.credito - m.debito end) as movimiento
from contabilidad.v_movimientos m
join contabilidad.cuentas c on c.id = m.cuenta_id
group by 1, c.id, c.codigo, c.nombre, c.tipo, c.naturaleza;

create or replace function contabilidad.balance_comprobacion(p_desde date, p_hasta date)
returns table (
  cuenta_codigo   text,
  cuenta_nombre   text,
  tipo            text,
  naturaleza      text,
  saldo_anterior  numeric,
  debitos         numeric,
  creditos        numeric,
  saldo_final     numeric
)
language sql
stable
set search_path = ''
as $$
  with mov as (
    select
      m.cuenta_id,
      sum(case when m.fecha < p_desde then m.debito - m.credito else 0 end) as neto_anterior,
      sum(case when m.fecha >= p_desde then m.debito else 0 end)            as debitos,
      sum(case when m.fecha >= p_desde then m.credito else 0 end)           as creditos
    from contabilidad.v_movimientos m
    where m.fecha <= p_hasta
    group by m.cuenta_id
  )
  select
    c.codigo,
    c.nombre,
    c.tipo,
    c.naturaleza,
    round(case when c.naturaleza = 'debito' then mov.neto_anterior else -mov.neto_anterior end, 2),
    round(mov.debitos, 2),
    round(mov.creditos, 2),
    round(case when c.naturaleza = 'debito'
      then mov.neto_anterior + mov.debitos - mov.creditos
      else -(mov.neto_anterior + mov.debitos - mov.creditos)
    end, 2)
  from mov
  join contabilidad.cuentas c on c.id = mov.cuenta_id
  order by c.codigo
$$;

-- ---------------------------------------------------------------------
-- Estado de resultados
-- valor positivo = ingreso para cuentas de ingreso, gasto/costo para las demás.
-- (Las devoluciones en ventas, de naturaleza débito, restan ingresos.)
-- ---------------------------------------------------------------------
create view contabilidad.v_estado_resultados
with (security_invoker = true) as
select
  b.periodo,
  extract(year from b.periodo)::int as anio,
  b.cuenta_codigo,
  b.cuenta_nombre,
  b.tipo,
  case when b.tipo = 'ingreso' then b.creditos - b.debitos else b.debitos - b.creditos end as valor
from contabilidad.v_balance_comprobacion_mensual b
where b.tipo in ('ingreso', 'costo', 'gasto');

create view contabilidad.v_resultado_mensual
with (security_invoker = true) as
select
  periodo,
  anio,
  coalesce(sum(valor) filter (where tipo = 'ingreso'), 0) as ingresos,
  coalesce(sum(valor) filter (where tipo = 'costo'), 0)   as costos,
  coalesce(sum(valor) filter (where tipo = 'gasto'), 0)   as gastos,
  coalesce(sum(valor) filter (where tipo = 'ingreso'), 0)
    - coalesce(sum(valor) filter (where tipo in ('costo', 'gasto')), 0) as utilidad
from contabilidad.v_estado_resultados
group by periodo, anio;

create view contabilidad.v_resultado_anual
with (security_invoker = true) as
select
  anio,
  sum(ingresos) as ingresos,
  sum(costos)   as costos,
  sum(gastos)   as gastos,
  sum(utilidad) as utilidad
from contabilidad.v_resultado_mensual
group by anio;

-- ---------------------------------------------------------------------
-- Balance general a una fecha
-- Activo = Pasivo + Patrimonio, con el resultado calculado al vuelo.
-- ---------------------------------------------------------------------
create or replace function contabilidad.balance_general(p_fecha date)
returns table (
  seccion        text,
  cuenta_codigo  text,
  cuenta_nombre  text,
  saldo          numeric
)
language sql
stable
set search_path = ''
as $$
  with saldos as (
    select
      c.codigo,
      c.nombre,
      c.tipo,
      sum(m.debito - m.credito) as neto,
      sum(case when m.fecha >= date_trunc('year', p_fecha)::date then m.debito - m.credito else 0 end) as neto_ejercicio
    from contabilidad.v_movimientos m
    join contabilidad.cuentas c on c.id = m.cuenta_id
    where m.fecha <= p_fecha
    group by c.codigo, c.nombre, c.tipo
  )
  select * from (
    select
      s.tipo,
      s.codigo,
      s.nombre,
      case when s.tipo = 'activo' then s.neto else -s.neto end
    from saldos s
    where s.tipo in ('activo', 'pasivo', 'patrimonio') and s.neto <> 0
    union all
    select 'patrimonio', '3605', 'Resultado del ejercicio (calculado)', -coalesce(sum(s.neto_ejercicio), 0)
    from saldos s
    where s.tipo in ('ingreso', 'costo', 'gasto')
    union all
    select 'patrimonio', '3705', 'Resultados de ejercicios anteriores (calculado)', -coalesce(sum(s.neto - s.neto_ejercicio), 0)
    from saldos s
    where s.tipo in ('ingreso', 'costo', 'gasto')
  ) r (seccion, cuenta_codigo, cuenta_nombre, saldo)
  order by
    case r.seccion when 'activo' then 1 when 'pasivo' then 2 else 3 end,
    r.cuenta_codigo
$$;

-- Estado de los saldos iniciales (la UI avisa si faltan o no cuadran)
create view contabilidad.v_estado_saldos_iniciales
with (security_invoker = true) as
select
  count(*)                          as cantidad,
  coalesce(sum(debito), 0)          as total_debitos,
  coalesce(sum(credito), 0)         as total_creditos,
  count(*) > 0                      as cargados,
  coalesce(sum(debito), 0) = coalesce(sum(credito), 0) as cuadran,
  min(fecha_corte)                  as fecha_corte
from contabilidad.saldos_iniciales;

-- ---------------------------------------------------------------------
-- Reportes de gestión sobre facturas aprobadas (valores en COP)
-- ---------------------------------------------------------------------
create view contabilidad.v_gastos_categoria
with (security_invoker = true) as
select
  date_trunc('month', f.fecha_emision)::date as periodo,
  f.tipo,
  cat.id     as categoria_id,
  coalesce(cat.nombre, 'Sin categoría') as categoria,
  count(*)   as cantidad,
  sum(round(f.subtotal * f.tasa_cambio, 2)) as subtotal_cop,
  sum(round(f.iva * f.tasa_cambio, 2))      as iva_cop,
  sum(round(f.total * f.tasa_cambio, 2))    as total_cop
from contabilidad.facturas f
left join contabilidad.categorias cat on cat.id = f.categoria_id
where f.estado = 'aprobada' and f.tipo in ('compra', 'gasto')
group by 1, f.tipo, cat.id, cat.nombre;

create view contabilidad.v_gastos_proveedor
with (security_invoker = true) as
select
  date_trunc('month', f.fecha_emision)::date as periodo,
  t.id            as tercero_id,
  t.nit,
  t.razon_social,
  count(*)        as cantidad,
  sum(round(f.subtotal * f.tasa_cambio, 2)) as subtotal_cop,
  sum(round(f.iva * f.tasa_cambio, 2))      as iva_cop,
  sum(round(f.total * f.tasa_cambio, 2))    as total_cop
from contabilidad.facturas f
join contabilidad.terceros t on t.id = f.tercero_id
where f.estado = 'aprobada' and f.tipo in ('compra', 'gasto')
group by 1, t.id, t.nit, t.razon_social;

create view contabilidad.v_impuestos_periodo
with (security_invoker = true) as
select
  date_trunc('month', f.fecha_emision)::date as periodo,
  coalesce(sum(round(f.iva * f.tasa_cambio, 2)) filter (where f.tipo in ('compra', 'gasto')), 0)        as iva_descontable,
  coalesce(sum(round(f.iva * f.tasa_cambio, 2)) filter (where f.tipo = 'venta'), 0)                     as iva_generado,
  coalesce(sum(round(f.iva * f.tasa_cambio, 2)) filter (where f.tipo = 'venta'), 0)
    - coalesce(sum(round(f.iva * f.tasa_cambio, 2)) filter (where f.tipo in ('compra', 'gasto')), 0)    as iva_neto,
  coalesce(sum(round(f.retefuente * f.tasa_cambio, 2)) filter (where f.tipo in ('compra', 'gasto')), 0) as retefuente_practicada,
  coalesce(sum(round(f.reteica * f.tasa_cambio, 2)) filter (where f.tipo in ('compra', 'gasto')), 0)    as reteica_practicada,
  coalesce(sum(round(f.retefuente * f.tasa_cambio, 2)) filter (where f.tipo = 'venta'), 0)              as retefuente_a_favor,
  coalesce(sum(round(f.reteica * f.tasa_cambio, 2)) filter (where f.tipo = 'venta'), 0)                 as reteica_a_favor
from contabilidad.facturas f
where f.estado = 'aprobada'
group by 1;

-- V1 no registra pagos ni recaudos: estos reportes muestran el saldo
-- original de cada factura aprobada.
create view contabilidad.v_cuentas_por_pagar
with (security_invoker = true) as
select
  f.id            as factura_id,
  f.numero,
  t.nit,
  t.razon_social,
  f.fecha_emision,
  f.fecha_vencimiento,
  f.moneda,
  round((coalesce(f.subtotal, 0) + f.iva + f.otros_impuestos - f.retefuente - f.reteica) * f.tasa_cambio, 2) as saldo_cop,
  greatest(current_date - f.fecha_vencimiento, 0) as dias_vencida
from contabilidad.facturas f
join contabilidad.terceros t on t.id = f.tercero_id
where f.estado = 'aprobada' and f.tipo in ('compra', 'gasto');

create view contabilidad.v_cuentas_por_cobrar
with (security_invoker = true) as
select
  f.id            as factura_id,
  f.numero,
  t.nit,
  t.razon_social,
  f.fecha_emision,
  f.fecha_vencimiento,
  f.moneda,
  round((coalesce(f.subtotal, 0) + f.iva + f.otros_impuestos - f.retefuente - f.reteica) * f.tasa_cambio, 2) as saldo_cop,
  greatest(current_date - f.fecha_vencimiento, 0) as dias_vencida
from contabilidad.facturas f
join contabilidad.terceros t on t.id = f.tercero_id
where f.estado = 'aprobada' and f.tipo = 'venta';

-- ---------------------------------------------------------------------
-- Operaciones atómicas sobre asientos
-- ---------------------------------------------------------------------

-- Reemplaza el asiento de una factura y la deja aprobada, en una sola
-- transacción. p_lineas: [{ "cuenta": "codigo", "tercero_id": 1,
-- "descripcion": "...", "debito": 0, "credito": 0 }, ...]
create or replace function contabilidad.registrar_asiento_factura(
  p_factura_id   bigint,
  p_fecha        date,
  p_descripcion  text,
  p_lineas       jsonb,
  p_usuario      text
)
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  v_asiento   bigint;
  v_insertadas integer;
begin
  delete from contabilidad.asientos where factura_id = p_factura_id;

  insert into contabilidad.asientos (fecha, descripcion, origen, factura_id, creado_por)
  values (p_fecha, p_descripcion, 'factura', p_factura_id, p_usuario)
  returning id into v_asiento;

  insert into contabilidad.asiento_lineas (asiento_id, cuenta_id, tercero_id, descripcion, debito, credito)
  select
    v_asiento,
    c.id,
    nullif(l ->> 'tercero_id', '')::bigint,
    l ->> 'descripcion',
    coalesce((l ->> 'debito')::numeric, 0),
    coalesce((l ->> 'credito')::numeric, 0)
  from jsonb_array_elements(p_lineas) l
  join contabilidad.cuentas c on c.codigo = l ->> 'cuenta';

  get diagnostics v_insertadas = row_count;
  if v_insertadas <> jsonb_array_length(p_lineas) then
    raise exception 'El asiento usa cuentas que no existen en el plan de cuentas';
  end if;

  update contabilidad.facturas
  set estado = 'aprobada', aprobada_por = p_usuario, aprobada_en = now()
  where id = p_factura_id;

  return v_asiento;
end
$$;

-- Cambia el estado de una factura a uno distinto de 'aprobada' y elimina
-- su asiento si lo tenía (por ejemplo al rechazarla o devolverla a revisión).
create or replace function contabilidad.cambiar_estado_factura(
  p_factura_id     bigint,
  p_estado         text,
  p_observaciones  text default null
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_estado = 'aprobada' then
    raise exception 'Para aprobar use contabilidad.registrar_asiento_factura';
  end if;

  delete from contabilidad.asientos where factura_id = p_factura_id;

  update contabilidad.facturas
  set estado = p_estado,
      aprobada_por = null,
      aprobada_en = null,
      observaciones = coalesce(p_observaciones, observaciones)
  where id = p_factura_id;
end
$$;

-- Permisos de los objetos creados en esta migración
grant select on all tables in schema contabilidad to authenticated;
grant all on all tables in schema contabilidad to service_role;
revoke execute on all functions in schema contabilidad from public;
grant execute on all functions in schema contabilidad to authenticated, service_role;
