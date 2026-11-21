import type { BaseDatos } from "../repo/supabase";
import { consultarTrm, ErrorTrm } from "../trm/cliente";

/** Pesos colombianos por unidad de `moneda` en `fecha`. Usa la caché de la tabla tasas_cambio. */
export async function obtenerTasa(db: BaseDatos, moneda: string, fecha: string): Promise<number> {
  if (moneda === "COP") return 1;
  if (moneda !== "USD") throw new ErrorTrm(`No hay una fuente de tasa de cambio para ${moneda}`);

  const { data } = await db.from("tasas_cambio").select("valor").eq("fecha", fecha).eq("moneda", moneda).maybeSingle();
  if (data) return Number(data.valor);

  const valor = await consultarTrm(fecha);
  await db.from("tasas_cambio").upsert({ fecha, moneda, valor, fuente: "datos.gov.co" });
  return valor;
}
