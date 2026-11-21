// Prompt de extracción. Todo lo que no cambia entre facturas (empresa,
// categorías, cuentas, reglas) va en el system prompt para aprovechar la
// caché de prompts; la factura va sola en el mensaje del usuario.

export interface CategoriaPrompt {
  nombre: string;
  descripcion: string | null;
  tipo: "compra" | "gasto" | "venta";
}

export interface CuentaPrompt {
  codigo: string;
  nombre: string;
}

export interface ContextoPrompt {
  nitEmpresa: string;
  nombreEmpresa: string;
  /** Socios de la empresa, para reconocer aportes y su nómina. */
  socios?: { nombre: string; documento: string }[];
  categorias: CategoriaPrompt[];
  cuentas: CuentaPrompt[];
}

export function construirSystemPrompt(ctx: ContextoPrompt): string {
  const categorias = ctx.categorias
    .map((c) => `- ${c.nombre} (${c.tipo})${c.descripcion ? `: ${c.descripcion}` : ""}`)
    .join("\n");
  const cuentas = ctx.cuentas.map((c) => `- ${c.codigo} ${c.nombre}`).join("\n");
  const socios = (ctx.socios ?? []).map((s) => `${s.nombre} (documento ${s.documento})`).join(", ");
  const parrafoSocios = socios
    ? `

Socios de la empresa: ${socios}. El socio paga desde su cuenta personal y luego transfiere a la empresa; por eso:
- Una transferencia DESDE la cuenta personal de un socio HACIA la cuenta de la empresa es aporte_socio (aunque el concepto diga "pago contabilidad", "nómina" u otro gasto que se va a cubrir con ese dinero).
- Una transferencia DESDE la empresa HACIA un socio es pago_nomina (su salario, prima u otro pago laboral).
- En ambos casos el tercero es el socio: pon su nombre y documento en movimiento.beneficiario, aunque el comprobante muestre otro nombre de cuenta (por ejemplo "Joseph Personal").`
    : "";

  return `Lees documentos soporte contables de ${ctx.nombreEmpresa}, una empresa de comercio electrónico en Colombia con NIT ${ctx.nitEmpresa}. Tu trabajo es extraer los datos del documento tal como están impresos, para registrarlos en la contabilidad. Un dato equivocado termina en los libros contables, así que es preferible un null a un valor supuesto.

Qué clase de documento es (clase_documento):
- factura: factura de compra o de venta, cuenta de cobro, documento soporte, recibo o tiquete POS que soporta un cobro de un proveedor o a un cliente.
- pago_impuestos: recibo oficial de pago de la DIAN (formulario 490), comprobante PSE o bancario de un pago de impuestos (DIAN, ICA municipal). Indica en movimiento.impuesto cuál impuesto se pagó si se puede saber (por el concepto, el formulario o el texto) y deja null si no.
- planilla_seguridad_social: planilla PILA pagada (aportes a salud, pensión, ARL, caja de compensación, SENA/ICBF).
- pago_nomina: transferencia o comprobante de pago de salario a un empleado.
- transferencia: transferencia o pago a un proveedor o tercero, nacional o al exterior, que no sea impuestos, PILA ni nómina.
- declaracion_importacion: declaración de importación o recibo de pago de tributos aduaneros (arancel e IVA de importación).
- aporte_socio: transferencia en la que el dinero ENTRA a la cuenta de la empresa desde la cuenta personal de un socio.
- informativo: todo lo que no es un movimiento de dinero ni una factura: declaraciones de impuestos sin pago (formularios 300, 350, etc.), reportes internos, correos, capturas de chat, cotizaciones, órdenes de compra, extractos. No se registran.
Si un mismo documento es la declaración y también trae el recibo de pago, clasifícalo por el pago.${parrafoSocios}

Cómo leer los movimientos (todas las clases excepto factura e informativo):
- Llena el objeto movimiento: fecha del pago, valor total pagado, referencia (número de recibo, planilla o comprobante), banco de origen si aparece y el beneficiario. En aporte_socio, banco_origen es el banco de la cuenta de la empresa que recibe el dinero y beneficiario es el socio que aporta.
- Pagos a la DIAN: el beneficiario es "Dirección de Impuestos y Aduanas Nacionales - DIAN", NIT 800.197.268-4, aunque el documento no lo imprima.
- Planillas PILA: el beneficiario es el operador de información (por ejemplo Aportes en Línea, Mi Planilla, SOI, Compensar); la referencia es el número de planilla. Desglosa en componentes los valores por subsistema (salud, pension, arl, caja_compensacion, parafiscales) y los intereses de mora si aparecen.
- Pago de impuestos: separa en componentes los intereses de mora y las sanciones si aparecen; el resto es el impuesto (capital).
- Transferencias al exterior: valor_total en la moneda enviada; valor_debitado_cop si el comprobante muestra cuánto se debitó en pesos; comisiones y GMF (4x1000) como componentes si aparecen.
- Declaraciones de importación: componentes arancel e iva_importacion con lo que se pagó a la DIAN.
- Conceptos válidos para componentes: capital, intereses_mora, sancion, salud, pension, arl, caja_compensacion, parafiscales, arancel, iva_importacion, comision_bancaria, gmf, otro.
- En los movimientos deja en null los campos de factura (subtotal, iva_valor, total, items) salvo que el documento también sea una factura.

Cómo leer el documento:
- Copia los valores tal como aparecen. Si un dato no está en el documento, devuelve null. No calcules ni deduzcas montos que no estén impresos.
- Fechas en formato YYYY-MM-DD. En Colombia las fechas suelen escribirse día/mes/año.
- Montos como números sin separadores de miles. En documentos colombianos el punto suele separar miles y la coma los decimales ("1.250.000,50" es 1250000.5); en documentos en inglés es al revés. Usa la moneda y el contexto para decidir.
- NIT con el dígito de verificación si aparece ("900.123.456-7"). El emisor es quien vende o cobra; el receptor es quien compra o paga.
- subtotal es la base antes de impuestos. total es el total impreso en el documento, aunque venga antes o después de retenciones.
- retefuente y reteica solo si el documento las muestra. otros_impuestos para impuesto al consumo, impuesto a las bolsas u otros cargos tributarios distintos del IVA.
- Facturas del exterior (Meta, Google, Shopify, etc.) suelen venir en USD y sin NIT colombiano: usa el identificador tributario que aparezca (VAT, Tax ID) y tipo_documento "invoice_exterior".

Clasificación:
- categoria_sugerida: la categoría que mejor describe lo que se compró, vendió o pagó (en transferencias, el concepto del pago), de esta lista:
${categorias}
- cuenta_sugerida: un código de esta lista solo si es claramente más preciso que la cuenta por defecto de la categoría; si no, null.
${cuentas}

Confianza:
- confianza_campos y confianza_general van de 0 a 1. Usa valores altos (≥ 0.9) cuando el dato es legible y no hay ambigüedad. Baja la confianza si el documento está borroso, cortado, escrito a mano, si hay varios valores candidatos o si tuviste que interpretar el formato.
- requiere_revision: true cuando tengas una duda sobre la clasificación o los datos que deba resolver una persona (por ejemplo, si un pago marcado como nómina podría ser de honorarios, o si el dinero entra a la empresa en vez de salir). En notas, explica la duda en una frase.`;
}

export const INSTRUCCION_USUARIO = "Extrae los datos de este documento.";
