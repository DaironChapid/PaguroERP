// Prueba temporal de la interfaz con una sesión real de rol LECTOR.
// Crea la cuenta, recorre páginas y endpoints, y la borra al final.
import { randomBytes } from "node:crypto";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

const URL_APP = process.env.URL_APP ?? "http://localhost:3000";
const email = "prueba-temporal-ui@pagurocorp.com";
const clave = randomBytes(18).toString("base64url");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const servicio = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const contabilidad = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { db: { schema: "contabilidad" }, auth: { persistSession: false } });

let idUsuario: string | null = null;
try {
  const creado = await servicio.auth.admin.createUser({ email, password: clave, email_confirm: true });
  if (creado.error) throw creado.error;
  idUsuario = creado.data.user.id;
  await contabilidad.from("usuarios").upsert({ email, rol: "lector", nombre: "Prueba temporal", activo: true });

  // Iniciar sesión con el mismo cliente SSR que usa la app, para obtener las cookies reales.
  const jarro = new Map<string, string>();
  const ssr = createServerClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => [...jarro].map(([name, value]) => ({ name, value })),
      setAll: (lista) => lista.forEach(({ name, value }) => (value ? jarro.set(name, value) : jarro.delete(name))),
    },
  });
  const sesion = await ssr.auth.signInWithPassword({ email, password: clave });
  if (sesion.error) throw sesion.error;
  const cookie = [...jarro].map(([k, v]) => `${k}=${v}`).join("; ");

  const { data: doc } = await contabilidad.from("facturas").select("id").eq("estado", "aprobada").limit(1).single();
  const { data: pend } = await contabilidad.from("facturas").select("id").eq("estado", "pendiente_revision").limit(1).single();

  const casos: [string, string, RequestInit?, number?][] = [
    ["Inicio del ERP", "/"],
    ["Contabilidad · resumen", "/contabilidad"],
    ["Resumen (otro mes)", "/contabilidad?mes=2026-02"],
    ["Documentos", "/contabilidad/documentos"],
    ["Documentos filtrados", "/contabilidad/documentos?clase=planilla_seguridad_social&texto=planilla"],
    ["Revisión (redirige)", "/contabilidad/revision", undefined, 307],
    ["Documentos · por revisar", "/contabilidad/documentos?vista=revisar"],
    ["Documentos · todos", "/contabilidad/documentos?vista=todos"],
    ["Detalle aprobado", `/contabilidad/documentos/${doc!.id}`],
    ["Detalle en revisión", `/contabilidad/documentos/${pend!.id}`],
    ["Configuración general", "/configuracion"],
    ["Config. contabilidad (redirige)", "/contabilidad/configuracion", undefined, 307],
    ...(["estado_resultados", "balance_general", "balance_comprobacion", "gastos_categoria", "gastos_proveedor", "impuestos", "cuentas_por_pagar", "cuentas_por_cobrar", "libro_mayor"].map(
      (t) => [`Reporte ${t}`, `/contabilidad/reportes?tipo=${t}&desde=2026-01-01&hasta=2026-11-20`] as [string, string],
    )),
    ["API lista", "/api/contabilidad/facturas?estado=aprobada"],
    ["API detalle", `/api/contabilidad/facturas/${doc!.id}`],
    ["API reporte JSON", "/api/contabilidad/reportes/estado_resultados?desde=2026-01-01&hasta=2026-11-20"],
    ["API reporte CSV", "/api/contabilidad/reportes/impuestos?formato=csv"],
    ["Lector no puede aprobar", `/api/contabilidad/facturas/${pend!.id}/aprobar`, { method: "POST" }, 403],
    ["Lector no puede corregir", `/api/contabilidad/facturas/${pend!.id}`, { method: "PATCH", body: "{}" }, 403],
    ["Lector no puede configurar", "/api/contabilidad/configuracion", { method: "PATCH", body: "{}" }, 403],
    ["Lector no puede sincronizar", "/api/contabilidad/sync", { method: "POST", body: "{}" }, 403],
  ];

  let fallos = 0;
  for (const [nombre, ruta, init, esperado = 200] of casos) {
    const r = await fetch(URL_APP + ruta, { ...init, headers: { cookie, "Content-Type": "application/json" }, redirect: "manual" });
    const cuerpo = await r.text();
    const errorEnPagina = /Application error|Unhandled Runtime Error|digest|Error:/.test(cuerpo) && r.headers.get("content-type")?.includes("html");
    const ok = r.status === esperado && !errorEnPagina;
    if (!ok) fallos++;
    console.log(`${ok ? "✔" : "✘"} ${nombre.padEnd(30)} HTTP ${r.status}${ok ? "" : ` (esperado ${esperado})${errorEnPagina ? " · error en la página" : ""} ${cuerpo.slice(0, 200).replace(/\s+/g, " ")}`}`);
  }

  // Cada fila de los reportes debe llevar a sus soportes, y ningún enlace a una lista vacía.
  for (const tipo of ["estado_resultados", "balance_general", "balance_comprobacion", "gastos_categoria", "gastos_proveedor", "impuestos", "cuentas_por_pagar", "cuentas_por_cobrar", "libro_mayor"]) {
    const r = await (await fetch(`${URL_APP}/api/contabilidad/reportes/${tipo}?desde=2026-01-01&hasta=2026-11-20`, { headers: { cookie } })).json();
    const enlaces = ((r.enlaces ?? []) as ({ href: string } | null)[]).filter((e): e is { href: string } => e !== null);
    let vacios = 0;
    for (const e of enlaces) {
      const h = await (await fetch(URL_APP + e.href, { headers: { cookie } })).text();
      if (/No hay documentos con estos filtros|No hay datos para este periodo|Application error|digest/.test(h)) vacios++;
    }
    const ok = (r.filas.length === 0 || enlaces.length > 0) && vacios === 0;
    if (!ok) fallos++;
    console.log(`${ok ? "✔" : "✘"} ${`Enlaces ${tipo}`.padEnd(30)} ${enlaces.length} de ${r.filas.length} filas${vacios ? ` · ${vacios} llevan a una lista vacía o con error` : ""}`);
  }

  // Sin sesión: las páginas redirigen a /login y la API responde 401
  const sinSesion = await fetch(URL_APP + "/contabilidad/documentos", { redirect: "manual" });
  console.log(`${sinSesion.status === 307 && sinSesion.headers.get("location")?.includes("/login") ? "✔" : "✘"} ${"Sin sesión → login".padEnd(30)} HTTP ${sinSesion.status}`);
  const apiSinSesion = await fetch(URL_APP + "/api/contabilidad/facturas");
  console.log(`${apiSinSesion.status === 401 ? "✔" : "✘"} ${"API sin sesión → 401".padEnd(30)} HTTP ${apiSinSesion.status}`);
  console.log(fallos ? `\n${fallos} caso(s) fallaron` : "\nTodos los casos pasaron");
} finally {
  if (idUsuario) await servicio.auth.admin.deleteUser(idUsuario);
  await contabilidad.from("usuarios").delete().eq("email", email);
  console.log("Cuenta temporal eliminada.");
}
