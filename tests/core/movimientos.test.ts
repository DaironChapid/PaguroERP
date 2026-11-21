import { describe, expect, it } from "vitest";
import {
  cuadraAsiento,
  cuentaBanco,
  cuentasMovimientosDesdeConfig,
  ErrorMovimiento,
  generarAsientoMovimiento,
  normalizarConcepto,
  normalizarImpuesto,
  validarMovimiento,
} from "@/modules/contabilidad/core";
import type { ContextoMovimiento, DatosMovimiento, MovimientoParaAsiento } from "@/modules/contabilidad/core";

// Igual a la semilla de configuración
const c = cuentasMovimientosDesdeConfig({
  bancos: { Bancolombia: "111005" },
  banco_por_defecto: "111005",
  iva_por_pagar: "240805",
  retefuente_por_pagar: "236570",
  renta_por_pagar: "240405",
  ica_por_pagar: "241205",
  otros_impuestos_por_pagar: "249595",
  intereses_mora: "530520",
  sanciones: "539520",
  aportes_salud: "510569",
  aportes_pension: "510570",
  aportes_arl: "510568",
  aportes_caja: "510572",
  aportes_parafiscales: "510575",
  sueldos: "510506",
  comisiones_bancarias: "530515",
  gmf: "511595",
  arancel: "620501",
  iva_importacion: "240810",
  aportes_socios: "310520",
});

const base: MovimientoParaAsiento = {
  clase: "pago_impuestos",
  referencia: "4911168588945",
  fecha: "2026-09-14",
  terceroNombre: "DIAN",
  totalCop: 1_090_000,
  componentesCop: [],
  impuesto: "iva",
  cuentaBanco: "111005",
  cuentaDestino: null,
};

const resumen = (a: { lineas: { cuenta: string; debito: number; credito: number }[] }) =>
  a.lineas.map(({ cuenta, debito, credito }) => ({ cuenta, debito, credito }));

describe("generarAsientoMovimiento", () => {
  it("aporte de socio: entra dinero al banco y se abona al patrimonio", () => {
    const a = generarAsientoMovimiento(
      { ...base, clase: "aporte_socio", impuesto: null, referencia: null, terceroNombre: "JOSEPH ARCE CLAVIJO", totalCop: 1_750_905 },
      c,
    );
    expect(resumen(a)).toEqual([
      { cuenta: "111005", debito: 1_750_905, credito: 0 },
      { cuenta: "310520", debito: 0, credito: 1_750_905 },
    ]);
    expect(cuadraAsiento(a.lineas)).toBe(true);
    expect(a.descripcion).toBe("Aporte de socio - JOSEPH ARCE CLAVIJO");
  });

  it("aporte de socio con la cuenta corregida por una persona", () => {
    const a = generarAsientoMovimiento({ ...base, clase: "aporte_socio", impuesto: null, totalCop: 100, cuentaPrincipal: "235510" }, c);
    expect(resumen(a)).toEqual([
      { cuenta: "111005", debito: 100, credito: 0 },
      { cuenta: "235510", debito: 0, credito: 100 },
    ]);
  });

  it("pago de IVA a la DIAN", () => {
    const a = generarAsientoMovimiento(base, c);
    expect(resumen(a)).toEqual([
      { cuenta: "240805", debito: 1_090_000, credito: 0 },
      { cuenta: "111005", debito: 0, credito: 1_090_000 },
    ]);
    expect(a.descripcion).toBe("Pago de impuestos 4911168588945 - DIAN");
  });

  it("pago de retención con intereses de mora", () => {
    const a = generarAsientoMovimiento(
      { ...base, impuesto: "retencion_fuente", totalCop: 17_500, componentesCop: [{ concepto: "intereses_mora", valor: 500 }] },
      c,
    );
    expect(resumen(a)).toEqual([
      { cuenta: "530520", debito: 500, credito: 0 },
      { cuenta: "236570", debito: 17_000, credito: 0 },
      { cuenta: "111005", debito: 0, credito: 17_500 },
    ]);
  });

  it("planilla PILA con desglose y mora", () => {
    const a = generarAsientoMovimiento(
      {
        ...base,
        clase: "planilla_seguridad_social",
        impuesto: null,
        totalCop: 401_100,
        componentesCop: [
          { concepto: "salud", valor: 100_000 },
          { concepto: "pension", valor: 280_000 },
          { concepto: "arl", valor: 14_600 },
          { concepto: "intereses_mora", valor: 6_500 },
        ],
      },
      c,
    );
    expect(resumen(a)).toEqual([
      { cuenta: "510569", debito: 100_000, credito: 0 },
      { cuenta: "510570", debito: 280_000, credito: 0 },
      { cuenta: "510568", debito: 14_600, credito: 0 },
      { cuenta: "530520", debito: 6_500, credito: 0 },
      { cuenta: "111005", debito: 0, credito: 401_100 },
    ]);
  });

  it("pago de nómina", () => {
    const a = generarAsientoMovimiento({ ...base, clase: "pago_nomina", impuesto: null, totalCop: 1_750_905 }, c);
    expect(resumen(a)[0]).toEqual({ cuenta: "510506", debito: 1_750_905, credito: 0 });
  });

  it("transferencia al exterior: salda la cuenta por pagar y registra comisiones", () => {
    const a = generarAsientoMovimiento(
      {
        ...base,
        clase: "transferencia",
        impuesto: null,
        totalCop: 4_100_000,
        componentesCop: [
          { concepto: "comision_bancaria", valor: 80_000 },
          { concepto: "gmf", valor: 16_400 },
        ],
        cuentaDestino: "221005",
      },
      c,
    );
    expect(resumen(a)).toEqual([
      { cuenta: "530515", debito: 80_000, credito: 0 },
      { cuenta: "511595", debito: 16_400, credito: 0 },
      { cuenta: "221005", debito: 4_003_600, credito: 0 },
      { cuenta: "111005", debito: 0, credito: 4_100_000 },
    ]);
    expect(cuadraAsiento(a.lineas)).toBe(true);
  });

  it("tributos de importación: arancel a compras e IVA descontable", () => {
    const a = generarAsientoMovimiento(
      {
        ...base,
        clase: "declaracion_importacion",
        impuesto: null,
        totalCop: 950_000,
        componentesCop: [{ concepto: "iva_importacion", valor: 760_000 }],
      },
      c,
    );
    expect(resumen(a)).toEqual([
      { cuenta: "240810", debito: 760_000, credito: 0 },
      { cuenta: "620501", debito: 190_000, credito: 0 },
      { cuenta: "111005", debito: 0, credito: 950_000 },
    ]);
  });

  it("una cuenta principal corregida a mano reemplaza la deducida", () => {
    const a = generarAsientoMovimiento({ ...base, clase: "pago_nomina", impuesto: null, totalCop: 1_000, cuentaPrincipal: "511095" }, c);
    expect(resumen(a)[0]).toEqual({ cuenta: "511095", debito: 1_000, credito: 0 });
  });

  it("errores", () => {
    expect(() => generarAsientoMovimiento({ ...base, totalCop: 0 }, c)).toThrow(ErrorMovimiento);
    expect(() => generarAsientoMovimiento({ ...base, componentesCop: [{ concepto: "intereses_mora", valor: 2_000_000 }] }, c)).toThrow(ErrorMovimiento);
    expect(() => generarAsientoMovimiento({ ...base, clase: "transferencia", cuentaDestino: null }, c)).toThrow(ErrorMovimiento);
  });
});

