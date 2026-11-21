import { describe, expect, it } from "vitest";
import { filtroDesdeConfig, motivoExclusion } from "@/modules/contabilidad/core";

const filtro = filtroDesdeConfig({
  solo_carpetas_con_anio: true,
  incluir_raiz: false,
  excluir: ["90_DOCUMENTOS_LEGALES", "91_CONTADOR", "SOPs"],
});

describe("motivoExclusion", () => {
  it("procesa PDF e imágenes dentro de carpetas de año", () => {
    expect(motivoExclusion(["02_2026", "marzo"], "application/pdf", filtro)).toBeNull();
    expect(motivoExclusion(["01_2025", "Pagos internacionales"], "image/jpeg", filtro)).toBeNull();
    expect(motivoExclusion(["02_2026"], "image/png", filtro)).toBeNull();
  });

  it("ignora formatos que no son facturas", () => {
    expect(motivoExclusion(["02_2026", "marzo"], "application/vnd.google-apps.spreadsheet", filtro)).toBe("formato");
    expect(motivoExclusion(["SOPs"], "video/mp4", filtro)).toBe("formato");
  });

  it("ignora carpetas excluidas, sin año y archivos de la raíz", () => {
    expect(motivoExclusion(["90_DOCUMENTOS_LEGALES"], "application/pdf", filtro)).toBe("carpeta_excluida");
    expect(motivoExclusion(["91_CONTADOR", "2026"], "application/pdf", filtro)).toBe("carpeta_excluida");
    expect(motivoExclusion(["sops"], "application/pdf", filtro)).toBe("carpeta_excluida");
    expect(motivoExclusion(["Varios"], "application/pdf", filtro)).toBe("carpeta_sin_anio");
    expect(motivoExclusion([], "application/pdf", filtro)).toBe("raiz");
  });

  it("respeta la configuración", () => {
    const abierto = filtroDesdeConfig({ solo_carpetas_con_anio: false, incluir_raiz: true, excluir: [] });
    expect(motivoExclusion(["Varios"], "application/pdf", abierto)).toBeNull();
    expect(motivoExclusion([], "application/pdf", abierto)).toBeNull();
  });

  it("valores por defecto conservadores si falta la configuración", () => {
    const porDefecto = filtroDesdeConfig(undefined);
    expect(porDefecto).toEqual({ soloCarpetasConAnio: true, incluirRaiz: false, excluir: [] });
  });
});
