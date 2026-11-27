// Verifica el acceso al Drive y muestra un resumen de la carpeta raíz sin
// descargar nada. Uso: npm run probar-drive
import { ClienteDrive } from "../drive/cliente";
import { inferirPeriodoCarpeta } from "../core";

async function main() {
  const raiz = process.env.DRIVE_ROOT_FOLDER_ID!;
  const drive = new ClienteDrive();
  const carpeta = await drive.obtener(raiz);
  console.log(`Carpeta raíz: ${carpeta.name}\nRecorriendo…`);

  const porCarpeta = new Map<string, number>();
  const porTipo = new Map<string, number>();
  const porAnio = new Map<string, number>();
  const sinPeriodo: string[] = [];
  let total = 0;
  let bytes = 0;
  for await (const f of drive.recorrer(raiz)) {
    total++;
    bytes += f.tamanoBytes ?? 0;
    porTipo.set(f.mime, (porTipo.get(f.mime) ?? 0) + 1);
    const carpetaArchivo = f.ruta.slice(0, 2).join("/") || "(raíz)";
    porCarpeta.set(carpetaArchivo, (porCarpeta.get(carpetaArchivo) ?? 0) + 1);
    const { anio } = inferirPeriodoCarpeta(f.ruta);
    porAnio.set(String(anio ?? "sin año"), (porAnio.get(String(anio ?? "sin año")) ?? 0) + 1);
    if (anio === null && sinPeriodo.length < 10) sinPeriodo.push([...f.ruta, f.nombre].join("/"));
    if (total % 200 === 0) console.log(`  ${total} archivos…`);
  }

  console.log(`\nTotal: ${total} archivos (${(bytes / 1024 / 1024).toFixed(1)} MB)`);
  console.log("\nPor carpeta (dos primeros niveles):");
  for (const [k, v] of [...porCarpeta].sort()) console.log(`  ${v.toString().padStart(6)}  ${k}`);
  console.log("\nPor tipo:");
  for (const [k, v] of [...porTipo].sort((a, b) => b[1] - a[1])) console.log(`  ${v.toString().padStart(6)}  ${k}`);
  console.log("\nPor año (según carpeta):");
  for (const [k, v] of [...porAnio].sort()) console.log(`  ${v.toString().padStart(6)}  ${k}`);
  if (sinPeriodo.length) console.log("\nEjemplos sin año en la ruta:\n  " + sinPeriodo.join("\n  "));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
