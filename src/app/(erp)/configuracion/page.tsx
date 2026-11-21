import { redirect } from "next/navigation";
import { crearClienteSesion, usuarioActual } from "@/modules/contabilidad/api/sesion";
import { Encabezado } from "@/modules/contabilidad/ui/componentes";
import { SeccionConfiguracionContabilidad } from "@/modules/contabilidad/ui/configuracion";

// Configuración general del ERP: una sección por módulo al que el usuario tiene acceso.
export default async function Configuracion() {
  const db = await crearClienteSesion();
  const usuario = await usuarioActual(db);
  if (!usuario) redirect("/login");
  return (
    <>
      <Encabezado titulo="Configuración" descripcion="Ajustes generales del sistema." />
      {usuario.rol ? (
        <section id="contabilidad" aria-labelledby="config-contabilidad" className="scroll-mt-6">
          <h2 id="config-contabilidad" className="mb-2 text-xs font-semibold tracking-wide text-tinta-suave uppercase">Contabilidad</h2>
          <SeccionConfiguracionContabilidad db={db} usuario={usuario} />
        </section>
      ) : (
        <p className="text-sm text-tinta-2">No tienes acceso a ningún módulo que tenga ajustes.</p>
      )}
    </>
  );
}
