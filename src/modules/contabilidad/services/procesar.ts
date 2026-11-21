import { ErrorExtraccion, type Extraccion, type ExtractorFacturas, type ResultadoExtraccion } from "../ai";
import {
  CLASES_MOVIMIENTO,
  clasificarFactura,
  cuentaBanco,
  cuentaPrincipalMovimiento,
  datosDesdeExtraccion,
  decidirEstado,
  ErrorAsiento,
  esNombreDeLaEmpresa,
  ErrorMovimiento,
  fechaValida,
  generarAsiento,
  generarAsientoMovimiento,
  mismoNit,
  normalizarConcepto,
  normalizarImpuesto,
  normalizarNit,
  redondear2,
  resolverCuenta,
  terceroDesdeParte,
  toleranciaPara,
  validarFactura,
  validarMovimiento,
  type Asiento,
  type ClaseMovimiento,
  type EstadoFactura,
  type Hallazgo,
  type TerceroExtraido,
} from "../core";
import { ErrorDrive, type ClienteDrive } from "../drive/cliente";
import { exigir, type BaseDatos, type Fila } from "../repo/supabase";
import type { Database, Json } from "../repo/tipos-db";
import type { CategoriaCtx, ContextoProcesamiento } from "./contexto";
import { obtenerTasa } from "./tasas";

export interface Dependencias {
  db: BaseDatos;
  drive: ClienteDrive;
  extractor: ExtractorFacturas;
  ctx: ContextoProcesamiento;
  /** YYYY-MM-DD; se inyecta para poder probar con fechas fijas. */
  hoy: string;
  /** Quién aprueba automáticamente. */
  usuario: string;
}

export interface ResultadoArchivo {
  archivoId: number;
  nombre: string;
  resultado: "procesado" | "omitido" | "error";
  facturaId?: number;
  estadoFactura?: EstadoFactura;
  mensaje?: string;
  pausarLote: boolean;
  tokensEntrada: number;
  tokensSalida: number;
}

type Archivo = Fila<"archivos_drive">;

const noNegativo = (n: number | null) => (n !== null && n < 0 ? null : n);

type Tablas = Database["contabilidad"]["Tables"];
/** Valor JSON no nulo, para columnas jsonb NOT NULL. */
const json = (valor: unknown) => valor as NonNullable<Json>;

