# Instalación, traspaso y desarrollo · Paguro ERP

Guía para recibir el proyecto desde GitHub, ponerlo a funcionar en otro computador y seguir desarrollándolo **sin perder ni alterar la contabilidad existente**. La visión general (arquitectura, servicios, IA) está en `docs/tecnico/Documento-tecnico-Paguro-ERP.pdf`; el mapa del código y los comandos, en `README.md`.

---

## 1. Qué viaja con GitHub y qué no

| Componente | ¿Viene en el repositorio? | Cómo se obtiene |
|---|---|---|
| Código, migraciones, pruebas, scripts, documentación | ✅ Sí | `git clone` |
| **Datos contables** (documentos, asientos, usuarios del sistema) | No hace falta | Viven en **Supabase (nube)**. Cualquier PC que se conecte con las mismas claves ve los mismos datos. Nada se pierde al cambiar de PC |
| Documentos soporte | No | Siguen en **Google Drive** |
| **Claves y configuración** (`.env.local`) | ❌ No (a propósito) | Se entrega por un canal seguro (sección 4) |
| Dependencias (`node_modules`) y compilación (`.next`) | ❌ No | `npm ci` y `npm run build` |
| Vínculo de la CLI de Supabase (`supabase/.temp`) | ❌ No | `npx supabase link` (sección 5) |
| Sesión de Google para leer el Drive | ❌ No | Cada persona o PC hace `gcloud auth application-default login` (sección 6) |
| Respaldos (`respaldos/`) | ❌ No (tienen datos reales) | `npm run respaldo` |
| Cuentas de Supabase, Google Cloud, Anthropic y GitHub | ❌ No | Invitaciones y roles (sección 2) |

## 2. Cuentas, servicios y quién debe tener acceso

| Servicio | Para qué | Dónde está | Quién necesita acceso |
|---|---|---|---|
| **GitHub** | Código | Repositorio **privado** (idealmente en una organización de la empresa) | Joseph: dueño. Desarrolladores: colaborador con escritura |
| **Supabase** | Base de datos, usuarios y permisos | Organización «Paguro Corp», proyecto `grsuvasppmydwxdwreov` (São Paulo) | Joseph: Owner. Desarrolladores: Developer. Las claves del proyecto van en `.env.local` |
| **Google Workspace** (`pagurocorp.com`) | Drive con los soportes y control de sesión | Admin console de Google | Joseph (administrador): ajusta la duración de la sesión (sección 7) |
| **Google Cloud** | Robot de solo lectura del Drive | Proyecto `paguro-contabilidad-03sb`, cuenta de servicio `lector-facturas@paguro-contabilidad-03sb.iam.gserviceaccount.com` | Quien encienda el sistema debe tener el rol **Service Account Token Creator** sobre esa cuenta (hoy: joseph@pagurocorp.com) |
| **Carpeta del Drive** (`02_2026`) | Soportes contables | Mi unidad de joseph@pagurocorp.com | El robot `lector-facturas@…` con permiso de **Lector** (ya compartida) |
| **Anthropic (Claude Console)** | IA que lee los documentos | console.anthropic.com | Joseph: dueño de la organización y la facturación. La clave va en `.env.local` |
| datos.gov.co (TRM) | Tasa de cambio oficial para facturas en USD | Servicio público | Nadie: no requiere cuenta |

> ⚠ **Antes de entregar:** la clave de Claude actual se creó en una cuenta personal y se compartió durante el desarrollo. Crea una nueva en la organización de la empresa (sección 8), ponla en `.env.local` y borra la anterior.

---

## 3. Requisitos del computador

| Programa | Versión | Comprobar |
|---|---|---|
| Node.js | 24 (LTS) | `node -v` |
| Git | cualquiera reciente | `git --version` |
| Google Cloud CLI | cualquiera reciente | `gcloud --version` |
| Microsoft Edge | el de Windows | Solo para las capturas y los PDF de la documentación |

El sistema está probado en **Windows 11**. En Mac o Linux funciona igual, salvo `iniciar-paguro.bat` (usar `npm start`) y los scripts de capturas y PDF (usan Edge).

## 4. Clonar y configurar

```bash
git clone https://github.com/DaironChapid/PaguroERP.git paguro-erp
cd paguro-erp
npm ci
```

`npm ci` instala exactamente las versiones de `package-lock.json`. Debe terminar con `found 0 vulnerabilities`.

### Variables de entorno (`.env.local`)

