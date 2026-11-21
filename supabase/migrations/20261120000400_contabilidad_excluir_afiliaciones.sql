-- La subcarpeta de afiliaciones contiene documentos personales (no
-- movimientos contables): no se envía a la IA.
update contabilidad.configuracion
set valor = jsonb_set(valor, '{excluir}', '["Afiliaciones"]'::jsonb)
where clave = 'drive_filtro';
