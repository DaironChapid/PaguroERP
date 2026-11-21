// Muestra un resumen de las últimas facturas registradas, con sus hallazgos.
// Uso: npm run ver-facturas -- [cantidad=10] [estado]
import { crearClienteServicio } from "../src/modules/contabilidad/repo/supabase";

async function main() {
  const db = crearClienteServicio();
  let consulta = db
    .from("facturas")
    .select("id, estado, tipo, clase_documento, tipo_documento, numero, fecha_emision, moneda, subtotal, iva, total, confianza, hallazgos, observaciones, carpeta_origen, terceros(razon_social), categorias(nombre), archivos_drive!facturas_archivo_id_fkey(nombre)")
    .order("id", { ascending: false })
    .limit(Number(process.argv[2] ?? 10));
  if (process.argv[3]) consulta = consulta.eq("estado", process.argv[3]);
  const { data, error } = await consulta;
  if (error) throw error;
  for (const f of data.reverse()) {
    console.log(`\n#${f.id} [${f.estado}] ${f.archivos_drive?.nombre ?? ""}  (${f.carpeta_origen})`);
    console.log(`   ${f.clase_documento} · ${f.tipo_documento} · ${f.terceros?.razon_social ?? "sin tercero"} · N° ${f.numero ?? "-"} · ${f.fecha_emision ?? "-"}`);
    console.log(`   ${f.moneda} subtotal ${f.subtotal} · IVA ${f.iva} · total ${f.total} · ${f.categorias?.nombre ?? "sin categoría"} · confianza ${f.confianza}`);
    for (const h of (f.hallazgos as { nivel: string; mensaje: string }[]) ?? []) console.log(`   ${h.nivel === "error" ? "✘" : "!"} ${h.mensaje}`);
    if (f.observaciones) console.log(`   nota IA: ${f.observaciones}`);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
