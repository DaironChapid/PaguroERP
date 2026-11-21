-- La empresa opera con una cuenta de AHORROS en Bancolombia (terminada en
-- 9667, según los extractos del Drive): sus movimientos van a 112005
-- (cuentas de ahorro) y no a 111005 (bancos, cuenta corriente).
update contabilidad.cuentas set nombre = 'Bancolombia cuenta de ahorros *9667' where codigo = '112005';

update contabilidad.configuracion
set valor = valor
  || '{"banco_por_defecto": "112005"}'::jsonb
  || jsonb_build_object('bancos', '{"BANCOLOMBIA": "112005"}'::jsonb)
where clave = 'cuentas_movimientos';

-- Asientos ya generados con la cuenta anterior
update contabilidad.asiento_lineas
set cuenta_id = (select id from contabilidad.cuentas where codigo = '112005')
where cuenta_id = (select id from contabilidad.cuentas where codigo = '111005');
