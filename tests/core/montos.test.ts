import { describe, expect, it } from "vitest";
import { netoAPagar, toleranciaPara, totalBruto, verificarCuadre } from "@/modules/contabilidad/core";
import type { MontosFactura } from "@/modules/contabilidad/core";

const base: MontosFactura = {
  subtotal: 1_000_000,
  iva: 190_000,
  otrosImpuestos: null,
  retefuente: 25_000,
  reteica: 9_660,
  total: null,
};

describe("verificarCuadre", () => {
  it("acepta total antes de retenciones (bruto)", () => {
    const r = verificarCuadre({ ...base, total: 1_190_000 }, 10);
    expect(r).toEqual({ cuadra: true, modo: "bruto", diferencia: 0 });
  });

  it("acepta total después de retenciones (neto)", () => {
    const r = verificarCuadre({ ...base, total: 1_155_340 }, 10);
    expect(r.cuadra).toBe(true);
    expect(r.modo).toBe("neto");
  });

  it("acepta diferencias de redondeo dentro de la tolerancia", () => {
    expect(verificarCuadre({ ...base, total: 1_190_008 }, 10).cuadra).toBe(true);
  });

  it("rechaza si no cuadra e informa la diferencia más cercana", () => {
    const r = verificarCuadre({ ...base, total: 1_200_000 }, 10);
    expect(r.cuadra).toBe(false);
    expect(r.diferencia).toBe(10_000);
  });

  it("no cuadra si falta el total o el subtotal", () => {
    expect(verificarCuadre({ ...base, total: null }, 10).cuadra).toBe(false);
    expect(verificarCuadre({ ...base, subtotal: null, total: 100 }, 10).cuadra).toBe(false);
  });

  it("maneja decimales en USD sin errores de punto flotante", () => {
    const r = verificarCuadre(
      { subtotal: 0.1, iva: 0.2, otrosImpuestos: null, retefuente: null, reteica: null, total: 0.3 },
      0,
    );
    expect(r.cuadra).toBe(true);
  });
});

describe("totales", () => {
  it("calcula bruto y neto", () => {
    expect(totalBruto(base)).toBe(1_190_000);
    expect(netoAPagar(base)).toBe(1_155_340);
  });
});

describe("toleranciaPara", () => {
  it("usa la de la moneda o la por defecto", () => {
    const cfg = { COP: 10, USD: 0.05, default: 0.01 };
    expect(toleranciaPara("COP", cfg)).toBe(10);
    expect(toleranciaPara("EUR", cfg)).toBe(0.01);
  });
});
