import { describe, expect, it } from "vitest";
import { clasificarFactura, esNombreDeLaEmpresa, resolverCuenta } from "@/modules/contabilidad/core";

const EMPRESA = "901234567";
const PROVEEDOR = "890903938-8";

describe("clasificarFactura", () => {
  it("venta cuando la empresa es el emisor", () => {
    const r = clasificarFactura({ nitEmisor: "901.234.567", nitReceptor: PROVEEDOR, nitEmpresa: EMPRESA, tipoCategoria: "venta" });
    expect(r).toEqual({ tipo: "venta", contraparte: "receptor", hallazgos: [] });
  });

  it("gasto o compra cuando la empresa es el receptor, según la categoría", () => {
    expect(clasificarFactura({ nitEmisor: PROVEEDOR, nitReceptor: EMPRESA, nitEmpresa: EMPRESA, tipoCategoria: "gasto" }).tipo).toBe("gasto");
    expect(clasificarFactura({ nitEmisor: PROVEEDOR, nitReceptor: EMPRESA, nitEmpresa: EMPRESA, tipoCategoria: "compra" }).tipo).toBe("compra");
    expect(clasificarFactura({ nitEmisor: PROVEEDOR, nitReceptor: EMPRESA, nitEmpresa: EMPRESA, tipoCategoria: null }).tipo).toBe("gasto");
  });

  it("advierte si la factura no trae NIT del comprador, pero la clasifica", () => {
    const r = clasificarFactura({ nitEmisor: PROVEEDOR, nitReceptor: null, nitEmpresa: EMPRESA, tipoCategoria: "gasto" });
    expect(r.tipo).toBe("gasto");
    expect(r.hallazgos).toEqual([expect.objectContaining({ codigo: "receptor_no_identificado", nivel: "advertencia" })]);
  });

  it("error si la empresa no es parte de la factura", () => {
    const r = clasificarFactura({ nitEmisor: PROVEEDOR, nitReceptor: "890900608", nitEmpresa: EMPRESA, tipoCategoria: "gasto" });
    expect(r.tipo).toBeNull();
    expect(r.hallazgos[0]).toMatchObject({ codigo: "empresa_no_es_parte", nivel: "error" });
  });

  it("advierte si la categoría contradice el tipo", () => {
    const r = clasificarFactura({ nitEmisor: EMPRESA, nitReceptor: PROVEEDOR, nitEmpresa: EMPRESA, tipoCategoria: "gasto" });
    expect(r.tipo).toBe("venta");
    expect(r.hallazgos[0].codigo).toBe("categoria_incoherente");
  });

  it("exige que el NIT de la empresa esté configurado", () => {
    expect(() => clasificarFactura({ nitEmisor: PROVEEDOR, nitReceptor: null, nitEmpresa: "", tipoCategoria: null })).toThrow(/PAGURO_NIT/);
  });
});

describe("esNombreDeLaEmpresa", () => {
  it("reconoce a la empresa por su nombre distintivo", () => {
    expect(esNombreDeLaEmpresa("Paguro Bancolombia Negocios", "Paguro Corp")).toBe(true);
    expect(esNombreDeLaEmpresa("CORPORACIÓN PAGURO SAS", "Paguro Corp")).toBe(true);
  });

  it("no confunde otros nombres", () => {
    expect(esNombreDeLaEmpresa("Nataly Contabilidad", "Paguro Corp")).toBe(false);
    expect(esNombreDeLaEmpresa(null, "Paguro Corp")).toBe(false);
    expect(esNombreDeLaEmpresa("Corp Andina", "Paguro Corp")).toBe(false);
  });
});

describe("resolverCuenta", () => {
  const permitidas = new Set(["523560", "513595"]);

  it("usa la sugerencia de la IA si está permitida", () => {
    expect(resolverCuenta("513595", "523560", permitidas)).toEqual({ cuenta: "513595", origen: "ia" });
  });

  it("cae a la cuenta de la categoría si la IA sugiere una no permitida", () => {
    expect(resolverCuenta("999999", "523560", permitidas)).toEqual({ cuenta: "523560", origen: "categoria" });
    expect(resolverCuenta(null, "523560", permitidas)).toEqual({ cuenta: "523560", origen: "categoria" });
  });

  it("null si no hay ninguna", () => {
    expect(resolverCuenta(null, null, permitidas)).toEqual({ cuenta: null, origen: null });
  });
});
