// Devuelve a la cola los archivos con error (todos o los de un código).
// Uso: npm run reintentar -- [codigo]     p. ej. npm run reintentar -- sin_creditos
import { crearClienteServicio } from "../src/modules/contabilidad/repo/supabase";

async function main() {
  const codigo = process.argv[2] ?? null;
  const { data, error } = await crearClienteServicio().rpc("reintentar_archivos", { p_codigo: codigo ?? undefined });
  if (error) throw error;
  console.log(`${data} archivo(s) devueltos a la cola${codigo ? ` (error: ${codigo})` : ""}. Ahora corre: npm run procesar -- 100`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
