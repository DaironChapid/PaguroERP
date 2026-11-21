import { datosDrive } from "../api/consultas";
import type { BaseDatos } from "../repo/supabase";
import { MENSAJE_FUERA_DE_ALCANCE } from "../services/inventario";
import { minutosIntervalo } from "../services/reloj";
import { mensajeClaro, sincronizacionEnCurso, type EstadoSincronizacion } from "../services/sincronizacion";
import { Aviso, EnlaceDrive } from "./componentes";
import { BotonSincronizar } from "./configuracion-acciones";
import { numero } from "./formato";

type ArchivoProblema = Awaited<ReturnType<typeof datosDrive>>["conError"][number];

/** Qué hacer con un archivo que no se pudo leer, en palabras simples. */
function queHacer(a: ArchivoProblema): string | null {
  if (a.estado === "ignorado") {
    return a.ultimo_error?.startsWith("Formato") ? "El sistema solo lee PDF e imágenes. Si es un soporte contable, súbelo en PDF." : null;
  }
  if (/contraseña/i.test(a.ultimo_error ?? "")) return "Sube al Drive una versión sin contraseña; se leerá sola en la siguiente revisión.";
  return "Se volverá a intentar solo. Si el error se repite, revisa que el archivo se abra bien.";
}

function ListaArchivos({ titulo, archivos }: { titulo: string; archivos: ArchivoProblema[] }) {
  if (archivos.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-medium text-tinta">{titulo} ({archivos.length})</p>
      <ul className="mt-1 divide-y divide-borde text-sm">
        {archivos.map((a) => (
          <li key={a.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-tinta">{a.nombre}</p>
              <p className="truncate text-xs text-tinta-2">{a.ruta || "Carpeta principal"} · {a.ultimo_error}</p>
              {queHacer(a) && <p className="text-xs text-tinta-2">{queHacer(a)}</p>}
            </div>
            <EnlaceDrive url={a.drive_url} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Franja con el estado del Drive: de dónde salen los documentos y qué no se pudo leer. */
export async function PanelDrive({ db, editor }: { db: BaseDatos; editor: boolean }) {
  const d = await datosDrive(db);
  const estado = d.estado as unknown as EstadoSincronizacion | null;
  const automatica = process.env.SYNC_AUTOMATICA !== "off";
  const porLeer = d.cola.filter((c) => c.estado === "pendiente" || c.estado === "procesando").reduce((s, c) => s + Number(c.cantidad), 0);
  // Los archivos que quedaron de configuraciones anteriores (otras carpetas) no le interesan a quien usa el sistema.
  const ignorados = d.ignorados.filter((a) => a.ultimo_error !== MENSAJE_FUERA_DE_ALCANCE);
  const problemas = d.conError.length + ignorados.length;

  return (
    <section aria-label="Google Drive" className="rounded-xl border border-borde bg-superficie px-4 py-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <p className="text-tinta-2">
          <span className="font-medium text-tinta">Google Drive</span>
          {" · "}
          {sincronizacionEnCurso() ? (
            <strong className="text-tinta">revisando ahora…</strong>
          ) : estado ? (
            <>
              última revisión {new Date(estado.fin).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" })}
              {estado.ok && estado.lote && (estado.lote.procesados === 0 ? ", sin documentos nuevos" : `, ${numero(estado.lote.procesados)} documentos nuevos`)}
            </>
          ) : (
            "todavía no se ha revisado"
          )}
          {porLeer > 0 && ` · ${numero(porLeer)} por leer`}
          {automatica && <span className="hidden sm:inline">{` · se revisa solo cada ${minutosIntervalo()} min`}</span>}
        </p>
        {editor && <BotonSincronizar />}
      </div>

      {estado && !estado.ok && (
        <div className="mt-2">
          <Aviso tono="critico">No se pudo revisar el Drive. {mensajeClaro(estado.error ?? "")}</Aviso>
        </div>
      )}

      {problemas > 0 && (
        <details className="mt-2 border-t border-borde pt-2">
          <summary className={`cursor-pointer text-xs font-medium ${d.conError.length > 0 ? "text-critico" : "text-tinta-2"}`}>
            {d.conError.length > 0 && `${d.conError.length} archivo(s) no se pudieron leer`}
            {d.conError.length > 0 && ignorados.length > 0 && " · "}
            {ignorados.length > 0 && `${ignorados.length} no se leen por su formato o carpeta`}
            {" — ver cuáles"}
          </summary>
          <div className="mt-2 space-y-3">
            <ListaArchivos titulo="No se pudieron leer" archivos={d.conError} />
            <ListaArchivos titulo="No se leen" archivos={ignorados} />
          </div>
        </details>
      )}
    </section>
  );
}
