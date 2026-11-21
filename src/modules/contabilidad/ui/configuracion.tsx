import { datosSaldosIniciales } from "../api/consultas";
import { tieneRol, type Usuario } from "../api/sesion";
import type { BaseDatos } from "../repo/supabase";
import { Aviso, Tarjeta } from "./componentes";
import { BotonBorrarSaldo, FormSaldoInicial } from "./configuracion-acciones";
import { cop, fecha } from "./formato";

/** Ajustes de contabilidad que se muestran en la Configuración general del ERP. */
export async function SeccionConfiguracionContabilidad({ db, usuario }: { db: BaseDatos; usuario: Usuario }) {
  const saldos = await datosSaldosIniciales(db);
  const admin = tieneRol(usuario, "admin");
  const totalDebito = saldos.reduce((s, x) => s + Number(x.debito), 0);
  const totalCredito = saldos.reduce((s, x) => s + Number(x.credito), 0);

  return (
    <Tarjeta titulo="Saldos iniciales">
      <p className="mb-3 text-sm text-tinta-2">
        Lo que la empresa tenía en cada cuenta antes de empezar a usar el sistema (por ejemplo, el saldo del banco). Los entrega el contador.
      </p>
      {saldos.length === 0 ? (
        <div className="mb-3">
          <Aviso>Aún no hay saldos iniciales: el balance general no incluye lo que la empresa tenía antes.</Aviso>
        </div>
      ) : (
        <div className="mb-3 overflow-x-auto">
          <table className="cifras w-full text-left text-sm">
            <thead className="text-xs text-tinta-2">
              <tr className="border-b border-borde">
                <th className="py-1.5 pr-3 font-medium">Cuenta</th>
                <th className="py-1.5 pr-3 font-medium">Corte</th>
                <th className="py-1.5 pr-3 text-right font-medium">Débito</th>
                <th className="py-1.5 pr-3 text-right font-medium">Crédito</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {saldos.map((s) => (
                <tr key={s.id} className="border-b border-borde last:border-0">
                  <td className="py-1.5 pr-3">{s.cuentas?.codigo} <span className="text-tinta-2">{s.cuentas?.nombre}</span></td>
                  <td className="py-1.5 pr-3">{fecha(s.fecha_corte)}</td>
                  <td className="py-1.5 pr-3 text-right">{cop(s.debito)}</td>
                  <td className="py-1.5 pr-3 text-right">{cop(s.credito)}</td>
                  <td className="py-1.5 text-right">{admin && <BotonBorrarSaldo id={s.id} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {Math.abs(totalDebito - totalCredito) >= 0.01 && (
            <div className="mt-2">
              <Aviso tono="critico">Los saldos no cuadran: débitos {cop(totalDebito)} ≠ créditos {cop(totalCredito)}.</Aviso>
            </div>
          )}
        </div>
      )}
      {admin ? <FormSaldoInicial /> : <p className="text-xs text-tinta-2">Solo un administrador puede cargar o borrar saldos.</p>}
    </Tarjeta>
  );
}