/** Descarga, extrae con IA, valida, clasifica y registra un archivo. Nunca lanza: los errores quedan en el archivo. */
export async function procesarArchivo(deps: Dependencias, archivo: Archivo): Promise<ResultadoArchivo> {
  const { db } = deps;
  const inicio = Date.now();
  const base = { archivoId: archivo.id, nombre: archivo.nombre, pausarLote: false, tokensEntrada: 0, tokensSalida: 0 };
  let extraccion: ResultadoExtraccion | null = null;

  try {
    // El mismo archivo (mismo md5) ya está registrado en otra factura: no se gasta IA.
    if (archivo.md5) {
      const { data: igual } = await db
        .from("facturas")
        .select("id")
        .eq("drive_md5", archivo.md5)
        .neq("id", archivo.factura_id ?? -1)
        .limit(1)
        .maybeSingle();
      if (igual) {
        const mensaje = `Archivo idéntico al de la factura #${igual.id}`;
        await marcarArchivo(db, archivo.id, { estado: "procesado", factura_id: igual.id, error_codigo: "duplicado_archivo", ultimo_error: mensaje });
        await registrarProcesamiento(db, archivo.id, { estado: "omitido", factura_id: igual.id, error: mensaje, duracion_ms: Date.now() - inicio });
        return { ...base, resultado: "omitido", facturaId: igual.id, mensaje };
      }
    }

    const datos = await deps.drive.descargar(archivo.drive_file_id);
    extraccion = await deps.extractor.extraer({ datos, mime: archivo.mime, nombre: archivo.nombre }, deps.ctx.prompt);
    const tokens = { tokensEntrada: extraccion.tokensEntrada, tokensSalida: extraccion.tokensSalida };
    const registro = await registrarExtraccion(deps, archivo, extraccion.datos);

    const comun = {
      metodo: "ia" as const,
      modelo: extraccion.modelo,
      duracion_ms: Date.now() - inicio,
      tokens_entrada: extraccion.tokensEntrada,
      tokens_salida: extraccion.tokensSalida,
      costo_usd: extraccion.costoUsd,
    };

    if ("duplicadaDe" in registro) {
      const mensaje = `Duplicada: ya existe la factura #${registro.duplicadaDe} del mismo tercero con el número ${registro.numero}`;
      await marcarArchivo(db, archivo.id, { estado: "procesado", factura_id: registro.duplicadaDe, md5_procesado: archivo.md5, error_codigo: "duplicada", ultimo_error: mensaje });
      await registrarProcesamiento(db, archivo.id, { ...comun, estado: "omitido", factura_id: registro.duplicadaDe, error: mensaje });
      return { ...base, ...tokens, resultado: "omitido", facturaId: registro.duplicadaDe, mensaje };
    }

    await marcarArchivo(db, archivo.id, { estado: "procesado", factura_id: registro.facturaId, md5_procesado: archivo.md5, error_codigo: null, ultimo_error: null, reintentar_desde: null });
    await registrarProcesamiento(db, archivo.id, { ...comun, estado: "exito", factura_id: registro.facturaId });
    return { ...base, ...tokens, resultado: "procesado", facturaId: registro.facturaId, estadoFactura: registro.estado };
  } catch (error) {
    const fallo = clasificarFallo(error);
    const reintentarDesde = fallo.esperaSegundos !== null ? new Date(Date.now() + fallo.esperaSegundos * 1000).toISOString() : null;
    await marcarArchivo(db, archivo.id, {
      estado: "error",
      error_codigo: fallo.codigo,
      ultimo_error: fallo.mensaje.slice(0, 1000),
      reintentar_desde: fallo.reintentable ? reintentarDesde : null,
    });
    await registrarProcesamiento(db, archivo.id, {
      estado: "error",
      metodo: "ia",
      modelo: extraccion?.modelo ?? deps.extractor.modelo,
      error: fallo.mensaje.slice(0, 1000),
      error_codigo: fallo.codigo,
      reintentable: fallo.reintentable,
      duracion_ms: Date.now() - inicio,
      tokens_entrada: extraccion?.tokensEntrada ?? null,
      tokens_salida: extraccion?.tokensSalida ?? null,
      costo_usd: extraccion?.costoUsd ?? null,
    });
    return {
      ...base,
      tokensEntrada: extraccion?.tokensEntrada ?? 0,
      tokensSalida: extraccion?.tokensSalida ?? 0,
      resultado: "error",
      mensaje: fallo.mensaje,
      pausarLote: fallo.pausarLote,
    };
  }
}

interface Fallo {
  codigo: string;
  mensaje: string;
  reintentable: boolean;
  pausarLote: boolean;
  esperaSegundos: number | null;
}

function clasificarFallo(error: unknown): Fallo {
  if (error instanceof ErrorExtraccion) {
    const d = error.detalle;
    // Una respuesta mal formada suele resolverse reintentando un rato después.
    const espera = d.esperaSegundos ?? (d.codigo === "respuesta_invalida" ? 300 : null);
    return { codigo: d.codigo, mensaje: d.mensaje, reintentable: d.reintentable, pausarLote: d.pausarLote, esperaSegundos: espera };
  }
  if (error instanceof ErrorDrive) {
    const sinAcceso = error.status === 401 || error.status === 403;
    return {
      codigo: "drive",
      mensaje: error.message,
      reintentable: error.status !== 404,
      pausarLote: sinAcceso,
      esperaSegundos: error.status === 404 || sinAcceso ? null : 600,
    };
  }
  const mensaje = error instanceof Error ? error.message : String(error);
  return { codigo: "desconocido", mensaje, reintentable: true, pausarLote: false, esperaSegundos: null };
}

type Registro = { facturaId: number; estado: EstadoFactura } | { duplicadaDe: number; numero: string };

