import type { ContextoPrompt } from "../ai";
import {
  cuentasDesdeConfig,
  cuentasMovimientosDesdeConfig,
  filtroDesdeConfig,
  normalizarNit,
  type CuentasAsientos,
  type CuentasMovimientos,
  type FiltroDrive,
  type TipoCuenta,
  type TipoFactura,
} from "../core";
import { exigir, type BaseDatos } from "../repo/supabase";

export interface CategoriaCtx {
  id: number;
  nombre: string;
  descripcion: string | null;
  tipo: TipoFactura;
  cuentaCodigo: string;
  retefuenteCodigo: string | null;
}

export interface CuentaCtx {
  id: number;
  codigo: string;
  nombre: string;
  tipo: TipoCuenta;
}

/** Todo lo que el procesamiento necesita saber de la configuración, cargado una vez por lote. */
export interface ContextoProcesamiento {
  nitEmpresa: string;
  nombreEmpresa: string;
  categorias: CategoriaCtx[];
  /** Cuentas auxiliares activas (las que aceptan movimiento). */
  cuentas: CuentaCtx[];
  cuentasAsientos: CuentasAsientos;
  cuentasMovimientos: CuentasMovimientos;
  umbralConfianza: number;
  autoAprobacion: boolean;
  tolerancias: Record<string, number>;
  filtro: FiltroDrive;
  /** Socios de la empresa (configuracion.socios): sus transferencias a la empresa son aportes. */
  socios: Socio[];
  prompt: ContextoPrompt;
}

export interface Socio {
  nombre: string;
  documento: string;
}

function sociosDesdeConfig(valor: unknown): Socio[] {
  if (!Array.isArray(valor)) return [];
  return valor
    .filter((x): x is Socio => typeof x?.nombre === "string" && typeof x?.documento === "string")
    .map((x) => ({ nombre: x.nombre.trim(), documento: x.documento.replace(/\D/g, "") }));
}

export async function cargarContexto(db: BaseDatos): Promise<ContextoProcesamiento> {
  const nitEmpresa = process.env.PAGURO_NIT ?? "";
  if (!normalizarNit(nitEmpresa)) throw new Error("Falta configurar PAGURO_NIT en las variables de entorno");

  const [config, cuentas, categorias] = await Promise.all([
    db.from("configuracion").select("clave, valor"),
    db.from("cuentas").select("id, codigo, nombre, tipo, acepta_movimiento, activa"),
    db.from("categorias").select("id, nombre, descripcion, tipo_factura, cuenta_id, cuenta_retefuente_id").eq("activa", true).order("nombre"),
  ]);

  const valores = new Map(exigir(config, "Leyendo configuración").map((c) => [c.clave, c.valor]));
  const todas = exigir(cuentas, "Leyendo plan de cuentas");
  const codigoPorId = new Map(todas.map((c) => [c.id, c.codigo]));
  const auxiliares: CuentaCtx[] = todas
    .filter((c) => c.acepta_movimiento && c.activa)
    .map((c) => ({ id: c.id, codigo: c.codigo, nombre: c.nombre, tipo: c.tipo as TipoCuenta }))
    .sort((a, b) => a.codigo.localeCompare(b.codigo));

  const cats: CategoriaCtx[] = exigir(categorias, "Leyendo categorías").map((c) => ({
    id: c.id,
    nombre: c.nombre,
    descripcion: c.descripcion,
    tipo: c.tipo_factura as TipoFactura,
    cuentaCodigo: codigoPorId.get(c.cuenta_id)!,
    retefuenteCodigo: c.cuenta_retefuente_id ? codigoPorId.get(c.cuenta_retefuente_id) ?? null : null,
  }));

  const nombreEmpresa = typeof valores.get("nombre_empresa") === "string" ? (valores.get("nombre_empresa") as string) : "la empresa";
  const umbral = Number(valores.get("umbral_confianza") ?? 0.85);
  const socios = sociosDesdeConfig(valores.get("socios"));

  return {
    nitEmpresa,
    nombreEmpresa,
    categorias: cats,
    cuentas: auxiliares,
    cuentasAsientos: cuentasDesdeConfig((valores.get("cuentas_asientos") ?? {}) as Record<string, unknown>),
    cuentasMovimientos: cuentasMovimientosDesdeConfig((valores.get("cuentas_movimientos") ?? {}) as Record<string, unknown>),
    umbralConfianza: Number.isFinite(umbral) ? umbral : 0.85,
    autoAprobacion: valores.get("auto_aprobacion") !== false,
    tolerancias: (valores.get("tolerancia_redondeo") ?? { default: 0.05 }) as Record<string, number>,
    filtro: filtroDesdeConfig(valores.get("drive_filtro")),
    socios,
    prompt: {
      nitEmpresa,
      nombreEmpresa,
      socios,
      categorias: cats.map((c) => ({ nombre: c.nombre, descripcion: c.descripcion, tipo: c.tipo })),
      cuentas: auxiliares
        .filter((c) => c.tipo === "gasto" || c.tipo === "costo" || c.tipo === "activo" || c.tipo === "ingreso")
        .map((c) => ({ codigo: c.codigo, nombre: c.nombre })),
    },
  };
}
