"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { claseBoton, claseBotonPrimario, claseCampo, Insignia, Tarjeta } from "./componentes";
import { CLASES, TIPOS } from "./formato";

export interface DatosFormulario {
  id: number;
  estado: string;
  clase_documento: string;
  tipo: string | null;
  numero: string | null;
  fecha_emision: string | null;
  fecha_vencimiento: string | null;
  moneda: string;
  tasa_cambio: number;
  subtotal: number | null;
  iva: number;
  retefuente: number;
  reteica: number;
  otros_impuestos: number;
  total: number | null;
  categoria_id: number | null;
  cuenta_id: number | null;
  observaciones: string | null;
  tercero: { nit: string; razon_social: string } | null;
  /** Confianza de la IA por campo (claves de la extracción). */
  confianza: Record<string, number>;
}

type Opcion = { id: number; nombre?: string; codigo?: string };

const CAMPOS_MONTO = ["subtotal", "iva", "retefuente", "reteica", "otros_impuestos", "total"] as const;
const ETIQUETAS_MONTO: Record<(typeof CAMPOS_MONTO)[number], string> = {
  subtotal: "Subtotal",
  iva: "IVA",
  retefuente: "Retención en la fuente",
  reteica: "ReteICA",
  otros_impuestos: "Otros impuestos",
  total: "Total",
};

/** Confianza de la IA para un grupo de campos (acepta claves de versiones anteriores del esquema). */
function confianzaDe(c: Record<string, number>, claves: string[]): number | null {
  const valores = claves.map((k) => c[k]).filter((v): v is number => typeof v === "number");
  return valores.length ? Math.min(...valores) : null;
}

function Campo({ etiqueta, confianza, umbral, children }: { etiqueta: string; confianza?: number | null; umbral: number; children: ReactNode }) {
  return (
    <label className="block text-xs text-tinta-2">
      <span className="mb-1 flex items-center gap-1.5">
        {etiqueta}
        {confianza !== null && confianza !== undefined && confianza < umbral && (
          <Insignia tono="aviso">Lectura dudosa {Math.round(confianza * 100)}%</Insignia>
        )}
      </span>
      {children}
    </label>
  );
}

