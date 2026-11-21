import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { clasificarErrorIA, ErrorExtraccion } from "./errores";
import { crearEsquemaExtraccion } from "./esquema";
import { construirSystemPrompt, INSTRUCCION_USUARIO, type ContextoPrompt } from "./prompt";
import {
  estimarCostoUsd,
  MIME_IMAGEN,
  type DocumentoEntrada,
  type ExtractorFacturas,
  type ResultadoExtraccion,
} from "./proveedor";

type Esfuerzo = "low" | "medium" | "high" | "xhigh" | "max";
const ESFUERZOS: Esfuerzo[] = ["low", "medium", "high", "xhigh", "max"];

// Límite de la API para documentos en base64 (32 MB por solicitud, con margen).
const TAMANO_MAXIMO_BYTES = 30 * 1024 * 1024;

export class ExtractorAnthropic implements ExtractorFacturas {
  readonly modelo: string;
  private readonly esfuerzo: Esfuerzo;
  private readonly cliente: Anthropic;

  constructor(opciones: { apiKey?: string; modelo?: string; esfuerzo?: string } = {}) {
    // Solo depende de variables de entorno; nada amarrado a una cuenta personal.
    this.cliente = new Anthropic({ apiKey: opciones.apiKey ?? process.env.ANTHROPIC_API_KEY, maxRetries: 2 });
    this.modelo = opciones.modelo ?? process.env.AI_MODEL ?? "claude-sonnet-5-5";
    const esfuerzo = (opciones.esfuerzo ?? process.env.AI_EFFORT ?? "medium") as Esfuerzo;
    this.esfuerzo = ESFUERZOS.includes(esfuerzo) ? esfuerzo : "medium";
  }

  async extraer(documento: DocumentoEntrada, contexto: ContextoPrompt): Promise<ResultadoExtraccion> {
    const bloque = this.bloqueDocumento(documento);
    const esquema = crearEsquemaExtraccion();

    let respuesta;
    try {
      respuesta = await this.cliente.messages.parse({
        model: this.modelo,
        max_tokens: 16000,
        system: [{ type: "text", text: construirSystemPrompt(contexto), cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: [bloque, { type: "text", text: INSTRUCCION_USUARIO }] }],
        output_config: { effort: this.esfuerzo, format: zodOutputFormat(esquema) },
      });
    } catch (error) {
      if (error instanceof Anthropic.APIError) {
        const cuerpo = error.error as { error?: { type?: string; message?: string } } | undefined;
        throw new ErrorExtraccion(
          clasificarErrorIA({
            status: error.status,
            tipo: cuerpo?.error?.type,
            mensaje: cuerpo?.error?.message ?? error.message,
            retryAfter: error.headers?.get("retry-after") ?? null,
          }),
        );
      }
      if (error instanceof Anthropic.APIConnectionError) {
        throw new ErrorExtraccion({
          codigo: "sobrecargado",
          mensaje: `No hubo conexión con la API: ${error.message}`,
          reintentable: true,
          pausarLote: true,
          esperaSegundos: 60,
        });
      }
      throw error;
    }

    const tokensEntrada =
      respuesta.usage.input_tokens +
      (respuesta.usage.cache_creation_input_tokens ?? 0) +
      (respuesta.usage.cache_read_input_tokens ?? 0);
    const tokensSalida = respuesta.usage.output_tokens;

    if (respuesta.stop_reason === "refusal") {
      throw new ErrorExtraccion({
        codigo: "rechazo",
        mensaje: "El modelo declinó procesar este documento",
        reintentable: false,
        pausarLote: false,
        esperaSegundos: null,
      });
    }
    if (respuesta.stop_reason === "max_tokens" || !respuesta.parsed_output) {
      throw new ErrorExtraccion({
        codigo: "respuesta_invalida",
        mensaje: `La respuesta del modelo no tiene el formato esperado (stop_reason: ${respuesta.stop_reason})`,
        reintentable: true,
        pausarLote: false,
        esperaSegundos: null,
      });
    }

    return {
      datos: respuesta.parsed_output,
      modelo: respuesta.model,
      tokensEntrada,
      tokensSalida,
      costoUsd: estimarCostoUsd(tokensEntrada, tokensSalida),
    };
  }

  private bloqueDocumento(documento: DocumentoEntrada): Anthropic.ContentBlockParam {
    if (documento.datos.length === 0) {
      throw new ErrorExtraccion({
        codigo: "archivo_ilegible",
        mensaje: "El archivo está vacío",
        reintentable: false,
        pausarLote: false,
        esperaSegundos: null,
      });
    }
    if (documento.datos.length > TAMANO_MAXIMO_BYTES) {
      throw new ErrorExtraccion({
        codigo: "archivo_ilegible",
        mensaje: "El archivo supera el tamaño máximo (30 MB)",
        reintentable: false,
        pausarLote: false,
        esperaSegundos: null,
      });
    }
    const data = documento.datos.toString("base64");
    if (documento.mime === "application/pdf") {
      return { type: "document", source: { type: "base64", media_type: "application/pdf", data } };
    }
    const mime = MIME_IMAGEN.find((m) => m === documento.mime);
    if (mime) {
      return { type: "image", source: { type: "base64", media_type: mime, data } };
    }
    throw new ErrorExtraccion({
      codigo: "archivo_ilegible",
      mensaje: `Formato no soportado: ${documento.mime}`,
      reintentable: false,
      pausarLote: false,
      esperaSegundos: null,
    });
  }
}
