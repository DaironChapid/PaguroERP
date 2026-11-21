import Link from "next/link";
import type { ModuloMenu } from "../modulos";

// Página de inicio del ERP: un acceso por módulo.
export function InicioErp({ modulos, email }: { modulos: ModuloMenu[]; email: string }) {
  return (
    <>
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight text-tinta sm:text-2xl">Paguro ERP</h1>
        <p className="mt-1 text-sm text-tinta-2">Hola, {email}. Elige un módulo para empezar.</p>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {modulos.map((m) => {
          const pendientes = m.items.reduce((s, i) => s + (i.cantidad ?? 0), 0);
          const contenido = (
            <>
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-base font-semibold text-tinta">{m.nombre}</h2>
                {m.estado === "proximamente" ? (
                  <span className="rounded-full border border-borde px-2 py-0.5 text-xs text-tinta-suave">Próximamente</span>
                ) : (
                  pendientes > 0 && (
                    <span className="rounded-full bg-aviso-fondo px-2 py-0.5 text-xs font-medium text-aviso">
                      ! {pendientes} por revisar
                    </span>
                  )
                )}
              </div>
              <p className="mt-2 text-sm text-tinta-2">{m.descripcion}</p>
            </>
          );
          return (
            <li key={m.id}>
              {m.estado === "activo" && m.inicio ? (
                <Link href={m.inicio} className="block h-full rounded-xl border border-borde bg-superficie p-5 transition-colors hover:bg-superficie-2">
                  {contenido}
                  <span className="mt-4 inline-block text-sm font-medium text-acento">Abrir →</span>
                </Link>
              ) : (
                <div aria-disabled="true" className="h-full cursor-not-allowed rounded-xl border border-dashed border-borde bg-superficie p-5 opacity-60 select-none">
                  {contenido}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