1. Copia la plantilla: `copy .env.example .env.local` (Windows) o `cp .env.example .env.local`.
2. Completa los valores. Para **conectar la base de datos existente**, usa los mismos valores del `.env.local` actual: así se ven todos los datos sin migrar nada.

| Variable | De dónde sale |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Supabase → *Project Settings → API Keys* |
| `SUPABASE_DB_PASSWORD` | Supabase → *Project Settings → Database* (solo para la CLI) |
| `ANTHROPIC_API_KEY` | Claude Console → *API Keys* (sección 8) |
| `DRIVE_ROOT_FOLDER_ID` | URL de la carpeta `02_2026` en el Drive: lo que va después de `/folders/` |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | `lector-facturas@paguro-contabilidad-03sb.iam.gserviceaccount.com` |
| `PAGURO_NIT` | `901937774-2` |
| `CONTABILIDAD_INTERNAL_TOKEN` | Generar uno: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

Las variables opcionales están comentadas en `.env.example`. **No las dejes vacías**: descoméntalas solo si las vas a usar. Una variable vacía no equivale a una ausente (por ejemplo, `AI_EFFORT=` vacío hace fallar la IA).

> 🔒 **Entrega segura de las claves:** usa un gestor de contraseñas compartido o pásalas en persona o por USB. Nunca por chat, correo ni dentro del repositorio. `.gitignore` ya excluye todos los `.env*` salvo `.env.example`. Si una clave se filtra, revócala en su servicio y crea otra: el código solo lee la variable.

### Compilar

```bash
npm run build
```

> ⚠ **Primero `.env.local`, después `npm run build`.** Las variables `NEXT_PUBLIC_*` (las que usan el login y el cierre de sesión en el navegador) se graban dentro de la compilación. Si compilas sin ellas, la app arranca pero no deja entrar. Si cambias esas variables, vuelve a compilar.

## 5. Base de datos (Supabase)

**La base de datos ya existe y está al día:** las 11 migraciones del repositorio están aplicadas en la nube (verificado con `npx supabase migration list --remote`). Para usar el sistema no hay que correr ninguna migración.

Comprobar la conexión:

```bash
npm run verificar
```

Debe mostrar las tablas con filas y terminar en `✔ un visitante anónimo no puede leer facturas`.

**Para aplicar migraciones futuras** hay que vincular la CLI (una sola vez por computador):

```bash
npx supabase login                                   # abre el navegador: cuenta con acceso al proyecto
npx supabase link --project-ref grsuvasppmydwxdwreov  # pide SUPABASE_DB_PASSWORD
npx supabase migration list --remote                 # columnas "local" y "remote" iguales = al día
```

> No uses `supabase config push`: el `supabase/config.toml` del repositorio es para desarrollo local y sobrescribiría ajustes del proyecto en la nube.

## 6. Permiso para leer Google Drive

La organización de Google de Paguro **prohíbe las llaves de cuentas de servicio** (política `iam.disableServiceAccountKeyCreation`). Por eso el sistema lee el Drive **suplantando** al robot `lector-facturas@…`, a partir de la sesión de Google de una persona autorizada:

```
Persona (gcloud ADC) ──rol Token Creator──▶ robot lector-facturas ──Lector──▶ carpeta 02_2026
```

1. Iniciar sesión, con una cuenta que tenga el rol Token Creator (hoy joseph@pagurocorp.com):
   ```bash
   gcloud auth application-default login
   ```
   Si la terminal responde *«no se encontró Python»*, usa la ruta completa: `"%LOCALAPPDATA%\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd" auth application-default login`. El aviso *«Cannot find a quota project»* es inofensivo.
2. Comprobar (no gasta IA):
   ```bash
   npm run probar-drive
   ```
   Debe listar los archivos de la carpeta.

**Dar acceso a otra persona** (lo ejecuta alguien con permisos de administración en el proyecto de Google Cloud):

```bash
gcloud iam service-accounts add-iam-policy-binding lector-facturas@paguro-contabilidad-03sb.iam.gserviceaccount.com --project paguro-contabilidad-03sb --member="user:correo@pagurocorp.com" --role="roles/iam.serviceAccountTokenCreator"
```

**Leer otra carpeta:** comparte la carpeta con `lector-facturas@…` como **Lector** y pon su ID en `DRIVE_ROOT_FOLDER_ID`.

## 7. El vencimiento de la autenticación de Google

**Síntoma:** en *Documentos* aparece *«No se pudo revisar el Drive. Google pide volver a iniciar sesión…»* (en la terminal: `invalid_grant` / `invalid_rapt`). Lo ya registrado sigue disponible; solo se detiene la lectura de documentos nuevos.

