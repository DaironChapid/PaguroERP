// Resumen contable rápido desde las vistas de reportes.
// Uso: npm run resumen
import { crearClienteServicio } from "../repo/supabase";

const cop = (n: number | null) => `$${Math.round(Number(n ?? 0)).toLocaleString("es-CO")}`;

async function main() {
  const db = crearClienteServicio();
  const [estados, resultado, balance, impuestos] = await Promise.all([
    db.from("facturas").select("estado, clase_documento"),
    db.from("v_resultado_mensual").select("*").order("periodo"),
    db.rpc("balance_general", { p_fecha: new Date().toISOString().slice(0, 10) }),
    db.from("v_impuestos_periodo").select("*").order("periodo"),
  ]);

  const conteo = new Map<string, number>();
  for (const f of estados.data ?? []) conteo.set(`${f.estado} · ${f.clase_documento}`, (conteo.get(`${f.estado} · ${f.clase_documento}`) ?? 0) + 1);
  console.log("Documentos por estado y clase:");
  for (const [k, v] of [...conteo].sort()) console.log(`  ${String(v).padStart(3)}  ${k}`);

  console.log("\nEstado de resultados por mes (solo aprobados):");
  for (const r of resultado.data ?? []) {
    console.log(`  ${r.periodo?.slice(0, 7)}  ingresos ${cop(r.ingresos).padStart(14)}  costos ${cop(r.costos).padStart(12)}  gastos ${cop(r.gastos).padStart(13)}  utilidad ${cop(r.utilidad).padStart(14)}`);
  }

  const secciones = new Map<string, number>();
  for (const b of balance.data ?? []) secciones.set(b.seccion, (secciones.get(b.seccion) ?? 0) + Number(b.saldo));
  console.log("\nBalance general a hoy:");
  for (const [s, v] of secciones) console.log(`  ${s.padEnd(11)} ${cop(v)}`);
  const activo = secciones.get("activo") ?? 0;
  const pasivoPatrimonio = (secciones.get("pasivo") ?? 0) + (secciones.get("patrimonio") ?? 0);
  console.log(`  Cuadra (activo = pasivo + patrimonio): ${Math.abs(activo - pasivoPatrimonio) < 0.01 ? "sí" : "NO"}`);

  console.log("\nIVA por periodo:");
  for (const i of impuestos.data ?? []) {
    console.log(`  ${i.periodo?.slice(0, 7)}  generado ${cop(i.iva_generado).padStart(12)}  descontable ${cop(i.iva_descontable).padStart(12)}`);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
