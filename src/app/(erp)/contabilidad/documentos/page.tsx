import { redirect } from "next/navigation";
import { crearClienteSesion, usuarioActual } from "@/modules/contabilidad/api/sesion";
import { PaginaDocumentos } from "@/modules/contabilidad/ui/documentos";

export default async function Documentos({ searchParams }: PageProps<"/contabilidad/documentos">) {
  const crudos = await searchParams;
  const parametros = Object.fromEntries(Object.entries(crudos).filter((e): e is [string, string] => typeof e[1] === "string" && e[1] !== ""));
  const db = await crearClienteSesion();
  const usuario = await usuarioActual(db);
  if (!usuario) redirect("/login");
  return <PaginaDocumentos db={db} usuario={usuario} parametros={parametros} />;
}
