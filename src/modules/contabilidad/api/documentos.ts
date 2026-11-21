import { z } from "zod/v4";
import { aprobarDocumento, corregirDocumento, ErrorRevision, EsquemaCorreccion, rechazarDocumento } from "../services/revision";
import { listarDocumentos, obtenerDocumento } from "./consultas";
import { esTipoReporte, generarReporte, reporteACsv } from "./reportes";
import { exigirSesion } from "./sesion";

// Handlers de los endpoints de usuario (sesión de Supabase). Delgados: validan
// la entrada y delegan en consultas y servicios.

type Contexto = { params: Promise<Record<string, string>> };

function fallo(error: unknown): Response {
  if (error instanceof ErrorRevision) return Response.json({ error: error.message }, { status: 422 });
  if (error instanceof z.ZodError) return Response.json({ error: "Datos inválidos", detalle: z.flattenError(error).fieldErrors }, { status: 400 });
  const mensaje = error instanceof Error ? error.message : String(error);
  console.error("[contabilidad]", mensaje);
  return Response.json({ error: mensaje }, { status: 500 });
}

async function idDe(ctx: Contexto): Promise<number | null> {
  const id = Number((await ctx.params).id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** GET /api/contabilidad/facturas?mes=&clase=&estado=&categoria=&texto=&pagina= */
export async function listar(request: Request): Promise<Response> {
  const sesion = await exigirSesion("lector");
  if (sesion instanceof Response) return sesion;
  const q = new URL(request.url).searchParams;
  try {
    return Response.json(
      await listarDocumentos(sesion.db, {
        mes: q.get("mes") ?? undefined,
        clase: q.get("clase") ?? undefined,
        estado: q.get("estado") ?? undefined,
        categoria: q.get("categoria") ? Number(q.get("categoria")) : undefined,
        texto: q.get("texto") ?? undefined,
        pagina: q.get("pagina") ? Number(q.get("pagina")) : undefined,
        porPagina: q.get("por_pagina") ? Number(q.get("por_pagina")) : undefined,
      }),
    );
  } catch (e) {
    return fallo(e);
  }
}

/** GET /api/contabilidad/facturas/:id */
export async function detalle(_request: Request, ctx: Contexto): Promise<Response> {
  const sesion = await exigirSesion("lector");
  if (sesion instanceof Response) return sesion;
  const id = await idDe(ctx);
  if (!id) return Response.json({ error: "Id inválido" }, { status: 400 });
  try {
    const doc = await obtenerDocumento(sesion.db, id);
    return doc ? Response.json(doc) : Response.json({ error: "No existe" }, { status: 404 });
  } catch (e) {
    return fallo(e);
  }
}

/** PATCH /api/contabilidad/facturas/:id — corrección manual (queda en revisiones) */
export async function corregir(request: Request, ctx: Contexto): Promise<Response> {
  const sesion = await exigirSesion("editor");
  if (sesion instanceof Response) return sesion;
  const id = await idDe(ctx);
  if (!id) return Response.json({ error: "Id inválido" }, { status: 400 });
  try {
    const correccion = EsquemaCorreccion.parse(await request.json());
    await corregirDocumento(sesion.db, id, correccion, sesion.usuario.email);
    return Response.json(await obtenerDocumento(sesion.db, id));
  } catch (e) {
    return fallo(e);
  }
}

/** POST /api/contabilidad/facturas/:id/aprobar */
export async function aprobar(_request: Request, ctx: Contexto): Promise<Response> {
  const sesion = await exigirSesion("editor");
  if (sesion instanceof Response) return sesion;
  const id = await idDe(ctx);
  if (!id) return Response.json({ error: "Id inválido" }, { status: 400 });
  try {
    await aprobarDocumento(sesion.db, id, sesion.usuario.email);
    return Response.json({ ok: true });
  } catch (e) {
    return fallo(e);
  }
}

/** POST /api/contabilidad/facturas/:id/rechazar  { motivo? } */
export async function rechazar(request: Request, ctx: Contexto): Promise<Response> {
  const sesion = await exigirSesion("editor");
  if (sesion instanceof Response) return sesion;
  const id = await idDe(ctx);
  if (!id) return Response.json({ error: "Id inválido" }, { status: 400 });
  try {
    const cuerpo = (await request.json().catch(() => ({}))) as { motivo?: unknown };
    await rechazarDocumento(sesion.db, id, typeof cuerpo.motivo === "string" ? cuerpo.motivo.slice(0, 1000) : null);
    return Response.json({ ok: true });
  } catch (e) {
    return fallo(e);
  }
}

/** GET /api/contabilidad/reportes/:tipo?desde=&hasta=&cuenta=&formato=csv */
export async function reporte(request: Request, ctx: Contexto): Promise<Response> {
  const sesion = await exigirSesion("lector");
  if (sesion instanceof Response) return sesion;
  const tipo = (await ctx.params).tipo;
  if (!esTipoReporte(tipo)) return Response.json({ error: "Reporte desconocido" }, { status: 404 });
  const q = new URL(request.url).searchParams;
  const hoy = new Date().toISOString().slice(0, 10);
  const valida = (f: string | null, porDefecto: string) => (f && /^\d{4}-\d{2}-\d{2}$/.test(f) ? f : porDefecto);
  try {
    const r = await generarReporte(sesion.db, tipo, {
      desde: valida(q.get("desde"), `${hoy.slice(0, 4)}-01-01`),
      hasta: valida(q.get("hasta"), hoy),
      cuenta: q.get("cuenta")?.replace(/\D/g, "") || undefined,
    });
    if (q.get("formato") === "csv") {
      return new Response(reporteACsv(r), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${tipo}_${q.get("desde") ?? ""}_${q.get("hasta") ?? hoy}.csv"`,
        },
      });
    }
    return Response.json(r);
  } catch (e) {
    return fallo(e);
  }
}

