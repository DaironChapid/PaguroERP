import type { PeriodoCarpeta } from "./carpeta";
import { verificarCuadre, type ModoTotal } from "./montos";
import { validarNit } from "./nit";
import type { EstadoFactura, Hallazgo, MontosFactura, TipoFactura } from "./tipos";

export interface DatosFactura {
  esFactura: boolean;
  tipoDocumento: string | null;
  numero: string | null;
  fechaEmision: string | null; // YYYY-MM-DD
  fechaVencimiento: string | null;
  emisorNit: string | null;
  receptorNit: string | null;
  moneda: string;
  montos: MontosFactura;
  confianzaGeneral: number;
  confianzaCampos?: Record<string, number>;
}

export interface ContextoValidacion {
  tipo: TipoFactura | null;
  periodoCarpeta: PeriodoCarpeta;
  hoy: string; // YYYY-MM-DD, se inyecta para que la función sea pura
  tolerancia: number;
  umbralConfianza: number;
  /** Ya existe otra factura del mismo tercero con el mismo número. */
  duplicada: boolean;
  cuentaAsignada: boolean;
}

export interface ResultadoValidacion {
  hallazgos: Hallazgo[];
  modoTotal: ModoTotal | null;
}

const FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;

export function fechaValida(valor: string): boolean {
  const m = valor.match(FECHA);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]);
}

const NOMBRES_CAMPOS: Record<string, string> = {
  numero: "número de factura",
  fechaEmision: "fecha de emisión",
  emisorNit: "NIT del emisor",
  receptorNit: "NIT del receptor",
  subtotal: "subtotal",
  total: "total",
};

export function validarFactura(d: DatosFactura, ctx: ContextoValidacion): ResultadoValidacion {
  const hallazgos: Hallazgo[] = [];
  const error = (codigo: string, mensaje: string) => hallazgos.push({ codigo, nivel: "error", mensaje });
  const advertencia = (codigo: string, mensaje: string) => hallazgos.push({ codigo, nivel: "advertencia", mensaje });

  if (d.tipoDocumento === "nota_credito") {
    error("nota_credito", "Las notas crédito no se contabilizan automáticamente en esta versión");
  }

  // Campos obligatorios
  const exterior = d.tipoDocumento === "invoice_exterior";
  const obligatorios: [keyof typeof NOMBRES_CAMPOS, unknown][] = [
    ["numero", d.numero],
    ["fechaEmision", d.fechaEmision],
    ["subtotal", d.montos.subtotal],
    ["total", d.montos.total],
  ];
  // Las facturas del exterior a veces no traen identificador tributario.
  if (!exterior) obligatorios.push(["emisorNit", d.emisorNit]);
  else if (!d.emisorNit) {
    advertencia("exterior_sin_identificacion", "Factura del exterior sin identificador tributario del proveedor");
  }
  if (ctx.tipo === "venta") obligatorios.push(["receptorNit", d.receptorNit]);
  for (const [campo, valor] of obligatorios) {
    if (valor === null || valor === undefined || valor === "") {
      error("campo_faltante", `Falta el campo obligatorio: ${NOMBRES_CAMPOS[campo]}`);
    }
  }

  // Fechas
  if (d.fechaEmision) {
    if (!fechaValida(d.fechaEmision)) {
      error("fecha_invalida", `Fecha de emisión inválida: ${d.fechaEmision}`);
    } else {
      if (d.fechaEmision > ctx.hoy) {
        error("fecha_futura", "La fecha de emisión está en el futuro");
      }
      const [anio, mes] = d.fechaEmision.split("-").map(Number);
      const { anio: anioCarpeta, mes: mesCarpeta } = ctx.periodoCarpeta;
      if (anioCarpeta !== null && mesCarpeta !== null && (anio !== anioCarpeta || mes !== mesCarpeta)) {
        advertencia(
          "fecha_fuera_de_carpeta",
          `La fecha (${d.fechaEmision}) no corresponde al mes de la carpeta (${anioCarpeta}-${String(mesCarpeta).padStart(2, "0")})`,
        );
      } else if (anioCarpeta !== null && mesCarpeta === null && anio !== anioCarpeta) {
        advertencia("fecha_fuera_de_carpeta", `La fecha (${d.fechaEmision}) no corresponde al año de la carpeta (${anioCarpeta})`);
      }
    }
  }
  if (d.fechaVencimiento) {
    if (!fechaValida(d.fechaVencimiento)) {
      advertencia("fecha_invalida", `Fecha de vencimiento inválida: ${d.fechaVencimiento}`);
    } else if (d.fechaEmision && d.fechaVencimiento < d.fechaEmision) {
      advertencia("vencimiento_anterior", "La fecha de vencimiento es anterior a la de emisión");
    }
  }

  // NIT
  if (d.emisorNit) {
    const v = validarNit(d.emisorNit);
    if (!v.valido) error("nit_emisor_invalido", `NIT del emisor inválido: ${v.motivo}`);
  }
  if (d.receptorNit) {
    const v = validarNit(d.receptorNit);
    if (!v.valido) advertencia("nit_receptor_invalido", `NIT del receptor inválido: ${v.motivo}`);
  }

  // Moneda y montos
  if (!/^[A-Z]{3}$/.test(d.moneda)) {
    error("moneda_invalida", `Moneda no reconocida: ${d.moneda}`);
  }
  const montos = Object.entries(d.montos) as [string, number | null][];
  if (montos.some(([, valor]) => valor !== null && valor < 0)) {
    error("monto_negativo", "Hay montos negativos");
  }

  let modoTotal: ModoTotal | null = null;
  if (d.montos.subtotal !== null && d.montos.total !== null) {
    const cuadre = verificarCuadre(d.montos, ctx.tolerancia);
    modoTotal = cuadre.modo;
    if (!cuadre.cuadra) {
      error(
        "no_cuadra",
        `Subtotal + impuestos − retenciones no coincide con el total (diferencia ${cuadre.diferencia})`,
      );
    }
  }

  if (ctx.duplicada) {
    error("duplicada", "Ya existe una factura de este tercero con el mismo número");
  }
  if (!ctx.cuentaAsignada) {
    error("sin_cuenta", "No se pudo asignar una cuenta contable");
  }

  // Confianza
  if (d.confianzaGeneral < ctx.umbralConfianza) {
    error(
      "confianza_baja",
      `Confianza de la lectura ${Math.round(d.confianzaGeneral * 100)}% (mínimo ${Math.round(ctx.umbralConfianza * 100)}%)`,
    );
  }
  const dudosos = Object.entries(d.confianzaCampos ?? {})
    .filter(([, c]) => c < ctx.umbralConfianza)
    .map(([campo]) => campo);
  if (dudosos.length > 0) {
    advertencia("campos_dudosos", `Campos con lectura dudosa: ${dudosos.join(", ")}`);
  }

  return { hallazgos, modoTotal };
}

export interface EntradaDecision {
  esFactura: boolean;
  hallazgos: Hallazgo[];
  autoAprobacion: boolean;
}

export function decidirEstado(e: EntradaDecision): EstadoFactura {
  if (!e.esFactura) return "descartada";
  if (e.hallazgos.some((h) => h.nivel === "error")) return "pendiente_revision";
  if (!e.autoAprobacion) return "pendiente_revision";
  return "aprobada";
}
