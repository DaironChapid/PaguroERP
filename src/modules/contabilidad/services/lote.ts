import { crearExtractor } from "../ai";
import { ClienteDrive } from "../drive/cliente";
import { crearClienteServicio, exigir, type BaseDatos } from "../repo/supabase";
import { cargarContexto } from "./contexto";
import { construirFilaArchivo, sincronizarInventario, type ResumenInventario } from "./inventario";
import { procesarArchivo, type Dependencias, type ResultadoArchivo } from "./procesar";

// Orquestación: sincronizar el Drive, procesar lotes de pendientes y
// procesar un archivo puntual (lo que usa n8n).

export const USUARIO_SISTEMA = "sistema (IA)";

function hoyColombia(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
}

export async function crearDependencias(db: BaseDatos = crearClienteServicio()): Promise<Dependencias> {
  return {
    db,
    drive: new ClienteDrive(),
    extractor: crearExtractor(),
    ctx: await cargarContexto(db),
    hoy: hoyColombia(),
    usuario: USUARIO_SISTEMA,
  };
}

function raizDrive(): string {
  const raiz = process.env.DRIVE_ROOT_FOLDER_ID;
  if (!raiz) throw new Error("Falta configurar DRIVE_ROOT_FOLDER_ID");
  return raiz;
}

/** Paso 1: inventario del Drive, sin IA. */
export async function sincronizarDrive(deps?: Dependencias, alAvanzar?: (vistos: number) => void): Promise<ResumenInventario> {
  const d = deps ?? (await crearDependencias());
  return sincronizarInventario(d.db, d.drive, raizDrive(), d.ctx.filtro, alAvanzar);
}

export interface ResumenLote {
  procesados: number;
  omitidos: number;
  errores: number;
  porEstado: Partial<Record<string, number>>;
  tokensEntrada: number;
  tokensSalida: number;
  pausado: boolean;
  motivoPausa?: string;
  resultados: ResultadoArchivo[];
}

/** Paso 2: procesa hasta `limite` archivos pendientes, `concurrencia` a la vez. Se detiene si un error lo exige (sin créditos, etc.). */
export async function procesarPendientes(
  opciones: { limite: number; concurrencia?: number; alProcesar?: (r: ResultadoArchivo) => void },
  deps?: Dependencias,
): Promise<ResumenLote> {
  const d = deps ?? (await crearDependencias());
  const concurrencia = Math.max(1, opciones.concurrencia ?? 3);
  const resumen: ResumenLote = { procesados: 0, omitidos: 0, errores: 0, porEstado: {}, tokensEntrada: 0, tokensSalida: 0, pausado: false, resultados: [] };

  let restantes = opciones.limite;
  while (restantes > 0 && !resumen.pausado) {
    const tomados = exigir(
      await d.db.rpc("tomar_archivos_pendientes", { p_limite: Math.min(concurrencia, restantes) }),
      "Tomando archivos pendientes",
    );
    if (tomados.length === 0) break;
    restantes -= tomados.length;

    const resultados = await Promise.all(tomados.map((a) => procesarArchivo(d, a)));
    for (const r of resultados) {
      resumen.resultados.push(r);
      resumen.tokensEntrada += r.tokensEntrada;
      resumen.tokensSalida += r.tokensSalida;
      if (r.resultado === "procesado") resumen.procesados++;
      else if (r.resultado === "omitido") resumen.omitidos++;
      else resumen.errores++;
      if (r.estadoFactura) resumen.porEstado[r.estadoFactura] = (resumen.porEstado[r.estadoFactura] ?? 0) + 1;
      if (r.pausarLote && !resumen.pausado) {
        resumen.pausado = true;
        resumen.motivoPausa = r.mensaje;
      }
      opciones.alProcesar?.(r);
    }
  }
  return resumen;
}

/**
 * Procesa un archivo puntual por su ID de Drive (endpoint usado por n8n).
 * Idempotente: si ya se procesó con el mismo md5, no vuelve a gastar IA.
 */
export async function procesarPorDriveId(driveFileId: string, deps?: Dependencias): Promise<ResultadoArchivo | { omitido: string }> {
  const d = deps ?? (await crearDependencias());
  const buscar = () =>
    d.db
      .from("archivos_drive")
      .select("drive_file_id, estado, md5_procesado, error_codigo, ultimo_error, ruta")
      .eq("drive_file_id", driveFileId)
      .maybeSingle()
      .then((r) => r.data);

  // Un archivo que aún no está en el inventario: se inventaría el Drive (sin IA) para conocer su carpeta.
  let existente = await buscar();
  if (!existente) {
    await sincronizarInventario(d.db, d.drive, raizDrive(), d.ctx.filtro);
    existente = await buscar();
    if (!existente) return { omitido: "El archivo no está dentro de la carpeta raíz configurada" };
  }

  const archivoDrive = await d.drive.obtenerMetadatos(driveFileId, existente.ruta ? existente.ruta.split("/") : []);
  if (!archivoDrive) return { omitido: "Es una carpeta, no un archivo" };
  const nombreRaiz = (await d.drive.obtener(raizDrive())).name;
  const fila = construirFilaArchivo(archivoDrive, existente, d.ctx.filtro, nombreRaiz);
  if (fila.estado === "ignorado") {
    await d.db.from("archivos_drive").upsert(fila, { onConflict: "drive_file_id" });
    return { omitido: fila.ultimo_error ?? "Archivo ignorado por el filtro" };
  }
  if (fila.estado === "procesado") return { omitido: "Ya procesado y sin cambios" };
  if (fila.estado === "procesando") return { omitido: "Ya se está procesando" };

  const archivo = exigir(
    await d.db
      .from("archivos_drive")
      .upsert({ ...fila, estado: "procesando" }, { onConflict: "drive_file_id" })
      .select("*")
      .single(),
    "Registrando archivo",
  );
  return procesarArchivo(d, archivo);
}
