import { mismoNit, normalizarNit } from "./nit";
import type { Hallazgo, TipoFactura } from "./tipos";

export interface EntradaClasificacion {
  nitEmisor: string | null;
  nitReceptor: string | null;
  nitEmpresa: string;
  /** Tipo de la categoría asignada (compra de mercancía/activos vs. gasto). */
  tipoCategoria: TipoFactura | null;
}

export interface ResultadoClasificacion {
  tipo: TipoFactura | null;
  /** Quién es el tercero de la factura: el emisor (compras/gastos) o el receptor (ventas). */
  contraparte: "emisor" | "receptor" | null;
  hallazgos: Hallazgo[];
}

/**
 * Decide si la factura es compra, gasto o venta comparando los NIT con el
 * de la empresa. Lo decide el código y no la IA para que sea determinista.
 */
export function clasificarFactura(e: EntradaClasificacion): ResultadoClasificacion {
  if (!normalizarNit(e.nitEmpresa)) {
    throw new Error("Falta configurar el NIT de la empresa (PAGURO_NIT)");
  }
  const hallazgos: Hallazgo[] = [];

  if (mismoNit(e.nitEmisor, e.nitEmpresa)) {
    if (e.tipoCategoria && e.tipoCategoria !== "venta") {
      hallazgos.push({
        codigo: "categoria_incoherente",
        nivel: "advertencia",
        mensaje: "La empresa es el emisor (venta) pero la categoría sugerida es de compra o gasto",
      });
    }
    return { tipo: "venta", contraparte: "receptor", hallazgos };
  }

  const tipoEgreso: TipoFactura = e.tipoCategoria === "compra" ? "compra" : "gasto";
  if (e.tipoCategoria === "venta") {
    hallazgos.push({
      codigo: "categoria_incoherente",
      nivel: "advertencia",
      mensaje: "La empresa no es el emisor pero la categoría sugerida es de venta",
    });
  }

  if (mismoNit(e.nitReceptor, e.nitEmpresa)) {
    return { tipo: tipoEgreso, contraparte: "emisor", hallazgos };
  }

  if (!normalizarNit(e.nitReceptor)) {
    hallazgos.push({
      codigo: "receptor_no_identificado",
      nivel: "advertencia",
      mensaje: "La factura no trae el NIT del comprador; puede no servir como soporte fiscal",
    });
    return { tipo: tipoEgreso, contraparte: "emisor", hallazgos };
  }

  hallazgos.push({
    codigo: "empresa_no_es_parte",
    nivel: "error",
    mensaje: "Ni el emisor ni el receptor tienen el NIT de la empresa",
  });
  return { tipo: null, contraparte: null, hallazgos };
}

const SUFIJOS_SOCIETARIOS = new Set(["corp", "corporacion", "sas", "ltda", "inc", "cia"]);

const palabras = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

/**
 * ¿El nombre corresponde a la propia empresa? Sirve cuando el documento no
 * trae NIT: "Paguro Bancolombia Negocios", "CORPORACIÓN PAGURO SAS"…
 * Se exigen todas las palabras distintivas del nombre (sin sufijos societarios).
 */
export function esNombreDeLaEmpresa(nombre: string | null, nombreEmpresa: string): boolean {
  if (!nombre) return false;
  const clave = palabras(nombreEmpresa).filter((p) => !SUFIJOS_SOCIETARIOS.has(p) && p.length > 2);
  const texto = new Set(palabras(nombre));
  return clave.length > 0 && clave.every((p) => texto.has(p));
}

/**
 * Elige la cuenta contable: la sugerida por la IA si está entre las
 * permitidas para el tipo de factura; si no, la de la categoría.
 */
export function resolverCuenta(
  sugerida: string | null,
  cuentaCategoria: string | null,
  permitidas: ReadonlySet<string>,
): { cuenta: string | null; origen: "ia" | "categoria" | null } {
  if (sugerida && permitidas.has(sugerida)) return { cuenta: sugerida, origen: "ia" };
  if (cuentaCategoria) return { cuenta: cuentaCategoria, origen: "categoria" };
  return { cuenta: null, origen: null };
}
