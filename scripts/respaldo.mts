// Respaldo de la contabilidad SIN Docker: exporta cada tabla del schema
// `contabilidad` a un archivo JSON en respaldos/AAAA-MM-DD_HHMM/.
// Solo LEE la base de datos. Úsalo antes de aplicar migraciones o de cambios grandes.
// Para un respaldo completo y restaurable (SQL), ver docs/INSTALACION.md (requiere Docker).
// Uso: npm run respaldo
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const TABLAS = [
  "usuarios", "configuracion", "cuentas", "categorias", "terceros", "archivos_drive", "facturas",
  "factura_items", "asientos", "asiento_lineas", "revisiones", "procesamientos", "saldos_iniciales", "tasas_cambio",
];
const POR_PAGINA = 1000;

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  db: { schema: "contabilidad" },
  auth: { persistSession: false },
});

const ahora = new Date();
const marca = `${ahora.toISOString().slice(0, 10)}_${String(ahora.getHours()).padStart(2, "0")}${String(ahora.getMinutes()).padStart(2, "0")}`;
const carpeta = `respaldos/${marca}`;
mkdirSync(carpeta, { recursive: true });

let total = 0;
for (const tabla of TABLAS) {
  const filas: unknown[] = [];
  for (let desde = 0; ; desde += POR_PAGINA) {
    const { data, error } = await db.from(tabla).select("*").range(desde, desde + POR_PAGINA - 1);
    if (error) throw new Error(`${tabla}: ${error.message}`);
    filas.push(...data);
    if (data.length < POR_PAGINA) break;
  }
  writeFileSync(`${carpeta}/${tabla}.json`, JSON.stringify(filas, null, 1));
  total += filas.length;
  console.log(`${tabla.padEnd(18)} ${filas.length} filas`);
}
console.log(`\nRespaldo listo: ${carpeta} (${total} filas). Guárdalo fuera del repositorio: tiene datos reales.`);
