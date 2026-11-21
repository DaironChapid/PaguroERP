import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import type { BaseDatos } from "../repo/supabase";
import type { Database } from "../repo/tipos-db";

// Cliente de Supabase con la sesión del usuario (cookies). Todo lo que se
// consulta con él pasa por RLS, así que los permisos los aplica la base de datos.

export type Rol = "admin" | "editor" | "lector";

export interface Usuario {
  email: string;
  rol: Rol | null;
}

export async function crearClienteSesion(): Promise<BaseDatos> {
  // La sesión de Supabase consulta la hora (vencimiento del token): con Cache Components y
  // precarga parcial, eso solo puede pasar en la visita real, no al precalcular la página.
  await connection();
  const almacen = await cookies();
  return createServerClient<Database, "contabilidad">(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      db: { schema: "contabilidad" },
      cookies: {
        getAll: () => almacen.getAll(),
        setAll: (lista) => {
          try {
            for (const { name, value, options } of lista) almacen.set(name, value, options);
          } catch {
            // Desde un Server Component no se pueden escribir cookies; el proxy refresca la sesión.
          }
        },
      },
    },
  ) as unknown as BaseDatos;
}

export async function usuarioActual(db: BaseDatos): Promise<Usuario | null> {
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user?.email) return null;
  const { data: rol } = await db.rpc("rol_actual");
  return { email: user.email, rol: (rol as Rol | null) ?? null };
}

const NIVEL: Record<Rol, number> = { lector: 1, editor: 2, admin: 3 };

export function tieneRol(usuario: Usuario | null, minimo: Rol): boolean {
  return !!usuario?.rol && NIVEL[usuario.rol] >= NIVEL[minimo];
}

/** Para route handlers: devuelve el cliente y el usuario, o la respuesta de error. */
export async function exigirSesion(minimo: Rol): Promise<{ db: BaseDatos; usuario: Usuario } | Response> {
  const db = await crearClienteSesion();
  const usuario = await usuarioActual(db);
  if (!usuario) return Response.json({ error: "Sesión requerida" }, { status: 401 });
  if (!tieneRol(usuario, minimo)) return Response.json({ error: "No tienes permiso para esta acción" }, { status: 403 });
  return { db, usuario };
}
