import Link from "next/link";
import { indicadoresInicio, ultimoMesConDatos } from "../api/consultas";
import type { BaseDatos } from "../repo/supabase";
import { rutas } from "../rutas";
import { Aviso, Encabezado, Indicador, Tarjeta } from "./componentes";
import { cop, mes as nombreMes } from "./formato";
import { BarrasRanking, TendenciaMensual } from "./graficos";
import { SelectorMes } from "./selector-mes";

export async function PaginaInicio({ db, mes }: { db: BaseDatos; mes?: string }) {
  const periodo = mes && /^\d{4}-\d{2}$/.test(mes) ? mes : await ultimoMesConDatos(db);
  const d = await indicadoresInicio(db, periodo);

  return (
    <>
      <Encabezado
        titulo="Contabilidad · Resumen"
        descripcion={`Resumen de ${nombreMes(periodo, true)} con los documentos aprobados.`}
        acciones={<SelectorMes valor={periodo} />}
      />

      <div className="space-y-4">
        {!d.saldosIniciales?.cargados && (
          <Aviso>
            Faltan los <strong>saldos iniciales</strong>: el balance general y el saldo del banco estarán incompletos hasta cargarlos en{" "}
            <Link href={rutas.configuracion} className="underline">Configuración</Link>.
          </Aviso>
        )}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Indicador etiqueta="Ingresos del mes" valor={cop(d.ingresos)} />
          <Indicador etiqueta="Gastos y costos del mes" valor={cop(d.gastos)} />
          <Indicador
            etiqueta="Utilidad del mes"
            valor={cop(d.utilidad)}
            detalle={d.utilidad < 0 ? "Pérdida" : d.utilidad > 0 ? "Ganancia" : undefined}
            tono={d.utilidad < 0 ? "critico" : d.utilidad > 0 ? "bien" : undefined}
          />
          <Link href={rutas.revision} className="block">
            <Indicador
              etiqueta="Pendientes de revisión"
              valor={String(d.pendientes)}
              detalle={d.pendientes > 0 ? "Revisar ahora" : "Todo al día"}
              tono={d.pendientes > 0 ? "aviso" : "bien"}
            />
          </Link>
        </div>

        {(d.archivosConError > 0 || d.archivosPendientes > 0) && (
          <Aviso tono={d.archivosConError > 0 ? "critico" : "aviso"}>
            {d.archivosPendientes > 0 && <>{d.archivosPendientes} archivo(s) del Drive esperan ser procesados. </>}
            {d.archivosConError > 0 && <>{d.archivosConError} archivo(s) no se pudieron leer. </>}
            <Link href={rutas.documentos} className="underline">Ver estado del Drive</Link>
          </Aviso>
        )}

        <div className="grid gap-4 lg:grid-cols-5">
          <Tarjeta titulo="Ingresos y gastos · últimos 12 meses" className="lg:col-span-3">
            <TendenciaMensual datos={d.tendencia} />
          </Tarjeta>
          <Tarjeta titulo={`Gastos por cuenta · ${nombreMes(periodo, true)}`} className="lg:col-span-2">
            {d.gastosPorCuenta.length > 0 ? (
              <BarrasRanking datos={d.gastosPorCuenta.map((g) => ({ etiqueta: g.cuenta, valor: g.valor }))} />
            ) : (
              <p className="text-sm text-tinta-2">No hay gastos aprobados en este mes.</p>
            )}
          </Tarjeta>
        </div>
      </div>
    </>
  );
}
