// Capturas de pantalla temporales de la interfaz (cuenta de prueba de solo lectura, se borra al final).
import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright-core";

const SALIDA = process.argv[2];
mkdirSync(SALIDA, { recursive: true });
const email = "prueba-temporal-ui@pagurocorp.com";
const clave = randomBytes(18).toString("base64url");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const servicio = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const contabilidad = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { db: { schema: "contabilidad" }, auth: { persistSession: false } });

let idUsuario: string | null = null;
const navegador = await chromium.launch({ channel: "msedge" });
try {
  const creado = await servicio.auth.admin.createUser({ email, password: clave, email_confirm: true });
  if (creado.error) throw creado.error;
  idUsuario = creado.data.user.id;
  await contabilidad.from("usuarios").upsert({ email, rol: "lector", nombre: "Prueba temporal", activo: true });

  const jarro = new Map<string, string>();
  const ssr = createServerClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => [...jarro].map(([name, value]) => ({ name, value })),
      setAll: (lista) => lista.forEach(({ name, value }) => (value ? jarro.set(name, value) : jarro.delete(name))),
    },
  });
  const s = await ssr.auth.signInWithPassword({ email, password: clave });
  if (s.error) throw s.error;
  const cookies = [...jarro].map(([name, value]) => ({ name, value, domain: "localhost", path: "/" }));
  const { data: pend } = await contabilidad.from("facturas").select("id").eq("estado", "pendiente_revision").eq("clase_documento", "factura").limit(1).single();

  const vistas: [string, string, { width: number; height: number }, "light" | "dark"][] = [
    ["inicio-erp", "/", { width: 1360, height: 900 }, "light"],
    ["contabilidad", "/contabilidad?mes=2026-05", { width: 1360, height: 900 }, "light"],
    ["contabilidad-oscuro", "/contabilidad?mes=2026-05", { width: 1360, height: 900 }, "dark"],
    ["contabilidad-movil", "/contabilidad?mes=2026-05", { width: 390, height: 844 }, "light"],
    ["menu-movil", "/contabilidad/documentos?vista=revisar", { width: 390, height: 844 }, "light"],
    ["revision", "/contabilidad/documentos?vista=revisar", { width: 1360, height: 900 }, "light"],
    ["detalle", `/contabilidad/documentos/${pend!.id}`, { width: 1360, height: 1000 }, "light"],
    ["reporte", "/contabilidad/reportes?tipo=estado_resultados&desde=2026-01-01&hasta=2026-11-20", { width: 1360, height: 900 }, "light"],
    ["configuracion", "/configuracion", { width: 1360, height: 900 }, "dark"],
  ];
  for (const [nombre, ruta, viewport, esquema] of vistas) {
    const contexto = await navegador.newContext({ viewport, colorScheme: esquema });
    await contexto.addCookies(cookies);
    const pagina = await contexto.newPage();
    await pagina.goto(`http://localhost:3000${ruta}`, { waitUntil: "networkidle" });
    if (nombre === "menu-movil") await pagina.getByRole("button", { name: "Menú" }).click();
    await pagina.screenshot({ path: `${SALIDA}/${nombre}.png`, fullPage: nombre !== "detalle" });
    console.log(`captura: ${nombre}`);
    await contexto.close();
  }
} finally {
  await navegador.close();
  if (idUsuario) await servicio.auth.admin.deleteUser(idUsuario);
  await contabilidad.from("usuarios").delete().eq("email", email);
  console.log("Cuenta temporal eliminada.");
}
