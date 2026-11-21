"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { claseBoton, claseCampo } from "./componentes";
import { CLASES, ESTADOS } from "./formato";

/** Filtros en una sola fila encima de la tabla; se reflejan en la URL. */
export function FiltrosLista({ categorias }: { categorias: { id: number; nombre: string }[] }) {
  const router = useRouter();
  const ruta = usePathname();
  const actuales = useSearchParams();
  const [texto, setTexto] = useState(actuales.get("texto") ?? "");

  function cambiar(clave: string, valor: string) {
    const p = new URLSearchParams(actuales);
    if (valor) p.set(clave, valor);
    else p.delete(clave);
    p.delete("pagina");
    router.push(`${ruta}?${p}`);
  }

  function buscar(e: FormEvent) {
    e.preventDefault();
    cambiar("texto", texto.trim());
  }

  const hayFiltros = ["mes", "desde", "hasta", "clase", "estado", "categoria", "texto"].some((k) => actuales.get(k));

  return (
    <div className="flex flex-wrap items-end gap-2">
      <form onSubmit={buscar} className="min-w-[200px] flex-1">
        <label className="block text-xs text-tinta-2">
          Buscar
          <input
            type="search"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Tercero, NIT, número…"
            className={`${claseCampo} mt-1`}
          />
        </label>
      </form>
      <label className="block text-xs text-tinta-2">
        Mes
        <input type="month" value={actuales.get("mes") ?? ""} onChange={(e) => cambiar("mes", e.target.value)} className={`${claseCampo} mt-1 w-auto`} />
      </label>
      <label className="block text-xs text-tinta-2">
        Tipo
        <select value={actuales.get("clase") ?? ""} onChange={(e) => cambiar("clase", e.target.value)} className={`${claseCampo} mt-1 w-auto`}>
          <option value="">Todos</option>
          {Object.entries(CLASES).map(([v, e]) => <option key={v} value={v}>{e}</option>)}
        </select>
      </label>
      <label className="block text-xs text-tinta-2">
        Estado
        <select value={actuales.get("estado") ?? ""} onChange={(e) => cambiar("estado", e.target.value)} className={`${claseCampo} mt-1 w-auto`}>
          <option value="">Todos</option>
          {Object.entries(ESTADOS).map(([v, e]) => <option key={v} value={v}>{e.etiqueta}</option>)}
        </select>
      </label>
      <label className="block text-xs text-tinta-2">
        Categoría
        <select value={actuales.get("categoria") ?? ""} onChange={(e) => cambiar("categoria", e.target.value)} className={`${claseCampo} mt-1 w-auto max-w-[200px]`}>
          <option value="">Todas</option>
          {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
      </label>
      {(actuales.get("desde") || actuales.get("hasta")) && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-superficie-2 px-3 py-1.5 text-xs text-tinta">
          Periodo: {actuales.get("desde") ?? "…"} a {actuales.get("hasta") ?? "hoy"}
          <button
            type="button"
            aria-label="Quitar el filtro de periodo"
            onClick={() => {
              const p = new URLSearchParams(actuales);
              p.delete("desde");
              p.delete("hasta");
              p.delete("pagina");
              router.push(`${ruta}?${p}`);
            }}
            className="text-tinta-2 hover:text-tinta"
          >
            ✕
          </button>
        </span>
      )}
      {hayFiltros && (
        <button type="button" onClick={() => router.push(`${ruta}?vista=todos`)} className={claseBoton}>
          Limpiar
        </button>
      )}
    </div>
  );
}
