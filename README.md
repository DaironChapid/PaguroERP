# Paguro ERP

ERP interno de **Paguro Corp**. Hoy tiene un módulo, **Contabilidad**: lee los soportes contables que se guardan en Google Drive, los interpreta con IA (Claude), los clasifica, valida y contabiliza, y genera los reportes contables con un enlace a cada soporte.

> 🔒 **Repositorio privado.** Contiene datos reales del negocio (migraciones con datos de socios y capturas del manual). Nunca lo hagas público. Las claves **no** están aquí: viven en `.env.local`, que nunca se sube.

## Documentación

| Documento | Para quién | Qué tiene |
|---|---|---|
| [`docs/tecnico/Documento-tecnico-Paguro-ERP.pdf`](docs/tecnico/Documento-tecnico-Paguro-ERP.pdf) | Dueño / quien recibe el proyecto | Qué se construyó, tecnologías, servicios conectados, cómo funciona la IA y qué hace falta para recibirlo |
| [`docs/INSTALACION.md`](docs/INSTALACION.md) | Quien instala o desarrolla | Clonar, configurar, conectar los servicios, probar, publicar cambios |
| [`docs/manual/Manual-de-uso-Paguro-ERP.pdf`](docs/manual/Manual-de-uso-Paguro-ERP.pdf) | Quien usa el sistema | Uso diario, con capturas |
| [`docs/ESTADO.md`](docs/ESTADO.md) | Equipo | Qué está hecho, decisiones contables y pendientes |
| [`docs/PLAN.md`](docs/PLAN.md) | Equipo | Plan y decisiones originales (fase 1) |

## Inicio rápido

Requisitos: Node.js 24, Google Cloud CLI y acceso a las cuentas del proyecto (ver `docs/INSTALACION.md`).

```bash
git clone <url-del-repositorio> paguro-erp
cd paguro-erp
npm ci
cp .env.example .env.local        # y completar los valores (ver INSTALACION.md)
gcloud auth application-default login
npm run dev                       # http://localhost:3000
```

Para usarlo a diario (versión de producción): `npm run build` y luego `iniciar-paguro.bat`.

## Tecnologías

Next.js 16 (App Router, React 19, TypeScript, Tailwind CSS 4) · Supabase (PostgreSQL, Auth, RLS) · Claude API (Anthropic) · Google Drive API · Vitest y PGlite (pruebas) · Playwright (capturas y PDF).

## Organización del código

```
src/
├─ app/                 Rutas de Next.js (delgadas: delegan a los módulos)
│  ├─ (erp)/            Páginas con el menú del ERP (inicio, contabilidad, configuración)
│  └─ api/contabilidad/ Endpoints del módulo
├─ erp/                 Armazón del ERP: registro de módulos, sesión, menú, login
├─ modules/contabilidad/
│  ├─ core/             Reglas contables puras (sin red ni base de datos): validación, asientos, NIT…
│  ├─ ai/               Lectura con Claude: prompt, esquema de respuesta, errores
│  ├─ drive/            Cliente de Google Drive (solo lectura)
│  ├─ trm/              Tasa de cambio oficial (datos.gov.co)
│  ├─ services/         Procesos: sincronizar, procesar, revisar, reloj automático
│  ├─ repo/             Conexión a Supabase y tipos de la base de datos
│  ├─ api/              Lógica de los endpoints y consultas de las páginas
│  ├─ ui/               Componentes de las pantallas
│  ├─ modulo.ts         Manifiesto del módulo (lo que el ERP muestra en el menú)
│  └─ rutas.ts          Rutas del módulo
├─ instrumentation.ts   Arranca la sincronización automática con el servidor
└─ proxy.ts             Refresca la sesión y protege las páginas
supabase/migrations/    Base de datos: tablas, vistas, permisos (RLS), datos iniciales
scripts/                Herramientas de terminal (procesar, respaldar, probar…)
tests/                  Pruebas automáticas
```

### Agregar un módulo nuevo al ERP

1. Crear `src/modules/<modulo>/` con su `modulo.ts` (manifiesto: nombre, ítems del menú) y `rutas.ts`. Tomar `contabilidad` como modelo.
2. Registrar el manifiesto en `src/erp/modulos.ts`.
3. Crear sus páginas en `src/app/(erp)/<modulo>/` (con un `loading.tsx` por carpeta) y sus endpoints en `src/app/api/<modulo>/`.
4. Si guarda datos: una migración nueva en `supabase/migrations/` con su propio schema (por ejemplo `inventario`), RLS activado y permisos por rol, y agregar el schema en Supabase → *Project Settings → Data API → Exposed schemas*.
5. Agregar sus ajustes, si los tiene, como una sección de `src/app/(erp)/configuracion/page.tsx`.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` / `npm start` | Compilar y encender la versión de producción |
| `npm test` | Pruebas de la lógica contable y de las migraciones (no necesita `.env.local`) |
| `npm run typecheck` / `npm run lint` | Tipos y estilo del código |
| `npm run prueba:interfaz` / `npm run prueba:flujo` | Pruebas de pantallas y del flujo completo (con la app encendida) |
| `npm run verificar` / `npm run probar-drive` / `npm run probar-ia` | Verificar la conexión con Supabase, Drive y Claude |
| `npm run respaldo` | Copia de los datos contables en `respaldos/` (no se sube al repositorio) |
| `npm run acceso -- correo rol "Nombre"` | Crear un usuario o cambiar su rol (admin, editor, lector) |
| `npm run sync` / `npm run procesar -- 20` | Revisar el Drive / leer con IA hasta 20 archivos |

La lista completa está en `package.json` y en `docs/INSTALACION.md`.
