-- =====================================================================
-- Módulo de contabilidad · Esquema y tablas
-- Todo vive en el schema `contabilidad` para poder migrarlo como bloque.
-- Se usan columnas text + CHECK en vez de ENUM para facilitar la portabilidad.
-- =====================================================================

create schema if not exists contabilidad;

create or replace function contabilidad.tocar_actualizado_en()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.actualizado_en := now();
  return new;
end
$$;

-- ---------------------------------------------------------------------
-- Usuarios autorizados (personal de la empresa) y su rol en el módulo.
-- Se identifican por email para no depender de la tabla de auth del proveedor.
-- ---------------------------------------------------------------------
create table contabilidad.usuarios (
  email       text primary key check (email = lower(email)),
  nombre      text,
  rol         text not null default 'lector' check (rol in ('admin', 'editor', 'lector')),
  activo      boolean not null default true,
  creado_en   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Configuración clave/valor (umbral de confianza, auto-aprobación,
-- cuentas puente para asientos, tolerancias, etc.)
-- ---------------------------------------------------------------------
create table contabilidad.configuracion (
  clave           text primary key,
  valor           jsonb not null,
  descripcion     text,
  actualizado_en  timestamptz not null default now()
);

create trigger configuracion_actualizado_en
  before update on contabilidad.configuracion
  for each row execute function contabilidad.tocar_actualizado_en();

-- ---------------------------------------------------------------------
-- Plan de cuentas (PUC colombiano)
-- ---------------------------------------------------------------------
create table contabilidad.cuentas (
  id                 bigint generated always as identity primary key,
  codigo             text not null unique check (codigo ~ '^[0-9]{1,10}$'),
  nombre             text not null,
  naturaleza         text not null check (naturaleza in ('debito', 'credito')),
  tipo               text not null check (tipo in ('activo', 'pasivo', 'patrimonio', 'ingreso', 'gasto', 'costo')),
  padre_id           bigint references contabilidad.cuentas (id),
  acepta_movimiento  boolean not null default true,
  activa             boolean not null default true,
  creado_en          timestamptz not null default now()
);

create index cuentas_padre_idx on contabilidad.cuentas (padre_id);

-- ---------------------------------------------------------------------
-- Categorías de negocio, cada una con su cuenta contable por defecto
-- ---------------------------------------------------------------------
create table contabilidad.categorias (
  id                    bigint generated always as identity primary key,
  nombre                text not null unique,
  descripcion           text,
  tipo_factura          text not null check (tipo_factura in ('compra', 'gasto', 'venta')),
  cuenta_id             bigint not null references contabilidad.cuentas (id),
  -- Cuenta de retención en la fuente propia de la categoría (honorarios, servicios, arriendos…).
  -- Si es null se usa la cuenta configurada por defecto.
  cuenta_retefuente_id  bigint references contabilidad.cuentas (id),
  activa                boolean not null default true,
  creado_en             timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Terceros: proveedores y clientes
-- `nit` va normalizado: solo dígitos y sin DV para Colombia;
-- identificador tributario en mayúsculas sin separadores para el exterior.
-- ---------------------------------------------------------------------
create table contabilidad.terceros (
  id              bigint generated always as identity primary key,
  nit             text not null unique check (nit ~ '^[0-9A-Z]+$'),
  dv              text check (dv ~ '^[0-9]$'),
  razon_social    text not null,
  tipo            text not null default 'proveedor' check (tipo in ('proveedor', 'cliente', 'ambos')),
  pais            text not null default 'CO' check (pais ~ '^[A-Z]{2}$'),
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now()
);

create trigger terceros_actualizado_en
  before update on contabilidad.terceros
  for each row execute function contabilidad.tocar_actualizado_en();

-- ---------------------------------------------------------------------
-- Inventario de archivos del Drive (paso 1 de la sincronización, sin IA)
-- ---------------------------------------------------------------------
create table contabilidad.archivos_drive (
  id                bigint generated always as identity primary key,
  drive_file_id     text not null unique,
  nombre            text not null,
  ruta              text not null default '',   -- carpetas desde la raíz, separadas por '/'
  mime              text not null,
  md5               text,
  tamano_bytes      bigint,
  modificado_drive  timestamptz,
  drive_url         text,
  anio_carpeta      smallint,
  mes_carpeta       smallint check (mes_carpeta between 1 and 12),
  estado            text not null default 'pendiente'
                    check (estado in ('pendiente', 'procesando', 'procesado', 'error', 'ignorado')),
  md5_procesado     text,                       -- md5 con el que se procesó por última vez
  intentos          integer not null default 0,
  ultimo_error      text,
  factura_id        bigint,                     -- FK agregada después de crear facturas
  visto_en          timestamptz not null default now(),
  creado_en         timestamptz not null default now(),
  actualizado_en    timestamptz not null default now()
);

create index archivos_drive_estado_idx on contabilidad.archivos_drive (estado);
create index archivos_drive_md5_idx on contabilidad.archivos_drive (md5);

create trigger archivos_drive_actualizado_en
  before update on contabilidad.archivos_drive
  for each row execute function contabilidad.tocar_actualizado_en();

-- ---------------------------------------------------------------------
-- Facturas
-- ---------------------------------------------------------------------
create table contabilidad.facturas (
  id                 bigint generated always as identity primary key,
  tipo               text check (tipo in ('compra', 'venta', 'gasto')),  -- null si no se pudo determinar
  tipo_documento     text,
  numero             text,
  cufe               text,
  fecha_emision      date,
  fecha_vencimiento  date,
  tercero_id         bigint references contabilidad.terceros (id),
  moneda             text not null default 'COP' check (moneda ~ '^[A-Z]{3}$'),
  tasa_cambio        numeric(14, 4) not null default 1 check (tasa_cambio > 0),  -- a COP
  subtotal           numeric(18, 2),
  iva                numeric(18, 2) not null default 0,
  iva_tasa           numeric(5, 2),
  retefuente         numeric(18, 2) not null default 0,
  reteica            numeric(18, 2) not null default 0,
  otros_impuestos    numeric(18, 2) not null default 0,
  total              numeric(18, 2),
  categoria_id       bigint references contabilidad.categorias (id),
  cuenta_id          bigint references contabilidad.cuentas (id),
  estado             text not null default 'pendiente_revision'
                     check (estado in ('pendiente_revision', 'aprobada', 'rechazada', 'error', 'descartada')),
  confianza          numeric(4, 3) check (confianza between 0 and 1),
  confianza_campos   jsonb not null default '{}'::jsonb,
  hallazgos          jsonb not null default '[]'::jsonb,   -- errores y advertencias de validación
  archivo_id         bigint references contabilidad.archivos_drive (id) on delete set null,
  drive_file_id      text,
  drive_url          text,
  drive_md5          text,
  carpeta_origen     text,
  datos_ia           jsonb,                                -- respuesta cruda del modelo
  observaciones      text,
  aprobada_por       text,
  aprobada_en        timestamptz,
  creado_en          timestamptz not null default now(),
  actualizado_en     timestamptz not null default now(),

  constraint facturas_tercero_numero_unico unique (tercero_id, numero),
  constraint facturas_montos_no_negativos check (
    coalesce(subtotal, 0) >= 0 and iva >= 0 and retefuente >= 0
    and reteica >= 0 and otros_impuestos >= 0 and coalesce(total, 0) >= 0
  ),
  constraint facturas_aprobada_completa check (
    estado <> 'aprobada' or (
      tipo is not null and numero is not null and fecha_emision is not null
      and tercero_id is not null and subtotal is not null and total is not null
      and cuenta_id is not null
    )
  )
);

create unique index facturas_drive_md5_unico on contabilidad.facturas (drive_md5) where drive_md5 is not null;
create index facturas_fecha_idx on contabilidad.facturas (fecha_emision);
create index facturas_estado_idx on contabilidad.facturas (estado);
create index facturas_tipo_idx on contabilidad.facturas (tipo);
create index facturas_tercero_idx on contabilidad.facturas (tercero_id);
create index facturas_categoria_idx on contabilidad.facturas (categoria_id);

create trigger facturas_actualizado_en
  before update on contabilidad.facturas
  for each row execute function contabilidad.tocar_actualizado_en();

alter table contabilidad.archivos_drive
  add constraint archivos_drive_factura_fk
  foreign key (factura_id) references contabilidad.facturas (id) on delete set null;

create table contabilidad.factura_items (
  id              bigint generated always as identity primary key,
  factura_id      bigint not null references contabilidad.facturas (id) on delete cascade,
  linea           smallint not null,
  descripcion     text not null,
  cantidad        numeric(18, 4),
  valor_unitario  numeric(18, 2),
  iva_tasa        numeric(5, 2),
  iva_valor       numeric(18, 2),
  total           numeric(18, 2)
);

create index factura_items_factura_idx on contabilidad.factura_items (factura_id);

-- ---------------------------------------------------------------------
-- Asientos contables (partida doble)
-- ---------------------------------------------------------------------
create table contabilidad.asientos (
  id           bigint generated always as identity primary key,
  fecha        date not null,
  descripcion  text not null,
  origen       text not null default 'factura' check (origen in ('factura', 'manual')),
  factura_id   bigint unique references contabilidad.facturas (id) on delete restrict,
  creado_por   text,
  creado_en    timestamptz not null default now(),
  constraint asientos_factura_requerida check (origen <> 'factura' or factura_id is not null)
);

create index asientos_fecha_idx on contabilidad.asientos (fecha);

create table contabilidad.asiento_lineas (
  id           bigint generated always as identity primary key,
  asiento_id   bigint not null references contabilidad.asientos (id) on delete cascade,
  cuenta_id    bigint not null references contabilidad.cuentas (id),
  tercero_id   bigint references contabilidad.terceros (id),
  descripcion  text,
  debito       numeric(18, 2) not null default 0,
  credito      numeric(18, 2) not null default 0,
  constraint asiento_lineas_no_negativos check (debito >= 0 and credito >= 0),
  constraint asiento_lineas_un_lado check ((debito = 0) <> (credito = 0))
);

create index asiento_lineas_asiento_idx on contabilidad.asiento_lineas (asiento_id);
create index asiento_lineas_cuenta_idx on contabilidad.asiento_lineas (cuenta_id);

-- Solo se puede mover una cuenta activa y de movimiento (auxiliar).
create or replace function contabilidad.validar_cuenta_movimiento()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from contabilidad.cuentas c
    where c.id = new.cuenta_id and c.acepta_movimiento and c.activa
  ) then
    raise exception 'La cuenta % no acepta movimientos o está inactiva', new.cuenta_id;
  end if;
  return new;
end
$$;

create trigger asiento_lineas_cuenta_movimiento
  before insert or update of cuenta_id on contabilidad.asiento_lineas
  for each row execute function contabilidad.validar_cuenta_movimiento();

-- Débitos = créditos por asiento. Se verifica al final de la transacción
-- para poder insertar todas las líneas antes de validar.
create or replace function contabilidad.verificar_partida_doble()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_asiento   bigint;
  v_debitos   numeric;
  v_creditos  numeric;
begin
  if tg_op = 'DELETE' then
    v_asiento := old.asiento_id;
  else
    v_asiento := new.asiento_id;
  end if;

  -- Si el asiento completo se eliminó, no hay nada que verificar.
  if not exists (select 1 from contabilidad.asientos where id = v_asiento) then
    return null;
  end if;

  select coalesce(sum(debito), 0), coalesce(sum(credito), 0)
    into v_debitos, v_creditos
  from contabilidad.asiento_lineas
  where asiento_id = v_asiento;

  if v_debitos <> v_creditos then
    raise exception 'El asiento % no cuadra: débitos % <> créditos %', v_asiento, v_debitos, v_creditos;
  end if;

  return null;
end
$$;

create constraint trigger asiento_lineas_partida_doble
  after insert or update or delete on contabilidad.asiento_lineas
  deferrable initially deferred
  for each row execute function contabilidad.verificar_partida_doble();

-- ---------------------------------------------------------------------
-- Historial de correcciones humanas sobre los datos de la IA
-- ---------------------------------------------------------------------
create table contabilidad.revisiones (
  id               bigint generated always as identity primary key,
  factura_id       bigint not null references contabilidad.facturas (id) on delete cascade,
  campo            text not null,
  valor_ia         jsonb,
  valor_corregido  jsonb,
  usuario          text,
  creado_en        timestamptz not null default now()
);

create index revisiones_factura_idx on contabilidad.revisiones (factura_id);

-- ---------------------------------------------------------------------
-- Log de cada intento de procesamiento
-- ---------------------------------------------------------------------
create table contabilidad.procesamientos (
  id              bigint generated always as identity primary key,
  archivo_id      bigint references contabilidad.archivos_drive (id) on delete cascade,
  factura_id      bigint references contabilidad.facturas (id) on delete set null,
  estado          text not null check (estado in ('exito', 'error', 'omitido')),
  metodo          text check (metodo in ('ia', 'xml')),
  modelo          text,
  error           text,
  duracion_ms     integer,
  tokens_entrada  integer,
  tokens_salida   integer,
  costo_usd       numeric(10, 5),
  creado_en       timestamptz not null default now()
);

create index procesamientos_archivo_idx on contabilidad.procesamientos (archivo_id);
create index procesamientos_creado_idx on contabilidad.procesamientos (creado_en);

-- ---------------------------------------------------------------------
-- Saldos de apertura por cuenta (y opcionalmente por tercero)
-- ---------------------------------------------------------------------
create table contabilidad.saldos_iniciales (
  id           bigint generated always as identity primary key,
  cuenta_id    bigint not null references contabilidad.cuentas (id),
  tercero_id   bigint references contabilidad.terceros (id),
  fecha_corte  date not null,
  debito       numeric(18, 2) not null default 0 check (debito >= 0),
  credito      numeric(18, 2) not null default 0 check (credito >= 0),
  creado_en    timestamptz not null default now(),
  constraint saldos_iniciales_unico unique nulls not distinct (cuenta_id, tercero_id, fecha_corte)
);
