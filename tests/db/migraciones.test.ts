// Aplica las migraciones reales sobre un Postgres embebido (PGlite) con un
// stub mínimo de lo que provee Supabase (roles y auth.jwt()).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { cuentasDesdeConfig, generarAsiento } from "@/modules/contabilidad/core";

const MIGRACIONES = join(__dirname, "..", "..", "supabase", "migrations");

const STUB_SUPABASE = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create function auth.jwt() returns jsonb language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
  $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.jwt() to anon, authenticated, service_role;
`;

let db: PGlite;

async function comoUsuario<T>(email: string | null, fn: () => Promise<T>): Promise<T> {
  const claims = email ? JSON.stringify({ email }) : "";
  await db.exec(`set role authenticated; select set_config('request.jwt.claims', '${claims}', false);`);
  try {
    return await fn();
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claims', '', false);`);
  }
}

async function crearFacturaPendiente(numero: string, terceroId: number, cuentaCodigo: string): Promise<number> {
  const r = await db.query<{ id: number }>(
    `insert into contabilidad.facturas
       (tipo, numero, fecha_emision, tercero_id, subtotal, iva, retefuente, reteica, total, cuenta_id, estado)
     values ('gasto', $1, '2026-03-15', $2, 1000000, 190000, 40000, 9660, 1190000,
             (select id from contabilidad.cuentas where codigo = $3), 'pendiente_revision')
     returning id`,
    [numero, terceroId, cuentaCodigo],
  );
  return r.rows[0].id;
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(STUB_SUPABASE);
  const archivos = readdirSync(MIGRACIONES).filter((f) => f.endsWith(".sql")).sort();
  for (const archivo of archivos) {
    await db.exec(readFileSync(join(MIGRACIONES, archivo), "utf8"));
  }
  await db.exec(`
    insert into contabilidad.usuarios (email, rol) values
      ('admin@pagurocorp.com', 'admin'),
      ('lector@pagurocorp.com', 'lector');
    insert into contabilidad.terceros (nit, dv, razon_social) values ('890903938', '8', 'Agencia X SAS');
  `);
});

describe("migraciones", () => {
  it("cargan el plan de cuentas con jerarquía y las categorías", async () => {
    const cuentas = await db.query<{ total: number; sin_padre: number; movimiento: number }>(`
      select count(*)::int as total,
             count(*) filter (where padre_id is null and length(codigo) > 1)::int as sin_padre,
             count(*) filter (where acepta_movimiento)::int as movimiento
      from contabilidad.cuentas`);
    expect(cuentas.rows[0].total).toBeGreaterThan(100);
    expect(cuentas.rows[0].sin_padre).toBe(0);
    expect(cuentas.rows[0].movimiento).toBeGreaterThan(50);

    const categorias = await db.query(`select * from contabilidad.categorias`);
    expect(categorias.rows).toHaveLength(19);
  });

  it("la configuración de cuentas de la semilla es válida y sus cuentas existen", async () => {
    const r = await db.query<{ valor: Record<string, string> }>(
      `select valor from contabilidad.configuracion where clave = 'cuentas_asientos'`,
    );
    const config = r.rows[0].valor;
    expect(() => cuentasDesdeConfig(config)).not.toThrow();

    const existentes = await db.query<{ codigo: string }>(
      `select codigo from contabilidad.cuentas where acepta_movimiento and codigo = any($1)`,
      [Object.values(config)],
    );
    expect(new Set(existentes.rows.map((c) => c.codigo))).toEqual(new Set(Object.values(config)));
  });
});

