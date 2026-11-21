import { moduloContabilidad } from "@/modules/contabilidad/modulo";

// Registro de módulos del ERP. Para agregar un módulo: crear su carpeta en
// src/modules/<modulo>, exportar su manifiesto y sumarlo a esta lista.

export interface ItemMenu {
  href: string;
  etiqueta: string;
  /** Solo se marca activo con la ruta exacta (para la página de resumen). */
  exacto?: boolean;
  /** Clave del contador que se muestra al lado (lo calcula `insignias`). */
  insignia?: string;
}

export interface ModuloErp {
  id: string;
  nombre: string;
  descripcion: string;
  estado: "activo" | "proximamente";
  inicio?: string;
  items: ItemMenu[];
  /** Contadores del menú (p. ej. pendientes de revisión). Se ejecuta en el servidor. */
  insignias?: () => Promise<Record<string, number>>;
}

// Un módulo en preparación se puede listar con estado "proximamente" (se ve en gris).
export const MODULOS: ModuloErp[] = [moduloContabilidad];

/** Versión serializable para el menú (componente de cliente). */
export interface ModuloMenu {
  id: string;
  nombre: string;
  descripcion: string;
  estado: ModuloErp["estado"];
  inicio?: string;
  items: (ItemMenu & { cantidad?: number })[];
}

export async function modulosParaMenu(): Promise<ModuloMenu[]> {
  return Promise.all(
    MODULOS.map(async ({ insignias, ...m }) => {
      let valores: Record<string, number> = {};
      try {
        valores = (await insignias?.()) ?? {};
      } catch {
        // Un contador que falla no debe tumbar el menú.
      }
      return { ...m, items: m.items.map((i) => ({ ...i, cantidad: i.insignia ? valores[i.insignia] : undefined })) };
    }),
  );
}