const EsquemaConfiguracion = z
  .object({
    umbral_confianza: z.number().min(0).max(1),
    auto_aprobacion: z.boolean(),
  })
  .partial()
  .strict();

/** PATCH /api/contabilidad/configuracion  { umbral_confianza?, auto_aprobacion? } (solo admin) */
export async function configurar(request: Request): Promise<Response> {
  const sesion = await exigirSesion("admin");
  if (sesion instanceof Response) return sesion;
  try {
    const cambios = EsquemaConfiguracion.parse(await request.json());
    for (const [clave, valor] of Object.entries(cambios)) {
      const r = await sesion.db.from("configuracion").update({ valor }).eq("clave", clave);
      if (r.error) throw new Error(r.error.message);
    }
    return Response.json({ ok: true });
  } catch (e) {
    return fallo(e);
  }
}

const EsquemaSaldo = z.object({
  cuenta_codigo: z.string().regex(/^\d{6,10}$/),
  fecha_corte: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  debito: z.number().min(0),
  credito: z.number().min(0),
});

/** POST /api/contabilidad/saldos-iniciales (solo admin) */
export async function agregarSaldo(request: Request): Promise<Response> {
  const sesion = await exigirSesion("admin");
  if (sesion instanceof Response) return sesion;
  try {
    const s = EsquemaSaldo.parse(await request.json());
    const cuenta = await sesion.db.from("cuentas").select("id").eq("codigo", s.cuenta_codigo).eq("acepta_movimiento", true).maybeSingle();
    if (!cuenta.data) throw new ErrorRevision("La cuenta no existe o no es auxiliar (6 dígitos o más)");
    const r = await sesion.db
      .from("saldos_iniciales")
      .upsert({ cuenta_id: cuenta.data.id, fecha_corte: s.fecha_corte, debito: s.debito, credito: s.credito }, { onConflict: "cuenta_id,tercero_id,fecha_corte" });
    if (r.error) throw new Error(r.error.message);
    return Response.json({ ok: true });
  } catch (e) {
    return fallo(e);
  }
}

/** DELETE /api/contabilidad/saldos-iniciales/:id (solo admin) */
export async function borrarSaldo(_request: Request, ctx: Contexto): Promise<Response> {
  const sesion = await exigirSesion("admin");
  if (sesion instanceof Response) return sesion;
  const id = await idDe(ctx);
  if (!id) return Response.json({ error: "Id inválido" }, { status: 400 });
  const r = await sesion.db.from("saldos_iniciales").delete().eq("id", id);
  return r.error ? fallo(new Error(r.error.message)) : Response.json({ ok: true });
}
