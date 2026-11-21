// Decide qué archivos del Drive se procesan con IA.

export interface FiltroDrive {
  /** Solo carpetas de primer nivel cuyo nombre contiene un año (01_2025, 2026, …). */
  soloCarpetasConAnio: boolean;
  /** Procesar archivos sueltos en la carpeta raíz. */
  incluirRaiz: boolean;
  /** Nombres de carpetas (en cualquier nivel) que nunca se procesan. */
  excluir: string[];
}

export const MIME_PROCESABLES = ["application/pdf", "image/jpeg", "image/png", "image/gif", "image/webp"];

export type MotivoExclusion = "formato" | "raiz" | "carpeta_sin_anio" | "carpeta_excluida";

export function filtroDesdeConfig(valor: unknown): FiltroDrive {
  const v = (valor ?? {}) as Record<string, unknown>;
  return {
    soloCarpetasConAnio: v.solo_carpetas_con_anio !== false,
    incluirRaiz: v.incluir_raiz === true,
    excluir: Array.isArray(v.excluir) ? v.excluir.filter((x): x is string => typeof x === "string") : [],
  };
}

const normalizar = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** null si se procesa; si no, el motivo por el que se ignora. */
export function motivoExclusion(ruta: string[], mime: string, filtro: FiltroDrive): MotivoExclusion | null {
  if (!MIME_PROCESABLES.includes(mime)) return "formato";
  if (ruta.length === 0) return filtro.incluirRaiz ? null : "raiz";

  const excluidas = new Set(filtro.excluir.map(normalizar));
  if (ruta.some((carpeta) => excluidas.has(normalizar(carpeta)))) return "carpeta_excluida";

  if (filtro.soloCarpetasConAnio && !/(^|[^0-9])(19|20)\d{2}([^0-9]|$)/.test(ruta[0])) {
    return "carpeta_sin_anio";
  }
  return null;
}