/** Aplica las reglas contables a la extracción y guarda la factura (y su asiento si se aprueba). */
async function registrarExtraccion(deps: Dependencias, archivo: Archivo, x: Extraccion): Promise<Registro> {
  const clase = CLASES_MOVIMIENTO.find((c) => c === x.clase_documento);
  if (clase) return registrarMovimiento(deps, archivo, x, clase);

  const { db, ctx } = deps;
  const d = datosDesdeExtraccion(x);

  // Tipo de factura y categoría
  const sugerida = ctx.categorias.find((c) => c.nombre === x.categoria_sugerida) ?? null;
  const clasificacion = clasificarFactura({
    nitEmisor: d.emisorNit,
    nitReceptor: d.receptorNit,
    nitEmpresa: ctx.nitEmpresa,
    tipoCategoria: sugerida?.tipo ?? null,
  });
  const tipo = clasificacion.tipo;
  let categoria = sugerida;
  if (tipo === "venta" && categoria?.tipo !== "venta") {
    categoria = ctx.categorias.find((c) => c.tipo === "venta") ?? null;
  } else if (tipo && tipo !== "venta" && (!categoria || categoria.tipo === "venta")) {
    categoria = ctx.categorias.find((c) => c.nombre === "Otros gastos") ?? null;
  }

  // Tercero: el emisor en compras y gastos, el receptor en ventas
  const parte = clasificacion.contraparte === "receptor" ? x.receptor : x.emisor;
  const datosTercero = d.esFactura ? terceroDesdeParte(parte, { exterior: d.tipoDocumento === "invoice_exterior" }) : null;
  const tercero = datosTercero ? await asegurarTercero(db, datosTercero, tipo === "venta" ? "cliente" : "proveedor") : null;

  // El mismo documento ya registrado (por ejemplo, PDF y foto de la misma factura)
  if (tercero && d.numero) {
    const { data: previa } = await db
      .from("facturas")
      .select("id")
      .eq("tercero_id", tercero.id)
      .eq("numero", d.numero)
      .neq("id", archivo.factura_id ?? -1)
      .limit(1)
      .maybeSingle();
    if (previa) return { duplicadaDe: previa.id, numero: d.numero };
  }

  // Cuenta contable
  const tiposPermitidos = tipo === "venta" ? ["ingreso"] : ["gasto", "costo", "activo"];
  const permitidas = new Set(ctx.cuentas.filter((c) => tiposPermitidos.includes(c.tipo)).map((c) => c.codigo));
  const { cuenta } = resolverCuenta(x.cuenta_sugerida, categoria?.cuentaCodigo ?? null, permitidas);

  const hallazgos: Hallazgo[] = [...clasificacion.hallazgos];

  // Tasa de cambio
  let tasa = 1;
  if (d.esFactura && d.moneda !== "COP") {
    if (d.fechaEmision && fechaValida(d.fechaEmision)) {
      try {
        tasa = await obtenerTasa(db, d.moneda, d.fechaEmision);
      } catch (e) {
        hallazgos.push({ codigo: "sin_tasa", nivel: "error", mensaje: `No se pudo obtener la tasa de cambio: ${(e as Error).message}` });
      }
    } else {
      hallazgos.push({ codigo: "sin_tasa", nivel: "error", mensaje: "Factura en moneda extranjera sin fecha válida para la tasa de cambio" });
    }
  }

  const validacion = validarFactura(d, {
    tipo,
    periodoCarpeta: { anio: archivo.anio_carpeta, mes: archivo.mes_carpeta },
    hoy: deps.hoy,
    tolerancia: toleranciaPara(d.moneda, ctx.tolerancias),
    umbralConfianza: ctx.umbralConfianza,
    duplicada: false,
    cuentaAsignada: cuenta !== null,
  });
  hallazgos.push(...validacion.hallazgos);
  if (d.esFactura && !tercero && !hallazgos.some((h) => h.codigo === "campo_faltante")) {
    hallazgos.push({ codigo: "sin_tercero", nivel: "error", mensaje: "No se pudo identificar al tercero de la factura" });
  }

  // Un documento que no es factura no se valida como tal: solo se deja el motivo.
  if (!d.esFactura) {
    hallazgos.splice(0, hallazgos.length, {
      codigo: "no_es_factura",
      nivel: "advertencia",
      mensaje: x.notas ?? "Documento informativo: no es una factura ni un movimiento de dinero",
    });
  } else {
    agregarDudaIA(x, hallazgos);
  }

  let estado = decidirEstado({ esFactura: d.esFactura, hallazgos, autoAprobacion: ctx.autoAprobacion });
  let asiento: Asiento | null = null;
  if (estado === "aprobada") {
    try {
      asiento = generarAsiento(
        {
          tipo: tipo!,
          numero: d.numero!,
          fecha: d.fechaEmision!,
          terceroNombre: tercero!.razon_social,
          terceroExterior: tercero!.extranjero,
          moneda: d.moneda,
          tasaCambio: tasa,
          montos: d.montos,
          cuentaPrincipal: cuenta!,
          cuentaRetefuente: categoria?.retefuenteCodigo ?? null,
        },
        ctx.cuentasAsientos,
      );
    } catch (e) {
      if (!(e instanceof ErrorAsiento)) throw e;
      hallazgos.push({ codigo: "asiento", nivel: "error", mensaje: e.message });
      estado = "pendiente_revision";
    }
  }

  const cuentaId = cuenta ? ctx.cuentas.find((c) => c.codigo === cuenta)?.id ?? null : null;
  const fila: FilaFactura = {
    tipo,
    clase_documento: d.esFactura ? "factura" : "informativo",
    tipo_documento: d.tipoDocumento,
    numero: d.numero,
    cufe: x.cufe,
    fecha_emision: d.fechaEmision && fechaValida(d.fechaEmision) ? d.fechaEmision : null,
    fecha_vencimiento: d.fechaVencimiento && fechaValida(d.fechaVencimiento) ? d.fechaVencimiento : null,
    tercero_id: tercero?.id ?? null,
    moneda: /^[A-Z]{3}$/.test(d.moneda) ? d.moneda : "COP",
    tasa_cambio: tasa,
    subtotal: noNegativo(d.montos.subtotal),
    iva: noNegativo(d.montos.iva) ?? 0,
    iva_tasa: x.iva_tasa,
    retefuente: noNegativo(d.montos.retefuente) ?? 0,
    reteica: noNegativo(d.montos.reteica) ?? 0,
    otros_impuestos: noNegativo(d.montos.otrosImpuestos) ?? 0,
    total: noNegativo(d.montos.total),
    categoria_id: categoria?.id ?? null,
    cuenta_id: cuentaId,
    // 'aprobada' solo se asigna junto con el asiento, en registrar_asiento_factura.
    estado: estado === "aprobada" ? "pendiente_revision" : estado,
    confianza: d.confianzaGeneral,
    confianza_campos: d.confianzaCampos ?? {},
    hallazgos: json(hallazgos),
    archivo_id: archivo.id,
    drive_file_id: archivo.drive_file_id,
    drive_url: archivo.drive_url,
    drive_md5: archivo.md5,
    carpeta_origen: archivo.ruta,
    datos_ia: x as unknown as Json,
    observaciones: x.notas,
  };

  return guardarDocumento(deps, archivo, fila, x.items, asiento, tercero?.id ?? null, estado, hallazgos);
}