describe("partida doble", () => {
  it("registrar_asiento_factura guarda el asiento generado por core y aprueba la factura", async () => {
    const facturaId = await crearFacturaPendiente("FE-1", 1, "523560");
    const config = (await db.query<{ valor: Record<string, string> }>(
      `select valor from contabilidad.configuracion where clave = 'cuentas_asientos'`,
    )).rows[0].valor;

    const asiento = generarAsiento(
      {
        tipo: "gasto",
        numero: "FE-1",
        fecha: "2026-03-15",
        terceroNombre: "Agencia X SAS",
        terceroExterior: false,
        moneda: "COP",
        tasaCambio: 1,
        montos: { subtotal: 1_000_000, iva: 190_000, otrosImpuestos: null, retefuente: 40_000, reteica: 9_660, total: 1_190_000 },
        cuentaPrincipal: "523560",
        cuentaRetefuente: "236525",
      },
      cuentasDesdeConfig(config),
    );
    const lineas = asiento.lineas.map((l) => ({ ...l, tercero_id: 1 }));

    await db.query(`select contabilidad.registrar_asiento_factura($1, $2, $3, $4, $5)`, [
      facturaId, asiento.fecha, asiento.descripcion, JSON.stringify(lineas), "admin@pagurocorp.com",
    ]);

    const f = await db.query<{ estado: string }>(`select estado from contabilidad.facturas where id = $1`, [facturaId]);
    expect(f.rows[0].estado).toBe("aprobada");

    const totales = await db.query<{ d: string; c: string }>(`
      select sum(debito)::text as d, sum(credito)::text as c
      from contabilidad.asiento_lineas l join contabilidad.asientos a on a.id = l.asiento_id
      where a.factura_id = $1`, [facturaId]);
    expect(totales.rows[0]).toEqual({ d: "1190000.00", c: "1190000.00" });
  });

  it("volver a registrar reemplaza el asiento anterior", async () => {
    const r = await db.query<{ n: number }>(`select count(*)::int as n from contabilidad.asientos`);
    const facturaId = (await db.query<{ id: number }>(`select id from contabilidad.facturas where numero = 'FE-1'`)).rows[0].id;
    await db.query(`select contabilidad.registrar_asiento_factura($1, '2026-03-15', 'x', $2, 'admin')`, [
      facturaId,
      JSON.stringify([
        { cuenta: "523560", debito: 1190000, credito: 0 },
        { cuenta: "233595", debito: 0, credito: 1190000 },
      ]),
    ]);
    const despues = await db.query<{ n: number }>(`select count(*)::int as n from contabilidad.asientos`);
    expect(despues.rows[0].n).toBe(r.rows[0].n);
  });

  it("rechaza un asiento descuadrado al confirmar la transacción", async () => {
    await expect(
      db.exec(`
        begin;
        insert into contabilidad.asientos (fecha, descripcion, origen) values ('2026-03-01', 'descuadrado', 'manual');
        insert into contabilidad.asiento_lineas (asiento_id, cuenta_id, debito, credito)
        select currval(pg_get_serial_sequence('contabilidad.asientos', 'id')), id, 100, 0
        from contabilidad.cuentas where codigo = '110505';
        commit;`),
    ).rejects.toThrow(/no cuadra/);
    await db.exec("rollback").catch(() => {});
    const r = await db.query(`select * from contabilidad.asientos where descripcion = 'descuadrado'`);
    expect(r.rows).toHaveLength(0);
  });

  it("rechaza movimientos en cuentas que no son auxiliares", async () => {
    const facturaId = await crearFacturaPendiente("FE-2", 1, "523560");
    await expect(
      db.query(`select contabilidad.registrar_asiento_factura($1, '2026-03-15', 'x', $2, 'admin')`, [
        facturaId,
        JSON.stringify([
          { cuenta: "5235", debito: 100, credito: 0 },
          { cuenta: "233595", debito: 0, credito: 100 },
        ]),
      ]),
    ).rejects.toThrow(/no acepta movimientos/);
  });

  it("rechaza cuentas inexistentes", async () => {
    const facturaId = (await db.query<{ id: number }>(`select id from contabilidad.facturas where numero = 'FE-2'`)).rows[0].id;
    await expect(
      db.query(`select contabilidad.registrar_asiento_factura($1, '2026-03-15', 'x', $2, 'admin')`, [
        facturaId,
        JSON.stringify([
          { cuenta: "999999", debito: 100, credito: 0 },
          { cuenta: "233595", debito: 0, credito: 100 },
        ]),
      ]),
    ).rejects.toThrow(/no existen/);
  });

  it("cambiar_estado_factura elimina el asiento al rechazar", async () => {
    const facturaId = (await db.query<{ id: number }>(`select id from contabilidad.facturas where numero = 'FE-1'`)).rows[0].id;
    await db.query(`select contabilidad.cambiar_estado_factura($1, 'rechazada', 'prueba')`, [facturaId]);
    const a = await db.query(`select * from contabilidad.asientos where factura_id = $1`, [facturaId]);
    expect(a.rows).toHaveLength(0);

    // Se vuelve a aprobar para los reportes siguientes
    await db.query(`select contabilidad.registrar_asiento_factura($1, '2026-03-15', 'Gasto FE-1', $2, 'admin')`, [
      facturaId,
      JSON.stringify([
        { cuenta: "523560", debito: 1000000, credito: 0, tercero_id: 1 },
        { cuenta: "240810", debito: 190000, credito: 0 },
        { cuenta: "236525", debito: 0, credito: 40000 },
        { cuenta: "236801", debito: 0, credito: 9660 },
        { cuenta: "233595", debito: 0, credito: 1140340, tercero_id: 1 },
      ]),
    ]);
  });
});

