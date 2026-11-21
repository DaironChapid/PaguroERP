import { exigir, type BaseDatos } from "../repo/supabase";
import { rutas } from "../rutas";

// Reportes: cada uno sale de las vistas o funciones SQL del schema y se
// describe con columnas tipadas, para que la UI y la exportación CSV los
// rendericen igual sin conocer su lógica.

export type TipoColumna = "texto" | "moneda" | "numero" | "fecha" | "mes";

export interface Columna {
  clave: string;
  titulo: string;
  tipo: TipoColumna;
}

export interface Reporte {
  tipo: TipoReporte;
  titulo: string;
  descripcion: string;
  columnas: Columna[];
  filas: Record<string, string | number | null>[];
  resumen: { etiqueta: string; valor: number }[];
  aviso?: string;
  /** Un enlace por fila (mismo orden que `filas`) hacia los documentos que la soportan. No va al CSV. */
  enlaces?: (EnlaceFila | null)[];
}

export interface EnlaceFila {
  /** Página del sistema con el soporte (el documento o la lista filtrada). */
  href: string;
  etiqueta: string;
  /** Archivo original en Google Drive, cuando la fila es un solo documento. */
  drive?: string | null;
}

const FECHA_ANTIGUA = "2000-01-01";

/** Libro mayor de una cuenta en el periodo: de ahí se llega a cada documento. */
function enlaceCuenta(codigo: unknown, desde: string, hasta: string): EnlaceFila | null {
  if (typeof codigo !== "string" || !/^\d+$/.test(codigo)) return null;
  return { href: `${rutas.reportes}?${new URLSearchParams({ tipo: "libro_mayor", cuenta: codigo, desde, hasta })}`, etiqueta: "Ver movimientos" };
}

/**
 * En el balance, los resultados (3605 del año, 3705 de años anteriores) se calculan
 * desde ingresos y gastos, sin movimientos propios: llevan al estado de resultados.
 */
function enlaceBalance(codigo: unknown, hasta: string): EnlaceFila | null {
  const inicioAnio = `${hasta.slice(0, 4)}-01-01`;
  const estadoResultados = (desde: string, h: string): EnlaceFila => ({
    href: `${rutas.reportes}?${new URLSearchParams({ tipo: "estado_resultados", desde, hasta: h })}`,
    etiqueta: "Ver estado de resultados",
  });
  if (codigo === "3605") return estadoResultados(inicioAnio, hasta);
  if (codigo === "3705") {
    const finAnterior = new Date(Date.UTC(Number(hasta.slice(0, 4)), 0, 0)).toISOString().slice(0, 10);
    return estadoResultados(FECHA_ANTIGUA, finAnterior);
  }
  return enlaceCuenta(codigo, FECHA_ANTIGUA, hasta);
}

/** Documentos aprobados con un filtro (pestaña Todos). */
function enlaceDocumentos(filtros: Record<string, string>): EnlaceFila {
  return { href: `${rutas.documentos}?${new URLSearchParams({ vista: "todos", estado: "aprobada", ...filtros })}`, etiqueta: "Ver documentos" };
}

export const REPORTES = {
  estado_resultados: { titulo: "Estado de resultados", parametros: "rango" },
  balance_general: { titulo: "Balance general", parametros: "fecha" },
  balance_comprobacion: { titulo: "Balance de comprobación", parametros: "rango" },
  gastos_categoria: { titulo: "Gastos por categoría", parametros: "rango" },
  gastos_proveedor: { titulo: "Gastos por proveedor", parametros: "rango" },
  impuestos: { titulo: "IVA y retenciones", parametros: "rango" },
  cuentas_por_pagar: { titulo: "Cuentas por pagar", parametros: "fecha" },
  cuentas_por_cobrar: { titulo: "Cuentas por cobrar", parametros: "fecha" },
  libro_mayor: { titulo: "Libro mayor", parametros: "rango" },
} as const;

export type TipoReporte = keyof typeof REPORTES;