type FilaFactura = Tablas["facturas"]["Insert"];

/**
 * Guarda el documento (factura o movimiento), sus ítems y, si se aprobó, su asiento.
 * En un reprocesamiento (el archivo cambió en el Drive) reemplaza datos, ítems y asiento.
 */
async function guardarDocumento(
  deps: Dependencias,
  archivo: Archivo,
  fila: FilaFactura,
  items: Extraccion["items"],
  asiento: Asiento | null,
  terceroId: number | null,
  estado: EstadoFactura,
  hallazgos: Hallazgo[],
): Promise<Registro> {
  const { db } = deps;
  let facturaId: number;
  if (archivo.factura_id) {
    facturaId = archivo.factura_id;
    const reabrir = await db.rpc("cambiar_estado_factura", { p_factura_id: facturaId, p_estado: "pendiente_revision" });
    if (reabrir.error) throw new Error(`Reabriendo documento: ${reabrir.error.message}`);
    exigir(await db.from("facturas").update(fila).eq("id", facturaId).select("id").single(), "Actualizando documento");
    await db.from("factura_items").delete().eq("factura_id", facturaId);
  } else {
    facturaId = exigir(await db.from("facturas").insert(fila).select("id").single(), "Guardando documento").id;
  }

  if (items.length > 0) {
    const { error } = await db.from("factura_items").insert(
      items.map((item, i) => ({
        factura_id: facturaId,
        linea: i + 1,
        descripcion: item.descripcion.slice(0, 2000),
        cantidad: item.cantidad,
        valor_unitario: item.valor_unitario,
        total: item.total,
      })),
    );
    if (error) throw new Error(`Guardando ítems: ${error.message}`);
  }

  if (asiento) {
    const lineas = asiento.lineas.map((l) => ({ ...l, tercero_id: terceroId }));
    const { error } = await db.rpc("registrar_asiento_factura", {
      p_factura_id: facturaId,
      p_fecha: asiento.fecha,
      p_descripcion: asiento.descripcion,
      p_lineas: lineas as unknown as Json,
      p_usuario: deps.usuario,
    });
    if (error) {
      // El documento queda guardado para revisión manual con el motivo.
      hallazgos.push({ codigo: "asiento", nivel: "error", mensaje: `No se pudo registrar el asiento: ${error.message}` });
      await db.from("facturas").update({ hallazgos: json(hallazgos) }).eq("id", facturaId);
      return { facturaId, estado: "pendiente_revision" };
    }
  }

  return { facturaId, estado };
}

