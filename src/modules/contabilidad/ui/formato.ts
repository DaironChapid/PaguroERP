// Formatos y etiquetas en español para la interfaz.

const formatoCop = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const formatoNumero = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 });

export function cop(valor: number | string | null | undefined): string {
  if (valor === null || valor === undefined || valor === "") return "—";
  return formatoCop.format(Number(valor));
}

/** COP compacto para ejes y etiquetas: $1,2 M, $850 mil. */
export function copCorto(valor: number): string {
  const abs = Math.abs(valor);
  const signo = valor < 0 ? "−" : "";
  if (abs >= 1_000_000) return `${signo}$${formatoNumero.format(Math.round(abs / 100_000) / 10)} M`;
  if (abs >= 1_000) return `${signo}$${Math.round(abs / 1_000)} mil`;
  return `${signo}$${Math.round(abs)}`;
}

export function monto(valor: number | string | null | undefined, moneda = "COP"): string {
  if (valor === null || valor === undefined || valor === "") return "—";
  if (moneda === "COP") return cop(valor);
  return `${moneda} ${formatoNumero.format(Number(valor))}`;
}

export function numero(valor: number | string | null | undefined): string {
  if (valor === null || valor === undefined || valor === "") return "—";
  return formatoNumero.format(Number(valor));
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MESES_LARGOS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export function fecha(valor: string | null | undefined): string {
  if (!valor) return "—";
  const [a, m, d] = valor.slice(0, 10).split("-").map(Number);
  return `${d} ${MESES[m - 1]} ${a}`;
}

/** "2026-03" o "2026-03-01" → "mar 2026" (o "marzo 2026" con largo). */
export function mes(valor: string, largo = false): string {
  const [a, m] = valor.split("-").map(Number);
  return `${(largo ? MESES_LARGOS : MESES)[m - 1]} ${a}`;
}

export function porcentaje(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return "—";
  return `${Math.round(Number(valor) * 100)}%`;
}

export const ESTADOS: Record<string, { etiqueta: string; tono: "bien" | "aviso" | "critico" | "neutro" }> = {
  aprobada: { etiqueta: "Aprobada", tono: "bien" },
  pendiente_revision: { etiqueta: "En revisión", tono: "aviso" },
  rechazada: { etiqueta: "Rechazada", tono: "critico" },
  error: { etiqueta: "Error", tono: "critico" },
  descartada: { etiqueta: "Informativo", tono: "neutro" },
};

export const CLASES: Record<string, string> = {
  factura: "Factura",
  pago_impuestos: "Pago de impuestos",
  planilla_seguridad_social: "Planilla PILA",
  pago_nomina: "Pago de nómina",
  transferencia: "Transferencia",
  declaracion_importacion: "Tributos de importación",
  aporte_socio: "Aporte de socio",
  informativo: "Informativo",
};

export const TIPOS: Record<string, string> = {
  compra: "Compra",
  venta: "Venta",
  gasto: "Gasto",
  pago: "Pago",
};