describe("reportes", () => {
  it("estado de resultados mensual", async () => {
    const r = await db.query<{ periodo: string; gastos: string; utilidad: string }>(
      `select periodo::text, gastos::text, utilidad::text from contabilidad.v_resultado_mensual`,
    );
    expect(r.rows).toEqual([{ periodo: "2026-03-01", gastos: "1000000.00", utilidad: "-1000000.00" }]);
  });

  it("balance general cuadra: activo = pasivo + patrimonio", async () => {
    await db.exec(`
      insert into contabilidad.saldos_iniciales (cuenta_id, fecha_corte, debito, credito)
      select id, date '2026-01-01', 5000000, 0 from contabilidad.cuentas where codigo = '111005'
      union all
      select id, date '2026-01-01', 0, 5000000 from contabilidad.cuentas where codigo = '310505';
    `);
    const r = await db.query<{ seccion: string; total: string }>(`
      select seccion, sum(saldo)::text as total
      from contabilidad.balance_general('2026-12-31') group by seccion order by seccion`);
    const total = Object.fromEntries(r.rows.map((x) => [x.seccion, Number(x.total)]));
    expect(total.activo).toBe(5_000_000);
    // pasivo: IVA descontable resta (−190.000), retenciones y CxP suman
    expect(total.pasivo).toBe(-190_000 + 40_000 + 9_660 + 1_140_340);
    expect(total.activo).toBe(total.pasivo + total.patrimonio);
  });

  it("balance de comprobación por rango", async () => {
    const r = await db.query<{ cuenta_codigo: string; saldo_anterior: string; saldo_final: string }>(
      `select cuenta_codigo, saldo_anterior::text, saldo_final::text
       from contabilidad.balance_comprobacion('2026-03-01', '2026-03-31') where cuenta_codigo in ('111005', '523560')`,
    );
    expect(r.rows).toEqual([
      { cuenta_codigo: "111005", saldo_anterior: "5000000.00", saldo_final: "5000000.00" },
      { cuenta_codigo: "523560", saldo_anterior: "0.00", saldo_final: "1000000.00" },
    ]);
  });

  it("libro mayor, impuestos, gastos y cuentas por pagar", async () => {
    const mayor = await db.query<{ saldo: string }>(
      `select saldo::text from contabilidad.v_libro_mayor where cuenta_codigo = '233595' order by fecha`,
    );
    expect(mayor.rows.at(-1)?.saldo).toBe("1140340.00");

    const imp = await db.query<{ iva_descontable: string; retefuente_practicada: string }>(
      `select iva_descontable::text, retefuente_practicada::text from contabilidad.v_impuestos_periodo`,
    );
    expect(imp.rows[0]).toEqual({ iva_descontable: "190000.00", retefuente_practicada: "40000.00" });

    const prov = await db.query<{ razon_social: string; total_cop: string }>(
      `select razon_social, total_cop::text from contabilidad.v_gastos_proveedor`,
    );
    expect(prov.rows).toEqual([{ razon_social: "Agencia X SAS", total_cop: "1190000.00" }]);

    const cxp = await db.query<{ saldo_cop: string }>(`select saldo_cop::text from contabilidad.v_cuentas_por_pagar`);
    expect(cxp.rows[0].saldo_cop).toBe("1140340.00");

    const saldos = await db.query<{ cargados: boolean; cuadran: boolean }>(
      `select cargados, cuadran from contabilidad.v_estado_saldos_iniciales`,
    );
    expect(saldos.rows[0]).toEqual({ cargados: true, cuadran: true });
  });
});

