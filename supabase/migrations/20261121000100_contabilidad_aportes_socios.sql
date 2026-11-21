-- =====================================================================
-- Módulo de contabilidad · Aportes de socios y prima de servicios
--
-- Respuesta del gerente (20-nov-2026): las transferencias de la cuenta
-- personal de Joseph a la empresa son APORTES DE SOCIO; las de la empresa a
-- Joseph son PAGO DE NÓMINA (Joseph hace un aporte y luego la empresa le paga
-- la nómina).
--
-- Un aporte es dinero que ENTRA al banco: débito al banco, crédito al
-- patrimonio en 310520 "Aportes de socios por capitalizar".
-- ⚠ PENDIENTE DE VALIDACIÓN POR EL CONTADOR: en una S.A.S. el aumento de
-- capital requiere formalizarse; si el contador prefiere otra cuenta (por
-- ejemplo 2355 Deudas con socios), basta con cambiar "aportes_socios" en
-- configuracion.cuentas_movimientos.
-- =====================================================================

alter table contabilidad.facturas drop constraint facturas_clase_documento_check;
alter table contabilidad.facturas
  add constraint facturas_clase_documento_check check (clase_documento in (
    'factura', 'pago_impuestos', 'planilla_seguridad_social', 'pago_nomina',
    'transferencia', 'declaracion_importacion', 'aporte_socio', 'informativo'
  ));

insert into contabilidad.cuentas (codigo, nombre, naturaleza, tipo, padre_id, acepta_movimiento)
select v.codigo, v.nombre, v.naturaleza, v.tipo, p.id, true
from (values
  ('310520', 'Aportes de socios por capitalizar', 'credito', 'patrimonio', '3105'),
  ('510536', 'Prima de servicios',                'debito',  'gasto',      '5105')
) as v (codigo, nombre, naturaleza, tipo, padre)
join contabilidad.cuentas p on p.codigo = v.padre
on conflict (codigo) do nothing;

update contabilidad.configuracion
set valor = valor || '{"aportes_socios": "310520"}'::jsonb
where clave = 'cuentas_movimientos';

-- Socios: la IA los usa para reconocer aportes y pagos de nómina al socio.
insert into contabilidad.configuracion (clave, valor, descripcion) values
  ('socios', '[{"nombre": "JOSEPH ARCE CLAVIJO", "documento": "1013626374"}]'::jsonb,
   'Socios de la empresa: sus transferencias a la empresa son aportes y lo que la empresa les transfiere es su nómina')
on conflict (clave) do nothing;
