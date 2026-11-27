# Estado del proyecto — 21 de noviembre de 2026

Versión entregable del ERP con el módulo de **Contabilidad**. Cómo instalarlo: `docs/INSTALACION.md`. Cómo usarlo: `docs/manual/`. Visión técnica: `docs/tecnico/`.

## Alcance de esta versión (lo que pidió el gerente)
Manual de uso · probado, sin errores conocidos · contabilidad de Paguro en un solo espacio del sistema · enlaces a las evidencias del Drive · IA que reconoce, mapea y categoriza. **Todo cumplido.**
Fuera de alcance por decisión: Inventario (oculto), n8n, reglas aprendidas, publicación en la nube (Vercel).

## Hecho
- **Fase 1 · Plan** (decisiones originales, hoy recogidas en este documento).
- **Fase 2 · Base de datos y reglas contables**: schema `contabilidad` en Supabase, PUC, categorías, vistas de reportes, RLS por rol.
- **Fase 3 · Motor**: lee la carpeta `02_2026` del Drive (robot de solo lectura, sin llaves), lee cada PDF o imagen con Claude, clasifica, valida y contabiliza facturas de compra y venta, pagos a la DIAN, planillas PILA, nómina, transferencias (también al exterior), importaciones y **aportes de socio**; detecta duplicados, maneja la falta de créditos y reintenta.
- **Fase 4 · App web**: menú del ERP → Contabilidad (Resumen · Documentos con pestañas *Por revisar* / *Todos* y el estado del Drive · Reportes) y ⚙ Configuración general (saldos iniciales). Inventario oculto. `/contabilidad/revision` y `/contabilidad/configuracion` redirigen (`next.config.ts`).
- **Sincronización automática**: revisa el Drive al arrancar y cada 15 minutos (`src/instrumentation.ts` → `services/reloj.ts`), hasta 20 documentos por vuelta y nunca dos a la vez.
- **Enlaces a las evidencias** desde los 9 reportes, Documentos, el detalle y los archivos que no se pudieron leer.
- **Pruebas**: 120 automáticas (`npm test`), y recorridos manuales de pantallas, permisos, enlaces y del flujo corregir/aprobar/rechazar (sus scripts temporales se retiraron en la limpieza del 26-nov-2026). Verificadas en desarrollo, en producción y sobre un clon limpio del repositorio.
- **Documentación**: manual de uso (PDF), documento técnico (PDF), `README.md` e `INSTALACION.md` (traspaso por GitHub).
- **Herramientas**: `iniciar-paguro.bat` (uso diario), `npm run respaldo` (copia de los datos sin Docker), `.gitattributes`, `.env.example` completo, `engines` de Node.

## Datos al 21-nov-2026 (carpeta `02_2026`)
41 aprobados · 3 por revisar · 22 informativos o duplicados. Archivos del Drive: 70 leídos, 4 con error (PDF con contraseña) y el resto ignorados por formato o carpeta. El balance cuadra (débitos = créditos).

## Decisiones contables (respuestas del gerente, 20-nov-2026)
- Transferencias de la cuenta personal de Joseph → empresa = **aporte de socio** (310520 «Aportes de socios por capitalizar», ⚠ confirmar con el contador). Clase `aporte_socio`; la IA reconoce a los socios de `configuracion.socios`.
- Transferencias empresa → Joseph = **nómina** (510506). Joseph = JOSEPH ARCE CLAVIJO, C.C. 1013626374.
- Nataly Contabilidad = **NB Contadores** = honorarios (511030). Ya no trabajan con ellos desde julio; el contador actual se paga desde la cuenta personal de Joseph (no va en los libros). El pago #43 salda la factura #51.
- Joseph casi no paga desde la empresa: transfiere desde su cuenta personal y luego la empresa paga.

## Pendiente
### Para entregar
- [x] Repositorio privado creado: https://github.com/DaironChapid/PaguroERP (falta dar acceso de administrador a Joseph).
- [ ] Rotar la clave de Claude y pasarla a la organización de la empresa (§8).
- [x] Usuario admin de Joseph creado (joseph@pagurocorp.com).
- [ ] Ajustar el control de sesión de Google Cloud para que la lectura del Drive no venza (§7).

### Datos (los gestiona el gerente)
- [ ] **Banco en negativo**: están todas las salidas, pero solo un aporte con comprobante y ningún cobro de ventas. Faltan los comprobantes de aportes y los cobros (están en los extractos `5300009667_*.pdf`).
- [ ] Claves o versiones sin contraseña de 4 PDF.
- [ ] 3 documentos por revisar: #64 (declaración de importación de dic-2025), #48 (PILA sin fecha), #4 (pago DIAN sin valor).

### Para el contador
- [ ] Cuenta de los aportes (310520), prima de junio en el pago #23 (510536), fletes y aduanas (¿costo de la mercancía?), saldos iniciales y validación general del plan de cuentas.

### Siguientes funciones (propuestas)
- Leer los **extractos bancarios** para registrar los cobros y conciliar el banco.
- Reglas por tercero aprendidas de las correcciones.
- Tabla de documentos en formato de tarjetas para celular.
- Publicar en la nube (Vercel) para usarlo desde cualquier lugar.

Los comandos están en `README.md`.