export function FormularioDocumento({
  datos,
  categorias,
  cuentas,
  editable,
  umbral,
}: {
  datos: DatosFormulario;
  categorias: Opcion[];
  cuentas: Opcion[];
  editable: boolean;
  umbral: number;
}) {
  const router = useRouter();
  const [f, setF] = useState(datos);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<{ tono: "bien" | "critico"; texto: string } | null>(null);

  const cambiar = <K extends keyof DatosFormulario>(k: K, v: DatosFormulario[K]) => setF((x) => ({ ...x, [k]: v }));
  const esFactura = f.clase_documento === "factura";

  function diferencias() {
    const cambios: Record<string, unknown> = {};
    for (const k of ["clase_documento", "tipo", "numero", "fecha_emision", "fecha_vencimiento", "moneda", "tasa_cambio", ...CAMPOS_MONTO, "categoria_id", "cuenta_id", "observaciones"] as const) {
      if (f[k] !== datos[k]) cambios[k] = f[k] === "" ? null : f[k];
    }
    if (f.tercero && (f.tercero.nit !== datos.tercero?.nit || f.tercero.razon_social !== datos.tercero?.razon_social)) {
      cambios.tercero = f.tercero;
    }
    return cambios;
  }
  const cambios = diferencias();
  const hayCambios = Object.keys(cambios).length > 0;

  async function llamar(accion: string, url: string, init: RequestInit) {
    setOcupado(accion);
    setMensaje(null);
    try {
      const r = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } });
      const cuerpo = await r.json().catch(() => ({}));
      if (!r.ok) {
        const detalle = cuerpo.detalle ? ` (${Object.keys(cuerpo.detalle).join(", ")})` : "";
        throw new Error((cuerpo.error ?? `Error ${r.status}`) + detalle);
      }
      return true;
    } catch (e) {
      setMensaje({ tono: "critico", texto: e instanceof Error ? e.message : String(e) });
      return false;
    } finally {
      setOcupado(null);
    }
  }

  async function guardar() {
    if (await llamar("guardar", `/api/contabilidad/facturas/${f.id}`, { method: "PATCH", body: JSON.stringify(cambios) })) {
      setMensaje({ tono: "bien", texto: "Cambios guardados." });
      router.refresh();
    }
  }

  async function aprobar() {
    if (hayCambios && !(await llamar("guardar", `/api/contabilidad/facturas/${f.id}`, { method: "PATCH", body: JSON.stringify(cambios) }))) return;
    if (await llamar("aprobar", `/api/contabilidad/facturas/${f.id}/aprobar`, { method: "POST" })) {
      setMensaje({ tono: "bien", texto: "Documento aprobado y contabilizado." });
      router.refresh();
    }
  }

  async function rechazar() {
    const motivo = window.prompt("Motivo del rechazo (opcional):");
    if (motivo === null) return;
    if (await llamar("rechazar", `/api/contabilidad/facturas/${f.id}/rechazar`, { method: "POST", body: JSON.stringify({ motivo }) })) {
      setMensaje({ tono: "bien", texto: "Documento rechazado." });
      router.refresh();
    }
  }

  const deshabilitado = !editable || ocupado !== null;
  const numeroCampo = (k: (typeof CAMPOS_MONTO)[number] | "tasa_cambio") => (
    <input
      type="number"
      step="0.01"
      min={0}
      disabled={deshabilitado}
      value={f[k] ?? ""}
      onChange={(e) => cambiar(k, e.target.value === "" ? (k === "subtotal" || k === "total" ? null : 0) : Number(e.target.value))}
      className={`${claseCampo} cifras text-right`}
    />
  );

  return (
    <Tarjeta
      titulo="Datos del documento"
      accion={!editable && <span className="text-xs text-tinta-2">Solo lectura (rol lector)</span>}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Clase de documento" umbral={umbral}>
          <select disabled={deshabilitado} value={f.clase_documento} onChange={(e) => cambiar("clase_documento", e.target.value)} className={claseCampo}>
            {Object.entries(CLASES).map(([v, e]) => <option key={v} value={v}>{e}</option>)}
          </select>
        </Campo>
        <Campo etiqueta="Tipo" umbral={umbral}>
          <select disabled={deshabilitado} value={f.tipo ?? ""} onChange={(e) => cambiar("tipo", e.target.value || null)} className={claseCampo}>
            <option value="">—</option>
            {Object.entries(TIPOS).map(([v, e]) => <option key={v} value={v}>{e}</option>)}
          </select>
        </Campo>
        <Campo etiqueta={esFactura ? "NIT del tercero" : "Identificación del beneficiario"} confianza={confianzaDe(f.confianza, ["nits", "emisor_nit"])} umbral={umbral}>
          <input
            disabled={deshabilitado}
            value={f.tercero?.nit ?? ""}
            onChange={(e) => cambiar("tercero", { nit: e.target.value, razon_social: f.tercero?.razon_social ?? "" })}
            className={`${claseCampo} cifras`}
          />
        </Campo>
        <Campo etiqueta="Nombre o razón social" umbral={umbral}>
          <input
            disabled={deshabilitado}
            value={f.tercero?.razon_social ?? ""}
            onChange={(e) => cambiar("tercero", { nit: f.tercero?.nit ?? "", razon_social: e.target.value })}
            className={claseCampo}
          />
        </Campo>
        <Campo etiqueta={esFactura ? "Número de factura" : "Referencia"} confianza={confianzaDe(f.confianza, ["numero"])} umbral={umbral}>
          <input disabled={deshabilitado} value={f.numero ?? ""} onChange={(e) => cambiar("numero", e.target.value || null)} className={claseCampo} />
        </Campo>
        <Campo etiqueta="Fecha" confianza={confianzaDe(f.confianza, ["fecha", "fecha_emision"])} umbral={umbral}>
          <input type="date" disabled={deshabilitado} value={f.fecha_emision ?? ""} onChange={(e) => cambiar("fecha_emision", e.target.value || null)} className={claseCampo} />
        </Campo>
        {esFactura && (
          <Campo etiqueta="Vencimiento" umbral={umbral}>
            <input type="date" disabled={deshabilitado} value={f.fecha_vencimiento ?? ""} onChange={(e) => cambiar("fecha_vencimiento", e.target.value || null)} className={claseCampo} />
          </Campo>
        )}
        <Campo etiqueta="Moneda" umbral={umbral}>
          <input disabled={deshabilitado} value={f.moneda} maxLength={3} onChange={(e) => cambiar("moneda", e.target.value.toUpperCase())} className={claseCampo} />
        </Campo>
        {f.moneda !== "COP" && <Campo etiqueta="Tasa de cambio (COP)" umbral={umbral}>{numeroCampo("tasa_cambio")}</Campo>}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {(esFactura ? CAMPOS_MONTO : (["total"] as const)).map((k) => (
          <Campo key={k} etiqueta={ETIQUETAS_MONTO[k]} confianza={confianzaDe(f.confianza, ["montos", k])} umbral={umbral}>
            {numeroCampo(k)}
          </Campo>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Categoría" umbral={umbral}>
          <select disabled={deshabilitado} value={f.categoria_id ?? ""} onChange={(e) => cambiar("categoria_id", e.target.value ? Number(e.target.value) : null)} className={claseCampo}>
            <option value="">—</option>
            {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </Campo>
        <Campo etiqueta="Cuenta contable" umbral={umbral}>
          <select disabled={deshabilitado} value={f.cuenta_id ?? ""} onChange={(e) => cambiar("cuenta_id", e.target.value ? Number(e.target.value) : null)} className={claseCampo}>
            <option value="">—</option>
            {cuentas.map((c) => <option key={c.id} value={c.id}>{c.codigo} {c.nombre}</option>)}
          </select>
        </Campo>
      </div>

      <div className="mt-3">
        <Campo etiqueta="Observaciones" umbral={umbral}>
          <textarea disabled={deshabilitado} rows={2} value={f.observaciones ?? ""} onChange={(e) => cambiar("observaciones", e.target.value || null)} className={claseCampo} />
        </Campo>
      </div>

      {mensaje && (
        <p role="status" className={`mt-3 text-sm ${mensaje.tono === "bien" ? "text-bien" : "text-critico"}`}>
          {mensaje.texto}
        </p>
      )}

      {editable && (
        <div className="mt-4 flex flex-wrap gap-2">
          {f.estado !== "aprobada" && f.clase_documento !== "informativo" && (
            <button onClick={aprobar} disabled={ocupado !== null} className={claseBotonPrimario}>
              {ocupado === "aprobar" ? "Aprobando…" : hayCambios ? "Guardar y aprobar" : "Aprobar"}
            </button>
          )}
          <button onClick={guardar} disabled={ocupado !== null || !hayCambios} className={claseBoton}>
            {ocupado === "guardar" ? "Guardando…" : "Guardar cambios"}
          </button>
          {f.estado !== "rechazada" && (
            <button onClick={rechazar} disabled={ocupado !== null} className={`${claseBoton} text-critico`}>
              Rechazar
            </button>
          )}
        </div>
      )}
      {editable && f.estado === "aprobada" && hayCambios && (
        <p className="mt-2 text-xs text-tinta-2">Al guardar cambios en un documento aprobado, su asiento se anula y vuelve a revisión.</p>
      )}
    </Tarjeta>
  );
}
