// Prueba de humo de la extracción con IA: genera una factura PDF de ejemplo
// (datos ficticios), la envía al modelo configurado y muestra el resultado.
// Uso: npm run probar-ia [-- ruta/a/factura.pdf]
import { readFileSync } from "node:fs";
import { extname } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { crearExtractor, ErrorExtraccion } from "../src/modules/contabilidad/ai";

function pdfDeEjemplo(lineas: string[]): Buffer {
  const texto = lineas
    .map((l, i) => `BT /F1 11 Tf 50 ${780 - i * 18} Td (${l.replace(/[()\\]/g, "\\$&")}) Tj ET`)
    .join("\n");
  const objetos = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    `<< /Length ${Buffer.byteLength(texto, "latin1")} >>\nstream\n${texto}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objetos.forEach((o, i) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, "latin1");
}

const MIME: Record<string, string> = { ".pdf": "application/pdf", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };

async function main() {
  const ruta = process.argv[2];
  const documento = ruta
    ? { datos: readFileSync(ruta), mime: MIME[extname(ruta).toLowerCase()] ?? "application/octet-stream", nombre: ruta }
    : {
        nombre: "factura-ejemplo.pdf",
        mime: "application/pdf",
        datos: pdfDeEjemplo([
          "AGENCIA DIGITAL ANDINA S.A.S.   NIT 900.123.456-8",
          "FACTURA ELECTRONICA DE VENTA No. FEAD-2041",
          "Fecha de emision: 15/03/2026     Vence: 14/04/2026",
          "Cliente: PAGURO CORP S.A.S.   NIT 901.937.774-2",
          "",
          "Descripcion                                   Cant      Valor",
          "Gestion de campanas Meta Ads marzo 2026        1    1.000.000,00",
          "",
          "Subtotal                                            1.000.000,00",
          "IVA 19%                                               190.000,00",
          "Total factura                                       1.190.000,00",
          "Retencion en la fuente 4% (practicada por el cliente)  40.000,00",
          "Neto a pagar                                        1.150.000,00",
        ]),
      };

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    db: { schema: "contabilidad" },
    auth: { persistSession: false },
  });
  const [{ data: categorias, error: e1 }, { data: cuentas, error: e2 }] = await Promise.all([
    supabase.from("categorias").select("nombre, descripcion, tipo_factura").eq("activa", true).order("nombre"),
    supabase.from("cuentas").select("codigo, nombre").eq("acepta_movimiento", true).eq("activa", true).in("tipo", ["gasto", "costo", "activo", "ingreso"]).order("codigo"),
  ]);
  if (e1 || e2) throw e1 ?? e2;

  const extractor = crearExtractor();
  console.log(`Modelo: ${extractor.modelo}. Enviando ${documento.nombre}…`);
  const inicio = Date.now();
  try {
    const r = await extractor.extraer(documento, {
      nitEmpresa: process.env.PAGURO_NIT!,
      nombreEmpresa: "Paguro Corp",
      categorias: categorias!.map((c) => ({ nombre: c.nombre, descripcion: c.descripcion, tipo: c.tipo_factura })),
      cuentas: cuentas!,
    });
    console.log(JSON.stringify(r.datos, null, 2));
    console.log(`\nTokens: ${r.tokensEntrada} entrada / ${r.tokensSalida} salida · ${((Date.now() - inicio) / 1000).toFixed(1)} s`);
  } catch (error) {
    if (error instanceof ErrorExtraccion) {
      console.error("Error clasificado:", error.detalle);
      process.exit(1);
    }
    throw error;
  }
}

main();
