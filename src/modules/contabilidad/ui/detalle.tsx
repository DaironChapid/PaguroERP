import Link from "next/link";
import { notFound } from "next/navigation";
import { obtenerDocumento } from "../api/consultas";
import { tieneRol, type Usuario } from "../api/sesion";
import type { BaseDatos } from "../repo/supabase";
import { rutas } from "../rutas";
import { Aviso, EnlaceDrive, InsigniaEstado, Tarjeta } from "./componentes";
import { CLASES, cop, fecha, monto, numero, porcentaje } from "./formato";
import { FormularioDocumento, type DatosFormulario } from "./formulario-documento";

interface Hallazgo {
  codigo: string;
  nivel: "error" | "advertencia";
  mensaje: string;
}

export async function PaginaDetalle({ db, id, usuario }: { db: BaseDatos; id: number; usuario: Usuario }) {
  const [doc, categorias, cuentas, umbral] = await Promise.all([
    obtenerDocumento(db, id),
    db.from("categorias").select("id, nombre").eq("activa", true).order("nombre"),
    db.from("cuentas").select("id, codigo, nombre").eq("acepta_movimiento", true).eq("activa", true).order("codigo"),
    db.from("configuracion").select("valor").eq("clave", "umbral_confianza").maybeSingle(),
  ]);
  if (!doc) notFound();

  const hallazgos = (Array.isArray(doc.hallazgos) ? doc.hallazgos : []) as unknown as Hallazgo[];
  const errores = hallazgos.filter((h) => h.nivel === "error");
  const advertencias = hallazgos.filter((h) => h.nivel === "advertencia");
  const editable = tieneRol(usuario, "editor");

  const datos: DatosFormulario = {
    id: doc.id,
    estado: doc.estado,
    clase_documento: doc.clase_documento,
    tipo: doc.tipo,
    numero: doc.numero,
    fecha_emision: doc.fecha_emision,
    fecha_vencimiento: doc.fecha_vencimiento,
    moneda: doc.moneda,
    tasa_cambio: Number(doc.tasa_cambio),
    subtotal: doc.subtotal === null ? null : Number(doc.subtotal),
    iva: Number(doc.iva),
    retefuente: Number(doc.retefuente),
    reteica: Number(doc.reteica),
    otros_impuestos: Number(doc.otros_impuestos),
    total: doc.total === null ? null : Number(doc.total),
    categoria_id: doc.categoria_id,
    cuenta_id: doc.cuenta_id,
    observaciones: doc.observaciones,
    tercero: doc.terceros ? { nit: doc.terceros.nit, razon_social: doc.terceros.razon_social } : null,
    confianza: (doc.confianza_campos ?? {}) as Record<string, number>,
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <Link href={doc.estado === "pendiente_revision" ? rutas.revision : rutas.todos} className="text-tinta-2 hover:text-tinta">
          ← {doc.estado === "pendiente_revision" ? "Por revisar" : "Documentos"}
        </Link>
      </div>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-tinta sm:text-2xl">
            {doc.terceros?.razon_social ?? doc.archivos_drive?.nombre ?? `Documento #${doc.id}`}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-tinta-2">
            <InsigniaEstado estado={doc.estado} />
            <span>{CLASES[doc.clase_documento] ?? doc.clase_documento}</span>
            {doc.numero && <span>· N° {doc.numero}</span>}
            <span>· {fecha(doc.fecha_emision)}</span>
            <span className="cifras">· {monto(doc.total, doc.moneda)}</span>
            {doc.confianza !== null && <span>· Confianza IA {porcentaje(doc.confianza)}</span>}
          </p>
        </div>
        <EnlaceDrive url={doc.drive_url} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <Tarjeta titulo="Documento original" accion={<span className="truncate text-xs text-tinta-2">{doc.archivos_drive?.ruta}/{doc.archivos_drive?.nombre}</span>}>
            {doc.drive_file_id ? (
              <iframe
                src={`https://drive.google.com/file/d/${doc.drive_file_id}/preview`}
                title="Vista previa del documento"
                className="h-[60vh] w-full rounded-lg border border-borde bg-superficie-2 lg:h-[75vh]"
                allow="autoplay"
              />
            ) : (
              <p className="text-sm text-tinta-2">Sin archivo asociado.</p>
            )}
            <p className="mt-2 text-xs text-tinta-2">Para ver la vista previa debes tener sesión de Google con acceso a la carpeta del Drive.</p>
          </Tarjeta>
        </div>

        <div className="space-y-4">
          {(errores.length > 0 || advertencias.length > 0 || doc.observaciones) && (
            <Tarjeta titulo="Lo que encontró la revisión automática">
              <div className="space-y-2">
                {errores.map((h, i) => <Aviso key={`e${i}`} tono="critico">{h.mensaje}</Aviso>)}
                {advertencias.map((h, i) => <Aviso key={`a${i}`}>{h.mensaje}</Aviso>)}
                {doc.observaciones && (
                  <p className="text-sm text-tinta-2">
                    <span className="font-medium text-tinta">Nota de la IA: </span>
                    {doc.observaciones}
                  </p>
                )}
              </div>
            </Tarjeta>
          )}

          <FormularioDocumento
            datos={datos}
            categorias={categorias.data ?? []}
            cuentas={cuentas.data ?? []}
            editable={editable}
            umbral={Number(umbral.data?.valor ?? 0.85)}
          />

          {doc.asiento ? (
            <Tarjeta titulo="Asiento contable" accion={<span className="text-xs text-tinta-2">{fecha(doc.asiento.fecha)} · {doc.asiento.creado_por}</span>}>
              <div className="overflow-x-auto">
                <table className="cifras w-full text-left text-sm">
                  <thead className="text-xs text-tinta-2">
                    <tr className="border-b border-borde">
                      <th className="py-1.5 pr-2 font-medium">Cuenta</th>
                      <th className="py-1.5 pr-2 text-right font-medium">Débito</th>
                      <th className="py-1.5 text-right font-medium">Crédito</th>
                    </tr>
                  </thead>
                  <tbody>
                    {doc.asiento.asiento_lineas.map((l) => (
                      <tr key={l.id} className="border-b border-borde last:border-0">
                        <td className="py-1.5 pr-2">
                          <span className="text-tinta">{l.cuentas?.codigo}</span> <span className="text-tinta-2">{l.cuentas?.nombre}</span>
                        </td>
                        <td className="py-1.5 pr-2 text-right">{Number(l.debito) ? cop(l.debito) : ""}</td>
                        <td className="py-1.5 text-right">{Number(l.credito) ? cop(l.credito) : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Tarjeta>
          ) : (
            doc.estado !== "descartada" && (
              <Tarjeta titulo="Asiento contable">
                <p className="text-sm text-tinta-2">Se genera al aprobar el documento.</p>
              </Tarjeta>
            )
          )}

          {doc.items.length > 0 && (
            <Tarjeta titulo="Detalle de ítems">
              <ul className="space-y-1 text-sm">
                {doc.items.map((it) => (
                  <li key={it.id} className="flex justify-between gap-3 border-b border-borde py-1 last:border-0">
                    <span className="text-tinta-2">
                      {it.cantidad !== null && <span className="cifras">{numero(it.cantidad)} × </span>}
                      {it.descripcion}
                    </span>
                    <span className="cifras shrink-0 text-tinta">{monto(it.total, doc.moneda)}</span>
                  </li>
                ))}
              </ul>
            </Tarjeta>
          )}

          {doc.revisiones.length > 0 && (
            <Tarjeta titulo="Historial de correcciones">
              <ul className="space-y-1 text-xs text-tinta-2">
                {doc.revisiones.map((r) => (
                  <li key={r.id}>
                    <span className="font-medium text-tinta">{r.campo}</span>: {JSON.stringify(r.valor_ia)} → {JSON.stringify(r.valor_corregido)} · {r.usuario} · {fecha(r.creado_en)}
                  </li>
                ))}
              </ul>
            </Tarjeta>
          )}
        </div>
      </div>
    </>
  );
}
