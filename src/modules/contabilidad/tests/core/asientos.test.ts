import { describe, expect, it } from "vitest";
import { cuadraAsiento, cuentasDesdeConfig, ErrorAsiento, generarAsiento } from "@/modules/contabilidad/core";
import type { FacturaParaAsiento } from "@/modules/contabilidad/core";

// Igual a la semilla de configuración
const cuentas = cuentasDesdeConfig({
  iva_descontable: "240810",
  iva_generado: "240805",
  otros_impuestos_por_pagar: "249595",
  retefuente_por_pagar: "236570",
  reteica_por_pagar: "236801",
  proveedores_nacionales: "220505",
  proveedores_exterior: "221005",
  cuentas_por_pagar_nacionales: "233595",
  cuentas_por_pagar_exterior: "233595",
  clientes_nacionales: "130505",
  clientes_exterior: "130510",
  retefuente_a_favor: "135515",
  reteica_a_favor: "135518",
});

const gasto: FacturaParaAsiento = {
  tipo: "gasto",
  numero: "FE-1",
  fecha: "2026-03-15",
  terceroNombre: "Agencia X",
  terceroExterior: false,
  moneda: "COP",
  tasaCambio: 1,
  montos: { subtotal: 1_000_000, iva: 190_000, otrosImpuestos: null, retefuente: 40_000, reteica: 9_660, total: 1_190_000 },
  cuentaPrincipal: "523560",
  cuentaRetefuente: "236525",
};

const resumen = (lineas: { cuenta: string; debito: number; credito: number }[]) =>
  lineas.map(({ cuenta, debito, credito }) => ({ cuenta, debito, credito }));

describe("generarAsiento · compras y gastos", () => {
  it("gasto nacional con IVA y retenciones", () => {
    const a = generarAsiento(gasto, cuentas);
    expect(resumen(a.lineas)).toEqual([
      { cuenta: "523560", debito: 1_000_000, credito: 0 },
      { cuenta: "240810", debito: 190_000, credito: 0 },
      { cuenta: "236525", debito: 0, credito: 40_000 },
      { cuenta: "236801", debito: 0, credito: 9_660 },
      { cuenta: "233595", debito: 0, credito: 1_140_340 },
    ]);
    expect(a.descripcion).toBe("Gasto FE-1 - Agencia X");
    expect(cuadraAsiento(a.lineas)).toBe(true);
  });

  it("usa la retención por defecto si la categoría no trae una", () => {
    const a = generarAsiento({ ...gasto, cuentaRetefuente: null }, cuentas);
    expect(a.lineas.find((l) => l.credito === 40_000)?.cuenta).toBe("236570");
  });

  it("compra de mercancía va a proveedores", () => {
    const a = generarAsiento({ ...gasto, tipo: "compra", cuentaPrincipal: "620501" }, cuentas);
    expect(a.lineas.at(-1)).toMatchObject({ cuenta: "220505", credito: 1_140_340 });
  });

  it("otros impuestos no descontables suman al gasto", () => {
    const a = generarAsiento(
      { ...gasto, montos: { subtotal: 10_000, iva: null, otrosImpuestos: 800, retefuente: null, reteica: null, total: 10_800 } },
      cuentas,
    );
    expect(resumen(a.lineas)).toEqual([
      { cuenta: "523560", debito: 10_800, credito: 0 },
      { cuenta: "233595", debito: 0, credito: 10_800 },
    ]);
  });

  it("proveedor del exterior en USD convertido con la TRM", () => {
    const a = generarAsiento(
      {
        ...gasto,
        tipo: "compra",
        cuentaPrincipal: "620501",
        terceroExterior: true,
        moneda: "USD",
        tasaCambio: 4_000,
        montos: { subtotal: 100, iva: null, otrosImpuestos: null, retefuente: null, reteica: null, total: 100 },
      },
      cuentas,
    );
    expect(resumen(a.lineas)).toEqual([
      { cuenta: "620501", debito: 400_000, credito: 0 },
      { cuenta: "221005", debito: 0, credito: 400_000 },
    ]);
  });

  it("siempre cuadra aunque la conversión genere centavos", () => {
    const a = generarAsiento(
      {
        ...gasto,
        moneda: "USD",
        tasaCambio: 3_987.65,
        montos: { subtotal: 33.33, iva: 6.33, otrosImpuestos: 0.07, retefuente: 1.33, reteica: 0.32, total: 39.73 },
      },
      cuentas,
    );
    expect(cuadraAsiento(a.lineas)).toBe(true);
  });
});

describe("generarAsiento · ventas", () => {
  it("venta nacional con IVA y retención que nos practica el cliente", () => {
    const a = generarAsiento(
      {
        ...gasto,
        tipo: "venta",
        numero: "PAG-100",
        terceroNombre: "Cliente SAS",
        cuentaPrincipal: "413501",
        cuentaRetefuente: null,
        montos: { subtotal: 500_000, iva: 95_000, otrosImpuestos: null, retefuente: 12_500, reteica: null, total: 595_000 },
      },
      cuentas,
    );
    expect(resumen(a.lineas)).toEqual([
      { cuenta: "135515", debito: 12_500, credito: 0 },
      { cuenta: "130505", debito: 582_500, credito: 0 },
      { cuenta: "413501", debito: 0, credito: 500_000 },
      { cuenta: "240805", debito: 0, credito: 95_000 },
    ]);
  });
});

describe("generarAsiento · errores", () => {
  it("falla si el neto es cero o negativo", () => {
    expect(() =>
      generarAsiento({ ...gasto, montos: { ...gasto.montos, subtotal: 0, iva: 0, retefuente: 0, reteica: 0 } }, cuentas),
    ).toThrow(ErrorAsiento);
  });

  it("falla sin tasa de cambio válida o sin subtotal", () => {
    expect(() => generarAsiento({ ...gasto, tasaCambio: 0 }, cuentas)).toThrow(ErrorAsiento);
    expect(() => generarAsiento({ ...gasto, montos: { ...gasto.montos, subtotal: null } }, cuentas)).toThrow(ErrorAsiento);
  });

  it("cuentasDesdeConfig exige todas las cuentas", () => {
    expect(() => cuentasDesdeConfig({ iva_descontable: "240810" })).toThrow(/iva_generado/);
  });
});

describe("cuadraAsiento", () => {
  it("detecta descuadres y asientos de una sola línea", () => {
    expect(cuadraAsiento([{ cuenta: "1", descripcion: "", debito: 10, credito: 0 }])).toBe(false);
    expect(
      cuadraAsiento([
        { cuenta: "1", descripcion: "", debito: 10, credito: 0 },
        { cuenta: "2", descripcion: "", debito: 0, credito: 9.99 },
      ]),
    ).toBe(false);
  });
});
