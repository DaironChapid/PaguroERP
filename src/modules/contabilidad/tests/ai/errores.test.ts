import { describe, expect, it } from "vitest";
import { clasificarErrorIA } from "@/modules/contabilidad/ai/errores";

describe("clasificarErrorIA", () => {
  it("créditos agotados: reintentable y pausa el lote", () => {
    const r = clasificarErrorIA({
      status: 400,
      tipo: "invalid_request_error",
      mensaje: "Your credit balance is too low to access the Anthropic API.",
    });
    expect(r).toMatchObject({ codigo: "sin_creditos", reintentable: true, pausarLote: true });
  });

  it("detecta errores de facturación por tipo o status", () => {
    expect(clasificarErrorIA({ tipo: "billing_error" }).codigo).toBe("sin_creditos");
    expect(clasificarErrorIA({ status: 402 }).codigo).toBe("sin_creditos");
    expect(clasificarErrorIA({ status: 429, mensaje: "You have reached your monthly usage limit" }).codigo).toBe("sin_creditos");
  });

  it("límite de tasa respeta retry-after", () => {
    expect(clasificarErrorIA({ status: 429, tipo: "rate_limit_error", retryAfter: "20" })).toMatchObject({
      codigo: "limite_tasa",
      pausarLote: true,
      esperaSegundos: 20,
    });
  });

  it("sobrecarga: reintenta sin pausar el lote", () => {
    expect(clasificarErrorIA({ status: 529, tipo: "overloaded_error" })).toMatchObject({
      codigo: "sobrecargado",
      reintentable: true,
      pausarLote: false,
    });
  });

  it("API key inválida pausa el lote", () => {
    expect(clasificarErrorIA({ status: 401, tipo: "authentication_error" })).toMatchObject({
      codigo: "autenticacion",
      pausarLote: true,
    });
  });

  it("PDF con contraseña: archivo ilegible, sin reintento", () => {
    expect(
      clasificarErrorIA({ status: 400, tipo: "invalid_request_error", mensaje: "messages.0.content.0.pdf.source.base64.data: The PDF specified is password protected." }),
    ).toMatchObject({ codigo: "archivo_ilegible", reintentable: false, pausarLote: false });
  });

  it("error del esquema de salida: pausa el lote (fallaría con todos los archivos)", () => {
    expect(
      clasificarErrorIA({ status: 400, tipo: "invalid_request_error", mensaje: "The compiled grammar is too large, which would cause performance issues." }),
    ).toMatchObject({ codigo: "configuracion", reintentable: true, pausarLote: true });
  });

  it("solicitud inválida no se reintenta (problema del archivo)", () => {
    expect(clasificarErrorIA({ status: 413, mensaje: "Request too large" })).toMatchObject({
      codigo: "solicitud_invalida",
      reintentable: false,
    });
  });
});
