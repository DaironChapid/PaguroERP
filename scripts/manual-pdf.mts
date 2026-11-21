// Convierte un documento HTML de docs/ en PDF con Microsoft Edge (sin Python ni otras herramientas).
// Uso:
//   npm run manual:pdf    → docs/manual/Manual-de-uso-Paguro-ERP.pdf
//   npm run tecnico:pdf   → docs/tecnico/Documento-tecnico-Paguro-ERP.pdf
//   node --import tsx scripts/manual-pdf.mts <origen.html> <destino.pdf> "<pie de página>"
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright-core";

const [origenArg = "docs/manual/manual.html", destinoArg = "docs/manual/Manual-de-uso-Paguro-ERP.pdf", pie = "Paguro ERP · Manual de uso"] = process.argv.slice(2);
const origen = resolve(origenArg);
const destino = resolve(destinoArg);
const navegador = await chromium.launch({ channel: "msedge" });
try {
  const pagina = await navegador.newPage();
  await pagina.goto(pathToFileURL(origen).href, { waitUntil: "load" });
  await pagina.pdf({
    path: destino,
    format: "Letter",
    printBackground: true,
    preferCSSPageSize: true,
    displayHeaderFooter: true,
    headerTemplate: "<span></span>",
    footerTemplate:
      '<div style="width:100%;font-size:8px;color:#8c959f;padding:0 16mm;display:flex;justify-content:space-between;font-family:Segoe UI,sans-serif">' +
      `<span>${pie}</span><span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span></div>`,
  });
  console.log(`PDF generado: ${destino}`);
} finally {
  await navegador.close();
}