**Causa:** el *control de sesión de Google Cloud* de Google Workspace obliga a volver a autenticarse cada cierto tiempo, y eso invalida el inicio de sesión del paso 6.

**Soluciones, de la más simple a la más permanente:**

1. **Volver a iniciar sesión** (paso 6). Toma un minuto, pero se repetirá.
2. **Ajustar la política (recomendado).** El administrador de Google Workspace entra a *Admin console → Seguridad → Control de acceso y datos → Control de sesión de Google Cloud* y, para la unidad organizativa de la cuenta que enciende el sistema, elige no exigir reautenticación o la frecuencia más larga disponible. No cambia la seguridad de las demás aplicaciones de Google.
3. **Llave de la cuenta de servicio (no vence).** Solo si la empresa lo acepta: crear una excepción de la política `iam.disableServiceAccountKeyCreation` **únicamente** en el proyecto `paguro-contabilidad-03sb`, generar una llave JSON para `lector-facturas@…` y pegarla en una sola línea en `GOOGLE_SERVICE_ACCOUNT_JSON`. El código ya la soporta y le da prioridad. La llave da acceso de lectura al Drive compartido: hay que guardarla como cualquier otra clave y rotarla periódicamente.

## 8. Conectar la API de Claude

1. En **console.anthropic.com**, con la cuenta de la empresa: crea o elige la organización, agrega un método de pago o créditos en *Billing* y, si quieres, un límite de gasto mensual en *Limits*.
2. *API Keys → Create key*. Cópiala en `ANTHROPIC_API_KEY`.
3. Comprobar (gasta unos 8 000 tokens con una factura ficticia):
   ```bash
   npm run probar-ia
   ```
   Debe mostrar los datos extraídos y `confianza_general` cerca de 0.95.

El modelo se elige con `AI_MODEL` (por defecto `claude-sonnet-5-5`; `claude-haiku-5-5` es más barato y menos preciso). Cada documento consume unos 8 000 tokens de entrada; el consumo queda registrado en la tabla `procesamientos`. Si se acaban los créditos, los archivos quedan en error y se reintentan solos hasta 5 veces; después, `npm run reintentar`.

## 9. Usuarios y primer arranque

```bash
npm run acceso -- joseph@pagurocorp.com admin "Joseph"
```

Pide la contraseña en la terminal. Roles: `admin` (todo), `editor` (revisar y aprobar), `lector` (consultar). El mismo comando cambia el rol de un usuario existente.

**Encender para el uso diario:** doble clic en `iniciar-paguro.bat`. Enciende la versión compilada y abre <http://localhost:3000>. Para que arranque con Windows: `Win + R` → `shell:startup` → crear ahí un acceso directo al `.bat`.

## 10. Pruebas

| Comando | Necesita | Qué comprueba |
|---|---|---|
| `npm test` | Nada | 120 pruebas de reglas contables y de las migraciones (en una base de datos en memoria) |
| `npm run typecheck` · `npm run lint` | Nada | Tipos y estilo del código |
| `npm run verificar` · `npm run probar-drive` · `npm run probar-ia` | `.env.local` | Cada conexión externa |
| `npm run prueba:interfaz` | App encendida | Todas las pantallas, permisos por rol y los enlaces de los 9 reportes |
| `npm run prueba:flujo` | App encendida | Corregir, aprobar, reabrir y rechazar un documento de prueba; asiento cuadrado y saldos iniciales |

Las dos últimas crean un usuario y un documento de prueba **temporales** y los borran al final, aunque fallen. Si la app no está en el puerto 3000, indica la dirección antes del comando: `set URL_APP=http://localhost:3200` (cmd) o `$env:URL_APP="http://localhost:3200"` (PowerShell).

> Verificado el 21-nov-2026 sobre un **clon limpio** del repositorio: `npm ci`, `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm start`, `prueba:interfaz` y `prueba:flujo` pasan.

---

## 11. Desarrollar sin afectar la contabilidad existente

Con el `.env.local` de producción, **cualquier copia del sistema trabaja sobre los datos reales**: aprueba, corrige y lee documentos de verdad. Para desarrollar con tranquilidad:

**Recomendado: un proyecto de desarrollo separado.**
1. En Supabase, crea un segundo proyecto (por ejemplo `paguro-erp-desarrollo`; el plan gratuito sirve).
2. Créale la base de datos completa con las migraciones del repositorio (crean tablas, permisos, plan de cuentas, categorías y configuración):
   ```bash
   npx supabase link --project-ref <ref-de-desarrollo>
   npx supabase db push --remote
   ```