describe("normalización de la respuesta de la IA", () => {
  it("conceptos de componentes", () => {
    expect(normalizarConcepto("Salud")).toBe("salud");
    expect(normalizarConcepto("intereses de mora")).toBe("intereses_mora");
    expect(normalizarConcepto("Riesgos laborales")).toBe("arl");
    expect(normalizarConcepto("intereses_mora")).toBe("intereses_mora");
    expect(normalizarConcepto("Mora")).toBe("intereses_mora");
    expect(normalizarConcepto("Caja")).toBe("caja_compensacion");
    expect(normalizarConcepto("algo raro")).toBe("otro");
  });

  it("impuestos", () => {
    expect(normalizarImpuesto("Retención en la fuente")).toBe("retencion_fuente");
    expect(normalizarImpuesto("IVA")).toBe("iva");
    expect(normalizarImpuesto("Impuesto sobre las ventas")).toBe("iva");
    expect(normalizarImpuesto(null)).toBeNull();
  });
});

describe("cuentaBanco", () => {
  it("reconoce el banco configurado sin importar mayúsculas o texto adicional", () => {
    expect(cuentaBanco("Bancolombia S.A.", c)).toEqual({ cuenta: "111005", conocido: true, informado: true });
    expect(cuentaBanco("BANCOLOMBIA", c)).toEqual({ cuenta: "111005", conocido: true, informado: true });
  });

  it("banco no informado usa el por defecto; banco desconocido se marca", () => {
    expect(cuentaBanco(null, c)).toEqual({ cuenta: "111005", conocido: true, informado: false });
    expect(cuentaBanco("Nequi", c).conocido).toBe(false);
  });
});

describe("validarMovimiento", () => {
  const datos: DatosMovimiento = {
    clase: "pago_impuestos",
    referencia: "4911168588945",
    fecha: "2026-09-14",
    valorTotal: 1_090_000,
    componentes: [],
    beneficiario: "DIAN",
    confianzaGeneral: 0.95,
  };
  const ctx: ContextoMovimiento = {
    periodoCarpeta: { anio: 2026, mes: 9 },
    hoy: "2026-11-20",
    umbralConfianza: 0.85,
    bancoConocido: true,
    bancoInformado: true,
    cuentaDestino: null,
  };
  const codigos = (d: DatosMovimiento, x: ContextoMovimiento = ctx) => validarMovimiento(d, x).map((h) => `${h.nivel}:${h.codigo}`);

  it("un pago correcto no tiene hallazgos", () => {
    expect(codigos(datos)).toEqual([]);
  });

  it("detecta faltantes, banco desconocido y confianza baja", () => {
    expect(codigos({ ...datos, valorTotal: null })).toContain("error:campo_faltante");
    expect(codigos({ ...datos, beneficiario: null })).toContain("error:sin_tercero");
    expect(codigos(datos, { ...ctx, bancoConocido: false })).toContain("error:banco_no_configurado");
    expect(codigos({ ...datos, confianzaGeneral: 0.5 })).toContain("error:confianza_baja");
  });

  it("advertencias que no bloquean", () => {
    expect(codigos({ ...datos, referencia: null })).toEqual(["advertencia:sin_referencia"]);
    expect(codigos(datos, { ...ctx, bancoInformado: false })).toEqual(["advertencia:banco_supuesto"]);
    expect(codigos({ ...datos, clase: "planilla_seguridad_social" })).toEqual(["advertencia:sin_desglose"]);
    expect(codigos({ ...datos, fecha: "2026-08-30" })).toEqual(["advertencia:fecha_fuera_de_carpeta"]);
  });

  it("transferencia sin cuenta destino", () => {
    expect(codigos({ ...datos, clase: "transferencia" })).toContain("error:sin_cuenta");
  });
});
