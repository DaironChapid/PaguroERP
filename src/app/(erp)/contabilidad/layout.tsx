import { redirect } from "next/navigation";
import { crearClienteSesion, usuarioActual } from "@/modules/contabilidad/api/sesion";

// Acceso al módulo: se necesita un rol en contabilidad (admin, editor o lector).
export default async function LayoutContabilidad({ children }: LayoutProps<"/contabilidad">) {
  const usuario = await usuarioActual(await crearClienteSesion());
  if (!usuario) redirect("/login");
  if (!usuario.rol) {
    return (
      <div className="max-w-md rounded-xl border border-borde bg-superficie p-6 text-sm">
        <h1 className="text-lg font-semibold text-tinta">Sin acceso a Contabilidad</h1>
        <p className="mt-2 text-tinta-2">
          Tu usuario (<strong>{usuario.email}</strong>) no tiene un rol en este módulo. Pídele a un administrador que te dé acceso.
        </p>
      </div>
    );
  }
  return children;
}
