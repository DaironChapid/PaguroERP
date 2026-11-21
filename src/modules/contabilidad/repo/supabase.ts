import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./tipos-db";

// Única capa que conoce la base de datos. Los tipos se generan con `npm run db:tipos`.

export type BaseDatos = SupabaseClient<Database, "contabilidad">;
export type Fila<T extends keyof Database["contabilidad"]["Tables"]> = Database["contabilidad"]["Tables"][T]["Row"];

/** Cliente con la service role: solo para procesos internos del servidor (no pasa por RLS). */
export function crearClienteServicio(): BaseDatos {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const llave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !llave) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  return createClient<Database, "contabilidad">(url, llave, {
    db: { schema: "contabilidad" },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Lanza el error de Supabase si lo hay y devuelve los datos. */
export function exigir<T>(resultado: { data: T; error: { message: string } | null }, contexto: string): NonNullable<T> {
  if (resultado.error) throw new Error(`${contexto}: ${resultado.error.message}`);
  if (resultado.data === null || resultado.data === undefined) throw new Error(`${contexto}: sin datos`);
  return resultado.data as NonNullable<T>;
}
