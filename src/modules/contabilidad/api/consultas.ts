import { exigir, type BaseDatos } from "../repo/supabase";

// Consultas de lectura que usan la interfaz y los endpoints. Reciben el
// cliente de la sesión del usuario: RLS decide qué puede ver.

export interface FiltrosDocumentos {
  mes?: string; // YYYY-MM
  /** Rango de fechas de emisión (YYYY-MM-DD), lo usan los enlaces desde los reportes. */
  desde?: string;
  hasta?: string;
  clase?: string;
  estado?: string;
  categoria?: number;
  texto?: string;
  pagina?: number;
  porPagina?: number;
}

const COLUMNAS_LISTA =
  "id, estado, tipo, clase_documento, tipo_documento, numero, fecha_emision, moneda, total, tasa_cambio, confianza, drive_url, drive_file_id, terceros(id, nit, razon_social), categorias(id, nombre), archivos_drive!facturas_archivo_id_fkey(nombre)";

export async function listarDocumentos(db: BaseDatos, f: FiltrosDocumentos) {
  const porPagina = Math.min(Math.max(f.porPagina ?? 50, 1), 200);
  const pagina = Math.max(f.pagina ?? 1, 1);
  let q = db.from("facturas").select(COLUMNAS_LISTA, { count: "exact" });

  if (f.mes && /^\d{4}-\d{2}$/.test(f.mes)) {
    const [a, m] = f.mes.split("-").map(Number);
    const fin = new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
    q = q.gte("fecha_emision", `${f.mes}-01`).lte("fecha_emision", fin);
  }
  const esFecha = (x?: string): x is string => !!x && /^d{4}-d{2}-d{2}$/.test(x);
  if (esFecha(f.desde)) q = q.gte("fecha_emision", f.desde);
  if (esFecha(f.hasta)) q = q.lte("fecha_emision", f.hasta);
  if (f.clase) q = q.eq("clase_documento", f.clase);
  if (f.estado) q = q.eq("estado", f.estado);
  if (f.categoria) q = q.eq("categoria_id", f.categoria);
  if (f.texto?.trim()) {
    const t = f.texto.trim().replace(/[%,()]/g, " ");
    const { data: terceros } = await db.from("terceros").select("id").or(`razon_social.ilike.%${t}%,nit.ilike.%${t}%`).limit(100);
    const ids = (terceros ?? []).map((x) => x.id);
    q = q.or([`numero.ilike.%${t}%`, `observaciones.ilike.%${t}%`, ids.length ? `tercero_id.in.(${ids.join(",")})` : null].filter(Boolean).join(","));
  }

  const desde = (pagina - 1) * porPagina;
  const r = await q
    .order("fecha_emision", { ascending: false, nullsFirst: false })
    .order("id", { ascending: false })
    .range(desde, desde + porPagina - 1);
  if (r.error) throw new Error(r.error.message);
  return { filas: r.data, total: r.count ?? 0, pagina, porPagina };
}

export type DocumentoLista = Awaited<ReturnType<typeof listarDocumentos>>["filas"][number];

export async function obtenerDocumento(db: BaseDatos, id: number) {
  const r = await db
    .from("facturas")
    .select("*, terceros(id, nit, dv, razon_social, pais), categorias(id, nombre), cuentas(id, codigo, nombre), archivos_drive!facturas_archivo_id_fkey(nombre, ruta, mime)")
    .eq("id", id)
    .maybeSingle();
  if (r.error) throw new Error(r.error.message);
  if (!r.data) return null;

  const [items, asiento, revisiones] = await Promise.all([
    db.from("factura_items").select("*").eq("factura_id", id).order("linea"),
    db.from("asientos").select("id, fecha, descripcion, creado_por, creado_en, asiento_lineas(id, debito, credito, descripcion, cuentas(codigo, nombre))").eq("factura_id", id).maybeSingle(),
    db.from("revisiones").select("*").eq("factura_id", id).order("creado_en", { ascending: false }),
  ]);
  return { ...r.data, items: items.data ?? [], asiento: asiento.data, revisiones: revisiones.data ?? [] };
}

export type Documento = NonNullable<Awaited<ReturnType<typeof obtenerDocumento>>>;