/** La IA marcó una duda que debe resolver una persona: el documento no se aprueba solo. */
function agregarDudaIA(x: Extraccion, hallazgos: Hallazgo[]) {
  if (x.requiere_revision) {
    hallazgos.push({ codigo: "duda_ia", nivel: "error", mensaje: x.notas ?? "La IA marcó una duda que debe revisar una persona" });
  }
}

const DIAN = { nombre: "Dirección de Impuestos y Aduanas Nacionales - DIAN", nit: "800197268-4", pais: "CO" };

const MOVIMIENTO_VACIO: NonNullable<Extraccion["movimiento"]> = {
  fecha: null,
  valor_total: null,
  moneda: null,
  valor_debitado_cop: null,
  referencia: null,
  banco_origen: null,
  beneficiario: { nombre: null, nit: null, pais: null },
  concepto: null,
  impuesto: null,
  componentes: [],
};

/** Pagos de impuestos, PILA, nómina, transferencias e importaciones. */
async function registrarMovimiento(deps: Dependencias, archivo: Archivo, x: Extraccion, clase: ClaseMovimiento): Promise<Registro> {
  const { db, ctx } = deps;
  const m = x.movimiento ?? MOVIMIENTO_VACIO;
  const hallazgos: Hallazgo[] = [];
  if (!x.movimiento) {
    hallazgos.push({ codigo: "sin_datos_movimiento", nivel: "error", mensaje: "La lectura no trajo los datos del movimiento" });
  }
  const moneda = (m.moneda ?? "COP").trim().toUpperCase() || "COP";
  const referencia = m.referencia?.trim().replace(/\s+/g, " ") || null;
  const impuesto = normalizarImpuesto(m.impuesto);
  const componentes = m.componentes.map((c) => ({ concepto: normalizarConcepto(c.concepto), valor: c.valor }));
  const fecha = m.fecha && fechaValida(m.fecha) ? m.fecha : null;
  const confianza = Math.min(1, Math.max(0, x.confianza_general));

  // Tercero (beneficiario). Los pagos de impuestos van a la DIAN si no se indica otro.
  let parte = clase === "pago_impuestos" && !normalizarNit(m.beneficiario.nit) && !m.beneficiario.nombre ? DIAN : m.beneficiario;
  // Un aporte viene de un socio. Si la IA dejó como contraparte a la propia empresa
  // (o a nadie) y hay un solo socio configurado, el aporte es de ese socio.
  if (clase === "aporte_socio" && ctx.socios.length === 1) {
    const sinSocio = !normalizarNit(parte.nit) || mismoNit(parte.nit ?? "", ctx.nitEmpresa) || esNombreDeLaEmpresa(parte.nombre, ctx.nombreEmpresa);
    if (sinSocio) parte = { nombre: ctx.socios[0].nombre, nit: ctx.socios[0].documento, pais: "CO" };
  }
  // Solo es del exterior si la moneda no es COP o la IA indicó un país válido distinto de Colombia
  // (un país vacío o mal escrito no cuenta).
  const paisIndicado = parte.pais?.trim().toUpperCase() ?? "";
  const exterior = moneda !== "COP" || (/^[A-Z]{2}$/.test(paisIndicado) && paisIndicado !== "CO");
  const datosTercero = terceroDesdeParte(parte, { exterior, sinNit: true });
  const trasladoPropio = !!datosTercero && (mismoNit(datosTercero.nit, ctx.nitEmpresa) || esNombreDeLaEmpresa(parte.nombre, ctx.nombreEmpresa));
  const tercero = datosTercero && !trasladoPropio ? await asegurarTercero(db, datosTercero, "proveedor") : null;
  if (trasladoPropio) {
    hallazgos.push({
      codigo: "traslado_propio",
      nivel: "error",
      mensaje: "El dinero llega a la propia empresa: puede ser un aporte de un socio o un traslado entre cuentas propias. Definir cómo registrarlo",
    });
  }

  // El mismo pago ya registrado (por ejemplo, el recibo 490 y el comprobante PSE)
  if (referencia && m.valor_total) {
    const { data: previa } = await db
      .from("facturas")
      .select("id")
      .eq("clase_documento", clase)
      .eq("numero", referencia)
      .eq("total", m.valor_total)
      .neq("id", archivo.factura_id ?? -1)
      .limit(1)
      .maybeSingle();
    if (previa) return { duplicadaDe: previa.id, numero: referencia };
  }

  // Valor en pesos: el debitado si el documento lo muestra; si no, con la TRM del día.
  let totalCop: number | null = null;
  if (m.valor_total && m.valor_total > 0) {
    if (moneda === "COP") totalCop = m.valor_total;
    else if (m.valor_debitado_cop && m.valor_debitado_cop > 0) totalCop = m.valor_debitado_cop;
    else if (fecha) {
      try {
        totalCop = redondear2(m.valor_total * (await obtenerTasa(db, moneda, fecha)));
      } catch (e) {
        hallazgos.push({ codigo: "sin_tasa", nivel: "error", mensaje: `No se pudo obtener la tasa de cambio: ${(e as Error).message}` });
      }
    }
  }
  const factor = totalCop && m.valor_total ? totalCop / m.valor_total : 1;
  const componentesCop = componentes.map((c) => ({ ...c, valor: redondear2(c.valor * factor) }));

  // Banco y cuenta destino
  const banco = cuentaBanco(m.banco_origen, ctx.cuentasMovimientos);
  let categoria: CategoriaCtx | null = null;
  let cuentaDestino: string | null = null;
  if (clase === "transferencia" && tercero) {
    const { data: facturaPrevia } = await db
      .from("facturas")
      .select("tipo")
      .eq("tercero_id", tercero.id)
      .eq("estado", "aprobada")
      .in("tipo", ["compra", "gasto"])
      .order("fecha_emision", { ascending: false })
      .limit(1)
      .maybeSingle();
    const ca = ctx.cuentasAsientos;
    if (facturaPrevia) {
      // Hay factura del proveedor: el pago salda su cuenta por pagar.
      cuentaDestino = facturaPrevia.tipo === "compra"
        ? tercero.extranjero ? ca.proveedoresExterior : ca.proveedoresNacionales
        : tercero.extranjero ? ca.cuentasPorPagarExterior : ca.cuentasPorPagarNacionales;
    } else {
      const sugerida = ctx.categorias.find((c) => c.nombre === x.categoria_sugerida && c.tipo !== "venta");
      categoria = sugerida ?? ctx.categorias.find((c) => c.nombre === "Otros gastos") ?? null;
      cuentaDestino = categoria?.cuentaCodigo ?? null;
      hallazgos.push({
        codigo: "transferencia_sin_factura",
        nivel: "advertencia",
        mensaje: `No hay una factura registrada de este tercero; se registró como ${categoria?.nombre ?? "gasto"}`,
      });
    }
  }

  hallazgos.push(
    ...validarMovimiento(
      {
        clase,
        referencia,
        fecha: m.fecha,
        valorTotal: m.valor_total,
        componentes,
        beneficiario: tercero?.razon_social ?? null,
        confianzaGeneral: confianza,
      },
      {
        periodoCarpeta: { anio: archivo.anio_carpeta, mes: archivo.mes_carpeta },
        hoy: deps.hoy,
        umbralConfianza: ctx.umbralConfianza,
        bancoConocido: banco.conocido,
        bancoInformado: banco.informado,
        cuentaDestino,
      },
    ),
  );
  if (m.valor_total && totalCop === null && !hallazgos.some((h) => h.codigo === "sin_tasa")) {
    hallazgos.push({ codigo: "sin_tasa", nivel: "error", mensaje: "No se pudo convertir el valor a pesos" });
  }
  agregarDudaIA(x, hallazgos);

  let estado = decidirEstado({ esFactura: true, hallazgos, autoAprobacion: ctx.autoAprobacion });
  let asiento: Asiento | null = null;
  if (estado === "aprobada") {
    try {
      asiento = generarAsientoMovimiento(
        {
          clase,
          referencia,
          fecha: fecha!,
          terceroNombre: tercero!.razon_social,
          totalCop: totalCop!,
          componentesCop,
          impuesto,
          cuentaBanco: banco.cuenta,
          cuentaDestino,
        },
        ctx.cuentasMovimientos,
      );
    } catch (e) {
      if (!(e instanceof ErrorMovimiento)) throw e;
      hallazgos.push({ codigo: "asiento", nivel: "error", mensaje: e.message });
      estado = "pendiente_revision";
    }
  }

  const principal = cuentaPrincipalMovimiento(clase, impuesto, ctx.cuentasMovimientos, cuentaDestino);
  const ivaImportacion = componentesCop.filter((c) => c.concepto === "iva_importacion").reduce((s, c) => s + c.valor, 0);
  const fila: FilaFactura = {
    tipo: "pago",
    clase_documento: clase,
    tipo_documento: x.tipo_documento,
    numero: referencia,
    cufe: null,
    fecha_emision: fecha,
    fecha_vencimiento: null,
    tercero_id: tercero?.id ?? null,
    moneda: /^[A-Z]{3}$/.test(moneda) ? moneda : "COP",
    tasa_cambio: factor > 0 ? Number(factor.toFixed(4)) : 1,
    subtotal: noNegativo(m.valor_total),
    // IVA de importación en la moneda del documento, para el reporte de impuestos
    iva: factor > 0 ? redondear2(ivaImportacion / factor) : 0,
    total: noNegativo(m.valor_total),
    categoria_id: categoria?.id ?? null,
    cuenta_id: principal ? ctx.cuentas.find((c) => c.codigo === principal)?.id ?? null : null,
    estado: estado === "aprobada" ? "pendiente_revision" : estado,
    confianza,
    confianza_campos: x.confianza_campos,
    hallazgos: json(hallazgos),
    componentes: json(componentes),
    archivo_id: archivo.id,
    drive_file_id: archivo.drive_file_id,
    drive_url: archivo.drive_url,
    drive_md5: archivo.md5,
    carpeta_origen: archivo.ruta,
    datos_ia: x as unknown as Json,
    observaciones: [m.concepto, x.notas].filter(Boolean).join(" · ") || null,
  };
  return guardarDocumento(deps, archivo, fila, [], asiento, tercero?.id ?? null, estado, hallazgos);
}

