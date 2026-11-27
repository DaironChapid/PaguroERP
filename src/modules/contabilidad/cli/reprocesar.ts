// Vuelve a procesar con IA documentos ya registrados, por ejemplo después de
// mejorar las reglas.
// Uso: npm run reprocesar -- [filtro]
//   pendiente_revision (por defecto) · aprobada · descartada   → por estado
//   24,43                                                       → por número de documento
//   clase:transferencia,pago_nomina                             → por clase de documento
import { crearClienteServicio } from "../repo/supabase";

async function main() {
  const filtro = process.argv[2] ?? "pendiente_revision";
  const db = crearClienteServicio();
  let consulta = db.from("facturas").select("archivo_id").not("archivo_id", "is", null);
  if (/^\d+(,\d+)*$/.test(filtro)) consulta = consulta.in("id", filtro.split(",").map(Number));
  else if (filtro.startsWith("clase:")) consulta = consulta.in("clase_documento", filtro.slice(6).split(","));
  else consulta = consulta.eq("estado", filtro);

  const { data: facturas, error } = await consulta;
  if (error) throw error;
  const ids = facturas.map((f) => f.archivo_id!);
  if (ids.length === 0) return console.log(`No hay documentos para "${filtro}".`);
  const { error: e2 } = await db.from("archivos_drive").update({ estado: "pendiente", md5_procesado: null }).in("id", ids);
  if (e2) throw e2;
  console.log(`${ids.length} documento(s) devueltos a la cola. Ahora corre: npm run procesar -- ${ids.length}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
