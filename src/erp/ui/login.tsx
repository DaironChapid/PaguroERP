"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

const claseCampo =
  "w-full rounded-lg border border-borde bg-superficie px-2.5 py-1.5 text-sm text-tinta outline-none focus:ring-2 focus:ring-acento/40";

export function FormularioLogin() {
  const router = useRouter();
  const parametros = useSearchParams();
  const [email, setEmail] = useState("");
  const [clave, setClave] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function entrar(e: FormEvent) {
    e.preventDefault();
    setCargando(true);
    setError(null);
    const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: clave });
    if (error) {
      setError(error.message === "Invalid login credentials" ? "Correo o contraseña incorrectos" : error.message);
      setCargando(false);
      return;
    }
    const siguiente = parametros.get("siguiente");
    router.replace(siguiente?.startsWith("/") && !siguiente.startsWith("//") ? siguiente : "/");
    router.refresh();
  }

  return (
    <form onSubmit={entrar} className="w-full max-w-sm space-y-4 rounded-xl border border-borde bg-superficie p-6">
      <div>
        <h1 className="text-lg font-semibold text-tinta">Paguro ERP</h1>
        <p className="mt-1 text-sm text-tinta-2">Entra con tu correo de la empresa.</p>
      </div>
      <label className="block text-sm">
        <span className="mb-1 block text-tinta-2">Correo</span>
        <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={claseCampo} />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-tinta-2">Contraseña</span>
        <input type="password" required autoComplete="current-password" value={clave} onChange={(e) => setClave(e.target.value)} className={claseCampo} />
      </label>
      {error && <p role="alert" className="text-sm text-critico">{error}</p>}
      <button
        type="submit"
        disabled={cargando}
        className="inline-flex w-full items-center justify-center rounded-lg bg-acento px-3 py-1.5 text-sm font-medium text-acento-tinta hover:opacity-90 disabled:opacity-50"
      >
        {cargando ? "Entrando…" : "Entrar"}
      </button>
      <p className="text-xs text-tinta-2">¿No tienes acceso? Pídeselo a un administrador.</p>
    </form>
  );
}
