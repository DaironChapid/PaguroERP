import { z } from "zod/v4";
import { CLASES_MOVIMIENTO } from "../core/movimientos";

// Esquema de la respuesta estructurada del modelo. Los nombres van en
// snake_case porque es lo que ve el modelo y lo que se guarda en `datos_ia`.
//
// La API compila el esquema a una gramática con un tamaño máximo. Por eso
// solo clase_documento es una lista cerrada: el resto de listas (tipo de
// documento, categoría, cuenta, concepto, impuesto) van como texto, el
// prompt indica los valores válidos y el código los normaliza.

export const TIPOS_DOCUMENTO = [
  "factura_electronica",
  "factura",
  "cuenta_de_cobro",
  "documento_soporte",
  "recibo",
  "tiquete_pos",
  "nota_credito",
  "invoice_exterior",
  "recibo_pago_impuestos",
  "comprobante_transferencia",
  "planilla_pila",
  "declaracion_importacion",
  "declaracion_tributaria",
  "reporte_interno",
  "otro",
] as const;

export const CLASES_DOCUMENTO = ["factura", ...CLASES_MOVIMIENTO, "informativo"] as const;

const texto = z.string().nullable();
const monto = z.number().nullable();

const parte = z.object({
  nombre: texto,
  nit: texto.describe("NIT o identificador tributario tal como aparece, con dígito de verificación"),
  pais: texto.describe("Código ISO de 2 letras"),
});

export function crearEsquemaExtraccion() {
  return z.object({
    clase_documento: z.enum(CLASES_DOCUMENTO),
    tipo_documento: z.string().describe(`Uno de: ${TIPOS_DOCUMENTO.join(", ")}`),
    numero: texto,
    cufe: texto,
    fecha_emision: texto.describe("YYYY-MM-DD"),
    fecha_vencimiento: texto.describe("YYYY-MM-DD"),
    emisor: parte,
    receptor: parte,
    moneda: texto.describe("ISO 4217"),
    items: z.array(z.object({ descripcion: z.string(), cantidad: monto, valor_unitario: monto, total: monto })),
    subtotal: monto,
    iva_tasa: monto.describe("Porcentaje, por ejemplo 19"),
    iva_valor: monto,
    retefuente: monto,
    reteica: monto,
    otros_impuestos: z.array(z.object({ nombre: z.string(), valor: z.number() })),
    total: monto,
    movimiento: z
      .object({
        fecha: texto.describe("YYYY-MM-DD"),
        valor_total: monto,
        moneda: texto,
        valor_debitado_cop: monto,
        referencia: texto,
        banco_origen: texto,
        beneficiario: parte,
        concepto: texto,
        impuesto: texto.describe("iva, retencion_fuente, renta, ica u otro"),
        componentes: z.array(z.object({ concepto: z.string(), valor: z.number() })),
      })
      .nullable(),
    categoria_sugerida: texto,
    cuenta_sugerida: texto,
    confianza_campos: z.object({
      numero: z.number(),
      fecha: z.number(),
      nits: z.number(),
      montos: z.number(),
    }),
    confianza_general: z.number(),
    requiere_revision: z.boolean().describe("true si hay una duda que debe resolver una persona; explícala en notas"),
    notas: texto,
  });
}

export type Extraccion = z.infer<ReturnType<typeof crearEsquemaExtraccion>>;
