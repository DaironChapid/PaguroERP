// Crea o actualiza el acceso de una persona: usuario de inicio de sesión
// (correo + contraseña) y su rol en el módulo. La contraseña se escribe en la
// terminal y no queda guardada en ningún archivo.
// Uso: npm run acceso -- correo@empresa.com [admin|editor|lector] ["Nombre"]
import { createInterface } from "node:readline/promises";
import { createClient } from "@supabase/supabase-js";

const ROLES = ["admin", "editor", "lector"];

async function main() {
  const [correo, rol = "lector", nombre = null] = process.argv.slice(2);
  if (!correo || !ROLES.includes(rol)) {
    console.error('Uso: npm run acceso -- correo@empresa.com [admin|editor|lector] ["Nombre"]');
    process.exit(1);
  }
  const email = correo.toLowerCase();

  const lector = createInterface({ input: process.stdin, output: process.stdout });
  const clave = await lector.question(`Contraseña para ${email} (mínimo 8 caracteres): `);
  lector.close();
  if (clave.length < 8) {
    console.error("La contraseña debe tener al menos 8 caracteres.");
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const llave = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const auth = createClient(url, llave, { auth: { persistSession: false } }).auth.admin;

  // ¿Ya existe el usuario de inicio de sesión?
  let existente: { id: string } | undefined;
  for (let pagina = 1; !existente; pagina++) {
    const { data, error } = await auth.listUsers({ page: pagina, perPage: 200 });
    if (error) throw error;
    existente = data.users.find((u) => u.email?.toLowerCase() === email);
    if (data.users.length < 200) break;
  }
  const { error } = existente
    ? await auth.updateUserById(existente.id, { password: clave })
    : await auth.createUser({ email, password: clave, email_confirm: true });
  if (error) throw error;

  const db = createClient(url, llave, { db: { schema: "contabilidad" }, auth: { persistSession: false } });
  const { error: e2 } = await db.from("usuarios").upsert({ email, rol, nombre, activo: true }, { onConflict: "email" });
  if (e2) throw e2;

  console.log(`\nListo: ${email} puede entrar con rol ${rol}${existente ? " (contraseña actualizada)" : ""}.`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
