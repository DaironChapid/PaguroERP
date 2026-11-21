import Link from "next/link";
import type { ReactNode } from "react";
import { ESTADOS } from "./formato";

// Piezas de interfaz compartidas por las páginas del módulo.

const TONOS = {
  bien: { clase: "bg-bien-fondo text-bien", icono: "✓" },
  aviso: { clase: "bg-aviso-fondo text-aviso", icono: "!" },
  critico: { clase: "bg-critico-fondo text-critico", icono: "✕" },
  neutro: { clase: "bg-superficie-2 text-tinta-2", icono: "·" },
} as const;

export type Tono = keyof typeof TONOS;

/** Estado con ícono + texto (el color nunca va solo). */
export function Insignia({ tono, children }: { tono: Tono; children: ReactNode }) {
  const t = TONOS[tono];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${t.clase}`}>
      <span aria-hidden>{t.icono}</span>
      {children}
    </span>
  );
}

export function InsigniaEstado({ estado }: { estado: string }) {
  const e = ESTADOS[estado] ?? { etiqueta: estado, tono: "neutro" as const };
  return <Insignia tono={e.tono}>{e.etiqueta}</Insignia>;
}

export function Tarjeta({ titulo, accion, children, className = "" }: { titulo?: ReactNode; accion?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-borde bg-superficie p-4 sm:p-5 ${className}`}>
      {(titulo || accion) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {titulo && <h2 className="text-sm font-semibold text-tinta">{titulo}</h2>}
          {accion}
        </div>
      )}
      {children}
    </section>
  );
}

export function Indicador({ etiqueta, valor, detalle, tono }: { etiqueta: string; valor: string; detalle?: ReactNode; tono?: Tono }) {
  return (
    <div className="rounded-xl border border-borde bg-superficie p-4">
      <p className="text-xs font-medium text-tinta-2">{etiqueta}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-tinta">{valor}</p>
      {detalle && <div className="mt-1 text-xs text-tinta-2">{tono ? <Insignia tono={tono}>{detalle}</Insignia> : detalle}</div>}
    </div>
  );
}

export function Aviso({ tono = "aviso", children }: { tono?: Tono; children: ReactNode }) {
  const t = TONOS[tono];
  return (
    <div role="status" className={`flex gap-2 rounded-lg px-3 py-2 text-sm ${t.clase}`}>
      <span aria-hidden className="font-bold">{t.icono}</span>
      <div>{children}</div>
    </div>
  );
}

export function Encabezado({ titulo, descripcion, acciones }: { titulo: string; descripcion?: ReactNode; acciones?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-tinta sm:text-2xl">{titulo}</h1>
        {descripcion && <p className="mt-1 text-sm text-tinta-2">{descripcion}</p>}
      </div>
      {acciones && <div className="flex flex-wrap gap-2">{acciones}</div>}
    </div>
  );
}

export function EnlaceDrive({ url }: { url: string | null }) {
  if (!url) return null;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-acento hover:underline">
      Ver en Drive <span aria-hidden>↗</span>
    </a>
  );
}

export const claseBoton =
  "inline-flex items-center justify-center gap-1 rounded-lg border border-borde bg-superficie px-3 py-1.5 text-sm font-medium text-tinta hover:bg-superficie-2 disabled:opacity-50";
export const claseBotonPrimario =
  "inline-flex items-center justify-center gap-1 rounded-lg bg-acento px-3 py-1.5 text-sm font-medium text-acento-tinta hover:opacity-90 disabled:opacity-50";
export const claseCampo =
  "w-full rounded-lg border border-borde bg-superficie px-2.5 py-1.5 text-sm text-tinta outline-none focus:ring-2 focus:ring-acento/40";

export function BotonEnlace({ href, children, primario = false }: { href: string; children: ReactNode; primario?: boolean }) {
  return (
    <Link href={href} className={primario ? claseBotonPrimario : claseBoton}>
      {children}
    </Link>
  );
}
