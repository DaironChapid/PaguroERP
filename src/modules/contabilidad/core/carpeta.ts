// Deduce el año y el mes al que corresponde una factura a partir de la ruta
// de carpetas del Drive. Las estructuras cambian entre años, así que se
// reconocen varios formatos y la carpeta más profunda tiene prioridad:
//   02_2026/03_marzo   → 2026-03   (el "02" es solo un prefijo de orden)
//   2025/Enero         → 2025-01
//   2024-05            → 2024-05
//   Facturas Mayo 2023 → 2023-05

export interface PeriodoCarpeta {
  anio: number | null;
  mes: number | null;
}

const MESES: Record<string, number> = {
  enero: 1, ene: 1,
  febrero: 2, feb: 2,
  marzo: 3, mar: 3,
  abril: 4, abr: 4,
  mayo: 5, may: 5,
  junio: 6, jun: 6,
  julio: 7, jul: 7,
  agosto: 8, ago: 8,
  septiembre: 9, setiembre: 9, sep: 9, sept: 9, set: 9,
  octubre: 10, oct: 10,
  noviembre: 11, nov: 11,
  diciembre: 12, dic: 12,
};

const ANIO = /^(19|20)\d{2}$/;

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function esMes(n: number): boolean {
  return Number.isInteger(n) && n >= 1 && n <= 12;
}

/** @param ruta carpetas desde la raíz (sin el nombre del archivo), como arreglo o separadas por "/". */
export function inferirPeriodoCarpeta(ruta: string | string[]): PeriodoCarpeta {
  const segmentos = (Array.isArray(ruta) ? ruta : ruta.split("/")).map(normalizar).filter(Boolean);
  let anio: number | null = null;
  let mes: number | null = null;

  for (const segmento of segmentos) {
    // Año-mes numérico: 2024-05, 2024_05, 2024.05
    const anioMes = segmento.match(/^((?:19|20)\d{2})[-_. ](\d{1,2})$/);
    if (anioMes && esMes(Number(anioMes[2]))) {
      anio = Number(anioMes[1]);
      mes = Number(anioMes[2]);
      continue;
    }
    // Mes-año numérico solo con guion o punto: 05-2024. (02_2026 es prefijo de orden + año.)
    const mesAnio = segmento.match(/^(\d{1,2})[-.](\d{4})$/);
    if (mesAnio && esMes(Number(mesAnio[1])) && ANIO.test(mesAnio[2])) {
      anio = Number(mesAnio[2]);
      mes = Number(mesAnio[1]);
      continue;
    }

    const tokens = segmento.split(/[^a-z0-9]+/).filter(Boolean);
    let mesEnSegmento: number | null = null;
    for (const token of tokens) {
      if (ANIO.test(token)) {
        const nuevoAnio = Number(token);
        // Una carpeta de otro año invalida el mes que veníamos arrastrando.
        if (anio !== null && nuevoAnio !== anio) mes = null;
        anio = nuevoAnio;
      } else if (token in MESES) {
        mesEnSegmento = MESES[token];
      }
    }

    if (mesEnSegmento !== null) {
      mes = mesEnSegmento;
    } else if (anio !== null && /^\d{1,2}$/.test(segmento) && esMes(Number(segmento))) {
      // Carpeta numérica pura dentro de una de año: 2026/03
      mes = Number(segmento);
    }
  }

  return { anio, mes };
}
