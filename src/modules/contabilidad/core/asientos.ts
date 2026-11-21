import { aCentavosCop } from "./dinero";
import type { Asiento, LineaAsiento, MontosFactura, TipoFactura } from "./tipos";

/** Cuentas puente configurables (tabla configuracion, clave `cuentas_asientos`). */
export interface CuentasAsientos {
  ivaDescontable: string;
  ivaGenerado: string;
  otrosImpuestosPorPagar: string;
  retefuentePorPagar: string;
  reteicaPorPagar: string;
  proveedoresNacionales: string;
  proveedoresExterior: string;
  cuentasPorPagarNacionales: string;
  cuentasPorPagarExterior: string;
  clientesNacionales: string;
  clientesExterior: string;
  retefuenteAFavor: string;
  reteicaAFavor: string;
}

const CLAVES_CONFIG: Record<keyof CuentasAsientos, string> = {
  ivaDescontable: "iva_descontable",
  ivaGenerado: "iva_generado",
  otrosImpuestosPorPagar: "otros_impuestos_por_pagar",
  retefuentePorPagar: "retefuente_por_pagar",
  reteicaPorPagar: "reteica_por_pagar",
  proveedoresNacionales: "proveedores_nacionales",
  proveedoresExterior: "proveedores_exterior",
  cuentasPorPagarNacionales: "cuentas_por_pagar_nacionales",
  cuentasPorPagarExterior: "cuentas_por_pagar_exterior",
  clientesNacionales: "clientes_nacionales",
  clientesExterior: "clientes_exterior",
  retefuenteAFavor: "retefuente_a_favor",
  reteicaAFavor: "reteica_a_favor",
};

/** Convierte el JSON de configuración (snake_case) y verifica que no falte ninguna cuenta. */
export function cuentasDesdeConfig(config: Record<string, unknown>): CuentasAsientos {
  const resultado = {} as CuentasAsientos;
  for (const [propiedad, clave] of Object.entries(CLAVES_CONFIG) as [keyof CuentasAsientos, string][]) {
    const valor = config[clave];
    if (typeof valor !== "string" || !/^\d+$/.test(valor)) {
      throw new Error(`Configuración de cuentas incompleta: falta "${clave}"`);
    }
    resultado[propiedad] = valor;
  }
  return resultado;
}

export interface FacturaParaAsiento {
  tipo: TipoFactura;
  numero: string;
  fecha: string; // YYYY-MM-DD
  terceroNombre: string;
  terceroExterior: boolean;
  moneda: string;
  /** Pesos colombianos por unidad de la moneda de la factura (1 si es COP). */
  tasaCambio: number;
  montos: MontosFactura;
  /** Cuenta de gasto/costo/activo (compras y gastos) o de ingreso (ventas). */
  cuentaPrincipal: string;
  /** Cuenta de retención propia de la categoría; si no, se usa la por defecto. */
  cuentaRetefuente?: string | null;
}

export class ErrorAsiento extends Error {}

const ETIQUETA: Record<TipoFactura, string> = { compra: "Compra", gasto: "Gasto", venta: "Venta" };

/**
 * Genera el asiento de partida doble de una factura, en COP.
 *
 * Compra / gasto:
 *   D  gasto, costo o activo     subtotal (+ otros impuestos no descontables)
 *   D  IVA descontable           IVA
 *   C  retención en la fuente    retefuente
 *   C  ReteICA por pagar         reteica
 *   C  proveedores / CxP         neto a pagar (cuadra el asiento)
 *
 * Venta:
 *   D  retención a favor         retefuente que nos practicó el cliente
 *   D  ReteICA a favor           reteica
 *   D  clientes                  neto a cobrar (cuadra el asiento)
 *   C  ingresos                  subtotal
 *   C  IVA generado              IVA
 *   C  otros impuestos por pagar otros impuestos
 */
export function generarAsiento(f: FacturaParaAsiento, cuentas: CuentasAsientos): Asiento {
  if (!(f.tasaCambio > 0)) throw new ErrorAsiento("La tasa de cambio debe ser mayor que cero");
  if (f.montos.subtotal === null) throw new ErrorAsiento("La factura no tiene subtotal");

  const cop = (valor: number | null) => aCentavosCop(valor ?? 0, f.tasaCambio);
  const subtotal = cop(f.montos.subtotal);
  const iva = cop(f.montos.iva);
  const otros = cop(f.montos.otrosImpuestos);
  const retefuente = cop(f.montos.retefuente);
  const reteica = cop(f.montos.reteica);

  const descripcion = `${ETIQUETA[f.tipo]} ${f.numero} - ${f.terceroNombre}`;
  const lineas: { cuenta: string; descripcion: string; debito: number; credito: number }[] = [];
  const debito = (cuenta: string, centavos: number, detalle: string) => {
    if (centavos > 0) lineas.push({ cuenta, descripcion: detalle, debito: centavos, credito: 0 });
  };
  const credito = (cuenta: string, centavos: number, detalle: string) => {
    if (centavos > 0) lineas.push({ cuenta, descripcion: detalle, debito: 0, credito: centavos });
  };

  if (f.tipo === "compra" || f.tipo === "gasto") {
    debito(f.cuentaPrincipal, subtotal + otros, descripcion);
    debito(cuentas.ivaDescontable, iva, "IVA descontable");
    credito(f.cuentaRetefuente ?? cuentas.retefuentePorPagar, retefuente, "Retención en la fuente");
    credito(cuentas.reteicaPorPagar, reteica, "ReteICA");

    const neto = subtotal + otros + iva - retefuente - reteica;
    if (neto <= 0) throw new ErrorAsiento("El neto a pagar es cero o negativo");
    const contrapartida =
      f.tipo === "compra"
        ? f.terceroExterior ? cuentas.proveedoresExterior : cuentas.proveedoresNacionales
        : f.terceroExterior ? cuentas.cuentasPorPagarExterior : cuentas.cuentasPorPagarNacionales;
    credito(contrapartida, neto, "Por pagar");
  } else {
    const neto = subtotal + iva + otros - retefuente - reteica;
    if (neto <= 0) throw new ErrorAsiento("El neto a cobrar es cero o negativo");
    debito(cuentas.retefuenteAFavor, retefuente, "Retención en la fuente a favor");
    debito(cuentas.reteicaAFavor, reteica, "ReteICA a favor");
    debito(f.terceroExterior ? cuentas.clientesExterior : cuentas.clientesNacionales, neto, "Por cobrar");
    credito(f.cuentaPrincipal, subtotal, descripcion);
    credito(cuentas.ivaGenerado, iva, "IVA generado");
    credito(cuentas.otrosImpuestosPorPagar, otros, "Otros impuestos");
  }

  const asiento: Asiento = {
    fecha: f.fecha,
    descripcion,
    lineas: lineas.map((l) => ({ ...l, debito: l.debito / 100, credito: l.credito / 100 })),
  };
  if (!cuadraAsiento(asiento.lineas)) {
    throw new ErrorAsiento("El asiento generado no cuadra");
  }
  return asiento;
}

/** Débitos = créditos (comparado en centavos). */
export function cuadraAsiento(lineas: LineaAsiento[]): boolean {
  let diferencia = 0;
  for (const l of lineas) {
    diferencia += Math.round(l.debito * 100) - Math.round(l.credito * 100);
  }
  return diferencia === 0 && lineas.length >= 2;
}
