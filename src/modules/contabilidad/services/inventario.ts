import { inferirPeriodoCarpeta, motivoExclusion, type FiltroDrive } from "../core";
import type { ArchivoDrive, ClienteDrive } from "../drive/cliente";
import { exigir, type BaseDatos, type Fila } from "../repo/supabase";

// Paso 1 de la sincronización (sin IA): registra en archivos_drive todo lo
// que hay en el Drive y decide qué queda pendiente de procesar.

type Existente = Pick<Fila<"archivos_drive">, "drive_file_id" | "estado" | "md5_procesado" | "error_codigo" | "ultimo_error">;

export interface ResumenInventario {
  vistos: number;
  nuevos: number;
  /** Archivos que quedaron pendientes de procesar (nuevos, modificados o reactivados). */
  pendientes: number;
  ignorados: number;
  /** Registrados antes pero que ya no están bajo la carpeta raíz. */
  fueraDeAlcance: number;
}

export const MENSAJE_FUERA_DE_ALCANCE = "Ya no está dentro de la carpeta configurada";

const MENSAJES_EXCLUSION = {
  formato: "Formato que no es PDF ni imagen",
  raiz: "Archivo suelto en la carpeta raíz",
  carpeta_sin_anio: "Carpeta que no corresponde a un año",
  carpeta_excluida: "Carpeta excluida en la configuración",
} as const;

/**
 * Construye la fila de archivos_drive para un archivo del Drive, conservando el estado si no cambió.
 * `nombreRaiz` se usa solo para deducir el periodo (por ejemplo, la raíz "02_2026" aporta el año).
 */
export function construirFilaArchivo(f: ArchivoDrive, existente: Existente | undefined, filtro: FiltroDrive, nombreRaiz = "") {
  const motivo = motivoExclusion(f.ruta, f.mime, filtro);
  const { anio, mes } = inferirPeriodoCarpeta([nombreRaiz, ...f.ruta]);

  let estado: string;
  let errorCodigo = existente?.error_codigo ?? null;
  let ultimoError = existente?.ultimo_error ?? null;

  if (motivo) {
    const enCurso = existente && (existente.estado === "procesado" || existente.estado === "procesando");
    estado = enCurso ? existente.estado : "ignorado";
    if (!enCurso) {
      errorCodigo = null;
      ultimoError = MENSAJES_EXCLUSION[motivo];
    }
  } else if (!existente || existente.estado === "ignorado") {
    estado = "pendiente";
    errorCodigo = null;
    ultimoError = null;
  } else if (existente.estado === "procesado" && f.md5 && f.md5 !== existente.md5_procesado) {
    estado = "pendiente"; // el archivo cambió en el Drive
  } else {
    estado = existente.estado;
  }

  return {
    drive_file_id: f.id,
    nombre: f.nombre,
    ruta: f.ruta.join("/"),
    mime: f.mime,
    md5: f.md5,
    tamano_bytes: f.tamanoBytes,
    modificado_drive: f.modificado,
    drive_url: f.url,
    anio_carpeta: anio,
    mes_carpeta: mes,
    estado,
    error_codigo: errorCodigo,
    ultimo_error: ultimoError,
    visto_en: new Date().toISOString(),
  };
}

async function cargarExistentes(db: BaseDatos): Promise<Map<string, Existente>> {
  const mapa = new Map<string, Existente>();
  for (let desde = 0; ; desde += 1000) {
    const pagina = exigir(
      await db
        .from("archivos_drive")
        .select("drive_file_id, estado, md5_procesado, error_codigo, ultimo_error")
        .order("id")
        .range(desde, desde + 999),
      "Leyendo archivos registrados",
    );
    for (const a of pagina) mapa.set(a.drive_file_id, a);
    if (pagina.length < 1000) return mapa;
  }
}

export async function sincronizarInventario(
  db: BaseDatos,
  drive: ClienteDrive,
  raizId: string,
  filtro: FiltroDrive,
  alAvanzar?: (vistos: number) => void,
): Promise<ResumenInventario> {
  const inicio = new Date().toISOString();
  const nombreRaiz = (await drive.obtener(raizId)).name;
  const existentes = await cargarExistentes(db);
  const resumen: ResumenInventario = { vistos: 0, nuevos: 0, pendientes: 0, ignorados: 0, fueraDeAlcance: 0 };
  let lote: ReturnType<typeof construirFilaArchivo>[] = [];

  const guardar = async () => {
    if (lote.length === 0) return;
    const { error } = await db.from("archivos_drive").upsert(lote, { onConflict: "drive_file_id" });
    if (error) throw new Error(`Guardando inventario: ${error.message}`);
    lote = [];
  };

  for await (const archivo of drive.recorrer(raizId)) {
    const existente = existentes.get(archivo.id);
    const fila = construirFilaArchivo(archivo, existente, filtro, nombreRaiz);
    resumen.vistos++;
    if (!existente) resumen.nuevos++;
    if (fila.estado === "pendiente" && existente?.estado !== "pendiente") resumen.pendientes++;
    if (fila.estado === "ignorado") resumen.ignorados++;
    lote.push(fila);
    if (lote.length >= 200) await guardar();
    if (resumen.vistos % 100 === 0) alAvanzar?.(resumen.vistos);
  }
  await guardar();

  // Lo que ya no aparece bajo la raíz (borrado, movido o fuera de la carpeta
  // configurada) deja de procesarse. Lo ya registrado en la contabilidad se conserva.
  const { data: fuera, error } = await db
    .from("archivos_drive")
    .update({ estado: "ignorado", error_codigo: null, ultimo_error: MENSAJE_FUERA_DE_ALCANCE })
    .lt("visto_en", inicio)
    .in("estado", ["pendiente", "error"])
    .select("id");
  if (error) throw new Error(`Marcando archivos fuera de alcance: ${error.message}`);
  resumen.fueraDeAlcance = fuera.length;
  return resumen;
}
