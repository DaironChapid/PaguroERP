import { describe, expect, it } from "vitest";
import { calcularDv, mismoNit, normalizarNit, validarNit } from "@/modules/contabilidad/core";

describe("calcularDv", () => {
  it("calcula el dígito de verificación de NIT reales", () => {
    expect(calcularDv("890903938")).toBe("8"); // Bancolombia
    expect(calcularDv("890900608")).toBe("9"); // Almacenes Éxito
  });
});

describe("normalizarNit", () => {
  it("quita puntos, espacios y separa el DV", () => {
    expect(normalizarNit("890.903.938-8")).toEqual({ numero: "890903938", dv: "8", extranjero: false });
    expect(normalizarNit("NIT: 890903938-8")).toEqual({ numero: "890903938", dv: "8", extranjero: false });
    expect(normalizarNit("C.C. 1.020.304.050")).toEqual({ numero: "1020304050", dv: null, extranjero: false });
  });

  it("separa el DV pegado cuando el número de 10 dígitos lo valida", () => {
    expect(normalizarNit("8909039388")).toEqual({ numero: "890903938", dv: "8", extranjero: false });
  });

  it("no separa el DV si no coincide (puede ser una cédula de 10 dígitos)", () => {
    expect(normalizarNit("8909039381")).toEqual({ numero: "8909039381", dv: null, extranjero: false });
  });

  it("separa el DV escrito con espacio", () => {
    expect(normalizarNit("890 903 938 8")).toEqual({ numero: "890903938", dv: "8", extranjero: false });
  });

  it("reconoce identificadores extranjeros", () => {
    expect(normalizarNit("VAT IE9692928F")).toEqual({ numero: "IE9692928F", dv: null, extranjero: true });
  });

  it("devuelve null si no hay nada", () => {
    expect(normalizarNit(null)).toBeNull();
    expect(normalizarNit("  ")).toBeNull();
    expect(normalizarNit("NIT")).toBeNull();
  });
});

describe("validarNit", () => {
  it("acepta NIT con DV correcto y sin DV", () => {
    expect(validarNit("890.903.938-8").valido).toBe(true);
    expect(validarNit("890903938").valido).toBe(true);
  });

  it("rechaza DV incorrecto", () => {
    const r = validarNit("890.903.938-1");
    expect(r.valido).toBe(false);
    expect(r.motivo).toContain("esperado 8");
  });

  it("rechaza longitudes imposibles", () => {
    expect(validarNit("123").valido).toBe(false);
    expect(validarNit("12345678901").valido).toBe(false);
  });
});

describe("mismoNit", () => {
  it("compara ignorando formato y DV", () => {
    expect(mismoNit("890.903.938-8", "890903938")).toBe(true);
    expect(mismoNit("890903938", "890900608")).toBe(false);
    expect(mismoNit(null, "890903938")).toBe(false);
  });
});
