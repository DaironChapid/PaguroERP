import { ExtractorAnthropic } from "./anthropic";
import type { ExtractorFacturas } from "./proveedor";

export * from "./errores";
export * from "./esquema";
export * from "./prompt";
export * from "./proveedor";

/** Crea el extractor según AI_PROVIDER. Para agregar otro proveedor, implementa ExtractorFacturas. */
export function crearExtractor(): ExtractorFacturas {
  const proveedor = process.env.AI_PROVIDER ?? "anthropic";
  switch (proveedor) {
    case "anthropic":
      return new ExtractorAnthropic();
    default:
      throw new Error(`Proveedor de IA no soportado: ${proveedor}`);
  }
}
