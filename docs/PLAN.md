# Fase 1 — Plan del módulo de contabilidad (Paguro Corp)

> **Documento histórico (19-nov-2026).** Es el plan original y se conserva como registro de las decisiones de diseño. Lo que cambió después: la carpeta raíz pasó a ser `02_2026`; no se usó n8n (la sincronización es automática dentro de la app); las páginas viven en `src/app/(erp)/…` dentro de un armazón de ERP; se agregaron movimientos (pagos, nómina, PILA, importaciones, aportes). El estado actual está en `docs/ESTADO.md` y la arquitectura vigente en `README.md` y en el documento técnico.

---

## 1. Decisiones tomadas

| Tema | Decisión | Motivo |
|---|---|---|
| Stack | Next.js (App Router) + TypeScript + Tailwind + Supabase (nube) + Vitest | Moderno, bien mantenido, y el núcleo queda portable (ver §2) |
| IA | Claude vía API (`AI_PROVIDER=anthropic`), modelo configurable por `AI_MODEL` | Lee PDF e imágenes nativamente y soporta salida estructurada. Capa de proveedor intercambiable (Gemini/OpenAI después) |
| Detección de facturas | Botón "Sincronizar Drive" + endpoint `/sync`. JSON de n8n entregado pero opcional | No hay n8n instalado |
| Carpeta raíz | `corporacion_paguro/01_corporativo/02_fianzas_y_contabilidad/contabilidad` | Se recorre **recursivamente**, sin depender de la estructura de cada año |
| Moneda | COP por defecto, soporte USD con TRM | |
| Datos fiscales | **Nada hardcodeado.** NIT, tasas y cuentas en configuración | No tenemos NIT ni régimen todavía; el contador valida después |

## 2. Cómo queda portable al ERP de tu compañera

```
Capa                      Depende de           Se migra a otro stack…
────────────────────────  ───────────────────  ─────────────────────────────────
core/ (reglas contables)  nada (TS puro)       copiar tal cual (cualquier backend Node)
schema SQL `contabilidad` Postgres             correr las migraciones en su base
vistas de reportes        Postgres             vienen con las migraciones
ai/, drive/               SDKs oficiales       copiar; solo piden variables de entorno
services/, api/           Next.js route        reescribir handlers delgados (~poco código)
ui/                       React + Tailwind     reusar si usa React; si no, rehacer la UI
```

Si el ERP no usa Postgres, lo único que habría que traducir son las migraciones y las vistas.

## 3. Estructura de carpetas

```
paguro-contabilidad/
├─ supabase/migrations/          SQL: schema, tablas, vistas, RLS, semillas
├─ src/
│  ├─ app/                       rutas de Next.js (delgadas, delegan al módulo)
│  │  ├─ (contabilidad)/...      páginas
│  │  └─ api/contabilidad/...    endpoints
│  └─ modules/contabilidad/
│     ├─ core/                   validación, clasificación, asientos, normalización NIT, fechas de carpeta
│     ├─ ai/                     proveedor IA (interfaz + implementación Claude), prompt, JSON schema
│     ├─ drive/                  cliente Drive (service account, drive.readonly), recorrido recursivo
│     ├─ services/               procesarFactura, sincronizarDrive, aprobar/rechazar
│     ├─ repo/                   acceso a datos (Supabase), única capa que conoce la BD
│     ├─ api/                    handlers reutilizables
│     └─ ui/                     componentes
├─ n8n/                          workflow exportado (opcional)
├─ scripts/                      reporte de precisión, carga del histórico
├─ tests/                        unitarias + facturas de prueba
├─ docs/                         PLAN.md, README técnico, INTEGRACION.md
└─ .env.example
```

## 4. Cómo se procesa el Drive (pensado para "muchas facturas")

El histórico es grande y con estructuras distintas por año. Por eso el procesamiento va en **dos pasos**:

