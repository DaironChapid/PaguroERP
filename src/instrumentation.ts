// Next llama a register() una vez al encender el servidor (npm run dev / npm start).
// Aquí arranca el reloj que sincroniza el Drive sin que nadie dé clic.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  const { iniciarSincronizacionAutomatica } = await import("./modules/contabilidad/services/reloj");
  iniciarSincronizacionAutomatica();
}
