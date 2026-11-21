import { sincronizarAhora } from "./sincronizacion";

// Reloj de la sincronización automática. Variables opcionales en .env.local:
//   SYNC_AUTOMATICA=off        → apagarla
//   SYNC_INTERVALO_MINUTOS=15  → cada cuánto revisa el Drive (mínimo 5)

const ESPERA_INICIAL_MS = 15_000; // deja que el servidor termine de arrancar

const global = globalThis as typeof globalThis & { __paguroReloj?: ReturnType<typeof setInterval> };

export function minutosIntervalo(): number {
  const n = Number(process.env.SYNC_INTERVALO_MINUTOS ?? 15);
  return Number.isFinite(n) && n >= 5 ? n : 15;
}

async function vuelta() {
  const r = await sincronizarAhora("automatica");
  if ("ocupado" in r) return;
  const nuevos = r.lote?.procesados ?? 0;
  if (!r.ok) console.error(`[sincronizacion] Falló: ${r.error}`);
  else if (nuevos > 0 || (r.lote?.errores ?? 0) > 0) console.log(`[sincronizacion] ${nuevos} documentos nuevos, ${r.lote?.errores ?? 0} con error`);
}

export function iniciarSincronizacionAutomatica(): void {
  if (process.env.SYNC_AUTOMATICA === "off") {
    console.log("[sincronizacion] Automática apagada (SYNC_AUTOMATICA=off)");
    return;
  }
  if (global.__paguroReloj) return; // ya corre (recarga en caliente de npm run dev)
  const minutos = minutosIntervalo();
  global.__paguroReloj = setInterval(() => void vuelta().catch((e) => console.error("[sincronizacion]", e)), minutos * 60_000);
  global.__paguroReloj.unref?.();
  setTimeout(() => void vuelta().catch((e) => console.error("[sincronizacion]", e)), ESPERA_INICIAL_MS).unref?.();
  console.log(`[sincronizacion] Automática cada ${minutos} minutos`);
}
