// Capturas de pantalla para el manual de uso (docs/manual/capturas).
// Usa una cuenta temporal de ADMINISTRADOR para que se vean todos los botones;
// solo mira, no cambia nada, y la cuenta se borra al final.
// Requiere la app encendida (npm run dev). Uso: npm run capturas:manual
import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { chromium, type Page } from "playwright-core";

const URL_APP = process.env.URL_APP ?? "http://localhost:3000";
const SALIDA = process.argv[2] ?? "docs/manual/capturas";
mkdirSync(SALIDA, { recursive: true });
const email = "manual@pagurocorp.com";
const clave = randomBytes(18).toString("base64url");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const servicio = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const db = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { db: { schema: "contabilidad" }, auth: { persistSession: false } });

let idUsuario: string | null = null;
const navegador = await chromium.launch({ channel: "msedge" });
try {
  const creado = await servicio.auth.admin.createUser({ email, password: clave, email_confirm: true });
  if (creado.error) throw creado.error;
  idUsuario = creado.data.user.id;
  await db.from("usuarios").upsert({ email, rol: "admin", nombre: "Manual", activo: true });

  const jarro = new Map<string, string>();
  const ssr = createServerClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => [...jarro].map(([name, value]) => ({ name, value })),
      setAll: (lista) => lista.forEach(({ name, value }) => (value ? jarro.set(name, value) : jarro.delete(name))),
    },
  });
  const sesion = await ssr.auth.signInWithPassword({ email, password: clave });
  if (sesion.error) throw sesion.error;
  const cookies = [...jarro].map(([name, value]) => ({ name, value, domain: "localhost", path: "/" }));

  // Documentos de ejemplo: uno por revisar con hallazgos y una factura aprobada con asiento.
  const { data: pend } = await db.from("facturas").select("id").eq("estado", "pendiente_revision").order("id").limit(1).single();
  // Para el ejemplo de "aprobada", una factura sin avisos de la revisión automática.
  const { data: aprobadas } = await db.from("facturas").select("id, hallazgos").eq("estado", "aprobada").eq("clase_documento", "factura").order("id", { ascending: false });
  const aprob = (aprobadas ?? []).find((f) => Array.isArray(f.hallazgos) && f.hallazgos.length === 0) ?? aprobadas?.[0];

  const abrirProblemas = async (p: Page) => {
    await p.locator("section[aria-label='Google Drive'] summary").click();
    await p.waitForTimeout(300);
  };
  const vistas: { nombre: string; ruta: string; sesion?: boolean; completa?: boolean; alto?: number; recorte?: { x: number; y: number; width: number; height: number }; accion?: (p: Page) => Promise<void> }[] = [
    { nombre: "01-login", ruta: "/login", sesion: false, recorte: { x: 390, y: 205, width: 500, height: 390 } },
    { nombre: "02-inicio", ruta: "/", alto: 520 },
    { nombre: "03-resumen", ruta: "/contabilidad?mes=2026-05", completa: true },
    { nombre: "04-por-revisar", ruta: "/contabilidad/documentos?vista=revisar", completa: true },
    { nombre: "05-drive-problemas", ruta: "/contabilidad/documentos?vista=revisar", accion: abrirProblemas, alto: 760 },
    { nombre: "06-todos", ruta: "/contabilidad/documentos?vista=todos" },
    { nombre: "07-detalle-revision", ruta: `/contabilidad/documentos/${pend!.id}`, completa: true },
    { nombre: "08-detalle-aprobado", ruta: `/contabilidad/documentos/${aprob!.id}`, completa: true },
    { nombre: "09-reporte-resultados", ruta: "/contabilidad/reportes?tipo=estado_resultados&desde=2026-01-01&hasta=2026-11-20", completa: true },
    { nombre: "10-reporte-libro-mayor", ruta: "/contabilidad/reportes?tipo=libro_mayor&desde=2026-03-01&hasta=2026-03-31" },
    { nombre: "11-configuracion", ruta: "/configuracion", completa: true },
  ];

  for (const v of vistas) {
    const contexto = await navegador.newContext({ viewport: { width: 1280, height: v.alto ?? 800 }, deviceScaleFactor: 2, colorScheme: "light", locale: "es-CO" });
    if (v.sesion !== false) await contexto.addCookies(cookies);
    const pagina = await contexto.newPage();
    await pagina.goto(URL_APP + v.ruta, { waitUntil: "load" });
    await pagina.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {}); // la vista previa de Drive sigue cargando
    await pagina.waitForTimeout(1500);
    // El botón de herramientas de Next (solo en desarrollo) no debe salir en el manual.
    await pagina.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    if (v.accion) await v.accion(pagina);
    await pagina.screenshot({ path: `${SALIDA}/${v.nombre}.png`, fullPage: !!v.completa, clip: v.recorte });
    console.log(`captura: ${v.nombre}`);
    await contexto.close();
  }
} finally {
  await navegador.close();
  if (idUsuario) await servicio.auth.admin.deleteUser(idUsuario);
  await db.from("usuarios").delete().eq("email", email);
  console.log("Cuenta temporal eliminada.");
}