/** Datos para el panel de inicio. `mes` en formato YYYY-MM. */
export async function indicadoresInicio(db: BaseDatos, mes: string) {
  const inicioMes = `${mes}-01`;
  const [a, m] = mes.split("-").map(Number);
  const hace12 = new Date(Date.UTC(a, m - 12, 1)).toISOString().slice(0, 10);

  const [resultado, cuentasMes, pendientes, cola, saldos] = await Promise.all([
    db.from("v_resultado_mensual").select("*").gte("periodo", hace12).lte("periodo", inicioMes).order("periodo"),
    db.from("v_estado_resultados").select("cuenta_codigo, cuenta_nombre, tipo, valor").eq("periodo", inicioMes).in("tipo", ["gasto", "costo"]),
    db.from("facturas").select("id", { count: "exact", head: true }).eq("estado", "pendiente_revision"),
    db.from("v_estado_archivos").select("*"),
    db.from("v_estado_saldos_iniciales").select("*").maybeSingle(),
  ]);

  const meses = exigir(resultado, "Leyendo resultados");
  // Serie de 12 meses completa (los meses sin movimiento van en cero)
  const tendencia = Array.from({ length: 12 }, (_, i) => {
    const periodo = new Date(Date.UTC(a, m - 12 + i, 1)).toISOString().slice(0, 10);
    const fila = meses.find((x) => x.periodo === periodo);
    return {
      periodo,
      ingresos: Number(fila?.ingresos ?? 0),
      gastos: Number(fila?.gastos ?? 0) + Number(fila?.costos ?? 0),
      utilidad: Number(fila?.utilidad ?? 0),
    };
  });
  const actual = tendencia[tendencia.length - 1];

  const gastosPorCuenta = new Map<string, number>();
  for (const c of exigir(cuentasMes, "Leyendo gastos del mes")) {
    const clave = c.cuenta_nombre ?? c.cuenta_codigo ?? "—";
    gastosPorCuenta.set(clave, (gastosPorCuenta.get(clave) ?? 0) + Number(c.valor ?? 0));
  }

  const archivos = cola.data ?? [];
  return {
    mes,
    ingresos: actual.ingresos,
    gastos: actual.gastos,
    utilidad: actual.utilidad,
    pendientes: pendientes.count ?? 0,
    archivosConError: archivos.filter((x) => x.estado === "error").reduce((s, x) => s + Number(x.cantidad ?? 0), 0),
    archivosPendientes: archivos.filter((x) => x.estado === "pendiente").reduce((s, x) => s + Number(x.cantidad ?? 0), 0),
    tendencia,
    gastosPorCuenta: [...gastosPorCuenta]
      .map(([cuenta, valor]) => ({ cuenta, valor }))
      .filter((g) => g.valor !== 0)
      .sort((x, y) => y.valor - x.valor),
    saldosIniciales: saldos.data,
  };
}

/** Último mes con documentos aprobados (para abrir el panel en un mes con datos). */
export async function ultimoMesConDatos(db: BaseDatos): Promise<string> {
  const { data } = await db.from("v_resultado_mensual").select("periodo").order("periodo", { ascending: false }).limit(1).maybeSingle();
  return data?.periodo?.slice(0, 7) ?? new Date().toISOString().slice(0, 7);
}

export async function opcionesFiltros(db: BaseDatos) {
  const { data } = await db.from("categorias").select("id, nombre").order("nombre");
  return { categorias: data ?? [] };
}

/** Estado de la conexión con el Drive: última revisión, cifras y archivos con problemas. */
export async function datosDrive(db: BaseDatos) {
  const [estado, cola, problemas] = await Promise.all([
    db.from("configuracion").select("valor").eq("clave", "estado_sincronizacion").maybeSingle(),
    db.from("v_estado_archivos").select("*"),
    db
      .from("archivos_drive")
      .select("id, nombre, ruta, estado, error_codigo, ultimo_error, drive_url")
      .in("estado", ["error", "ignorado"])
      .order("ruta")
      .order("nombre")
      .limit(300),
  ]);
  return {
    estado: estado.data?.valor ?? null,
    cola: cola.data ?? [],
    conError: (problemas.data ?? []).filter((a) => a.estado === "error"),
    ignorados: (problemas.data ?? []).filter((a) => a.estado === "ignorado"),
  };
}

export async function datosSaldosIniciales(db: BaseDatos) {
  const { data } = await db.from("saldos_iniciales").select("id, fecha_corte, debito, credito, cuentas(codigo, nombre)").order("fecha_corte");
  return data ?? [];
}
