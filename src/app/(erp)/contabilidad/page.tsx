import { crearClienteSesion } from "@/modules/contabilidad/api/sesion";
import { PaginaInicio } from "@/modules/contabilidad/ui/inicio";

export default async function Inicio({ searchParams }: PageProps<"/contabilidad">) {
  const { mes } = await searchParams;
  return <PaginaInicio db={await crearClienteSesion()} mes={typeof mes === "string" ? mes : undefined} />;
}