1. **Inventario (gratis, sin IA).** `/sync` recorre recursivamente la carpeta `contabilidad` y registra cada archivo en `archivos_drive`: id, nombre, ruta completa de carpetas, tipo MIME, md5 y fecha de modificación. Solo toma PDF e imágenes (jpg, png, heic, webp). Al terminar, la app muestra cuántos archivos hay, cuántos son nuevos y **el costo estimado** antes de gastar en IA.
2. **Procesamiento (con IA) por lotes.** Se procesan los archivos pendientes en lotes pequeños, con concurrencia limitada y reintentos ante límites de tasa. Se puede pausar y retomar, y empezar por un año o una carpeta concreta (por ejemplo solo `02_2026`).

Otras reglas:
- **Mes esperado:** se deduce de la ruta cuando es posible (`02_2026/03_marzo`, `2025/Enero`, `2024-05`, …). Si no se puede, queda vacío y solo se usa la fecha de la factura. La regla "fecha ≠ mes de carpeta" sigue siendo advertencia, no error.
- **El mismo archivo en dos carpetas:** se detecta por md5 y se procesa una sola vez.
- **Archivos que no son facturas** (cotizaciones, extractos, fotos sueltas): la IA los marca y quedan como `descartada` (estado nuevo, ver pregunta 2).

## 5. Esquema de base de datos (schema `contabilidad`)

Resumen. Los tipos exactos, índices y restricciones van en la fase 2.

```
configuracion        clave (pk), valor jsonb
                     → nit_empresa, umbral_confianza (0.85), auto_aprobacion,
                       tolerancia_redondeo, cuentas puente (IVA descontable,
                       IVA generado, retefuente, reteICA, proveedores, clientes)

cuentas              id, codigo (único), nombre, naturaleza (debito|credito),
                     tipo (activo|pasivo|patrimonio|ingreso|gasto|costo),
                     padre_id, acepta_movimiento, activa

categorias           id, nombre, cuenta_id (por defecto), tipo_factura_sugerido, activa

terceros             id, nit (normalizado, único), dv, razon_social,
                     tipo (proveedor|cliente|ambos), pais

archivos_drive       id, drive_file_id (único), nombre, ruta, mime, md5,
                     modificado_drive, mes_carpeta (date|null),
                     estado (pendiente|procesando|procesado|error|ignorado), factura_id

facturas             id, tipo (compra|venta|gasto), numero, fecha_emision,
                     fecha_vencimiento, tercero_id, moneda, tasa_cambio,
                     subtotal, iva, retefuente, reteica, otros_impuestos, total,
                     total_cop, categoria_id, cuenta_id,
                     estado (pendiente_revision|aprobada|rechazada|error|descartada),
                     confianza, confianza_campos jsonb, advertencias jsonb,
                     archivo_id, drive_file_id, drive_url, drive_md5,
                     carpeta_origen, datos_ia jsonb, observaciones,
                     creado_en, actualizado_en
                     UNIQUE (tercero_id, numero)

factura_items        id, factura_id, descripcion, cantidad, valor_unitario,
                     iva_tasa, iva_valor, total

asientos             id, fecha, descripcion, factura_id, creado_por, creado_en
asiento_lineas       id, asiento_id, cuenta_id, tercero_id, debito, credito
                     CHECK (debito >= 0 AND credito >= 0 AND NOT (debito > 0 AND credito > 0))
                     + trigger diferido: suma débitos = suma créditos por asiento

revisiones           id, factura_id, campo, valor_ia, valor_corregido, usuario_id, fecha
procesamientos       id, archivo_id, estado, error, duracion_ms,
                     tokens_entrada, tokens_salida, costo_usd, modelo, creado_en
saldos_iniciales     id, cuenta_id, tercero_id (null), fecha_corte, debito, credito
```

**Vistas de reportes:** `v_libro_mayor`, `v_balance_comprobacion`, `v_estado_resultados`, `v_balance_general`, `v_gastos_categoria`, `v_gastos_proveedor`, `v_impuestos_periodo`, `v_cuentas_por_pagar`, `v_cuentas_por_cobrar`. Todas leen solo de asientos aprobados y de saldos iniciales.

**Seguridad:** RLS en todas las tablas. Solo usuarios autenticados leen y escriben. Los endpoints internos usan la service key en el servidor y nunca en el navegador.

**Semillas:** el PUC común para un ecommerce (caja, bancos, clientes, IVA, retenciones, proveedores, ingresos operacionales, gastos de publicidad, fletes, software, comisiones de pasarela, costo de ventas, …) y unas 15 categorías iniciales. Todas marcadas como **pendiente de validación por el contador**.

