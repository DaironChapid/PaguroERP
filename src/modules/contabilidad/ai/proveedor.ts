import type { Extraccion } from "./esquema";
import type { ContextoPrompt } from "./prompt";

export interface DocumentoEntrada {
  datos: Buffer;
  mime: string;
  nombre: string;
}

export interface ResultadoExtraccion {
  datos: Extraccion;
  modelo: string;
  tokensEntrada: number;
  tokensSalida: number;
  /** Costo estimado en USD si se configuraron los precios; null si no. */
  costoUsd: number | null;
}

/** Contrato que cumple cualquier proveedor de IA (Anthropic hoy; otros después). */
export interface ExtractorFacturas {
  readonly modelo: string;
  extraer(documento: DocumentoEntrada, contexto: ContextoPrompt): Promise<ResultadoExtraccion>;
}

export const MIME_IMAGEN = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
export const MIME_SOPORTADOS = ["application/pdf", ...MIME_IMAGEN] as const;

export function estimarCostoUsd(tokensEntrada: number, tokensSalida: number): number | null {
  const entrada = Number(process.env.AI_PRECIO_ENTRADA_MTOK);
  const salida = Number(process.env.AI_PRECIO_SALIDA_MTOK);
  if (!process.env.AI_PRECIO_ENTRADA_MTOK || !process.env.AI_PRECIO_SALIDA_MTOK || isNaN(entrada) || isNaN(salida)) {
    return null;
  }
  return (tokensEntrada * entrada + tokensSalida * salida) / 1_000_000;
}
