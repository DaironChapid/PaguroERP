// Aritmética de dinero en centavos enteros para evitar errores de punto flotante.

export function aCentavos(valor: number): number {
  return Math.round(valor * 100);
}

export function deCentavos(centavos: number): number {
  return centavos / 100;
}

/** Convierte un monto a COP en centavos usando la tasa de cambio dada. */
export function aCentavosCop(valor: number, tasaCambio: number): number {
  return Math.round(valor * tasaCambio * 100);
}

export function redondear2(valor: number): number {
  return Math.round(valor * 100) / 100;
}
