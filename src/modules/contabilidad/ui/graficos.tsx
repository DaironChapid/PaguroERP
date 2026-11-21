import { cop, copCorto, mes } from "./formato";

// Gráficos en SVG renderizados en el servidor. Marcas delgadas con extremos
// redondeados anclados a la línea base, grilla recesiva, leyenda para más de
// una serie, tooltip por marca (<title>) y tabla equivalente para accesibilidad.

/** Barra con las esquinas redondeadas solo en el extremo de datos. */
function barraVertical(x: number, y: number, ancho: number, alto: number, radio = 4) {
  const r = Math.min(radio, ancho / 2, alto);
  return `M${x},${y + alto} V${y + r} Q${x},${y} ${x + r},${y} H${x + ancho - r} Q${x + ancho},${y} ${x + ancho},${y + r} V${y + alto} Z`;
}

function barraHorizontal(x: number, y: number, ancho: number, alto: number, radio = 4) {
  const r = Math.min(radio, alto / 2, ancho);
  return `M${x},${y} H${x + ancho - r} Q${x + ancho},${y} ${x + ancho},${y + r} V${y + alto - r} Q${x + ancho},${y + alto} ${x + ancho - r},${y + alto} H${x} Z`;
}

function escala(maximo: number) {
  if (maximo <= 0) return { tope: 1, marcas: [0] };
  const bruto = maximo / 4;
  const potencia = 10 ** Math.floor(Math.log10(bruto));
  const paso = [1, 2, 2.5, 5, 10].map((m) => m * potencia).find((p) => p >= bruto)!;
  const tope = paso * Math.ceil(maximo / paso);
  return { tope, marcas: Array.from({ length: Math.round(tope / paso) + 1 }, (_, i) => i * paso) };
}

export interface PuntoTendencia {
  periodo: string;
  ingresos: number;
  gastos: number;
  utilidad: number;
}

/** Ingresos y gastos por mes: columnas agrupadas (dos series, un solo eje). */
export function TendenciaMensual({ datos }: { datos: PuntoTendencia[] }) {
  const ancho = 720;
  const alto = 240;
  const margen = { arriba: 8, derecha: 8, abajo: 26, izquierda: 64 };
  const areaAncho = ancho - margen.izquierda - margen.derecha;
  const areaAlto = alto - margen.arriba - margen.abajo;
  const { tope, marcas } = escala(Math.max(...datos.flatMap((d) => [d.ingresos, d.gastos]), 0));
  const y = (v: number) => margen.arriba + areaAlto - (v / tope) * areaAlto;
  const paso = areaAncho / datos.length;
  const barra = Math.min(18, (paso - 10) / 2);

  return (
    <figure>
      <div className="mb-2 flex gap-4 text-xs text-tinta-2" aria-hidden>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-serie-1" />Ingresos</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-serie-2" />Gastos</span>
      </div>
      <div className="-mx-1 overflow-x-auto px-1">
      <svg viewBox={`0 0 ${ancho} ${alto}`} className="h-auto w-full min-w-[540px]" role="img" aria-label="Ingresos y gastos de los últimos 12 meses">
        {marcas.map((m) => (
          <g key={m}>
            <line x1={margen.izquierda} x2={ancho - margen.derecha} y1={y(m)} y2={y(m)} stroke={m === 0 ? "var(--eje)" : "var(--grilla)"} strokeWidth={1} />
            <text x={margen.izquierda - 8} y={y(m)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--tinta-suave)" className="cifras">
              {copCorto(m)}
            </text>
          </g>
        ))}
        {datos.map((d, i) => {
          const centro = margen.izquierda + paso * i + paso / 2;
          return (
            <g key={d.periodo}>
              {d.ingresos > 0 && (
                <path d={barraVertical(centro - barra - 1, y(d.ingresos), barra, y(0) - y(d.ingresos))} fill="var(--serie-1)">
                  <title>{`${mes(d.periodo, true)} · Ingresos ${cop(d.ingresos)}`}</title>
                </path>
              )}
              {d.gastos > 0 && (
                <path d={barraVertical(centro + 1, y(d.gastos), barra, y(0) - y(d.gastos))} fill="var(--serie-2)">
                  <title>{`${mes(d.periodo, true)} · Gastos ${cop(d.gastos)}`}</title>
                </path>
              )}
              {/* Zona de hover más grande que la marca */}
              <rect x={centro - paso / 2} y={margen.arriba} width={paso} height={areaAlto} fill="transparent">
                <title>{`${mes(d.periodo, true)}\nIngresos ${cop(d.ingresos)}\nGastos ${cop(d.gastos)}\nUtilidad ${cop(d.utilidad)}`}</title>
              </rect>
              <text x={centro} y={alto - 8} textAnchor="middle" fontSize={11} fill="var(--tinta-suave)">
                {mes(d.periodo).split(" ")[0]}
              </text>
            </g>
          );
        })}
      </svg>
      </div>
      <TablaEquivalente
        titulo="Ver tabla"
        columnas={["Mes", "Ingresos", "Gastos", "Utilidad"]}
        filas={datos.map((d) => [mes(d.periodo, true), cop(d.ingresos), cop(d.gastos), cop(d.utilidad)])}
      />
    </figure>
  );
}

/** Ranking horizontal de una sola serie (gastos por cuenta). */
export function BarrasRanking({ datos, maximoFilas = 8 }: { datos: { etiqueta: string; valor: number }[]; maximoFilas?: number }) {
  const visibles = datos.slice(0, maximoFilas);
  const resto = datos.slice(maximoFilas).reduce((s, d) => s + d.valor, 0);
  if (resto > 0) visibles.push({ etiqueta: "Otros", valor: resto });
  const maximo = Math.max(...visibles.map((d) => d.valor), 1);

  return (
    <figure>
      <ul className="space-y-2.5" aria-label="Gastos por cuenta">
        {visibles.map((d) => (
          <li key={d.etiqueta} title={`${d.etiqueta}: ${cop(d.valor)}`}>
            <div className="mb-1 flex justify-between gap-3 text-xs">
              <span className="truncate text-tinta-2">{d.etiqueta}</span>
              <span className="cifras shrink-0 font-medium text-tinta">{cop(d.valor)}</span>
            </div>
            <svg viewBox="0 0 100 6" preserveAspectRatio="none" className="block h-2 w-full" aria-hidden>
              <path d={barraHorizontal(0, 0, Math.max((d.valor / maximo) * 100, 0.5), 6, 1.5)} fill="var(--serie-2)" />
            </svg>
          </li>
        ))}
      </ul>
    </figure>
  );
}

function TablaEquivalente({ titulo, columnas, filas }: { titulo: string; columnas: string[]; filas: string[][] }) {
  return (
    <details className="mt-2 text-xs">
      <summary className="cursor-pointer text-tinta-2 hover:text-tinta">{titulo}</summary>
      <div className="mt-2 overflow-x-auto">
        <table className="cifras w-full text-left">
          <thead className="text-tinta-2">
            <tr>{columnas.map((c) => <th key={c} className="py-1 pr-4 font-medium">{c}</th>)}</tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f[0]} className="border-t border-borde">
                {f.map((c, i) => <td key={i} className="py-1 pr-4">{c}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
