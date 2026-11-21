import { aCentavos } from "./dinero";
import type { MontosFactura } from "./tipos";

/**
 * En Colombia el "total" impreso puede venir antes o después de retenciones:
 *   bruto = subtotal + IVA + otros impuestos
 *   neto  = bruto − retención en la fuente − ReteICA
 * Se acepta cualquiera de los dos y se informa cuál coincidió.
 */
export type ModoTotal = "bruto" | "neto";

export interface ResultadoCuadre {
  cuadra: boolean;
  modo: ModoTotal | null;
  /** Diferencia entre el total impreso y el cálculo más cercano. */
  diferencia: number | null;
}

function n(valor: number | null): number {
  return valor ?? 0;
}

export function totalBruto(m: MontosFactura): number {
  return (aCentavos(n(m.subtotal)) + aCentavos(n(m.iva)) + aCentavos(n(m.otrosImpuestos))) / 100;
}

/** Lo que efectivamente se paga (compra) o se cobra (venta). */
export function netoAPagar(m: MontosFactura): number {
  return (
    (aCentavos(n(m.subtotal)) +
      aCentavos(n(m.iva)) +
      aCentavos(n(m.otrosImpuestos)) -
      aCentavos(n(m.retefuente)) -
      aCentavos(n(m.reteica))) /
    100
  );
}

export function verificarCuadre(m: MontosFactura, tolerancia: number): ResultadoCuadre {
  if (m.total === null || m.subtotal === null) {
    return { cuadra: false, modo: null, diferencia: null };
  }
  const total = aCentavos(m.total);
  const tol = aCentavos(tolerancia);
  const difBruto = total - aCentavos(totalBruto(m));
  const difNeto = total - aCentavos(netoAPagar(m));

  if (Math.abs(difBruto) <= tol) return { cuadra: true, modo: "bruto", diferencia: difBruto / 100 };
  if (Math.abs(difNeto) <= tol) return { cuadra: true, modo: "neto", diferencia: difNeto / 100 };

  const masCercana = Math.abs(difBruto) <= Math.abs(difNeto) ? difBruto : difNeto;
  return { cuadra: false, modo: null, diferencia: masCercana / 100 };
}

/** Tolerancia por moneda a partir de la configuración { "COP": 10, "USD": 0.05, "default": 0.05 }. */
export function toleranciaPara(moneda: string, config: Record<string, number>): number {
  return config[moneda] ?? config.default ?? 0;
}
