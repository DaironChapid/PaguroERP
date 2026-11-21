import { timingSafeEqual } from "node:crypto";
import { procesarPorDriveId, sincronizarDrive } from "../services/lote";
import { LIMITE_POR_VUELTA, sincronizarAhora } from "../services/sincronizacion";
import { exigirSesion } from "./sesion";

// Handlers de los endpoints internos (n8n, tareas programadas). Protegidos
// con el token compartido del header `x-contabilidad-token`.

export function tokenInternoValido(request: Request): boolean {
  const esperado = process.env.CONTABILIDAD_INTERNAL_TOKEN;
  const recibido = request.headers.get("x-contabilidad-token");
  if (!esperado || !recibido) return false;
  const a = Buffer.from(esperado);
  const b = Buffer.from(recibido);
  return a.length === b.length && timingSafeEqual(a, b);
}

const noAutorizado = () => Response.json({ error: "No autorizado" }, { status: 401 });

function errorInterno(error: unknown) {
  const mensaje = error instanceof Error ? error.message : String(error);
  console.error("[contabilidad]", mensaje);
  return Response.json({ error: mensaje }, { status: 500 });
}

/** POST /api/contabilidad/facturas/procesar  { drive_file_id } */
export async function procesarFactura(request: Request): Promise<Response> {
  if (!tokenInternoValido(request)) return noAutorizado();
  const cuerpo = (await request.json().catch(() => null)) as { drive_file_id?: unknown } | null;
  const id = cuerpo?.drive_file_id;
  if (typeof id !== "string" || !/^[\w-]{10,}$/.test(id)) {
    return Response.json({ error: "drive_file_id es obligatorio" }, { status: 400 });
  }
  try {
    const resultado = await procesarPorDriveId(id);
    if ("omitido" in resultado) return Response.json({ resultado: "omitido", motivo: resultado.omitido });
    // 503 cuando conviene que n8n reintente más tarde (sin créditos, límite de tasa…)
    const status = resultado.resultado === "error" && resultado.pausarLote ? 503 : 200;
    return Response.json(resultado, { status });
  } catch (error) {
    return errorInterno(error);
  }
}

/**
 * POST /api/contabilidad/sync  { procesar?: boolean = true, limite?: number = 20 }
 * Lo usan n8n o una tarea programada (token) y el botón de la app (sesión de editor).
 */
export async function sincronizar(request: Request): Promise<Response> {
  if (!tokenInternoValido(request)) {
    const sesion = await exigirSesion("editor");
    if (sesion instanceof Response) return sesion;
  }
  const cuerpo = (await request.json().catch(() => ({}))) as { procesar?: unknown; limite?: unknown };
  const limite = Math.min(Math.max(Number(cuerpo.limite ?? LIMITE_POR_VUELTA) || LIMITE_POR_VUELTA, 1), 200);
  try {
    if (cuerpo.procesar === false) return Response.json({ inventario: await sincronizarDrive() });
    const r = await sincronizarAhora("manual", limite);
    if ("ocupado" in r) {
      return Response.json({ error: "Ya hay una sincronización en curso. Espera a que termine." }, { status: 409 });
    }
    if (!r.ok && !r.lote) return Response.json({ error: r.error }, { status: 500 });
    return Response.json(r);
  } catch (error) {
    return errorInterno(error);
  }
}
