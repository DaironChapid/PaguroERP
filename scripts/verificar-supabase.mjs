// Verifica que la conexión a Supabase y el schema `contabilidad` estén bien configurados.
// Uso: npm run verificar
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const servicio = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  db: { schema: "contabilidad" },
  auth: { persistSession: false },
});
const anonimo = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  db: { schema: "contabilidad" },
  auth: { persistSession: false },
});

let ok = true;
const check = (condicion, mensaje) => {
  console.log(`${condicion ? "✔" : "✘"} ${mensaje}`);
  if (!condicion) ok = false;
};

for (const tabla of ["cuentas", "categorias", "configuracion", "usuarios"]) {
  const { count, error } = await servicio.from(tabla).select("*", { count: "exact", head: true });
  check(!error, `${tabla}: ${error ? error.message : `${count} filas`}`);
}

const { error: errorVista } = await servicio.from("v_resultado_mensual").select("*").limit(1);
check(!errorVista, `vistas de reportes ${errorVista ? errorVista.message : "accesibles"}`);

const { data: datosAnon, error: errorAnon } = await anonimo.from("facturas").select("id").limit(1);
check(!!errorAnon || (datosAnon ?? []).length === 0, "un visitante anónimo no puede leer facturas");

process.exit(ok ? 0 : 1);
