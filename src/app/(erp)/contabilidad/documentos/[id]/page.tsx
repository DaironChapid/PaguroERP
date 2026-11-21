import { notFound, redirect } from "next/navigation";
import { crearClienteSesion, usuarioActual } from "@/modules/contabilidad/api/sesion";
import { PaginaDetalle } from "@/modules/contabilidad/ui/detalle";

export default async function Detalle({ params }: PageProps<"/contabilidad/documentos/[id]">) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const db = await crearClienteSesion();
  const usuario = await usuarioActual(db);
  if (!usuario) redirect("/login");
  return <PaginaDetalle db={db} id={id} usuario={usuario} />;
}
