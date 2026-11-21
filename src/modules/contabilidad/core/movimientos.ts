// Movimientos que no son facturas: pagos de impuestos, planillas PILA,
// pagos de nómina, transferencias (nacionales y al exterior) e impuestos de
// importación. Todos salen de un banco; el asiento acredita el banco y
// debita según el tipo de movimiento y su desglose.
// ⚠ Reglas pendientes de validación por el contador.

import type { PeriodoCarpeta } from "./carpeta";
import { aCentavos } from "./dinero";
import { fechaValida } from "./validacion";
import type { Asiento, Hallazgo } from "./tipos";

export const CLASES_MOVIMIENTO = [
  "pago_impuestos",
  "planilla_seguridad_social",
  "pago_nomina",
  "transferencia",
  "declaracion_importacion",
  "aporte_socio",
] as const;
export type ClaseMovimiento = (typeof CLASES_MOVIMIENTO)[number];

export const CONCEPTOS_COMPONENTE = [
  "capital",
  "intereses_mora",
  "sancion",
  "salud",
  "pension",
  "arl",
  "caja_compensacion",
  "parafiscales",
  "arancel",
  "iva_importacion",
  "comision_bancaria",
  "gmf",
  "otro",
] as const;
export type ConceptoComponente = (typeof CONCEPTOS_COMPONENTE)[number];

export const IMPUESTOS = ["iva", "retencion_fuente", "renta", "ica", "otro"] as const;
export type ImpuestoPagado = (typeof IMPUESTOS)[number];

const sinTildes = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim().replace(/[\s-]+/g, "_");

/** Concepto de un componente tal como lo escribió la IA → concepto conocido ("otro" si no se reconoce). */
export function normalizarConcepto(valor: string): ConceptoComponente {
  const v = sinTildes(valor);
  if ((CONCEPTOS_COMPONENTE as readonly string[]).includes(v)) return v as ConceptoComponente;
  const claves: [RegExp, ConceptoComponente][] = [
    [/mora|interes/, "intereses_mora"],
    [/sancion|multa/, "sancion"],
    [/salud|eps/, "salud"],
    [/pension/, "pension"],
    [/arl|riesgo/, "arl"],
    [/caja|ccf/, "caja_compensacion"],
    [/sena|icbf|parafiscal/, "parafiscales"],
    [/arancel/, "arancel"],
    [/iva/, "iva_importacion"],
    [/comision/, "comision_bancaria"],
    [/gmf|4x1000|gravamen/, "gmf"],
    [/capital|impuesto|valor/, "capital"],
  ];
  return claves.find(([patron]) => patron.test(v))?.[1] ?? "otro";
}

export function normalizarImpuesto(valor: string | null): ImpuestoPagado | null {
  if (!valor) return null;
  const v = sinTildes(valor);
  if ((IMPUESTOS as readonly string[]).includes(v)) return v as ImpuestoPagado;
  if (v.includes("retencion") || v.includes("retefuente")) return "retencion_fuente";
  if (v.includes("renta")) return "renta";
  if (v.includes("ica") || v.includes("industria")) return "ica";
  if (v.includes("iva") || v.includes("ventas")) return "iva";
  return "otro";
}

export interface Componente {
  concepto: ConceptoComponente;
  valor: number;
}

export interface CuentasMovimientos {
  bancos: Record<string, string>;
  bancoPorDefecto: string;
  ivaPorPagar: string;
  retefuentePorPagar: string;
  rentaPorPagar: string;
  icaPorPagar: string;
  otrosImpuestosPorPagar: string;
  interesesMora: string;
  sanciones: string;
  aportesSalud: string;
  aportesPension: string;
  aportesArl: string;
  aportesCaja: string;
  aportesParafiscales: string;
  sueldos: string;
  comisionesBancarias: string;
  gmf: string;
  arancel: string;
  ivaImportacion: string;
  aportesSocios: string;
}

const CLAVES: Record<Exclude<keyof CuentasMovimientos, "bancos">, string> = {
  bancoPorDefecto: "banco_por_defecto",
  ivaPorPagar: "iva_por_pagar",
  retefuentePorPagar: "retefuente_por_pagar",
  rentaPorPagar: "renta_por_pagar",
  icaPorPagar: "ica_por_pagar",
  otrosImpuestosPorPagar: "otros_impuestos_por_pagar",
  interesesMora: "intereses_mora",
  sanciones: "sanciones",
  aportesSalud: "aportes_salud",
  aportesPension: "aportes_pension",
  aportesArl: "aportes_arl",
  aportesCaja: "aportes_caja",
  aportesParafiscales: "aportes_parafiscales",
  sueldos: "sueldos",
  comisionesBancarias: "comisiones_bancarias",
  gmf: "gmf",
  arancel: "arancel",
  ivaImportacion: "iva_importacion",
  aportesSocios: "aportes_socios",
};

