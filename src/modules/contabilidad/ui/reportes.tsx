import { esTipoReporte, generarReporte, REPORTES, type Columna, type TipoReporte } from "../api/reportes";
import type { BaseDatos } from "../repo/supabase";
import Link from "next/link";
import { Aviso, claseBoton, EnlaceDrive, Encabezado, Tarjeta } from "./componentes";
import { FiltrosReporte } from "./filtros-reporte";
import { cop, fecha, mes, numero } from "./formato";

function valorCelda(v: string | number | null | undefined, c: Columna) {
  if (v === null || v === undefined) return "—";
  switch (c.tipo) {
    case "moneda": return cop(v);
    case "numero": return numero(v);
    case "fecha": return fecha(String(v));
    case "mes": return mes(String(v), true);
    default: return String(v);
  }
}

export async function PaginaReportes({ db, parametros }: { db: BaseDatos; parametros: Record<string, string> }) {
  const hoy = new Date().toISOString().slice(0, 10);
  const tipo: TipoReporte = parametros.tipo && esTipoReporte(parametros.tipo) ? parametros.tipo : "estado_resultados";
  const fechaValida = (f: string | undefined, d: string) => (f && /^\d{4}-\d{2}-\d{2}$/.test(f) ? f : d);
  const desde = fechaValida(parametros.desde, `${hoy.slice(0, 4)}-01-01`);
  const hasta = fechaValida(parametros.hasta, hoy);
  const cuenta = parametros.cuenta?.replace(/\D/g, "") || undefined;
  const conRango = REPORTES[tipo].parametros === "rango";

  const r = await generarReporte(db, tipo, { desde, hasta, cuenta });
  const conEnlaces = !!r.enlaces?.some(Boolean);
  const consulta = new URLSearchParams({ desde, hasta, ...(cuenta ? { cuenta } : {}), formato: "csv" });

  return (
    <>
      <Encabezado titulo="Reportes" descripcion="Calculados desde los asientos de los documentos aprobados." />

      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <FiltrosReporte
          key={`${tipo}-${cuenta ?? ""}`}
          tipos={Object.entries(REPORTES).map(([valor, d]) => ({ valor, titulo: d.titulo }))}
          tipo={tipo}
          desde={desde}
          hasta={hasta}
          cuenta={cuenta}
          conRango={conRango}
          conCuenta={tipo === "libro_mayor"}
        />
        <a href={`/api/contabilidad/reportes/${tipo}?${consulta}`} className={claseBoton}>Exportar CSV</a>
      </div>

      <Tarjeta titulo={r.titulo}>
        <p className="mb-3 text-sm text-tinta-2">{r.descripcion}</p>
        {r.aviso && <div className="mb-3"><Aviso>{r.aviso}</Aviso></div>}

        {r.resumen.length > 0 && (
          <dl className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {r.resumen.map((x) => (
              <div key={x.etiqueta} className="rounded-lg bg-superficie-2 px-3 py-2">
                <dt className="text-xs text-tinta-2">{x.etiqueta}</dt>
                <dd className="cifras text-base font-semibold text-tinta">{cop(x.valor)}</dd>
              </div>
            ))}
          </dl>
        )}

        {r.filas.length === 0 ? (
          <p className="py-6 text-center text-sm text-tinta-2">No hay datos para este periodo.</p>
        ) : (
          <div className="-mx-4 overflow-x-auto sm:mx-0">
            <table className="cifras w-full min-w-[560px] text-left text-sm">
              <thead className="text-xs text-tinta-2">
                <tr className="border-b border-borde">
                  {r.columnas.map((c) => (
                    <th key={c.clave} className={`px-2 py-2 font-medium first:pl-4 sm:first:pl-2 ${c.tipo === "moneda" || c.tipo === "numero" ? "text-right" : ""}`}>
                      {c.titulo}
                    </th>
                  ))}
                  {conEnlaces && <th className="px-2 py-2"><span className="sr-only">Soportes</span></th>}
                </tr>
              </thead>
              <tbody>
                {r.filas.map((f, i) => (
                  <tr key={i} className="border-b border-borde last:border-0">
                    {r.columnas.map((c) => (
                      <td key={c.clave} className={`px-2 py-1.5 first:pl-4 sm:first:pl-2 ${c.tipo === "moneda" || c.tipo === "numero" ? "text-right whitespace-nowrap" : "text-tinta"}`}>
                        {valorCelda(f[c.clave], c)}
                      </td>
                    ))}
                    {conEnlaces && (
                      <td className="px-2 py-1.5 text-right whitespace-nowrap">
                        {r.enlaces?.[i] && (
                          <span className="inline-flex items-center gap-3">
                            <Link href={r.enlaces[i].href} className="text-sm text-tinta-2 hover:text-tinta hover:underline">
                              {r.enlaces[i].etiqueta} →
                            </Link>
                            {r.enlaces[i].drive && <EnlaceDrive url={r.enlaces[i].drive ?? null} />}
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Tarjeta>
    </>
  );
}
