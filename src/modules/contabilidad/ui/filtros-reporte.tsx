"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { claseCampo } from "./componentes";

interface Props {
  tipos: { valor: string; titulo: string }[];
  tipo: string;
  desde: string;
  hasta: string;
  cuenta?: string;
  conRango: boolean;
  conCuenta: boolean;
}

// Al escribir la fecha a mano, el navegador entrega años incompletos (0002, 0020…): se espera a uno real.
const fechaCompleta = (f: string) => /^20\d{2}-\d{2}-\d{2}$/.test(f);

/** Filtros del reporte: se aplican solos al cambiar cualquier campo. */
export function FiltrosReporte({ tipos, tipo, desde, hasta, cuenta, conRango, conCuenta }: Props) {
  const router = useRouter();
  const ruta = usePathname();
  const [cargando, iniciar] = useTransition();
  const [textoCuenta, setTextoCuenta] = useState(cuenta ?? "");

  function aplicar(cambios: Record<string, string>) {
    const valores: Record<string, string> = { tipo, desde, hasta, ...(cuenta ? { cuenta } : {}), ...cambios };
    const p = new URLSearchParams(Object.entries(valores).filter(([, v]) => v));
    iniciar(() => router.push(`${ruta}?${p}`));
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="block text-xs text-tinta-2">
        Reporte
        <select value={tipo} onChange={(e) => aplicar({ tipo: e.target.value, cuenta: "" })} className={`${claseCampo} mt-1 w-auto`}>
          {tipos.map((t) => <option key={t.valor} value={t.valor}>{t.titulo}</option>)}
        </select>
      </label>
      {conRango && (
        <label className="block text-xs text-tinta-2">
          Desde
          <input type="date" value={desde} onChange={(e) => fechaCompleta(e.target.value) && aplicar({ desde: e.target.value })} className={`${claseCampo} mt-1 w-auto`} />
        </label>
      )}
      <label className="block text-xs text-tinta-2">
        {conRango ? "Hasta" : "A la fecha"}
        <input type="date" value={hasta} onChange={(e) => fechaCompleta(e.target.value) && aplicar({ hasta: e.target.value })} className={`${claseCampo} mt-1 w-auto`} />
      </label>
      {conCuenta && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            aplicar({ cuenta: textoCuenta.replace(/\D/g, "") });
          }}
        >
          <label className="block text-xs text-tinta-2">
            Cuenta (prefijo, Enter para filtrar)
            <input
              value={textoCuenta}
              onChange={(e) => setTextoCuenta(e.target.value)}
              onBlur={() => textoCuenta !== (cuenta ?? "") && aplicar({ cuenta: textoCuenta.replace(/\D/g, "") })}
              placeholder="p. ej. 1120"
              inputMode="numeric"
              className={`${claseCampo} mt-1 w-32`}
            />
          </label>
        </form>
      )}
      {cargando && <span className="pb-2 text-xs text-tinta-2">Cargando…</span>}
    </div>
  );
}
