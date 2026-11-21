import { z } from "zod/v4";
import {
  cuentaBanco,
  ErrorAsiento,
  ErrorMovimiento,
  generarAsiento,
  generarAsientoMovimiento,
  normalizarConcepto,
  normalizarImpuesto,
  normalizarNit,
  redondear2,
  CLASES_MOVIMIENTO,
  type Asiento,
  type ClaseMovimiento,
  type TipoFactura,
} from "../core";
import { exigir, type BaseDatos } from "../repo/supabase";
import type { Database, Json } from "../repo/tipos-db";
import { cargarContexto } from "./contexto";

// Acciones de la bandeja de revisión: corregir, aprobar y rechazar. Se
// ejecutan con el cliente de la sesión, así que RLS exige rol editor o admin.

export class ErrorRevision extends Error {}

type FilaFactura = Database["contabilidad"]["Tables"]["facturas"]["Row"];

const fechaIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha en formato AAAA-MM-DD");
const montoNoNegativo = z.number().min(0);

export const EsquemaCorreccion = z
  .object({
    clase_documento: z.enum(["factura", ...CLASES_MOVIMIENTO, "informativo"]),
    tipo: z.enum(["compra", "venta", "gasto", "pago"]),
    numero: z.string().trim().min(1).max(100).nullable(),
    fecha_emision: fechaIso.nullable(),
    fecha_vencimiento: fechaIso.nullable(),
    moneda: z.string().regex(/^[A-Z]{3}$/),
    tasa_cambio: z.number().positive(),
    subtotal: montoNoNegativo.nullable(),
    iva: montoNoNegativo,
    retefuente: montoNoNegativo,
    reteica: montoNoNegativo,
    otros_impuestos: montoNoNegativo,
    total: montoNoNegativo.nullable(),
    categoria_id: z.number().int().nullable(),
    cuenta_id: z.number().int().nullable(),
    observaciones: z.string().max(2000).nullable(),
    tercero: z.object({ nit: z.string().trim().min(3).max(40), razon_social: z.string().trim().min(2).max(200) }),
  })
  .partial()
  .strict();

export type Correccion = z.infer<typeof EsquemaCorreccion>;

async function leer(db: BaseDatos, id: number): Promise<FilaFactura> {
  const r = await db.from("facturas").select("*").eq("id", id).maybeSingle();
  if (r.error) throw new Error(r.error.message);
  if (!r.data) throw new ErrorRevision("El documento no existe");
  return r.data;
}

/** Aplica las correcciones de una persona y deja el historial en `revisiones`. */
export async function corregirDocumento(db: BaseDatos, id: number, correccion: Correccion, usuario: string): Promise<void> {
  const actual = await leer(db, id);
  const cambios: Database["contabilidad"]["Tables"]["facturas"]["Update"] = {};
  const historial: { campo: string; valor_ia: Json; valor_corregido: Json }[] = [];

  const { tercero, ...campos } = correccion;
  for (const [campo, valor] of Object.entries(campos) as [keyof FilaFactura, unknown][]) {
    if (valor === undefined || actual[campo] === valor) continue;
    (cambios as Record<string, unknown>)[campo] = valor;
    historial.push({ campo, valor_ia: (actual[campo] ?? null) as Json, valor_corregido: valor as Json });
  }

  if (tercero) {
    const nit = normalizarNit(tercero.nit);
    if (!nit) throw new ErrorRevision("NIT del tercero inválido");
    await db.from("terceros").upsert(
      { nit: nit.numero, dv: nit.dv, razon_social: tercero.razon_social, pais: nit.extranjero ? "ZZ" : "CO", tipo: actual.tipo === "venta" ? "cliente" : "proveedor" },
      { onConflict: "nit", ignoreDuplicates: true },
    );
    const t = exigir(await db.from("terceros").select("id").eq("nit", nit.numero).single(), "Leyendo tercero");
    if (t.id !== actual.tercero_id) {
      cambios.tercero_id = t.id;
      historial.push({ campo: "tercero", valor_ia: actual.tercero_id, valor_corregido: { nit: nit.numero, razon_social: tercero.razon_social } });
    }
  }

  // Al cambiar la categoría sin indicar cuenta, se usa la cuenta de la categoría.
  if (cambios.categoria_id && correccion.cuenta_id === undefined) {
    const cat = await db.from("categorias").select("cuenta_id").eq("id", cambios.categoria_id).single();
    if (cat.data && cat.data.cuenta_id !== actual.cuenta_id) cambios.cuenta_id = cat.data.cuenta_id;
  }
  if (Object.keys(cambios).length === 0) return;

  // Un documento aprobado que se corrige pierde su asiento y vuelve a revisión.
  if (actual.estado === "aprobada") {
    const r = await db.rpc("cambiar_estado_factura", { p_factura_id: id, p_estado: "pendiente_revision" });
    if (r.error) throw new Error(r.error.message);
  }
  if (cambios.clase_documento === "informativo") cambios.estado = "descartada";
  else if (actual.estado === "descartada" && cambios.clase_documento) cambios.estado = "pendiente_revision";

  const r = await db.from("facturas").update(cambios).eq("id", id);
  if (r.error) throw new Error(r.error.message);
  const h = await db.from("revisiones").insert(historial.map((x) => ({ ...x, factura_id: id, usuario })));
  if (h.error) throw new Error(h.error.message);
}