export function cuentasMovimientosDesdeConfig(config: Record<string, unknown>): CuentasMovimientos {
  const resultado = { bancos: {} } as CuentasMovimientos;
  for (const [propiedad, clave] of Object.entries(CLAVES) as [Exclude<keyof CuentasMovimientos, "bancos">, string][]) {
    const valor = config[clave];
    if (typeof valor !== "string" || !/^\d+$/.test(valor)) {
      throw new Error(`Configuración de cuentas de movimientos incompleta: falta "${clave}"`);
    }
    resultado[propiedad] = valor;
  }
  const bancos = (config.bancos ?? {}) as Record<string, unknown>;
  for (const [nombre, cuenta] of Object.entries(bancos)) {
    if (typeof cuenta === "string") resultado.bancos[normalizarBanco(nombre)] = cuenta;
  }
  return resultado;
}

function normalizarBanco(nombre: string): string {
  return nombre.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
}

/** Cuenta contable del banco de origen. `conocido` es false si el banco no está configurado. */
export function cuentaBanco(banco: string | null, cuentas: CuentasMovimientos): { cuenta: string; conocido: boolean; informado: boolean } {
  if (!banco?.trim()) return { cuenta: cuentas.bancoPorDefecto, conocido: true, informado: false };
  const nombre = normalizarBanco(banco);
  const clave = Object.keys(cuentas.bancos).find((b) => nombre.includes(b) || b.includes(nombre));
  return clave
    ? { cuenta: cuentas.bancos[clave], conocido: true, informado: true }
    : { cuenta: cuentas.bancoPorDefecto, conocido: false, informado: true };
}

function cuentaComponente(concepto: ConceptoComponente, c: CuentasMovimientos): string | null {
  switch (concepto) {
    case "intereses_mora": return c.interesesMora;
    case "sancion": return c.sanciones;
    case "salud": return c.aportesSalud;
    case "pension": return c.aportesPension;
    case "arl": return c.aportesArl;
    case "caja_compensacion": return c.aportesCaja;
    case "parafiscales": return c.aportesParafiscales;
    case "arancel": return c.arancel;
    case "iva_importacion": return c.ivaImportacion;
    case "comision_bancaria": return c.comisionesBancarias;
    case "gmf": return c.gmf;
    default: return null; // capital / otro → cuenta principal
  }
}

/** Cuenta que recibe el valor principal (lo que no se desglosa en componentes). */
export function cuentaPrincipalMovimiento(
  clase: ClaseMovimiento,
  impuesto: ImpuestoPagado | null,
  c: CuentasMovimientos,
  cuentaDestino: string | null,
): string | null {
  switch (clase) {
    case "pago_impuestos":
      return impuesto === "iva" ? c.ivaPorPagar
        : impuesto === "retencion_fuente" ? c.retefuentePorPagar
        : impuesto === "renta" ? c.rentaPorPagar
        : impuesto === "ica" ? c.icaPorPagar
        : c.otrosImpuestosPorPagar;
    case "planilla_seguridad_social":
      return c.aportesSalud;
    case "pago_nomina":
      return c.sueldos;
    case "declaracion_importacion":
      return c.arancel;
    case "transferencia":
      return cuentaDestino;
    case "aporte_socio":
      return c.aportesSocios;
  }
}

export interface MovimientoParaAsiento {
  clase: ClaseMovimiento;
  referencia: string | null;
  fecha: string;
  terceroNombre: string;
  /** Valor total que sale del banco, en COP. */
  totalCop: number;
  /** Desglose en COP; lo no desglosado va a la cuenta principal. */
  componentesCop: Componente[];
  impuesto: ImpuestoPagado | null;
  cuentaBanco: string;
  /** Transferencias: cuenta por pagar del proveedor, o la cuenta de gasto/compra si no hay factura. */
  cuentaDestino: string | null;
  /** Cuenta principal corregida por una persona; reemplaza la que se deduce de la clase. */
  cuentaPrincipal?: string | null;
}

export class ErrorMovimiento extends Error {}

const ETIQUETAS: Record<ClaseMovimiento, string> = {
  pago_impuestos: "Pago de impuestos",
  planilla_seguridad_social: "Planilla PILA",
  pago_nomina: "Pago de nómina",
  transferencia: "Transferencia",
  declaracion_importacion: "Tributos de importación",
  aporte_socio: "Aporte de socio",
};

/** Movimientos en los que el dinero ENTRA al banco (el resto son salidas). */
export const CLASES_ENTRADA: readonly ClaseMovimiento[] = ["aporte_socio"];

