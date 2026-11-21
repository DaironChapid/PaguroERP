import type { ModuloErp } from "@/erp/modulos";
import { crearClienteSesion } from "./api/sesion";
import { rutas } from "./rutas";

// Manifiesto del módulo: lo que el armazón del ERP necesita para mostrarlo
// en el menú. Es el único punto de contacto entre el módulo y el ERP.
export const moduloContabilidad: ModuloErp = {
  id: "contabilidad",
  nombre: "Contabilidad",
  descripcion: "Facturas y movimientos leídos del Drive con IA, asientos y reportes contables.",
  estado: "activo",
  inicio: rutas.inicio,
  items: [
    { href: rutas.inicio, etiqueta: "Resumen", exacto: true },
    { href: rutas.documentos, etiqueta: "Documentos", insignia: "pendientes" },
    { href: rutas.reportes, etiqueta: "Reportes" },
  ],
  async insignias() {
    const db = await crearClienteSesion();
    const { count } = await db.from("facturas").select("id", { count: "exact", head: true }).eq("estado", "pendiente_revision");
    return { pendientes: count ?? 0 };
  },
};