3. En ese proyecto: *Project Settings → Data API → Exposed schemas* → agrega `contabilidad`.
4. En el computador de desarrollo, `.env.local` apunta al proyecto de desarrollo y `DRIVE_ROOT_FOLDER_ID` a una **carpeta de prueba** del Drive (compartida con `lector-facturas@…`), con copias de algunos soportes.
5. Crea tu usuario con `npm run acceso` y trabaja normal.

**Si tienes que conectarte a producción desde desarrollo:** pon `SYNC_AUTOMATICA=off` en `.env.local` para que tu copia no procese documentos por su cuenta, y no corras `reprocesar`, `procesar` ni `reintentar` salvo que sea la intención.

Guarda las configuraciones como `.env.desarrollo` y `.env.produccion` (están ignoradas por git) y copia la que necesites sobre `.env.local`.

### Cambios en la base de datos (migraciones)

Toda modificación de tablas va en un archivo nuevo en `supabase/migrations/` con fecha al inicio (`AAAAMMDDHHMMSS_descripcion.sql`). Nunca edites una migración ya aplicada. Orden seguro:

1. Pruébala en el proyecto de **desarrollo** y corre `npm test` (incluye las migraciones).
2. Respaldo de producción: `npm run respaldo`. Exporta todas las tablas a JSON en `respaldos/`, sin Docker y solo leyendo. Para un respaldo SQL completo y restaurable: instala Docker Desktop y usa `npx supabase db dump --remote -f respaldo.sql`. Supabase también tiene copias automáticas según el plan contratado.
3. Vincula producción y revisa **qué** se aplicaría: `npx supabase db push --remote --dry-run`. La primera línea debe decir `Target: project paguro-contabilidad (grsuvasppmydwxdwreov) · production`.
4. Aplica: `npx supabase db push --remote`.
5. Si cambiaron tablas: `npm run db:tipos` regenera los tipos de TypeScript (`src/modules/contabilidad/repo/tipos-db.ts`).

## 12. Publicar cambios

**Quien desarrolla:**

```bash
git switch -c mejora-x            # una rama por cambio
# … cambios …
npm test && npm run typecheck && npm run lint
git add -A && git commit -m "Describe el cambio"
git push -u origin mejora-x       # abrir un Pull Request en GitHub y unirlo a main
```

**En el computador donde se usa el sistema**, después de unir el cambio a `main`:

```bash
git pull
npm ci
# si el cambio trae migraciones nuevas: sección 11 (respaldo → dry-run → push)
npm run build
```

Luego cierra la ventana de `iniciar-paguro.bat`, vuelve a abrirla y corre `npm run prueba:interfaz` y `npm run prueba:flujo`.

**Si el manual o el documento técnico cambian:** con la app encendida, `npm run capturas:manual`, `npm run manual:pdf` y `npm run tecnico:pdf`.

## 13. Crear el repositorio en GitHub (una sola vez)

1. En GitHub: *New repository* → **Private** → sin README ni `.gitignore` (ya existen).
2. En la carpeta del proyecto:
   ```bash
   git init -b main
   git add -A
   git status        # comprobar que NO aparece .env.local
   git commit -m "Paguro ERP: módulo de contabilidad"
   git remote add origin https://github.com/<organizacion>/<repositorio>.git
   git push -u origin main
   ```
3. *Settings → Collaborators* (o equipos de la organización): agrega a Joseph como administrador.

---

## Problemas comunes

| Síntoma | Causa y solución |
|---|---|
| La página no abre | El sistema está apagado: abre `iniciar-paguro.bat`. |
| El login no funciona después de instalar | Se compiló antes de crear `.env.local`: `npm run build` y reiniciar. |
| *«Another next dev server is already running»* o el puerto está ocupado | Hay otra copia encendida: cierra sus ventanas o reinicia el PC. |
| `npm run typecheck` muestra `Cannot find name 'PageProps'` | Se corrió `tsc` directamente: usa `npm run typecheck`, que primero genera los tipos de las rutas. |
| *«No se pudo revisar el Drive»* | Sección 7. |
| Archivos con error *«sin créditos»* | Recarga créditos en Claude Console (sección 8). |
| Un documento no aparece | En *Documentos*, abre el aviso de archivos que no se leen (formato, contraseña o carpeta). |
| `supabase db dump` pide Docker | Usa `npm run respaldo` o instala Docker Desktop. |
