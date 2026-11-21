import { redirect } from "next/navigation";
import { modulosParaMenu } from "@/erp/modulos";
import { usuarioErp } from "@/erp/sesion";
import { InicioErp } from "@/erp/ui/inicio-erp";

export default async function Inicio() {
  const usuario = await usuarioErp();
  if (!usuario) redirect("/login");
  return <InicioErp modulos={await modulosParaMenu()} email={usuario.email} />;
}
