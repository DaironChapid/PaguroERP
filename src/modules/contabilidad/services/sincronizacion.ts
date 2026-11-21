import { crearClienteServicio, type BaseDatos } from "../repo/supabase";
import type { ResumenInventario } from "./inventario";
import { crearDependencias, procesarPendientes, sincronizarDrive, type ResumenLote } from "./lote";

// Sincronización del Drive (inventario + lectura con IA de lo nuevo).
// La usan el reloj automático (instrumentation.ts) y el enlace "Sincronizar
// ahora". Nunca corren dos a la vez dentro del mismo servidor, y el último
// resultado se guarda en configuracion.estado_sincronizacion para mostrarlo.

export const CLAVE_ESTADO = "estado_sincronizacion";
export const LIMITE_POR_VUELTA = 20;

export type OrigenSincronizacion = "automatica" | "manual";

export interface EstadoSincronizacion {
  origen: OrigenSincronizacion;
  inicio: string;
  fin: string;
  ok: boolean;
  error?: string;
  inventario?: ResumenInventario;
  lote?: Omit<ResumenLote, "resultados">;
  archivos?: { nombre: string; resultado: string; estadoFactura?: string | null; mensaje?: string | null }[];
}

export type ResultadoSincronizacion = EstadoSincronizacion | { ocupado: true };

// En globalThis para que el candado sea uno solo aunque Next cargue este
// módulo en varios paquetes (instrumentation y rutas) del mismo proceso.
const global = globalThis as typeof globalThis & { __paguroSyncEnCurso?: Promise<EstadoSincronizacion> };

export function sincronizacionEnCurso(): boolean {
  return Boolean(global.__paguroSyncEnCurso);
}

async function guardarEstado(db: BaseDatos, estado: EstadoSincronizacion): Promise<void> {
  const { error } = await db.from("configuracion").upsert(
    { clave: CLAVE_ESTADO, valor: JSON.parse(JSON.stringify(estado)), descripcion: "Resultado de la última sincronización con el Drive (la escribe el sistema)" },
    { onConflict: "clave" },
  );
  if (error) console.error("[sincronizacion] No se pudo guardar el estado:", error.message);
}

/** Traduce los errores técnicos más comunes a una instrucción que se pueda seguir. */
export function mensajeClaro(error: string): string {
  if (/invalid_rapt|invalid_grant|reauth|Could not load the default credentials/i.test(error)) {
    return "Google pide volver a iniciar sesión para leer el Drive. En una terminal ejecuta: gcloud auth application-default login (con la cuenta de Paguro) y espera la siguiente sincronización.";
  }
  if (/ENOTFOUND|ECONNRESET|ETIMEDOUT|fetch failed/i.test(error)) {
    return "No hay conexión a internet o Google/Supabase no respondieron. Se reintentará en la siguiente vuelta.";
  }
  return error;
}

async function ejecutar(origen: OrigenSincronizacion, limite: number): Promise<EstadoSincronizacion> {
  const inicio = new Date().toISOString();
  const db = crearClienteServicio();
  let estado: EstadoSincronizacion;
  try {
    const deps = await crearDependencias(db);
    const inventario = await sincronizarDrive(deps);
    const { resultados, ...lote } = await procesarPendientes({ limite }, deps);
    estado = {
      origen,
      inicio,
      fin: new Date().toISOString(),
      ok: !lote.pausado,
      error: lote.pausado ? lote.motivoPausa : undefined,
      inventario,
      lote,
      archivos: resultados.map(({ nombre, resultado, estadoFactura, mensaje }) => ({ nombre, resultado, estadoFactura, mensaje })),
    };
  } catch (error) {
    estado = { origen, inicio, fin: new Date().toISOString(), ok: false, error: mensajeClaro(error instanceof Error ? error.message : String(error)) };
  }
  await guardarEstado(db, estado);
  return estado;
}

/** Sincroniza si no hay otra sincronización en curso; si la hay, devuelve { ocupado: true }. */
export async function sincronizarAhora(origen: OrigenSincronizacion, limite = LIMITE_POR_VUELTA): Promise<ResultadoSincronizacion> {
  if (global.__paguroSyncEnCurso) return { ocupado: true };
  const tarea = ejecutar(origen, limite);
  global.__paguroSyncEnCurso = tarea;
  try {
    return await tarea;
  } finally {
    global.__paguroSyncEnCurso = undefined;
  }
}
