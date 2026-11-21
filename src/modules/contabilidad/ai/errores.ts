// Clasificación de errores del proveedor de IA. Decide si un archivo se
// reintenta, cuándo, y si conviene pausar el lote completo (por ejemplo
// cuando se agotan los créditos del mes: seguir solo genera más errores).

export type CodigoErrorIA =
  | "sin_creditos"
  | "limite_tasa"
  | "sobrecargado"
  | "autenticacion"
  | "solicitud_invalida"
  | "archivo_ilegible" // formato no soportado, archivo dañado o protegido con contraseña
  | "configuracion" // el esquema o la solicitud no son válidos para ningún archivo
  | "respuesta_invalida" // el modelo no devolvió el JSON esperado
  | "rechazo" // el modelo declinó procesar el documento
  | "desconocido";

/** Error de extracción ya clasificado, para que el servicio decida qué hacer. */
export class ErrorExtraccion extends Error {
  constructor(public readonly detalle: ErrorIAClasificado) {
    super(detalle.mensaje);
    this.name = "ErrorExtraccion";
  }
}

export interface ErrorIAClasificado {
  codigo: CodigoErrorIA;
  mensaje: string;
  reintentable: boolean;
  /** Detener el resto del lote: el siguiente archivo fallaría igual. */
  pausarLote: boolean;
  /** Espera sugerida antes de reintentar, en segundos (null = sin espera definida). */
  esperaSegundos: number | null;
}

export interface ErrorHttpIA {
  status?: number;
  tipo?: string; // p. ej. "rate_limit_error", "overloaded_error", "invalid_request_error"
  mensaje?: string;
  /** Header retry-after, si vino. */
  retryAfter?: string | null;
}

const PATRON_CREDITOS = /credit|billing|balance|quota|usage limit|spend limit|insufficient funds/i;

export function clasificarErrorIA(e: ErrorHttpIA): ErrorIAClasificado {
  const mensaje = e.mensaje ?? "Error desconocido del proveedor de IA";
  const tipo = e.tipo ?? "";
  const retry = e.retryAfter ? Number(e.retryAfter) : NaN;
  const espera = Number.isFinite(retry) ? retry : null;

  // Créditos agotados o límite de gasto: no tiene sentido seguir el lote.
  if (tipo === "billing_error" || e.status === 402 || PATRON_CREDITOS.test(mensaje)) {
    return {
      codigo: "sin_creditos",
      mensaje: `Sin créditos de API: ${mensaje}`,
      reintentable: true,
      pausarLote: true,
      esperaSegundos: null,
    };
  }
  if (e.status === 429 || tipo === "rate_limit_error") {
    return { codigo: "limite_tasa", mensaje, reintentable: true, pausarLote: true, esperaSegundos: espera ?? 60 };
  }
  if (e.status === 529 || e.status === 503 || tipo === "overloaded_error") {
    return { codigo: "sobrecargado", mensaje, reintentable: true, pausarLote: false, esperaSegundos: espera ?? 30 };
  }
  if (e.status === 401 || e.status === 403 || tipo === "authentication_error" || tipo === "permission_error") {
    return {
      codigo: "autenticacion",
      mensaje: `API key inválida o sin permisos: ${mensaje}`,
      reintentable: true,
      pausarLote: true,
      esperaSegundos: null,
    };
  }
  if (/password protected/i.test(mensaje)) {
    return { codigo: "archivo_ilegible", mensaje: "El PDF está protegido con contraseña", reintentable: false, pausarLote: false, esperaSegundos: null };
  }
  // Errores del esquema de salida o de la solicitud en sí: fallarían igual con cualquier archivo.
  if (/grammar|output_config|json schema|schema is invalid/i.test(mensaje)) {
    return { codigo: "configuracion", mensaje: `Error de configuración de la IA: ${mensaje}`, reintentable: true, pausarLote: true, esperaSegundos: null };
  }
  if (e.status === 400 || e.status === 413 || tipo === "invalid_request_error") {
    // Problema con este archivo en particular (muy grande, formato no soportado…).
    return { codigo: "solicitud_invalida", mensaje, reintentable: false, pausarLote: false, esperaSegundos: null };
  }
  if (e.status !== undefined && e.status >= 500) {
    return { codigo: "sobrecargado", mensaje, reintentable: true, pausarLote: false, esperaSegundos: espera ?? 30 };
  }
  return { codigo: "desconocido", mensaje, reintentable: true, pausarLote: false, esperaSegundos: null };
}
