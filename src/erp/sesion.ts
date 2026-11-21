import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";

// Sesión del ERP: quién inició sesión. Los permisos de cada módulo los
// define el propio módulo (por ejemplo, los roles de contabilidad).
export async function usuarioErp(): Promise<{ email: string } | null> {
  // La sesión de Supabase consulta la hora (vencimiento del token): con Cache Components y
  // precarga parcial, eso solo puede pasar en la visita real, no al precalcular la página.
  await connection();
  const almacen = await cookies();
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => almacen.getAll(),
      setAll: () => {
        // Desde un Server Component no se escriben cookies; el proxy refresca la sesión.
      },
    },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.email ? { email: user.email } : null;
}
