-- =====================================================================
-- Módulo de contabilidad · Semillas
--
-- ⚠ PENDIENTE DE VALIDACIÓN POR EL CONTADOR.
-- Plan de cuentas basado en el PUC colombiano (Decreto 2650 de 1993) con
-- las cuentas más comunes para un ecommerce. Las subcuentas de 6 dígitos
-- son las auxiliares que reciben movimiento.
-- =====================================================================

insert into contabilidad.cuentas (codigo, nombre, naturaleza, tipo) values
  -- 1 ACTIVO
  ('1',      'Activo',                                             'debito',  'activo'),
  ('11',     'Disponible',                                         'debito',  'activo'),
  ('1105',   'Caja',                                               'debito',  'activo'),
  ('110505', 'Caja general',                                       'debito',  'activo'),
  ('1110',   'Bancos',                                             'debito',  'activo'),
  ('111005', 'Bancos moneda nacional',                             'debito',  'activo'),
  ('111010', 'Bancos moneda extranjera',                           'debito',  'activo'),
  ('1120',   'Cuentas de ahorro',                                  'debito',  'activo'),
  ('112005', 'Cuentas de ahorro bancos',                           'debito',  'activo'),
  ('13',     'Deudores',                                           'debito',  'activo'),
  ('1305',   'Clientes',                                           'debito',  'activo'),
  ('130505', 'Clientes nacionales',                                'debito',  'activo'),
  ('130510', 'Clientes del exterior',                              'debito',  'activo'),
  ('1330',   'Anticipos y avances',                                'debito',  'activo'),
  ('133005', 'Anticipos a proveedores',                            'debito',  'activo'),
  ('1355',   'Anticipo de impuestos y contribuciones o saldos a favor', 'debito', 'activo'),
  ('135515', 'Retención en la fuente (a favor)',                   'debito',  'activo'),
  ('135517', 'Impuesto a las ventas retenido (a favor)',           'debito',  'activo'),
  ('135518', 'Impuesto de industria y comercio retenido (a favor)', 'debito', 'activo'),
  ('14',     'Inventarios',                                        'debito',  'activo'),
  ('1435',   'Mercancías no fabricadas por la empresa',            'debito',  'activo'),
  ('143501', 'Mercancías no fabricadas por la empresa',            'debito',  'activo'),
  ('15',     'Propiedades, planta y equipo',                       'debito',  'activo'),
  ('1524',   'Equipo de oficina',                                  'debito',  'activo'),
  ('152405', 'Muebles y enseres',                                  'debito',  'activo'),
  ('1528',   'Equipo de computación y comunicación',               'debito',  'activo'),
  ('152805', 'Equipos de procesamiento de datos',                  'debito',  'activo'),

  -- 2 PASIVO
  ('2',      'Pasivo',                                             'credito', 'pasivo'),
  ('22',     'Proveedores',                                        'credito', 'pasivo'),
  ('2205',   'Proveedores nacionales',                             'credito', 'pasivo'),
  ('220505', 'Proveedores nacionales',                             'credito', 'pasivo'),
  ('2210',   'Proveedores del exterior',                           'credito', 'pasivo'),
  ('221005', 'Proveedores del exterior',                           'credito', 'pasivo'),
  ('23',     'Cuentas por pagar',                                  'credito', 'pasivo'),
  ('2335',   'Costos y gastos por pagar',                          'credito', 'pasivo'),
  ('233595', 'Costos y gastos por pagar - otros',                  'credito', 'pasivo'),
  ('2365',   'Retención en la fuente',                             'credito', 'pasivo'),
  ('236505', 'Retención en la fuente - salarios y pagos laborales', 'credito', 'pasivo'),
  ('236515', 'Retención en la fuente - honorarios',                'credito', 'pasivo'),
  ('236520', 'Retención en la fuente - comisiones',                'credito', 'pasivo'),
  ('236525', 'Retención en la fuente - servicios',                 'credito', 'pasivo'),
  ('236530', 'Retención en la fuente - arrendamientos',            'credito', 'pasivo'),
  ('236540', 'Retención en la fuente - compras',                   'credito', 'pasivo'),
  ('236570', 'Retención en la fuente - otras retenciones',         'credito', 'pasivo'),
  ('2367',   'Impuesto a las ventas retenido',                     'credito', 'pasivo'),
  ('236701', 'Impuesto a las ventas retenido',                     'credito', 'pasivo'),
  ('2368',   'Impuesto de industria y comercio retenido',          'credito', 'pasivo'),
  ('236801', 'Impuesto de industria y comercio retenido',          'credito', 'pasivo'),
  ('24',     'Impuestos, gravámenes y tasas',                      'credito', 'pasivo'),
  ('2408',   'Impuesto sobre las ventas por pagar',                'credito', 'pasivo'),
  ('240805', 'IVA generado',                                       'credito', 'pasivo'),
  ('240810', 'IVA descontable',                                    'debito',  'pasivo'),
  ('2495',   'Otros impuestos',                                    'credito', 'pasivo'),
  ('249595', 'Otros impuestos por pagar',                          'credito', 'pasivo'),

  -- 3 PATRIMONIO
  ('3',      'Patrimonio',                                         'credito', 'patrimonio'),
  ('31',     'Capital social',                                     'credito', 'patrimonio'),
  ('3105',   'Capital suscrito y pagado',                          'credito', 'patrimonio'),
  ('310505', 'Capital autorizado',                                 'credito', 'patrimonio'),
  ('36',     'Resultados del ejercicio',                           'credito', 'patrimonio'),
  ('3605',   'Utilidad del ejercicio',                             'credito', 'patrimonio'),
  ('360505', 'Utilidad del ejercicio',                             'credito', 'patrimonio'),
  ('3610',   'Pérdida del ejercicio',                              'debito',  'patrimonio'),
  ('361005', 'Pérdida del ejercicio',                              'debito',  'patrimonio'),
  ('37',     'Resultados de ejercicios anteriores',                'credito', 'patrimonio'),
  ('3705',   'Utilidades acumuladas',                              'credito', 'patrimonio'),
  ('370505', 'Utilidades acumuladas',                              'credito', 'patrimonio'),
  ('3710',   'Pérdidas acumuladas',                                'debito',  'patrimonio'),
  ('371005', 'Pérdidas acumuladas',                                'debito',  'patrimonio'),

  -- 4 INGRESOS
  ('4',      'Ingresos',                                           'credito', 'ingreso'),
  ('41',     'Operacionales',                                      'credito', 'ingreso'),
  ('4135',   'Comercio al por mayor y al por menor',               'credito', 'ingreso'),
  ('413501', 'Venta de mercancías',                                'credito', 'ingreso'),
  ('4175',   'Devoluciones en ventas',                             'debito',  'ingreso'),
  ('417501', 'Devoluciones en ventas',                             'debito',  'ingreso'),
  ('42',     'No operacionales',                                   'credito', 'ingreso'),
  ('4210',   'Financieros',                                        'credito', 'ingreso'),
  ('421005', 'Intereses',                                          'credito', 'ingreso'),
  ('421040', 'Diferencia en cambio',                               'credito', 'ingreso'),
  ('4295',   'Diversos',                                           'credito', 'ingreso'),
  ('429595', 'Otros ingresos diversos',                            'credito', 'ingreso'),

  -- 5 GASTOS
  ('5',      'Gastos',                                             'debito',  'gasto'),
  ('51',     'Operacionales de administración',                    'debito',  'gasto'),
  ('5105',   'Gastos de personal',                                 'debito',  'gasto'),
  ('510506', 'Sueldos',                                            'debito',  'gasto'),
  ('5110',   'Honorarios',                                         'debito',  'gasto'),
  ('511025', 'Asesoría jurídica',                                  'debito',  'gasto'),
  ('511030', 'Asesoría financiera y contable',                     'debito',  'gasto'),
  ('511095', 'Honorarios - otros',                                 'debito',  'gasto'),
  ('5115',   'Impuestos',                                          'debito',  'gasto'),
  ('511505', 'Industria y comercio',                               'debito',  'gasto'),
  ('511595', 'Otros impuestos y contribuciones',                   'debito',  'gasto'),
  ('5120',   'Arrendamientos',                                     'debito',  'gasto'),
  ('512010', 'Arrendamiento de construcciones y edificaciones',    'debito',  'gasto'),
  ('5135',   'Servicios',                                          'debito',  'gasto'),
  ('513505', 'Aseo y vigilancia',                                  'debito',  'gasto'),
  ('513530', 'Energía eléctrica',                                  'debito',  'gasto'),
  ('513535', 'Teléfono e internet',                                'debito',  'gasto'),
  ('513595', 'Otros servicios (software y suscripciones)',         'debito',  'gasto'),
  ('5140',   'Gastos legales',                                     'debito',  'gasto'),
  ('514005', 'Notariales',                                         'debito',  'gasto'),
  ('514010', 'Registro mercantil',                                 'debito',  'gasto'),
  ('5145',   'Mantenimiento y reparaciones',                       'debito',  'gasto'),
  ('514525', 'Mantenimiento de equipo de computación',             'debito',  'gasto'),
  ('5195',   'Diversos',                                           'debito',  'gasto'),
  ('519525', 'Elementos de aseo y cafetería',                      'debito',  'gasto'),
  ('519530', 'Útiles, papelería y fotocopias',                     'debito',  'gasto'),
  ('519595', 'Otros gastos diversos',                              'debito',  'gasto'),
  ('52',     'Operacionales de ventas',                            'debito',  'gasto'),
  ('5235',   'Servicios (ventas)',                                 'debito',  'gasto'),
  ('523550', 'Transporte, fletes y acarreos',                      'debito',  'gasto'),
  ('523560', 'Publicidad, propaganda y promoción',                 'debito',  'gasto'),
  ('523595', 'Otros servicios de ventas',                          'debito',  'gasto'),
  ('5295',   'Diversos (ventas)',                                  'debito',  'gasto'),
  ('529505', 'Comisiones (pasarelas y marketplaces)',              'debito',  'gasto'),
  ('529595', 'Otros gastos de ventas (empaques y embalajes)',      'debito',  'gasto'),
  ('53',     'No operacionales',                                   'debito',  'gasto'),
  ('5305',   'Financieros',                                        'debito',  'gasto'),
  ('530505', 'Gastos bancarios',                                   'debito',  'gasto'),
  ('530515', 'Comisiones bancarias',                               'debito',  'gasto'),
  ('530520', 'Intereses',                                          'debito',  'gasto'),
  ('530525', 'Diferencia en cambio',                               'debito',  'gasto'),

  -- 6 COSTOS DE VENTAS / 62 COMPRAS (sistema de inventario periódico)
  ('6',      'Costos de ventas',                                   'debito',  'costo'),
  ('61',     'Costo de ventas y de prestación de servicios',       'debito',  'costo'),
  ('6135',   'Comercio al por mayor y al por menor',               'debito',  'costo'),
  ('613501', 'Costo de mercancía vendida',                         'debito',  'costo'),
  ('62',     'Compras',                                            'debito',  'costo'),
  ('6205',   'De mercancías',                                      'debito',  'costo'),
  ('620501', 'Compras de mercancía',                               'debito',  'costo');