interface TerceroGuardado {
  id: number;
  razon_social: string;
  extranjero: boolean;
}

async function asegurarTercero(db: BaseDatos, t: TerceroExtraido, rol: "proveedor" | "cliente"): Promise<TerceroGuardado> {
  await db
    .from("terceros")
    .upsert({ nit: t.nit, dv: t.dv, razon_social: t.razonSocial, pais: t.pais, tipo: rol }, { onConflict: "nit", ignoreDuplicates: true });
  const fila = exigir(await db.from("terceros").select("id, razon_social, tipo, pais").eq("nit", t.nit).single(), "Leyendo tercero");
  if (fila.tipo !== rol && fila.tipo !== "ambos") {
    await db.from("terceros").update({ tipo: "ambos" }).eq("id", fila.id);
  }
  return { id: fila.id, razon_social: fila.razon_social, extranjero: fila.pais !== "CO" };
}

async function marcarArchivo(db: BaseDatos, id: number, cambios: Tablas["archivos_drive"]["Update"]) {
  const { error } = await db.from("archivos_drive").update(cambios).eq("id", id);
  if (error) throw new Error(`Actualizando archivo ${id}: ${error.message}`);
}

async function registrarProcesamiento(
  db: BaseDatos,
  archivoId: number,
  datos: Omit<Tablas["procesamientos"]["Insert"], "archivo_id">,
) {
  await db.from("procesamientos").insert({ archivo_id: archivoId, ...datos });
}
