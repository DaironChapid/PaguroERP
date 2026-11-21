import { describe, expect, it } from "vitest";
import { inferirPeriodoCarpeta } from "@/modules/contabilidad/core";

describe("inferirPeriodoCarpeta", () => {
  it("estructura actual: prefijo de orden + año, luego mes", () => {
    expect(inferirPeriodoCarpeta("02_2026/03_marzo")).toEqual({ anio: 2026, mes: 3 });
    expect(inferirPeriodoCarpeta(["02_2026", "11_Noviembre"])).toEqual({ anio: 2026, mes: 11 });
  });

  it("no confunde el prefijo de orden con un mes", () => {
    expect(inferirPeriodoCarpeta("02_2026")).toEqual({ anio: 2026, mes: null });
  });

  it("formatos de años anteriores", () => {
    expect(inferirPeriodoCarpeta("2025/Enero")).toEqual({ anio: 2025, mes: 1 });
    expect(inferirPeriodoCarpeta("2024-05")).toEqual({ anio: 2024, mes: 5 });
    expect(inferirPeriodoCarpeta("05-2024")).toEqual({ anio: 2024, mes: 5 });
    expect(inferirPeriodoCarpeta("Facturas Mayo 2023")).toEqual({ anio: 2023, mes: 5 });
    expect(inferirPeriodoCarpeta("2026/03")).toEqual({ anio: 2026, mes: 3 });
    expect(inferirPeriodoCarpeta("2025/SEPT")).toEqual({ anio: 2025, mes: 9 });
  });

  it("tolera tildes y mayúsculas", () => {
    expect(inferirPeriodoCarpeta("2024/DICIEMBRE")).toEqual({ anio: 2024, mes: 12 });
    expect(inferirPeriodoCarpeta("Año 2022/Ágosto")).toEqual({ anio: 2022, mes: 8 });
  });

  it("la carpeta más profunda manda", () => {
    expect(inferirPeriodoCarpeta("2025/Enero/proveedores/Febrero")).toEqual({ anio: 2025, mes: 2 });
  });

  it("devuelve null si no hay información", () => {
    expect(inferirPeriodoCarpeta("")).toEqual({ anio: null, mes: null });
    expect(inferirPeriodoCarpeta("varios/proveedores")).toEqual({ anio: null, mes: null });
  });
});
