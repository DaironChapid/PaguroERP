// Prueba de punta a punta de lo que hace quien usa el sistema: corregir,
// aprobar y rechazar un documento, ver que la contabilidad cuadre y cargar
// saldos iniciales. Usa un documento y un proveedor de prueba y una cuenta
// temporal; todo se borra al final, aunque la prueba falle.
// Requiere la app encendida (npm run dev). Uso: npm run prueba:flujo
import { randomBytes } from "node:crypto";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

const URL_APP = process.env.URL_APP ?? "http://localhost:3000";
const email = "prueba-temporal-flujo@pagurocorp.com";
const clave = randomBytes(18).toString("base64url");
const NIT_PRUEBA = "999000111";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const servicio = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const db = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { db: { schema: "contabilidad" }, auth: { persistSession: false } });

let fallos = 0;
function revisar(nombre: string, ok: boolean, detalle = "") {
  if (!ok) fallos++;
  console.log(`${ok ? "✔" : "✘"} ${nombre}${detalle ? ` · ${detalle}` : ""}`);
}

let idUsuario: string | null = null;
let idFactura: number | null = null;
let idTercero: number | null = null;
let idCuentaSaldo: number | null = null;
const FECHA_SALDO = "1999-12-31";

try {
  // --- Cuenta temporal con rol editor ---
  const creado = await servicio.auth.admin.createUser({ email, password: clave, email_confirm: true });
  if (creado.error) throw creado.error;
  idUsuario = creado.data.user.id;
  await db.from("usuarios").upsert({ email, rol: "editor", nombre: "Prueba temporal", activo: true });

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
  const api = async (ruta: string, metodo = "GET", cuerpo?: unknown) => {
    const r = await fetch(URL_APP + ruta, { method: metodo, headers: { cookie, "Content-Type": "application/json" }, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) });
    const texto = await r.text();
    let json: Record<string, unknown> = {};
    try {
      json = JSON.parse(texto);
    } catch {
      /* respuesta no JSON (HTML o CSV) */
    }
    return { status: r.status, json, texto };
  };

  // --- Documento de prueba: una factura de compra a la que le faltan datos ---
  const { data: categoria } = await db.from("categorias").select("id, nombre, cuenta_id").eq("tipo_factura", "compra").eq("activa", true).limit(1).single();
  if (!categoria) throw new Error("No hay categorías de compra activas");
  const tercero = await db.from("terceros").insert({ nit: NIT_PRUEBA, razon_social: "PRUEBA AUTOMÁTICA (se borra sola)" }).select("id").single();
  if (tercero.error) throw tercero.error;
  idTercero = tercero.data.id;
  const hoy = new Date().toISOString().slice(0, 10);
  const factura = await db
    .from("facturas")
    .insert({ tipo: "compra", tipo_documento: "factura", numero: "PRUEBA-001", fecha_emision: hoy, tercero_id: idTercero, moneda: "COP", estado: "pendiente_revision", observaciones: "Documento de prueba automática" })
    .select("id")
    .single();
  if (factura.error) throw factura.error;
  idFactura = factura.data.id;
  const ruta = `/api/contabilidad/facturas/${idFactura}`;
  console.log(`Documento de prueba #${idFactura} · categoría "${categoria.nombre}"\n`);

  // 1. Aprobar con datos incompletos: debe negarse y decir qué falta
  let r = await api(`${ruta}/aprobar`, "POST");
  revisar("Aprobar sin datos completos se niega", r.status === 422 && /Faltan datos/.test(String(r.json.error)), String(r.json.error ?? r.status));

  // 2. Aparece en la pestaña "Por revisar"
  r = await api("/contabilidad/documentos?vista=revisar");
  revisar("Aparece en Documentos → Por revisar", r.texto.includes("PRUEBA AUTOMÁTICA"));

  // 3. Corregir: categoría y montos (subtotal 100.000 + IVA 19.000 = 119.000)
  r = await api(ruta, "PATCH", { categoria_id: categoria.id, subtotal: 100000, iva: 19000, total: 119000 });
  const { data: tras } = await db.from("facturas").select("cuenta_id, subtotal, total, estado").eq("id", idFactura).single();
  revisar("Corregir guarda los datos", r.status === 200 && Number(tras?.total) === 119000 && Number(tras?.subtotal) === 100000, `HTTP ${r.status}`);
  revisar("Al elegir la categoría se asigna su cuenta contable", tras?.cuenta_id === categoria.cuenta_id);
  const { count: cambios } = await db.from("revisiones").select("*", { count: "exact", head: true }).eq("factura_id", idFactura);
  revisar("La corrección queda en el historial", (cambios ?? 0) >= 4, `${cambios} cambios registrados`);

  // 4. Datos inválidos: un monto negativo se rechaza sin tocar nada
  r = await api(ruta, "PATCH", { total: -5 });
  revisar("Un monto negativo se rechaza", r.status === 400);

  // 5. Aprobar: genera el asiento y cuadra
  r = await api(`${ruta}/aprobar`, "POST");
  revisar("Aprobar funciona", r.status === 200, r.status === 200 ? "" : String(r.json.error));
  const { data: aprobada } = await db.from("facturas").select("estado, aprobada_por").eq("id", idFactura).single();
  revisar("Queda aprobada y con quién la aprobó", aprobada?.estado === "aprobada" && aprobada?.aprobada_por === email);
  const { data: asiento } = await db.from("asientos").select("id, asiento_lineas(debito, credito)").eq("factura_id", idFactura).maybeSingle();
  const lineas = (asiento?.asiento_lineas ?? []) as { debito: number; credito: number }[];
  const debitos = lineas.reduce((s, l) => s + Number(l.debito), 0);
  const creditos = lineas.reduce((s, l) => s + Number(l.credito), 0);
  revisar("Se genera el asiento contable", !!asiento && lineas.length >= 2, `${lineas.length} líneas`);
  revisar("El asiento cuadra (débitos = créditos)", Math.abs(debitos - creditos) < 0.01 && debitos > 0, `${debitos.toLocaleString("es-CO")} = ${creditos.toLocaleString("es-CO")}`);

  // 6. Se refleja en los reportes, con enlace al documento
  r = await api(`/api/contabilidad/reportes/libro_mayor?desde=${hoy}&hasta=${hoy}`);
  const enlaces = (r.json.enlaces ?? []) as ({ href: string } | null)[];
  revisar("Aparece en el libro mayor con enlace al documento", enlaces.some((e) => e?.href.endsWith(`/documentos/${idFactura}`)));
  r = await api(`/api/contabilidad/reportes/cuentas_por_pagar?hasta=${hoy}`);
  const porPagar = ((r.json.filas ?? []) as { tercero_nit: string; saldo: number }[]).find((f) => f.tercero_nit === NIT_PRUEBA);
  revisar("Aparece en cuentas por pagar", !!porPagar && porPagar.saldo > 0, porPagar ? `saldo ${Number(porPagar.saldo).toLocaleString("es-CO")}` : "no aparece");
  r = await api(`/api/contabilidad/reportes/balance_comprobacion?desde=${hoy.slice(0, 4)}-01-01&hasta=${hoy}`);
  const filas = (r.json.filas ?? []) as { debitos: number; creditos: number }[];
  const td = filas.reduce((s, f) => s + Number(f.debitos), 0);
  const tc = filas.reduce((s, f) => s + Number(f.creditos), 0);
  revisar("El balance de comprobación sigue cuadrando", Math.abs(td - tc) < 0.01);

  // 7. Aprobar dos veces se niega
  r = await api(`${ruta}/aprobar`, "POST");
  revisar("Aprobar dos veces se niega", r.status === 422);

  // 8. Corregir un documento aprobado: pierde el asiento y vuelve a revisión
  r = await api(ruta, "PATCH", { observaciones: "Corrección después de aprobar" });
  const { data: reabierta } = await db.from("facturas").select("estado").eq("id", idFactura).single();
  const { count: asientos1 } = await db.from("asientos").select("*", { count: "exact", head: true }).eq("factura_id", idFactura);
  revisar("Corregir un aprobado lo devuelve a revisión sin asiento", r.status === 200 && reabierta?.estado === "pendiente_revision" && asientos1 === 0);

  // 9. Rechazar con motivo
  r = await api(`${ruta}/rechazar`, "POST", { motivo: "Documento de prueba" });
  const { data: rechazada } = await db.from("facturas").select("estado, observaciones").eq("id", idFactura).single();
  revisar("Rechazar funciona y guarda el motivo", r.status === 200 && rechazada?.estado === "rechazada" && rechazada?.observaciones === "Documento de prueba");
  r = await api("/contabilidad/documentos?vista=revisar");
  revisar("Ya no aparece en Por revisar", !r.texto.includes("PRUEBA AUTOMÁTICA"));

  // 10. Saldos iniciales: un editor no puede; un administrador sí
  const { data: cuentaSaldo } = await db.from("cuentas").select("id, codigo").eq("codigo", "110505").maybeSingle();
  if (!cuentaSaldo) throw new Error("No existe la cuenta 110505 (caja general) para probar saldos");
  idCuentaSaldo = cuentaSaldo.id;
  r = await api("/api/contabilidad/saldos-iniciales", "POST", { cuenta_codigo: cuentaSaldo.codigo, fecha_corte: FECHA_SALDO, debito: 1000, credito: 0 });
  revisar("Un editor no puede cargar saldos iniciales", r.status === 403);
  await db.from("usuarios").update({ rol: "admin" }).eq("email", email);
  r = await api("/api/contabilidad/saldos-iniciales", "POST", { cuenta_codigo: cuentaSaldo.codigo, fecha_corte: FECHA_SALDO, debito: 1000, credito: 0 });
  revisar("Un administrador puede cargar un saldo inicial", r.status === 200, r.status === 200 ? "" : String(r.json.error));
  r = await api("/configuracion");
  revisar("El saldo aparece en Configuración", r.texto.includes("31/12/1999") || r.texto.includes("31 dic 1999") || r.texto.includes("1999"));
  const { data: saldo } = await db.from("saldos_iniciales").select("id").eq("cuenta_id", idCuentaSaldo).eq("fecha_corte", FECHA_SALDO).maybeSingle();
  r = await api(`/api/contabilidad/saldos-iniciales/${saldo?.id}`, "DELETE");
  const { count: quedan } = await db.from("saldos_iniciales").select("*", { count: "exact", head: true }).eq("cuenta_id", idCuentaSaldo).eq("fecha_corte", FECHA_SALDO);
  revisar("Un administrador puede borrar el saldo", r.status === 200 && quedan === 0);
  r = await api("/api/contabilidad/saldos-iniciales", "POST", { cuenta_codigo: "1105", fecha_corte: FECHA_SALDO, debito: 1, credito: 0 });
  revisar("Un saldo en una cuenta que no es auxiliar se rechaza", r.status === 400 || r.status === 422);

  console.log(fallos ? `\n${fallos} verificación(es) fallaron` : "\nTodas las verificaciones pasaron");
} catch (e) {
  fallos++;
  console.error("\n✘ La prueba se detuvo:", e instanceof Error ? e.message : e);
} finally {
  // Limpieza: los asientos no se borran en cascada con el documento.
  if (idFactura) {
    await db.from("asientos").delete().eq("factura_id", idFactura);
    await db.from("facturas").delete().eq("id", idFactura);
  }
  if (idTercero) await db.from("terceros").delete().eq("id", idTercero);
  if (idCuentaSaldo) await db.from("saldos_iniciales").delete().eq("cuenta_id", idCuentaSaldo).eq("fecha_corte", FECHA_SALDO);
  if (idUsuario) await servicio.auth.admin.deleteUser(idUsuario);
  await db.from("usuarios").delete().eq("email", email);
  const { count: restos } = await db.from("facturas").select("*", { count: "exact", head: true }).eq("numero", "PRUEBA-001");
  console.log(restos ? `⚠ Quedaron ${restos} documento(s) de prueba sin borrar` : "Datos de prueba eliminados.");
  process.exitCode = fallos ? 1 : 0;
}