## 6. JSON schema de extracción (lo que devuelve la IA)

```jsonc
{
  "es_factura": boolean,                    // false si es cotización, extracto, otro documento
  "tipo_documento": "factura_electronica" | "factura" | "cuenta_de_cobro" | "recibo" | "documento_soporte" | "nota_credito" | "invoice_exterior" | "otro",
  "numero": string | null,
  "cufe": string | null,                    // si aparece en la representación gráfica
  "fecha_emision": "YYYY-MM-DD" | null,
  "fecha_vencimiento": "YYYY-MM-DD" | null,
  "emisor":   { "nombre": string | null, "nit": string | null, "pais": string | null },
  "receptor": { "nombre": string | null, "nit": string | null, "pais": string | null },
  "moneda": "COP" | "USD" | "EUR" | string,
  "items": [
    { "descripcion": string, "cantidad": number | null, "valor_unitario": number | null,
      "iva_tasa": number | null, "iva_valor": number | null, "total": number | null }
  ],
  "subtotal": number | null,
  "iva": { "tasa": number | null, "valor": number | null },
  "retefuente": number | null,
  "reteica": number | null,
  "otros_impuestos": [ { "nombre": string, "valor": number } ],
  "total": number | null,
  "categoria_sugerida": string | null,      // solo de la lista enviada
  "cuenta_sugerida": string | null,         // solo códigos de la lista enviada
  "confianza_campos": { "<campo>": number },  // 0..1
  "confianza_general": number,              // 0..1
  "notas": string | null
}
```

El prompt incluirá: el NIT de Paguro Corp (para decidir si es compra o venta), las categorías y cuentas permitidas, y la regla **"si no aparece, `null`; nunca inventes"**. El tipo `compra | venta | gasto` lo decide el código en `core/` comparando NITs, no la IA. Así es determinista y se puede probar.

## 7. Supuestos pendientes (no bloquean la fase 2)

- **NIT de Paguro Corp:** variable `PAGURO_NIT`. Sin ella el procesamiento no arranca, para no clasificar mal.
- **Régimen de IVA, retefuente y ReteICA:** no se calculan. Solo se **registran los valores que trae la factura**. Las cuentas de impuestos son configurables.
- **Contador:** todo lo contable queda marcado como pendiente de validación.

---

## Decisiones confirmadas (2026-11-19)

1. **Auto-aprobación encendida.** La IA aprueba y contabiliza sola si no hay errores y la confianza es ≥ 85%. Se puede apagar desde la configuración.
2. **Estado `descartada`** para archivos que no son facturas.
3. **Facturas en USD:** se convierten a COP con la TRM oficial del día (datos.gov.co) y se guarda también el valor original.
4. **Modelo:** Claude Sonnet por defecto, configurable (Haiku para abaratar el histórico).
5. **Usuarios:** personal de la empresa, con roles `admin`, `editor` y `lector` (tabla `contabilidad.usuarios`).

## Decisiones contables de la fase 2 (revisables)

- **Compras de mercancía → 620501 (Compras)**, sistema de inventario periódico. No hay módulo de inventario en V1.
- **Proveedores:** las compras de mercancía van a `2205` (proveedores) y los gastos y servicios a `2335` (costos y gastos por pagar). Se distingue entre nacional y exterior.
- **Total impreso:** se acepta antes o después de retenciones (las facturas colombianas traen ambos formatos).
- **Otros impuestos no descontables** (impuesto al consumo, bolsas) se suman al gasto.
- **Retención en la fuente:** cada categoría puede tener su propia cuenta (honorarios 236515, servicios 236525, arriendos 236530, compras 236540).
- **Sin NIT del comprador** (por ejemplo un tiquete POS): se registra con advertencia, sin bloquearla.
- **Notas crédito:** van a revisión manual en V1.
- **Pagos y recaudos** no se registran en V1. Las cuentas por pagar y por cobrar muestran el saldo original de cada factura.
- **Sin asientos de cierre:** el resultado del ejercicio se calcula al vuelo en el balance general.
