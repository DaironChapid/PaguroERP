import { crearClienteSesion } from "@/modules/contabilidad/api/sesion";
import { PaginaReportes } from "@/modules/contabilidad/ui/reportes";

export default async function Reportes({ searchParams }: PageProps<"/contabilidad/reportes">) {
  const crudos = await searchParams;
  const parametros = Object.fromEntries(Object.entries(crudos).filter((e): e is [string, string] => typeof e[1] === "string" && e[1] !== ""));
  return <PaginaReportes db={await crearClienteSesion()} parametros={parametros} />;
}
