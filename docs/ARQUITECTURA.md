# Arquitectura modular

Paguro ERP es un **armazón** (`src/erp`) al que se le conectan **módulos** (`src/modules/<modulo>`). Hoy existe uno: `contabilidad`. Todo lo nuevo se construye siguiendo esta estructura.

## Mapa

```
src/
├─ app/                          Rutas de Next.js. DELGADAS: solo conectan URL → módulo
│  ├─ (erp)/<modulo>/            Páginas del módulo (cada carpeta con su loading.tsx)
│  └─ api/<modulo>/              Endpoints del módulo
├─ erp/                          Armazón: registro de módulos, sesión, menú, login, inicio
├─ instrumentation.ts            Tareas de arranque del servidor (reloj de sincronización)
├─ proxy.ts                      Sesión y protección de páginas
└─ modules/<modulo>/             Todo lo del módulo vive aquí
   ├─ modulo.ts                  Manifiesto: nombre, menú, contadores (único punto de contacto con el ERP)
   ├─ rutas.ts                   Rutas del módulo en un solo lugar
   ├─ core/                      Reglas de negocio PURAS (sin red, base de datos ni framework)
   ├─ ai/ drive/ trm/ …          Integraciones externas, una carpeta por servicio
   ├─ repo/                      Acceso a la base de datos (cliente Supabase y tipos generados)
   ├─ services/                  Procesos que combinan core + integraciones + repo
   ├─ api/                       Lógica de los endpoints y consultas de las páginas
   ├─ ui/                        Componentes de pantalla
   ├─ cli/                       Herramientas de terminal (npm run …)
   └─ tests/                     Pruebas del módulo (espejo de las carpetas de arriba)
supabase/migrations/             <fecha>_<modulo>_<tema>.sql  (una base de datos, un schema por módulo)
docs/                            Documentación (manual, técnico, instalación, estado, esta guía)
scripts/                         Herramientas generales del repositorio (PDF de la documentación)
```

## Reglas (varias las hace cumplir `npm run lint`)

1. **Dirección de dependencias:** `ui → api → services → core / repo / integraciones`. Nunca hacia arriba.
2. **`core/` es puro.** Solo importa archivos de su propia carpeta: nada de `react`, `next`, Supabase, Claude ni otras capas. Es lo más fácil de probar y de llevar a otro sistema. *(lint)*
3. **Un módulo no importa a otro.** Si dos módulos necesitan lo mismo, se sube al armazón (`src/erp`). *(lint, cuando haya más de un módulo)*
4. **El armazón solo conoce el manifiesto** (`modulo.ts`) de cada módulo. *(lint)*
5. **Las rutas de `src/app` son delgadas:** reciben la petición y llaman al módulo. Sin reglas de negocio ahí.
6. **Cada módulo tiene su propio schema** en la base de datos y sus migraciones se llaman `<fecha>_<modulo>_<tema>.sql`.
7. **Las pruebas viven con el módulo** (`src/modules/<modulo>/tests/`), no en una carpeta global.
8. **Las herramientas de terminal viven con el módulo** (`cli/`) y se exponen como `npm run …` en `package.json`. No se dejan scripts sueltos de un solo uso: si sirvió una vez para una tarea o captura, se borra.

## Agregar un módulo

1. Crear `src/modules/<modulo>/` con `modulo.ts` y `rutas.ts` (tomar `contabilidad` como modelo) y las carpetas que necesite de la lista de arriba. Solo se crean las que se usan.
2. Registrar el manifiesto en `src/erp/modulos.ts`. Aparece solo en el menú.
3. Páginas en `src/app/(erp)/<modulo>/` (con `loading.tsx`) y endpoints en `src/app/api/<modulo>/`.
4. Si guarda datos: migración nueva con su propio schema, RLS activado y permisos por rol; exponer el schema en Supabase → *Project Settings → Data API → Exposed schemas*.
5. Ajustes del módulo, si los hay: una sección en `src/app/(erp)/configuracion/page.tsx`.
6. Pruebas en `src/modules/<modulo>/tests/`. `npm test`, `npm run typecheck` y `npm run lint` deben quedar en verde.

## Dónde poner algo nuevo (guía rápida)

| Quiero… | Va en… |
|---|---|
| Una regla contable o cálculo | `core/` (con su prueba) |
| Hablar con un servicio externo | carpeta propia (`drive/`, `ai/`…) |
| Leer o escribir en la base de datos | `repo/` o `services/` |
| Un proceso (sincronizar, procesar…) | `services/` |
| Una pantalla o componente | `ui/` |
| La lógica de un endpoint | `api/` + ruta delgada en `src/app/api/<modulo>/` |
| Un comando de terminal | `cli/` + entrada en `package.json` |
| Un cambio en la base de datos | migración nueva en `supabase/migrations/` |
