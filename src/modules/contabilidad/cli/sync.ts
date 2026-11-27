// Inventario del Drive (sin IA). Uso: npm run sync
import { sincronizarDrive } from "../services/lote";

async function main() {
  console.log("Recorriendo el Drive…");
  const r = await sincronizarDrive(undefined, (n) => console.log(`  ${n} archivos…`));
  console.log(`\nArchivos vistos: ${r.vistos}`);
  console.log(`Nuevos en el registro: ${r.nuevos}`);
  console.log(`Quedaron pendientes de procesar: ${r.pendientes}`);
  console.log(`Ignorados por el filtro o el formato: ${r.ignorados}`);
  console.log(`Ya no están en la carpeta configurada: ${r.fueraDeAlcance}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