/** Genera el asiento con los datos actuales del documento y lo aprueba. */
export async function aprobarDocumento(db: BaseDatos, id: number, usuario: string): Promise<void> {
  const f = await leer(db, id);
  if (f.estado === "aprobada") throw new ErrorRevision("El documento ya está aprobado");
  if (f.clase_documento === "informativo") throw new ErrorRevision("Un documento informativo no se contabiliza; cambia su clase primero");

  const faltan = [
    !f.tipo && "tipo",
    !f.fecha_emision && "fecha",
    !f.tercero_id && "tercero",
    !f.cuenta_id && "cuenta contable",
    f.total === null && "total",
    f.clase_documento === "factura" && f.subtotal === null && "subtotal",
    f.clase_documento === "factura" && !f.numero && "número",
  ].filter(Boolean);
  if (faltan.length) throw new ErrorRevision(`Faltan datos para aprobar: ${faltan.join(", ")}`);

  const ctx = await cargarContexto(db);
  const [tercero, cuenta] = await Promise.all([
    db.from("terceros").select("id, razon_social, pais").eq("id", f.tercero_id!).single(),
    db.from("cuentas").select("codigo").eq("id", f.cuenta_id!).single(),
  ]);
  const t = exigir(tercero, "Leyendo tercero");
  const codigoCuenta = exigir(cuenta, "Leyendo cuenta").codigo;

  let asiento: Asiento;
  try {
    if (f.clase_documento !== "factura") {
      const movimiento = (f.datos_ia as { movimiento?: { banco_origen?: string | null; impuesto?: string | null } } | null)?.movimiento;
      const componentes = (Array.isArray(f.componentes) ? f.componentes : []) as { concepto: string; valor: number }[];
      asiento = generarAsientoMovimiento(
        {
          clase: f.clase_documento as ClaseMovimiento,
          referencia: f.numero,
          fecha: f.fecha_emision!,
          terceroNombre: t.razon_social,
          totalCop: redondear2(Number(f.total) * Number(f.tasa_cambio)),
          componentesCop: componentes.map((c) => ({ concepto: normalizarConcepto(c.concepto), valor: redondear2(c.valor * Number(f.tasa_cambio)) })),
          impuesto: normalizarImpuesto(movimiento?.impuesto ?? null),
          cuentaBanco: cuentaBanco(movimiento?.banco_origen ?? null, ctx.cuentasMovimientos).cuenta,
          cuentaDestino: codigoCuenta,
          cuentaPrincipal: codigoCuenta,
        },
        ctx.cuentasMovimientos,
      );
    } else {
      const categoria = ctx.categorias.find((c) => c.id === f.categoria_id);
      asiento = generarAsiento(
        {
          tipo: f.tipo as TipoFactura,
          numero: f.numero!,
          fecha: f.fecha_emision!,
          terceroNombre: t.razon_social,
          terceroExterior: t.pais !== "CO",
          moneda: f.moneda,
          tasaCambio: Number(f.tasa_cambio),
          montos: {
            subtotal: f.subtotal === null ? null : Number(f.subtotal),
            iva: Number(f.iva),
            otrosImpuestos: Number(f.otros_impuestos),
            retefuente: Number(f.retefuente),
            reteica: Number(f.reteica),
            total: f.total === null ? null : Number(f.total),
          },
          cuentaPrincipal: codigoCuenta,
          cuentaRetefuente: categoria?.retefuenteCodigo ?? null,
        },
        ctx.cuentasAsientos,
      );
    }
  } catch (e) {
    if (e instanceof ErrorAsiento || e instanceof ErrorMovimiento) throw new ErrorRevision(e.message);
    throw e;
  }

  const r = await db.rpc("registrar_asiento_factura", {
    p_factura_id: id,
    p_fecha: asiento.fecha,
    p_descripcion: asiento.descripcion,
    p_lineas: asiento.lineas.map((l) => ({ ...l, tercero_id: t.id })) as unknown as Json,
    p_usuario: usuario,
  });
  if (r.error) throw new ErrorRevision(`No se pudo registrar el asiento: ${r.error.message}`);
}

export async function rechazarDocumento(db: BaseDatos, id: number, motivo: string | null): Promise<void> {
  await leer(db, id);
  const r = await db.rpc("cambiar_estado_factura", { p_factura_id: id, p_estado: "rechazada", p_observaciones: motivo ?? undefined });
  if (r.error) throw new Error(r.error.message);
}
