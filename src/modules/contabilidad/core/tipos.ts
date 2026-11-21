// Tipos del dominio contable. Sin dependencias de framework ni base de datos.

export type TipoFactura = "compra" | "venta" | "gasto";

export type EstadoFactura =
  | "pendiente_revision"
  | "aprobada"
  | "rechazada"
  | "error"
  | "descartada";

export type TipoCuenta = "activo" | "pasivo" | "patrimonio" | "ingreso" | "gasto" | "costo";

export type Naturaleza = "debito" | "credito";

/** Hallazgo de validación. Los errores mandan la factura a revisión; las advertencias no. */
export interface Hallazgo {
  codigo: string;
  nivel: "error" | "advertencia";
  mensaje: string;
}

/** Montos de una factura en su moneda original. null = no aparece en el documento. */
export interface MontosFactura {
  subtotal: number | null;
  iva: number | null;
  otrosImpuestos: number | null;
  retefuente: number | null;
  reteica: number | null;
  total: number | null;
}

/** Línea de asiento expresada en COP, con la cuenta por código PUC. */
export interface LineaAsiento {
  cuenta: string;
  descripcion: string;
  debito: number;
  credito: number;
}

export interface Asiento {
  fecha: string; // YYYY-MM-DD
  descripcion: string;
  lineas: LineaAsiento[];
}