-- Jerarquía: clase (1) → grupo (2) → cuenta (4) → subcuenta (6) → auxiliar (8)
update contabilidad.cuentas h
set padre_id = p.id
from contabilidad.cuentas p
where p.codigo = case length(h.codigo)
    when 2 then left(h.codigo, 1)
    when 4 then left(h.codigo, 2)
    when 6 then left(h.codigo, 4)
    when 8 then left(h.codigo, 6)
  end;

-- Solo las subcuentas (6+ dígitos) reciben movimiento
update contabilidad.cuentas set acepta_movimiento = length(codigo) >= 6;

-- ---------------------------------------------------------------------
-- Categorías de negocio
-- ---------------------------------------------------------------------
insert into contabilidad.categorias (nombre, descripcion, tipo_factura, cuenta_id, cuenta_retefuente_id)
select v.nombre, v.descripcion, v.tipo, c.id, r.id
from (values
  ('Compra de mercancía',          'Productos comprados para la venta',                          'compra', '620501', '236540'),
  ('Equipos de cómputo',           'Computadores, celulares y equipos de oficina',              'compra', '152805', '236540'),
  ('Publicidad y marketing digital', 'Meta, Google, TikTok, influenciadores, agencias',        'gasto',  '523560', '236525'),
  ('Fletes y envíos',              'Transportadoras y mensajería',                               'gasto',  '523550', '236525'),
  ('Software y suscripciones',     'Shopify, apps, dominios, hosting, herramientas SaaS',        'gasto',  '513595', '236525'),
  ('Comisiones de pasarelas y marketplaces', 'Wompi, MercadoPago, PayU, Mercado Libre, etc.', 'gasto',  '529505', '236520'),
  ('Empaques y embalajes',         'Cajas, bolsas, cintas y material de empaque',                'gasto',  '529595', '236540'),
  ('Honorarios profesionales',     'Contador, abogado, consultores',                             'gasto',  '511095', '236515'),
  ('Arrendamiento',                'Oficina, bodega',                                            'gasto',  '512010', '236530'),
  ('Servicios públicos e internet', 'Energía, telefonía, internet',                              'gasto',  '513535', '236525'),
  ('Mantenimiento y reparaciones', 'Reparación de equipos y locativas',                          'gasto',  '514525', '236525'),
  ('Papelería y útiles',           'Papelería, útiles de oficina, fotocopias',                   'gasto',  '519530', '236540'),
  ('Aseo y cafetería',             'Elementos de aseo y cafetería',                              'gasto',  '519525', '236540'),
  ('Gastos legales y trámites',    'Cámara de comercio, notarías, registros',                    'gasto',  '514010', null),
  ('Gastos bancarios',             'Cuotas de manejo, comisiones bancarias, 4x1000',             'gasto',  '530505', null),
  ('Impuestos y contribuciones',   'Impuestos no descontables, contribuciones',                  'gasto',  '511595', null),
  ('Nómina',                       'Sueldos y pagos laborales',                                  'gasto',  '510506', '236505'),
  ('Otros gastos',                 'Gastos que no encajan en otra categoría',                    'gasto',  '519595', '236570'),
  ('Venta de mercancía',           'Ventas de productos',                                        'venta',  '413501', null)
) as v (nombre, descripcion, tipo, cuenta, retefuente)
join contabilidad.cuentas c on c.codigo = v.cuenta
left join contabilidad.cuentas r on r.codigo = v.retefuente;

