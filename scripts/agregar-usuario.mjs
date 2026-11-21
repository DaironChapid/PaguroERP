// Agrega o actualiza un usuario autorizado del módulo de contabilidad.
// Uso: npm run usuario -- correo@empresa.com admin|editor|lector ["Nombre"]
import { createClient } from "@supabase/supabase-js";

const [email, rol = "lector", nombre = null] = process.argv.slice(2);
const ROLES = ["admin", "editor", "lector"];

if (!email || !ROLES.includes(rol)) {
  console.error("Uso: npm run usuario -- correo@empresa.com admin|editor|lector [\"Nombre\"]");
  process.exit(1);
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  db: { schema: "contabilidad" },
  auth: { persistSession: false },
});

const { error } = await supabase
  .from("usuarios")
  .upsert({ email: email.toLowerCase(), rol, nombre, activo: true }, { onConflict: "email" });

if (error) {
  console.error("No se pudo guardar el usuario:", error.message);
  process.exit(1);
}
console.log(`Usuario ${email.toLowerCase()} guardado con rol ${rol}.`);
