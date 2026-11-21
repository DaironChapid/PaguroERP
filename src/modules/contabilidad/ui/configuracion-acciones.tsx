"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { claseBoton, claseCampo } from "./componentes";

async function enviar(url: string, init: RequestInit): Promise<string | null> {
  const r = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } });
  if (r.ok) return null;
  const cuerpo = await r.json().catch(() => ({}));
  return cuerpo.error ?? `Error ${r.status}`;
}

export function BotonSincronizar() {
  const router = useRouter();
  const [estado, setEstado] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function sincronizar() {
    setOcupado(true);
    setEstado("Leyendo el Drive y procesando documentos nuevos… (puede tardar unos minutos)");
    const r = await fetch("/api/contabilidad/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const cuerpo = await r.json().catch(() => ({}));
    setOcupado(false);
    setEstado(r.ok ? "Listo." : (cuerpo.error ?? `Error ${r.status}`));
    router.refresh();
  }

  return (
    <p className="text-xs text-tinta-2">
      <button onClick={sincronizar} disabled={ocupado} className="underline underline-offset-2 hover:text-tinta disabled:no-underline disabled:opacity-60">
        {ocupado ? "Sincronizando…" : "Sincronizar ahora"}
      </button>
      {estado && <span className="ml-2">{estado}</span>}
    </p>
  );
}

export function FormSaldoInicial() {
  const router = useRouter();
  const [cuenta, setCuenta] = useState("");
  const [fechaCorte, setFechaCorte] = useState(`${new Date().getFullYear()}-01-01`);
  const [debito, setDebito] = useState("");
  const [credito, setCredito] = useState("");
  const [estado, setEstado] = useState<string | null>(null);

  async function agregar() {
    const error = await enviar("/api/contabilidad/saldos-iniciales", {
      method: "POST",
      body: JSON.stringify({ cuenta_codigo: cuenta.trim(), fecha_corte: fechaCorte, debito: Number(debito || 0), credito: Number(credito || 0) }),
    });
    setEstado(error ?? "Saldo guardado.");
    if (!error) {
      setCuenta("");
      setDebito("");
      setCredito("");
      router.refresh();
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-2 text-xs text-tinta-2">
      <label>Cuenta<input value={cuenta} onChange={(e) => setCuenta(e.target.value)} placeholder="112005" inputMode="numeric" className={`${claseCampo} mt-1 w-28`} /></label>
      <label>Fecha de corte<input type="date" value={fechaCorte} onChange={(e) => setFechaCorte(e.target.value)} className={`${claseCampo} mt-1 w-auto`} /></label>
      <label>Débito<input type="number" min={0} value={debito} onChange={(e) => setDebito(e.target.value)} className={`${claseCampo} cifras mt-1 w-36 text-right`} /></label>
      <label>Crédito<input type="number" min={0} value={credito} onChange={(e) => setCredito(e.target.value)} className={`${claseCampo} cifras mt-1 w-36 text-right`} /></label>
      <button onClick={agregar} className={claseBoton}>Agregar</button>
      {estado && <span>{estado}</span>}
    </div>
  );
}

export function BotonBorrarSaldo({ id }: { id: number }) {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        if (!window.confirm("¿Borrar este saldo inicial?")) return;
        const error = await enviar(`/api/contabilidad/saldos-iniciales/${id}`, { method: "DELETE" });
        if (error) window.alert(error);
        else router.refresh();
      }}
      className="text-xs text-critico underline"
    >
      Borrar
    </button>
  );
}