export function esTipoReporte(valor: string): valor is TipoReporte {
  return valor in REPORTES;
}

export interface ParametrosReporte {
  desde: string; // YYYY-MM-DD
  hasta: string;
  cuenta?: string; // libro mayor
}

const inicioMes = (f: string) => `${f.slice(0, 7)}-01`;

export async function generarReporte(db: BaseDatos, tipo: TipoReporte, p: ParametrosReporte): Promise<Reporte> {
  const titulo = REPORTES[tipo].titulo;
  switch (tipo) {
    case "estado_resultados": {
      const filas = exigir(
        await db.from("v_estado_resultados").select("cuenta_codigo, cuenta_nombre, tipo, valor").gte("periodo", inicioMes(p.desde)).lte("periodo", p.hasta),
        titulo,
      );
      const porCuenta = new Map<string, { tipo: string; cuenta_codigo: string; cuenta_nombre: string; valor: number }>();
      for (const f of filas) {
        const clave = f.cuenta_codigo!;
        const previa = porCuenta.get(clave) ?? { tipo: f.tipo!, cuenta_codigo: clave, cuenta_nombre: f.cuenta_nombre!, valor: 0 };
        previa.valor += Number(f.valor ?? 0);
        porCuenta.set(clave, previa);
      }
      const orden = { ingreso: 1, costo: 2, gasto: 3 } as Record<string, number>;
      const lista = [...porCuenta.values()].sort((a, b) => orden[a.tipo] - orden[b.tipo] || a.cuenta_codigo.localeCompare(b.cuenta_codigo));
      const total = (t: string) => lista.filter((x) => x.tipo === t).reduce((s, x) => s + x.valor, 0);
      const ingresos = total("ingreso");
      const costos = total("costo");
      const gastos = total("gasto");
      return {
        tipo,
        titulo,
        descripcion: "Ingresos, costos y gastos de los documentos aprobados en el periodo.",
        columnas: [
          { clave: "seccion", titulo: "Sección", tipo: "texto" },
          { clave: "cuenta_codigo", titulo: "Cuenta", tipo: "texto" },
          { clave: "cuenta_nombre", titulo: "Nombre", tipo: "texto" },
          { clave: "valor", titulo: "Valor", tipo: "moneda" },
        ],
        filas: lista.map((x) => ({ seccion: x.tipo === "ingreso" ? "Ingresos" : x.tipo === "costo" ? "Costos" : "Gastos", ...x })),
        enlaces: lista.map((x) => enlaceCuenta(x.cuenta_codigo, p.desde, p.hasta)),
        resumen: [
          { etiqueta: "Ingresos", valor: ingresos },
          { etiqueta: "Costos", valor: costos },
          { etiqueta: "Gastos", valor: gastos },
          { etiqueta: "Utilidad", valor: ingresos - costos - gastos },
        ],
      };
    }

    case "balance_general": {
      const [filas, saldos] = await Promise.all([
        db.rpc("balance_general", { p_fecha: p.hasta }),
        db.from("v_estado_saldos_iniciales").select("*").maybeSingle(),
      ]);
      const lista = exigir(filas, titulo);
      const total = (s: string) => lista.filter((x) => x.seccion === s).reduce((t, x) => t + Number(x.saldo), 0);
      const cargados = saldos.data?.cargados ?? false;
      return {
        tipo,
        titulo,
        descripcion: `Activos, pasivos y patrimonio al ${p.hasta}. El resultado del ejercicio se calcula al vuelo.`,
        columnas: [
          { clave: "seccion", titulo: "Sección", tipo: "texto" },
          { clave: "cuenta_codigo", titulo: "Cuenta", tipo: "texto" },
          { clave: "cuenta_nombre", titulo: "Nombre", tipo: "texto" },
          { clave: "saldo", titulo: "Saldo", tipo: "moneda" },
        ],
        filas: lista.map((x) => ({ ...x, seccion: x.seccion[0].toUpperCase() + x.seccion.slice(1) })),
        enlaces: lista.map((x) => enlaceBalance(x.cuenta_codigo, p.hasta)),
        resumen: [
          { etiqueta: "Activo", valor: total("activo") },
          { etiqueta: "Pasivo", valor: total("pasivo") },
          { etiqueta: "Patrimonio", valor: total("patrimonio") },
        ],
        aviso: !cargados
          ? "No hay saldos iniciales cargados: el balance solo refleja los movimientos registrados desde el sistema y está incompleto (por ejemplo, el saldo real del banco). Cárgalos en Configuración."
          : !saldos.data?.cuadran
            ? "Los saldos iniciales cargados no cuadran (débitos ≠ créditos)."
            : undefined,
      };
    }

    case "balance_comprobacion": {
      const lista = exigir(await db.rpc("balance_comprobacion", { p_desde: p.desde, p_hasta: p.hasta }), titulo);
      const suma = (k: "debitos" | "creditos") => lista.reduce((t, x) => t + Number(x[k]), 0);
      return {
        tipo,
        titulo,
        descripcion: "Saldo anterior, movimientos y saldo final por cuenta.",
        columnas: [
          { clave: "cuenta_codigo", titulo: "Cuenta", tipo: "texto" },
          { clave: "cuenta_nombre", titulo: "Nombre", tipo: "texto" },
          { clave: "saldo_anterior", titulo: "Saldo anterior", tipo: "moneda" },
          { clave: "debitos", titulo: "Débitos", tipo: "moneda" },
          { clave: "creditos", titulo: "Créditos", tipo: "moneda" },
          { clave: "saldo_final", titulo: "Saldo final", tipo: "moneda" },
        ],
        filas: lista,
        enlaces: lista.map((x) => enlaceCuenta(x.cuenta_codigo, p.desde, p.hasta)),
        resumen: [
          { etiqueta: "Total débitos", valor: suma("debitos") },
          { etiqueta: "Total créditos", valor: suma("creditos") },
        ],
      };
    }

    case "gastos_categoria":
    case "gastos_proveedor": {
      const porCategoria = tipo === "gastos_categoria";
      const datos = porCategoria
        ? exigir(await db.from("v_gastos_categoria").select("categoria, tipo, cantidad, subtotal_cop, iva_cop, total_cop").gte("periodo", inicioMes(p.desde)).lte("periodo", p.hasta), titulo)
        : exigir(await db.from("v_gastos_proveedor").select("nit, razon_social, cantidad, subtotal_cop, iva_cop, total_cop").gte("periodo", inicioMes(p.desde)).lte("periodo", p.hasta), titulo);
      const grupos = new Map<string, Record<string, string | number>>();
      for (const f of datos as Record<string, string | number | null>[]) {
        const clave = porCategoria ? String(f.categoria) : String(f.nit);
        const g = grupos.get(clave) ?? (porCategoria ? { categoria: String(f.categoria), cantidad: 0, subtotal_cop: 0, iva_cop: 0, total_cop: 0 } : { nit: String(f.nit), razon_social: String(f.razon_social), cantidad: 0, subtotal_cop: 0, iva_cop: 0, total_cop: 0 });
        for (const k of ["cantidad", "subtotal_cop", "iva_cop", "total_cop"]) g[k] = Number(g[k]) + Number(f[k] ?? 0);
        grupos.set(clave, g);
      }
      const filas = [...grupos.values()].sort((a, b) => Number(b.subtotal_cop) - Number(a.subtotal_cop));
      const idsCategoria = porCategoria
        ? new Map(exigir(await db.from("categorias").select("id, nombre"), "Categorías").map((c) => [c.nombre, String(c.id)]))
        : new Map<string, string>();
      const periodo = { desde: p.desde, hasta: p.hasta };
      const enlaces = filas.map((x) => {
        if (!porCategoria) return x.nit && x.nit !== "null" ? enlaceDocumentos({ ...periodo, texto: String(x.nit) }) : null;
        const id = idsCategoria.get(String(x.categoria));
        return id ? enlaceDocumentos({ ...periodo, categoria: id }) : null;
      });
      return {
        tipo,
        titulo,
        descripcion: "Facturas de compra y gasto aprobadas, en pesos. No incluye pagos sin factura (nómina, PILA, impuestos): esos están en el estado de resultados.",
        columnas: [
          ...(porCategoria
            ? [{ clave: "categoria", titulo: "Categoría", tipo: "texto" as const }]
            : [
                { clave: "razon_social", titulo: "Proveedor", tipo: "texto" as const },
                { clave: "nit", titulo: "NIT", tipo: "texto" as const },
              ]),
          { clave: "cantidad", titulo: "Facturas", tipo: "numero" },
          { clave: "subtotal_cop", titulo: "Subtotal", tipo: "moneda" },
          { clave: "iva_cop", titulo: "IVA", tipo: "moneda" },
          { clave: "total_cop", titulo: "Total", tipo: "moneda" },
        ],
        filas,
        enlaces,
        resumen: [{ etiqueta: "Subtotal", valor: filas.reduce((s, x) => s + Number(x.subtotal_cop), 0) }],
      };
    }

    case "impuestos": {
      const filas = exigir(await db.from("v_impuestos_periodo").select("*").gte("periodo", inicioMes(p.desde)).lte("periodo", p.hasta).order("periodo"), titulo);
      const suma = (k: keyof (typeof filas)[number]) => filas.reduce((s, x) => s + Number(x[k] ?? 0), 0);
      return {
        tipo,
        titulo,
        descripcion: "IVA generado y descontable, y retenciones, de los documentos aprobados.",
        columnas: [
          { clave: "periodo", titulo: "Mes", tipo: "mes" },
          { clave: "iva_generado", titulo: "IVA generado", tipo: "moneda" },
          { clave: "iva_descontable", titulo: "IVA descontable", tipo: "moneda" },
          { clave: "iva_neto", titulo: "IVA neto", tipo: "moneda" },
          { clave: "retefuente_practicada", titulo: "Retefuente practicada", tipo: "moneda" },
          { clave: "reteica_practicada", titulo: "ReteICA practicada", tipo: "moneda" },
          { clave: "retefuente_a_favor", titulo: "Retefuente a favor", tipo: "moneda" },
        ],
        filas,
        enlaces: filas.map((x) => (x.periodo ? enlaceDocumentos({ mes: x.periodo.slice(0, 7) }) : null)),
        resumen: [
          { etiqueta: "IVA generado", valor: suma("iva_generado") },
          { etiqueta: "IVA descontable", valor: suma("iva_descontable") },
          { etiqueta: "IVA neto", valor: suma("iva_neto") },
        ],
      };
    }

    case "cuentas_por_pagar":
    case "cuentas_por_cobrar": {
      // Desde el libro mayor: así los pagos ya registrados descuentan el saldo.
      const pagar = tipo === "cuentas_por_pagar";
      const filas = exigir(
        await db
          .from("v_libro_mayor")
          .select("cuenta_codigo, tercero_nit, tercero_nombre, debito, credito")
          .lte("fecha", p.hasta)
          .or(pagar ? "cuenta_codigo.like.22%,cuenta_codigo.like.2335%" : "cuenta_codigo.like.1305%"),
        titulo,
      );
      const saldos = new Map<string, { tercero_nombre: string; tercero_nit: string; saldo: number }>();
      for (const f of filas) {
        const clave = f.tercero_nit ?? "sin tercero";
        const s = saldos.get(clave) ?? { tercero_nombre: f.tercero_nombre ?? "Sin tercero", tercero_nit: f.tercero_nit ?? "—", saldo: 0 };
        s.saldo += pagar ? Number(f.credito) - Number(f.debito) : Number(f.debito) - Number(f.credito);
        saldos.set(clave, s);
      }
      const lista = [...saldos.values()].filter((s) => Math.abs(s.saldo) >= 0.01).sort((a, b) => b.saldo - a.saldo);
      return {
        tipo,
        titulo,
        descripcion: pagar
          ? "Saldo por pagar a cada proveedor (facturas aprobadas menos pagos registrados)."
          : "Saldo por cobrar a cada cliente (facturas de venta aprobadas menos cobros registrados).",
        columnas: [
          { clave: "tercero_nombre", titulo: pagar ? "Proveedor" : "Cliente", tipo: "texto" },
          { clave: "tercero_nit", titulo: "NIT", tipo: "texto" },
          { clave: "saldo", titulo: "Saldo", tipo: "moneda" },
        ],
        filas: lista,
        enlaces: lista.map((x) => (x.tercero_nit && x.tercero_nit !== "—" ? enlaceDocumentos({ texto: x.tercero_nit, hasta: p.hasta }) : null)),
        resumen: [{ etiqueta: "Total", valor: lista.reduce((s, x) => s + x.saldo, 0) }],
        aviso: pagar ? undefined : "Los cobros de clientes aún no se registran (llegan por el extracto bancario), así que este saldo puede estar sobrestimado.",
      };
    }

    case "libro_mayor": {
      let q = db
        .from("v_libro_mayor")
        .select("fecha, cuenta_codigo, cuenta_nombre, descripcion, tercero_nombre, debito, credito, saldo, factura_id")
        .gte("fecha", p.desde)
        .lte("fecha", p.hasta)
        .order("cuenta_codigo")
        .order("fecha")
        .limit(5000);
      if (p.cuenta) q = q.like("cuenta_codigo", `${p.cuenta}%`);
      const filas = exigir(await q, titulo);
      const ids = [...new Set(filas.map((f) => f.factura_id).filter((x): x is number => x !== null))];
      const drive = new Map<number, string | null>();
      for (let i = 0; i < ids.length; i += 200) {
        const docs = exigir(await db.from("facturas").select("id, drive_url").in("id", ids.slice(i, i + 200)), "Documentos del libro mayor");
        for (const d of docs) drive.set(d.id, d.drive_url);
      }
      return {
        tipo,
        titulo,
        descripcion: "Movimientos por cuenta con saldo acumulado.",
        columnas: [
          { clave: "fecha", titulo: "Fecha", tipo: "fecha" },
          { clave: "cuenta_codigo", titulo: "Cuenta", tipo: "texto" },
          { clave: "cuenta_nombre", titulo: "Nombre", tipo: "texto" },
          { clave: "descripcion", titulo: "Descripción", tipo: "texto" },
          { clave: "tercero_nombre", titulo: "Tercero", tipo: "texto" },
          { clave: "debito", titulo: "Débito", tipo: "moneda" },
          { clave: "credito", titulo: "Crédito", tipo: "moneda" },
          { clave: "saldo", titulo: "Saldo", tipo: "moneda" },
        ],
        // factura_id solo sirve para el enlace: no se muestra ni va al CSV.
        filas: filas.map((f) => Object.fromEntries(Object.entries(f).filter(([k]) => k !== "factura_id"))),
        enlaces: filas.map((f) =>
          f.factura_id !== null ? { href: rutas.documento(f.factura_id), etiqueta: "Ver documento", drive: drive.get(f.factura_id) ?? null } : null,
        ),
        resumen: [],
      };
    }
  }
}

/** CSV para Excel en español: separador ';', coma decimal y BOM UTF-8. */
export function reporteACsv(r: Reporte): string {
  const celda = (v: string | number | null | undefined, tipo: TipoColumna) => {
    if (v === null || v === undefined) return "";
    if (tipo === "moneda" || tipo === "numero") return String(Number(v).toFixed(2)).replace(".", ",");
    const s = String(v);
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lineas = [
    r.columnas.map((c) => c.titulo).join(";"),
    ...r.filas.map((f) => r.columnas.map((c) => celda(f[c.clave], c.tipo)).join(";")),
  ];
  return "﻿" + lineas.join("\r\n");
}
