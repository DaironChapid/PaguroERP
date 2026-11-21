// Convierte la respuesta cruda de la IA (snake_case) en los datos que usan
// las reglas contables. Se define la forma mínima esperada aquí para que
// `core/` no dependa del módulo de IA.
import { normalizarNit } from "./nit";
import type { DatosFactura } from "./validacion";

export interface ParteCruda {
  nombre: string | null;
  nit: string | null;
  pais: string | null;
}

export interface ExtraccionCruda {
  clase_documento: string;
  tipo_documento: string;
  numero: string | null;
  fecha_emision: string | null;
  fecha_vencimiento: string | null;
  emisor: ParteCruda;
  receptor: ParteCruda;
  moneda: string | null;
  subtotal: number | null;
  iva_tasa: number | null;
  iva_valor: number | null;
  retefuente: number | null;
  reteica: number | null;
  otros_impuestos: { nombre: string; valor: number }[];
  total: number | null;
  confianza_campos: Record<string, number>;
  confianza_general: number;
}

const acotar = (n: number) => Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0));

export function datosDesdeExtraccion(x: ExtraccionCruda): DatosFactura {
  const otros = x.otros_impuestos.reduce((suma, i) => suma + (i.valor ?? 0), 0);
  const moneda = (x.moneda ?? "COP").trim().toUpperCase() || "COP";
  // Sin impuestos ni retenciones (cuentas de cobro de no responsables de IVA,
  // notas de cobro del exterior) el subtotal es el total, aunque no se imprima.
  const sinImpuestos = !x.iva_valor && !x.retefuente && !x.reteica && x.otros_impuestos.length === 0;
  const subtotal = x.subtotal ?? (sinImpuestos ? x.total : null);
  return {
    esFactura: x.clase_documento === "factura",
    tipoDocumento: x.tipo_documento,
    numero: x.numero?.trim().replace(/\s+/g, " ") || null,
    fechaEmision: x.fecha_emision,
    fechaVencimiento: x.fecha_vencimiento,
    emisorNit: x.emisor.nit,
    receptorNit: x.receptor.nit,
    moneda,
    montos: {
      subtotal,
      iva: x.iva_valor,
      otrosImpuestos: x.otros_impuestos.length > 0 ? otros : null,
      retefuente: x.retefuente,
      reteica: x.reteica,
      total: x.total,
    },
    confianzaGeneral: acotar(x.confianza_general),
    confianzaCampos: Object.fromEntries(Object.entries(x.confianza_campos).map(([k, v]) => [k, acotar(v)])),
  };
}

export interface TerceroExtraido {
  nit: string;
  dv: string | null;
  razonSocial: string;
  pais: string;
  extranjero: boolean;
}

/**
 * Datos del tercero (el emisor en compras y gastos, el receptor en ventas).
 * Si no hay identificación tributaria, el tercero se identifica por su nombre:
 * - `exterior`: proveedor extranjero → "EXT" + nombre.
 * - `sinNit`: beneficiario nacional de un pago (p. ej. empleado en un comprobante
 *   bancario que no muestra la cédula) → "SN" + nombre.
 */
export function terceroDesdeParte(
  parte: ParteCruda,
  opciones: { exterior?: boolean; sinNit?: boolean } = {},
): TerceroExtraido | null {
  const nit = normalizarNit(parte.nit);
  if (!nit) {
    const clave = (parte.nombre ?? "")
      .normalize("NFD")
      .replace(/[^0-9A-Za-z]/g, "")
      .toUpperCase()
      .slice(0, 30);
    if (!clave) return null;
    if (opciones.exterior) {
      const pais = parte.pais?.trim().toUpperCase();
      return {
        nit: `EXT${clave}`,
        dv: null,
        razonSocial: parte.nombre!.trim(),
        pais: pais && /^[A-Z]{2}$/.test(pais) && pais !== "CO" ? pais : "ZZ",
        extranjero: true,
      };
    }
    if (opciones.sinNit) {
      return { nit: `SN${clave}`, dv: null, razonSocial: parte.nombre!.trim(), pais: "CO", extranjero: false };
    }
    return null;
  }
  const paisDeclarado = parte.pais?.trim().toUpperCase();
  const pais = paisDeclarado && /^[A-Z]{2}$/.test(paisDeclarado) ? paisDeclarado : nit.extranjero ? "ZZ" : "CO";
  return {
    nit: nit.numero,
    dv: nit.dv,
    razonSocial: parte.nombre?.trim() || `Tercero ${nit.numero}`,
    pais,
    extranjero: nit.extranjero || pais !== "CO",
  };
}
