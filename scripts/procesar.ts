// Procesa con IA archivos pendientes del inventario.
// Uso: npm run procesar -- [cantidad=5] [concurrencia=3]
import { procesarPendientes } from "../src/modules/contabilidad/services/lote";

const ETIQUETAS: Record<string, string> = {
  aprobada: "✔ aprobada",
  pendiente_revision: "⚠ a revisión",
  descartada: "· descartada",
  rechazada: "✘ rechazada",
  error: "✘ error",
};

async function main() {
  const limite = Number(process.argv[2] ?? 5);
  const concurrencia = Number(process.argv[3] ?? 3);
  console.log(`Procesando hasta ${limite} archivos (${concurrencia} a la vez)…\n`);

  const r = await procesarPendientes({
    limite,
    concurrencia,
    alProcesar: (a) => {
      const estado =
        a.resultado === "procesado" ? ETIQUETAS[a.estadoFactura ?? ""] ?? a.estadoFactura : a.resultado === "omitido" ? "· omitido" : "✘ error";
      console.log(`${estado.padEnd(14)} ${a.nombre}${a.facturaId ? `  (factura #${a.facturaId})` : ""}${a.mensaje ? `\n${" ".repeat(15)}${a.mensaje}` : ""}`);
    },
  });

  console.log(`\nProcesados: ${r.procesados} · Omitidos: ${r.omitidos} · Errores: ${r.errores}`);
  console.log(`Facturas por estado: ${JSON.stringify(r.porEstado)}`);
  console.log(`Tokens: ${r.tokensEntrada} entrada / ${r.tokensSalida} salida`);
  if (r.pausado) console.log(`\n⏸ Lote pausado: ${r.motivoPausa}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