export function generarAsientoMovimiento(m: MovimientoParaAsiento, c: CuentasMovimientos): Asiento {
  const total = aCentavos(m.totalCop);
  if (total <= 0) throw new ErrorMovimiento("El valor del movimiento debe ser mayor que cero");
  const principal = m.cuentaPrincipal || cuentaPrincipalMovimiento(m.clase, m.impuesto, c, m.cuentaDestino);
  if (!principal) throw new ErrorMovimiento("No se pudo determinar la cuenta a debitar");

  const descripcion = `${ETIQUETAS[m.clase]}${m.referencia ? ` ${m.referencia}` : ""} - ${m.terceroNombre}`;

  // Entrada de dinero (aporte): débito al banco, crédito a la cuenta principal. Sin desglose.
  if (CLASES_ENTRADA.includes(m.clase)) {
    return {
      fecha: m.fecha,
      descripcion,
      lineas: [
        { cuenta: m.cuentaBanco, descripcion: "Entrada a banco", debito: total / 100, credito: 0 },
        { cuenta: principal, descripcion, debito: 0, credito: total / 100 },
      ],
    };
  }

  const debitos = new Map<string, number>();
  let desglosado = 0;
  for (const comp of m.componentesCop) {
    const cuenta = cuentaComponente(comp.concepto, c);
    const valor = aCentavos(comp.valor);
    if (!cuenta || valor <= 0) continue;
    debitos.set(cuenta, (debitos.get(cuenta) ?? 0) + valor);
    desglosado += valor;
  }
  const resto = total - desglosado;
  if (resto < 0) throw new ErrorMovimiento("El desglose supera el valor total del movimiento");
  if (resto > 0) debitos.set(principal, (debitos.get(principal) ?? 0) + resto);

  const lineas = [
    ...[...debitos].map(([cuenta, valor]) => ({
      cuenta,
      descripcion: cuenta === principal ? descripcion : "Desglose",
      debito: valor / 100,
      credito: 0,
    })),
    { cuenta: m.cuentaBanco, descripcion: "Salida de banco", debito: 0, credito: total / 100 },
  ];
  return { fecha: m.fecha, descripcion, lineas };
}

export interface DatosMovimiento {
  clase: ClaseMovimiento;
  referencia: string | null;
  fecha: string | null;
  valorTotal: number | null;
  componentes: Componente[];
  beneficiario: string | null;
  confianzaGeneral: number;
}

export interface ContextoMovimiento {
  periodoCarpeta: PeriodoCarpeta;
  hoy: string;
  umbralConfianza: number;
  bancoConocido: boolean;
  bancoInformado: boolean;
  cuentaDestino: string | null;
}

export function validarMovimiento(d: DatosMovimiento, ctx: ContextoMovimiento): Hallazgo[] {
  const h: Hallazgo[] = [];
  const error = (codigo: string, mensaje: string) => h.push({ codigo, nivel: "error", mensaje });
  const advertencia = (codigo: string, mensaje: string) => h.push({ codigo, nivel: "advertencia", mensaje });

  if (!d.fecha) error("campo_faltante", "Falta la fecha del movimiento");
  else if (!fechaValida(d.fecha)) error("fecha_invalida", `Fecha inválida: ${d.fecha}`);
  else {
    if (d.fecha > ctx.hoy) error("fecha_futura", "La fecha del movimiento está en el futuro");
    const [anio, mes] = d.fecha.split("-").map(Number);
    const { anio: a, mes: m } = ctx.periodoCarpeta;
    if (a !== null && m !== null && (anio !== a || mes !== m)) {
      advertencia("fecha_fuera_de_carpeta", `La fecha (${d.fecha}) no corresponde al mes de la carpeta (${a}-${String(m).padStart(2, "0")})`);
    }
  }

  if (d.valorTotal === null || !(d.valorTotal > 0)) error("campo_faltante", "Falta el valor del movimiento");
  else {
    const desglose = d.componentes.reduce((s, c) => s + (c.concepto === "capital" || c.concepto === "otro" ? 0 : c.valor), 0);
    if (aCentavos(desglose) > aCentavos(d.valorTotal)) error("desglose_invalido", "El desglose supera el valor total");
  }
  if (!d.referencia) advertencia("sin_referencia", "El movimiento no tiene número de referencia; no se podrán detectar duplicados");
  if (!d.beneficiario) error("sin_tercero", d.clase === "aporte_socio" ? "No se identificó qué socio hizo el aporte" : "No se identificó a quién se le pagó");

  if (!ctx.bancoConocido) error("banco_no_configurado", "El banco de origen no está configurado en las cuentas de movimientos");
  else if (!ctx.bancoInformado) advertencia("banco_supuesto", "El documento no indica el banco; se usó el banco por defecto");

  if (d.clase === "planilla_seguridad_social" && d.componentes.length === 0) {
    advertencia("sin_desglose", "Planilla sin desglose por subsistema; el total se registró como aportes a salud");
  }
  if (d.clase === "transferencia" && !ctx.cuentaDestino) error("sin_cuenta", "No se pudo determinar la cuenta de la transferencia");

  if (d.confianzaGeneral < ctx.umbralConfianza) {
    error("confianza_baja", `Confianza de la lectura ${Math.round(d.confianzaGeneral * 100)}% (mínimo ${Math.round(ctx.umbralConfianza * 100)}%)`);
  }
  return h;
}