-- ---------------------------------------------------------------------
-- Configuración inicial
-- ---------------------------------------------------------------------
insert into contabilidad.configuracion (clave, valor, descripcion) values
  ('umbral_confianza', '0.85'::jsonb,
   'Confianza mínima de la IA (0 a 1) para aprobar automáticamente'),
  ('auto_aprobacion', 'true'::jsonb,
   'Si es true, las facturas que pasan todas las validaciones se aprueban y contabilizan solas'),
  ('tolerancia_redondeo', '{"COP": 10, "USD": 0.05, "default": 0.05}'::jsonb,
   'Diferencia máxima aceptada al verificar que los montos cuadran, por moneda'),
  ('cuentas_asientos', '{
     "iva_descontable": "240810",
     "iva_generado": "240805",
     "otros_impuestos_por_pagar": "249595",
     "retefuente_por_pagar": "236570",
     "reteica_por_pagar": "236801",
     "proveedores_nacionales": "220505",
     "proveedores_exterior": "221005",
     "cuentas_por_pagar_nacionales": "233595",
     "cuentas_por_pagar_exterior": "233595",
     "clientes_nacionales": "130505",
     "clientes_exterior": "130510",
     "retefuente_a_favor": "135515",
     "reteica_a_favor": "135518"
   }'::jsonb,
   'Cuentas puente usadas al generar asientos automáticamente');
