-- =====================================================================
-- Módulo de contabilidad · Movimientos (pagos, PILA, nómina,
-- transferencias e importaciones)
--
-- Los movimientos se guardan en la misma tabla `facturas` (que pasa a
-- funcionar como "documentos soporte") con tipo = 'pago'. Así comparten la
-- bandeja de revisión, el enlace al Drive, la detección de duplicados por
-- tercero + número y la generación de asientos.
-- ⚠ PENDIENTE DE VALIDACIÓN POR EL CONTADOR.
-- =====================================================================

alter table contabilidad.facturas drop constraint facturas_tipo_check;
alter table contabilidad.facturas
  add constraint facturas_tipo_check check (tipo in ('compra', 'venta', 'gasto', 'pago'));

alter table contabilidad.facturas
  add column clase_documento text not null default 'factura'
    check (clase_documento in (
      'factura', 'pago_impuestos', 'planilla_seguridad_social', 'pago_nomina',
      'transferencia', 'declaracion_importacion', 'informativo'
    )),
  add column componentes jsonb not null default '[]'::jsonb;

comment on column contabilidad.facturas.componentes is
  'Desglose de un movimiento: [{"concepto": "capital|intereses_mora|salud|...", "valor": 123}] en la moneda del documento';

create index facturas_clase_idx on contabilidad.facturas (clase_documento);

-- Cuentas adicionales del PUC para movimientos
insert into contabilidad.cuentas (codigo, nombre, naturaleza, tipo) values
  ('2404',   'De renta y complementarios',                    'credito', 'pasivo'),
  ('240405', 'Impuesto de renta por pagar',                   'credito', 'pasivo'),
  ('2412',   'De industria y comercio',                       'credito', 'pasivo'),
  ('241205', 'Impuesto de industria y comercio por pagar',    'credito', 'pasivo'),
  ('510568', 'Aportes a administradoras de riesgos laborales', 'debito', 'gasto'),
  ('510569', 'Aportes a entidades promotoras de salud EPS',   'debito',  'gasto'),
  ('510570', 'Aportes a fondos de pensiones',                 'debito',  'gasto'),
  ('510572', 'Aportes cajas de compensación familiar',        'debito',  'gasto'),
  ('510575', 'Aportes ICBF y SENA',                           'debito',  'gasto'),
  ('5395',   'Gastos diversos (no operacionales)',            'debito',  'gasto'),
  ('539520', 'Multas, sanciones y litigios',                  'debito',  'gasto');

update contabilidad.cuentas h
set padre_id = p.id
from contabilidad.cuentas p
where h.padre_id is null
  and p.codigo = case length(h.codigo)
    when 2 then left(h.codigo, 1)
    when 4 then left(h.codigo, 2)
    when 6 then left(h.codigo, 4)
  end;

update contabilidad.cuentas set acepta_movimiento = length(codigo) >= 6
where codigo in ('2404', '240405', '2412', '241205', '510568', '510569', '510570', '510572', '510575', '5395', '539520');

-- Cuentas que usa cada tipo de movimiento. `bancos` asocia el nombre del
-- banco (en mayúsculas, sin tildes) con su cuenta; si el banco no está en la
-- lista, el documento va a revisión.
insert into contabilidad.configuracion (clave, valor, descripcion) values
  ('cuentas_movimientos', '{
     "bancos": {"BANCOLOMBIA": "111005"},
     "banco_por_defecto": "111005",
     "iva_por_pagar": "240805",
     "retefuente_por_pagar": "236570",
     "renta_por_pagar": "240405",
     "ica_por_pagar": "241205",
     "otros_impuestos_por_pagar": "249595",
     "intereses_mora": "530520",
     "sanciones": "539520",
     "aportes_salud": "510569",
     "aportes_pension": "510570",
     "aportes_arl": "510568",
     "aportes_caja": "510572",
     "aportes_parafiscales": "510575",
     "sueldos": "510506",
     "comisiones_bancarias": "530515",
     "gmf": "511595",
     "arancel": "620501",
     "iva_importacion": "240810"
   }'::jsonb,
   'Cuentas usadas al contabilizar pagos, PILA, nómina, transferencias e importaciones');
