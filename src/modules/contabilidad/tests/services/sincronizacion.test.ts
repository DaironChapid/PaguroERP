import { describe, expect, it } from "vitest";
import { mensajeClaro } from "@/modules/contabilidad/services/sincronizacion";

describe("mensajeClaro", () => {
  it("pide volver a iniciar sesión cuando Google vence el permiso", () => {
    expect(mensajeClaro('unable to impersonate: {"error":"invalid_grant","error_subtype":"invalid_rapt"}')).toMatch(/gcloud auth application-default login/);
  });
  it("explica la falta de conexión", () => {
    expect(mensajeClaro("TypeError: fetch failed")).toMatch(/conexión/);
  });
  it("deja intactos los demás errores", () => {
    expect(mensajeClaro("Falta configurar DRIVE_ROOT_FOLDER_ID")).toBe("Falta configurar DRIVE_ROOT_FOLDER_ID");
  });
});
