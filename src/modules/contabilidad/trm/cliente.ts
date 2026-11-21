// TRM oficial (Superintendencia Financiera) publicada en datos.gov.co.
// Cada registro tiene un rango de vigencia; se busca el que cubre la fecha.

const DATASET = "https://www.datos.gov.co/resource/32sa-8pi3.json";

export class ErrorTrm extends Error {}

export async function consultarTrm(fecha: string): Promise<number> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw new ErrorTrm(`Fecha inválida para la TRM: ${fecha}`);
  const instante = `${fecha}T00:00:00.000`;
  const url = new URL(DATASET);
  url.searchParams.set("$where", `vigenciadesde <= '${instante}' AND vigenciahasta >= '${instante}'`);
  url.searchParams.set("$limit", "1");

  const respuesta = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!respuesta.ok) throw new ErrorTrm(`datos.gov.co respondió ${respuesta.status}`);
  const filas = (await respuesta.json()) as { valor: string }[];
  const valor = Number(filas[0]?.valor);
  if (!filas.length || !(valor > 0)) throw new ErrorTrm(`No hay TRM publicada para ${fecha}`);
  return valor;
}
