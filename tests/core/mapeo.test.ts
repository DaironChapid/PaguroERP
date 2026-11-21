import { describe, expect, it } from "vitest";
import { datosDesdeExtraccion, terceroDesdeParte } from "@/modules/contabilidad/core";
import type { ExtraccionCruda } from "@/modules/contabilidad/core";

const cruda: ExtraccionCruda = {
  clase_documento: "factura",
  tipo_documento: "factura_electronica",
  numero: "  FEAD   2041 ",
  fecha_emision: "2026-03-15",
  fecha_vencimiento: null,
  emisor: { nombre: "Agencia SAS", nit: "900.123.456-8", pais: "CO" },
  receptor: { nombre: "Paguro", nit: "901.937.774-2", pais: "CO" },
  moneda: "cop",
  subtotal: 1000,
  iva_tasa: 19,
  iva_valor: 190,
  retefuente: null,
  reteica: null,
  otros_impuestos: [
    { nombre: "Impoconsumo", valor: 50 },
    { nombre: "Bolsas", valor: 0.5 },
  ],
  total: 1240.5,
  confianza_campos: { total: 1.2, numero: 0.9 },
  confianza_general: 0.93,
};

describe("datosDesdeExtraccion", () => {
  it("normaliza número, moneda, otros impuestos y confianza", () => {
    const d = datosDesdeExtraccion(cruda);
    expect(d.numero).toBe("FEAD 2041");
    expect(d.moneda).toBe("COP");
    expect(d.montos).toEqual({ subtotal: 1000, iva: 190, otrosImpuestos: 50.5, retefuente: null, reteica: null, total: 1240.5 });
    expect(d.confianzaCampos).toEqual({ total: 1, numero: 0.9 });
  });

  it("sin impuestos ni retenciones, el subtotal es el total", () => {
    const sinIva = { ...cruda, subtotal: null, iva_valor: null, otros_impuestos: [], total: 500_000 };
    expect(datosDesdeExtraccion(sinIva).montos.subtotal).toBe(500_000);
    expect(datosDesdeExtraccion({ ...sinIva, iva_valor: 95_000 }).montos.subtotal).toBeNull();
  });

  it("COP por defecto y otros impuestos null si no hay", () => {
    const d = datosDesdeExtraccion({ ...cruda, moneda: null, otros_impuestos: [], numero: "  " });
    expect(d.moneda).toBe("COP");
    expect(d.montos.otrosImpuestos).toBeNull();
    expect(d.numero).toBeNull();
  });
});

describe("terceroDesdeParte", () => {
  it("tercero nacional", () => {
    expect(terceroDesdeParte(cruda.emisor)).toEqual({
      nit: "900123456",
      dv: "8",
      razonSocial: "Agencia SAS",
      pais: "CO",
      extranjero: false,
    });
  });

  it("tercero del exterior", () => {
    expect(terceroDesdeParte({ nombre: "Meta Platforms Ireland Ltd", nit: "IE9692928F", pais: "IE" })).toEqual({
      nit: "IE9692928F",
      dv: null,
      razonSocial: "Meta Platforms Ireland Ltd",
      pais: "IE",
      extranjero: true,
    });
  });

  it("null sin identificación", () => {
    expect(terceroDesdeParte({ nombre: "Tienda", nit: null, pais: null })).toBeNull();
  });

  it("beneficiario nacional sin cédula en un pago: se identifica por nombre", () => {
    expect(terceroDesdeParte({ nombre: "Nataly Contabilidad", nit: null, pais: "CO" }, { sinNit: true })).toEqual({
      nit: "SNNATALYCONTABILIDAD",
      dv: null,
      razonSocial: "Nataly Contabilidad",
      pais: "CO",
      extranjero: false,
    });
    expect(terceroDesdeParte({ nombre: "Nataly Contabilidad", nit: null, pais: "CO" })).toBeNull();
  });

  it("proveedor del exterior sin identificador: se identifica por nombre", () => {
    expect(terceroDesdeParte({ nombre: "Shopify Inc.", nit: null, pais: "CA" }, { exterior: true })).toEqual({
      nit: "EXTSHOPIFYINC",
      dv: null,
      razonSocial: "Shopify Inc.",
      pais: "CA",
      extranjero: true,
    });
    expect(terceroDesdeParte({ nombre: null, nit: null, pais: null }, { exterior: true })).toBeNull();
  });
});
