"use client";

import { createBrowserClient } from "@supabase/ssr";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import type { ModuloMenu } from "../modulos";

export function MenuLateral({ modulos, email }: { modulos: ModuloMenu[]; email: string }) {
  const ruta = usePathname();
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);

  const activo = (href: string, exacto?: boolean) => (exacto || href === "/" ? ruta === href : ruta === href || ruta.startsWith(`${href}/`));

  async function salir() {
    const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  const claseEnlace = (on: boolean) =>
    `flex items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-sm ${
      on ? "bg-superficie-2 font-medium text-tinta" : "text-tinta-2 hover:bg-superficie-2 hover:text-tinta"
    }`;

  return (
    <aside className="border-b border-borde bg-superficie lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-60 lg:shrink-0 lg:flex-col lg:border-r lg:border-b-0">
      <div className="flex items-center justify-between px-4 py-3 lg:py-5">
        <Link href="/" className="text-base font-semibold tracking-tight text-tinta">
          Paguro <span className="font-normal text-tinta-2">ERP</span>
        </Link>
        <button
          onClick={() => setAbierto((x) => !x)}
          aria-expanded={abierto}
          aria-controls="menu-erp"
          className="rounded-lg border border-borde px-3 py-1 text-sm text-tinta lg:hidden"
        >
          {abierto ? "Cerrar" : "Menú"}
        </button>
      </div>

      <nav
        id="menu-erp"
        aria-label="Módulos del ERP"
        // En celular, el menú se cierra al elegir un enlace.
        onClick={(e) => (e.target as HTMLElement).closest("a") && setAbierto(false)}
        className={`${abierto ? "block" : "hidden"} px-3 pb-4 lg:block lg:flex-1 lg:overflow-y-auto`}
      >
        <Link href="/" aria-current={ruta === "/" ? "page" : undefined} className={claseEnlace(ruta === "/")}>
          Inicio
        </Link>

        {modulos.map((m) =>
          m.estado === "activo" ? (
            <section key={m.id} className="mt-5" aria-labelledby={`modulo-${m.id}`}>
              <h2 id={`modulo-${m.id}`} className="px-3 pb-1 text-xs font-semibold tracking-wide text-tinta-suave uppercase">
                {m.nombre}
              </h2>
              <ul className="space-y-0.5">
                {m.items.map((i) => (
                  <li key={i.href}>
                    <Link href={i.href} aria-current={activo(i.href, i.exacto) ? "page" : undefined} className={claseEnlace(activo(i.href, i.exacto))}>
                      {i.etiqueta}
                      {!!i.cantidad && (
                        <span className="rounded-full bg-aviso-fondo px-1.5 text-xs font-medium text-aviso" aria-label={`${i.cantidad} pendientes`}>
                          {i.cantidad}
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            <section key={m.id} className="mt-5" aria-labelledby={`modulo-${m.id}`}>
              <div
                aria-disabled="true"
                title={`${m.nombre}: ${m.descripcion} Disponible próximamente.`}
                className="flex cursor-not-allowed items-center justify-between gap-2 px-3 pb-1 select-none"
              >
                <h2 id={`modulo-${m.id}`} className="text-xs font-semibold tracking-wide text-tinta-suave uppercase opacity-60">
                  {m.nombre}
                </h2>
                <span className="rounded-full border border-borde px-1.5 text-[10px] font-medium text-tinta-suave">Próximamente</span>
              </div>
            </section>
          ),
        )}

        <div className="mt-5 border-t border-borde pt-3">
          <Link href="/configuracion" aria-current={activo("/configuracion") ? "page" : undefined} className={claseEnlace(activo("/configuracion"))}>
            <span className="flex items-center gap-2"><span aria-hidden>⚙</span> Configuración</span>
          </Link>
        </div>

        <div className="mt-6 border-t border-borde px-3 pt-3 text-xs text-tinta-2 lg:hidden">
          <p className="truncate">{email}</p>
          <button onClick={salir} className="mt-1 underline hover:text-tinta">Cerrar sesión</button>
        </div>
      </nav>

      <div className="hidden border-t border-borde px-4 py-3 text-xs text-tinta-2 lg:block">
        <p className="truncate" title={email}>{email}</p>
        <button onClick={salir} className="mt-1 underline hover:text-tinta">Cerrar sesión</button>
      </div>
    </aside>
  );
}
