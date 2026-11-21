"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { claseCampo } from "./componentes";

/** Cambia el parámetro ?mes=YYYY-MM de la página actual. */
export function SelectorMes({ valor }: { valor: string }) {
  const router = useRouter();
  const ruta = usePathname();
  const parametros = useSearchParams();
  return (
    <label className="flex items-center gap-2 text-sm text-tinta-2">
      Mes
      <input
        type="month"
        value={valor}
        onChange={(e) => {
          const p = new URLSearchParams(parametros);
          if (e.target.value) p.set("mes", e.target.value);
          else p.delete("mes");
          router.push(`${ruta}?${p}`);
        }}
        className={`${claseCampo} w-auto`}
      />
    </label>
  );
}
