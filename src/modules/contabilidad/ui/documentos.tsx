import Link from "next/link";
import { listarDocumentos, opcionesFiltros, type DocumentoLista, type FiltrosDocumentos } from "../api/consultas";
import { tieneRol, type Usuario } from "../api/sesion";
import type { BaseDatos } from "../repo/supabase";
import { rutas } from "../rutas";
import { EnlaceDrive, Encabezado, InsigniaEstado, Tarjeta } from "./componentes";
import { CLASES, fecha, monto, porcentaje } from "./formato";
import { PanelDrive } from "./drive";
import { FiltrosLista } from "./filtros";

export function TablaDocumentos({ filas, vacio }: { filas: DocumentoLista[]; vacio: string }) {
  if (filas.length === 0) return <p className="py-6 text-center text-sm text-tinta-2">{vacio}</p>;
  return (
    <div className="-mx-4 overflow-x-auto sm:mx-0">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="text-xs text-tinta-2">
          <tr className="border-b border-borde">
            <th className="px-4 py-2 font-medium sm:px-2">Fecha</th>
            <th className="px-2 py-2 font-medium">Tercero</th>
            <th className="px-2 py-2 font-medium">Documento</th>
            <th className="px-2 py-2 font-medium">Categoría</th>
            <th className="px-2 py-2 text-right font-medium">Total</th>
            <th className="px-2 py-2 font-medium">Estado</th>
            <th className="px-2 py-2 font-medium">
              <span className="sr-only">Drive</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.id} className="border-b border-borde last:border-0 hover:bg-superficie-2">
              <td className="cifras px-4 py-2 whitespace-nowrap text-tinta-2 sm:px-2">{fecha(f.fecha_emision)}</td>
              <td className="max-w-[220px] px-2 py-2">
                <Link href={rutas.documento(f.id)} className="block truncate font-medium text-tinta hover:underline">
                  {f.terceros?.razon_social ?? f.archivos_drive?.nombre ?? `Documento #${f.id}`}
                </Link>
                {f.terceros?.nit && <span className="cifras text-xs text-tinta-2">{f.terceros.nit}</span>}
              </td>
              <td className="px-2 py-2">
                <span className="text-tinta">{CLASES[f.clase_documento] ?? f.clase_documento}</span>
                {f.numero && <span className="block max-w-[160px] truncate text-xs text-tinta-2">N° {f.numero}</span>}
              </td>
              <td className="px-2 py-2 text-tinta-2">{f.categorias?.nombre ?? "—"}</td>
              <td className="cifras px-2 py-2 text-right whitespace-nowrap text-tinta">{monto(f.total, f.moneda)}</td>
              <td className="px-2 py-2">
                <InsigniaEstado estado={f.estado} />
                {f.estado === "pendiente_revision" && f.confianza !== null && (
                  <span className="mt-0.5 block text-xs text-tinta-2">Confianza {porcentaje(f.confianza)}</span>
                )}
              </td>
              <td className="px-2 py-2 whitespace-nowrap">
                <EnlaceDrive url={f.drive_url} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Paginacion({ pagina, total, porPagina, parametros }: { pagina: number; total: number; porPagina: number; parametros: Record<string, string> }) {
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  if (paginas <= 1) return null;
  const enlace = (p: number) => `?${new URLSearchParams({ ...parametros, pagina: String(p) })}`;
  return (
    <div className="mt-3 flex items-center justify-between text-sm text-tinta-2">
      <span>
        Página {pagina} de {paginas} · {total} documentos
      </span>
      <div className="flex gap-2">
        {pagina > 1 && <Link href={enlace(pagina - 1)} className="underline">Anterior</Link>}
        {pagina < paginas && <Link href={enlace(pagina + 1)} className="underline">Siguiente</Link>}
      </div>
    </div>
  );
}

function Pestanas({ vista, pendientes }: { vista: "revisar" | "todos"; pendientes: number }) {
  const clase = (on: boolean) =>
    `-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm ${on ? "border-acento font-medium text-tinta" : "border-transparent text-tinta-2 hover:text-tinta"}`;
  return (
    <nav aria-label="Vistas de documentos" className="mb-4 flex gap-1 border-b border-borde">
      <Link href={rutas.revision} aria-current={vista === "revisar" ? "page" : undefined} className={clase(vista === "revisar")}>
        Por revisar
        <span className={`rounded-full px-1.5 text-xs font-medium ${pendientes > 0 ? "bg-aviso-fondo text-aviso" : "bg-superficie-2 text-tinta-2"}`}>{pendientes}</span>
      </Link>
      <Link href={rutas.todos} aria-current={vista === "todos" ? "page" : undefined} className={clase(vista === "todos")}>
        Todos
      </Link>
    </nav>
  );
}

export async function PaginaDocumentos({ db, usuario, parametros }: { db: BaseDatos; usuario: Usuario; parametros: Record<string, string> }) {
  const porRevisar = await listarDocumentos(db, { estado: "pendiente_revision", porPagina: 200 });
  const hayFiltros = ["mes", "desde", "hasta", "clase", "estado", "categoria", "texto", "pagina"].some((k) => parametros[k]);
  // Sin elegir pestaña: se abre "Por revisar" si hay pendientes (es lo que hay que hacer); si no, "Todos".
  const vista = parametros.vista === "revisar" || parametros.vista === "todos" ? parametros.vista : !hayFiltros && porRevisar.total > 0 ? "revisar" : "todos";

  return (
    <>
      <Encabezado titulo="Documentos" descripcion="Facturas y movimientos leídos del Drive, con acceso al archivo original." />
      <div className="mb-4">
        <PanelDrive db={db} editor={tieneRol(usuario, "editor")} />
      </div>
      <Pestanas vista={vista} pendientes={porRevisar.total} />
      {vista === "revisar" ? (
        <>
          <p className="mb-3 text-sm text-tinta-2">
            La IA no pudo aprobar solos estos documentos: les faltan datos, tiene dudas o no pasaron una validación. Ábrelos para corregir, aprobar o rechazar.
          </p>
          <Tarjeta>
            <TablaDocumentos filas={porRevisar.filas} vacio="No hay documentos por revisar. ¡Todo al día!" />
          </Tarjeta>
        </>
      ) : (
        <ListaTodos db={db} parametros={parametros} />
      )}
    </>
  );
}

async function ListaTodos({ db, parametros }: { db: BaseDatos; parametros: Record<string, string> }) {
  const filtros: FiltrosDocumentos = {
    mes: parametros.mes,
    desde: parametros.desde,
    hasta: parametros.hasta,
    clase: parametros.clase,
    estado: parametros.estado,
    categoria: parametros.categoria ? Number(parametros.categoria) : undefined,
    texto: parametros.texto,
    pagina: parametros.pagina ? Number(parametros.pagina) : 1,
  };
  const [lista, opciones] = await Promise.all([listarDocumentos(db, filtros), opcionesFiltros(db)]);
  const sinPagina = Object.fromEntries(Object.entries(parametros).filter(([k]) => k !== "pagina"));
  return (
    <>
      <FiltrosLista categorias={opciones.categorias} />
      <Tarjeta className="mt-4">
        <TablaDocumentos filas={lista.filas} vacio="No hay documentos con estos filtros." />
        <Paginacion pagina={lista.pagina} total={lista.total} porPagina={lista.porPagina} parametros={sinPagina} />
      </Tarjeta>
    </>
  );
}
