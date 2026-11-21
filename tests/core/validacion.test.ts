import { describe, expect, it } from "vitest";
import { decidirEstado, validarFactura } from "@/modules/contabilidad/core";
import type { ContextoValidacion, DatosFactura } from "@/modules/contabilidad/core";

const datos: DatosFactura = {
  esFactura: true,
  tipoDocumento: "factura_electronica",
  numero: "FE-1234",
  fechaEmision: "2026-03-15",
  fechaVencimiento: "2026-04-15",
  emisorNit: "890.903.938-8",
  receptorNit: "901234567",
  moneda: "COP",
  montos: { subtotal: 100_000, iva: 19_000, otrosImpuestos: null, retefuente: null, reteica: null, total: 119_000 },
  confianzaGeneral: 0.95,
  confianzaCampos: { numero: 0.99, total: 0.97 },
};

const ctx: ContextoValidacion = {
  tipo: "gasto",
  periodoCarpeta: { anio: 2026, mes: 3 },
  hoy: "2026-11-19",
  tolerancia: 10,
  umbralConfianza: 0.85,
  duplicada: false,
  cuentaAsignada: true,
};

const codigos = (d: DatosFactura, c: ContextoValidacion = ctx) =>
  validarFactura(d, c).hallazgos.map((h) => `${h.nivel}:${h.codigo}`);

describe("validarFactura", () => {
  it("una factura correcta no tiene hallazgos", () => {
    const r = validarFactura(datos, ctx);
    expect(r.hallazgos).toEqual([]);
    expect(r.modoTotal).toBe("bruto");
  });

  it("campos obligatorios", () => {
    expect(codigos({ ...datos, numero: null })).toContain("error:campo_faltante");
    expect(codigos({ ...datos, montos: { ...datos.montos, total: null } })).toContain("error:campo_faltante");
  });

  it("facturas del exterior sin identificador: solo advertencia", () => {
    expect(codigos({ ...datos, tipoDocumento: "invoice_exterior", emisorNit: null })).toEqual([
      "advertencia:exterior_sin_identificacion",
    ]);
    expect(codigos({ ...datos, emisorNit: null })).toContain("error:campo_faltante");
  });

  it("en ventas el NIT del receptor es obligatorio", () => {
    expect(codigos({ ...datos, receptorNit: null }, { ...ctx, tipo: "venta" })).toContain("error:campo_faltante");
    expect(codigos({ ...datos, receptorNit: null })).not.toContain("error:campo_faltante");
  });

  it("fecha fuera del mes de la carpeta es solo advertencia", () => {
    const h = codigos({ ...datos, fechaEmision: "2026-02-28" });
    expect(h).toEqual(["advertencia:fecha_fuera_de_carpeta"]);
    expect(codigos({ ...datos, fechaEmision: "2025-03-01" }, { ...ctx, periodoCarpeta: { anio: 2026, mes: null } }))
      .toEqual(["advertencia:fecha_fuera_de_carpeta"]);
  });

  it("fechas inválidas o futuras", () => {
    expect(codigos({ ...datos, fechaEmision: "2026-02-30" })).toContain("error:fecha_invalida");
    expect(codigos({ ...datos, fechaEmision: "2027-01-01" }, { ...ctx, periodoCarpeta: { anio: null, mes: null } }))
      .toContain("error:fecha_futura");
    expect(codigos({ ...datos, fechaVencimiento: "2026-03-01" })).toContain("advertencia:vencimiento_anterior");
  });

  it("NIT inválido", () => {
    expect(codigos({ ...datos, emisorNit: "890903938-1" })).toContain("error:nit_emisor_invalido");
  });

  it("montos que no cuadran", () => {
    expect(codigos({ ...datos, montos: { ...datos.montos, total: 150_000 } })).toContain("error:no_cuadra");
  });

  it("duplicada y sin cuenta", () => {
    expect(codigos(datos, { ...ctx, duplicada: true })).toContain("error:duplicada");
    expect(codigos(datos, { ...ctx, cuentaAsignada: false })).toContain("error:sin_cuenta");
  });

  it("confianza baja general y por campo", () => {
    expect(codigos({ ...datos, confianzaGeneral: 0.6 })).toContain("error:confianza_baja");
    expect(codigos({ ...datos, confianzaCampos: { total: 0.4 } })).toEqual(["advertencia:campos_dudosos"]);
  });

  it("notas crédito van a revisión", () => {
    expect(codigos({ ...datos, tipoDocumento: "nota_credito" })).toContain("error:nota_credito");
  });
});

describe("decidirEstado", () => {
  const advertencia = { codigo: "x", nivel: "advertencia" as const, mensaje: "" };
  const error = { codigo: "y", nivel: "error" as const, mensaje: "" };

  it("aprueba si no hay errores y la auto-aprobación está activa", () => {
    expect(decidirEstado({ esFactura: true, hallazgos: [advertencia], autoAprobacion: true })).toBe("aprobada");
  });

  it("manda a revisión si hay errores o la auto-aprobación está apagada", () => {
    expect(decidirEstado({ esFactura: true, hallazgos: [error], autoAprobacion: true })).toBe("pendiente_revision");
    expect(decidirEstado({ esFactura: true, hallazgos: [], autoAprobacion: false })).toBe("pendiente_revision");
  });

  it("descarta lo que no es factura", () => {
    expect(decidirEstado({ esFactura: false, hallazgos: [], autoAprobacion: true })).toBe("descartada");
  });
});
