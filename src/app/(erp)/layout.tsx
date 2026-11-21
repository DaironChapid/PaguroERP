import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";
import { modulosParaMenu } from "@/erp/modulos";
import { usuarioErp } from "@/erp/sesion";
import { MenuLateral } from "@/erp/ui/menu-lateral";

// Armazón del ERP: sesión y menú de módulos. La sesión se lee de cookies
// (dato de cada petición), así que va dentro de <Suspense>.
export default function LayoutErp({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={<Cargando />}>
      <ConSesion>{children}</ConSesion>
    </Suspense>
  );
}

function Cargando() {
  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-tinta-2" role="status">
      Cargando…
    </div>
  );
}

async function ConSesion({ children }: { children: ReactNode }) {
  await connection(); // todo lo que sigue es por petición (sesión, hora actual)
  const usuario = await usuarioErp();
  if (!usuario) redirect("/login");
  const modulos = await modulosParaMenu();
  return (
    <div className="lg:flex">
      <MenuLateral modulos={modulos} email={usuario.email} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:py-8">{children}</main>
    </div>
  );
}