describe("consumo de IA", () => {
  it("suma tokens por mes y modelo y cuenta los errores por falta de créditos", async () => {
    await db.exec(`
      insert into contabilidad.archivos_drive (drive_file_id, nombre, mime, estado, error_codigo)
      values ('drv-1', 'a.pdf', 'application/pdf', 'error', 'sin_creditos');
      insert into contabilidad.procesamientos (archivo_id, estado, metodo, modelo, tokens_entrada, tokens_salida, error_codigo, reintentable, creado_en)
      select id, 'exito', 'ia', 'modelo-x', 3000, 500, null::text, null::boolean, timestamptz '2026-11-02' from contabilidad.archivos_drive where drive_file_id = 'drv-1'
      union all
      select id, 'exito', 'ia', 'modelo-x', 2000, 300, null, null, '2026-11-03' from contabilidad.archivos_drive where drive_file_id = 'drv-1'
      union all
      select id, 'error', 'ia', 'modelo-x', null, null, 'sin_creditos', true, '2026-11-04' from contabilidad.archivos_drive where drive_file_id = 'drv-1';
    `);
    const r = await db.query<Record<string, unknown>>(`
      select periodo::text, modelo, intentos::int, exitos::int, errores_sin_creditos::int,
             tokens_total::int, tokens_promedio_por_factura::int
      from contabilidad.v_consumo_ia_mensual`);
    expect(r.rows).toEqual([
      {
        periodo: "2026-11-01",
        modelo: "modelo-x",
        intentos: 3,
        exitos: 2,
        errores_sin_creditos: 1,
        tokens_total: 5800,
        tokens_promedio_por_factura: 2900,
      },
    ]);
  });
});

describe("seguridad (RLS)", () => {
  it("un usuario no registrado no ve nada", async () => {
    const r = await comoUsuario("intruso@gmail.com", () => db.query(`select * from contabilidad.facturas`));
    expect(r.rows).toHaveLength(0);
    const v = await comoUsuario("intruso@gmail.com", () => db.query(`select * from contabilidad.v_resultado_mensual`));
    expect(v.rows).toHaveLength(0);
  });

  it("un lector ve los datos y los reportes, pero no puede modificarlos", async () => {
    const r = await comoUsuario("lector@pagurocorp.com", () => db.query(`select * from contabilidad.facturas`));
    expect(r.rows.length).toBeGreaterThan(0);
    const v = await comoUsuario("lector@pagurocorp.com", () => db.query(`select * from contabilidad.v_resultado_mensual`));
    expect(v.rows).toHaveLength(1);

    const actualizadas = await comoUsuario("lector@pagurocorp.com", () =>
      db.query(`update contabilidad.facturas set observaciones = 'hack'`),
    );
    expect(actualizadas.affectedRows).toBe(0);
  });

  it("solo un admin cambia la configuración", async () => {
    await comoUsuario("lector@pagurocorp.com", () =>
      db.query(`update contabilidad.configuracion set valor = 'false' where clave = 'auto_aprobacion'`),
    );
    await comoUsuario("admin@pagurocorp.com", () =>
      db.query(`update contabilidad.configuracion set valor = '0.9' where clave = 'umbral_confianza'`),
    );
    const r = await db.query<{ clave: string; valor: unknown }>(
      `select clave, valor from contabilidad.configuracion where clave in ('auto_aprobacion', 'umbral_confianza') order by clave`,
    );
    expect(r.rows).toEqual([
      { clave: "auto_aprobacion", valor: true },
      { clave: "umbral_confianza", valor: 0.9 },
    ]);
  });

  it("anon no tiene acceso al schema", async () => {
    await db.exec(`set role anon`);
    await expect(db.query(`select * from contabilidad.facturas`)).rejects.toThrow(/permission denied/);
    await db.exec(`reset role`);
  });
});
