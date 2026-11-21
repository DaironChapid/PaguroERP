import { GoogleAuth, Impersonated, type AuthClient } from "google-auth-library";

// Cliente mínimo de Google Drive v3 (solo lectura) sobre fetch.
// Autenticación, en orden de prioridad:
//   1. GOOGLE_SERVICE_ACCOUNT_JSON: llave de la cuenta de servicio.
//   2. GOOGLE_SERVICE_ACCOUNT_EMAIL: suplantación sin llave a partir de las
//      credenciales por defecto de la máquina (gcloud auth application-default login,
//      o federación de identidad cuando se despliegue).

const API = "https://www.googleapis.com/drive/v3";
const SCOPE_DRIVE = "https://www.googleapis.com/auth/drive.readonly";
const MIME_CARPETA = "application/vnd.google-apps.folder";

export interface ArchivoDrive {
  id: string;
  nombre: string;
  mime: string;
  md5: string | null;
  tamanoBytes: number | null;
  modificado: string | null;
  url: string | null;
  /** Carpetas desde la raíz (sin incluirla), por ejemplo ["02_2026", "03_marzo"]. */
  ruta: string[];
}

interface RespuestaLista {
  nextPageToken?: string;
  files: {
    id: string;
    name: string;
    mimeType: string;
    md5Checksum?: string;
    size?: string;
    modifiedTime?: string;
    webViewLink?: string;
  }[];
}

export class ErrorDrive extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = "ErrorDrive";
  }
}

async function crearClienteAuth(): Promise<AuthClient> {
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (json) {
    return new GoogleAuth({ credentials: JSON.parse(json), scopes: [SCOPE_DRIVE] }).getClient();
  }
  const cuenta = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  if (!cuenta) {
    throw new ErrorDrive("Falta configurar GOOGLE_SERVICE_ACCOUNT_EMAIL o GOOGLE_SERVICE_ACCOUNT_JSON");
  }
  const origen = await new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] }).getClient();
  return new Impersonated({
    sourceClient: origen,
    targetPrincipal: cuenta,
    targetScopes: [SCOPE_DRIVE],
    lifetime: 3600,
    delegates: [],
  });
}

export class ClienteDrive {
  private auth: Promise<AuthClient> | null = null;

  private async token(): Promise<string> {
    this.auth ??= crearClienteAuth();
    const { token } = await (await this.auth).getAccessToken();
    if (!token) throw new ErrorDrive("No se pudo obtener un token de acceso para Google Drive");
    return token;
  }

  private async pedir(ruta: string, parametros: Record<string, string> = {}): Promise<Response> {
    const url = new URL(`${API}${ruta}`);
    for (const [k, v] of Object.entries({ supportsAllDrives: "true", ...parametros })) url.searchParams.set(k, v);

    for (let intento = 0; ; intento++) {
      const respuesta = await fetch(url, { headers: { Authorization: `Bearer ${await this.token()}` } });
      if (respuesta.ok) return respuesta;
      // Reintento con espera exponencial ante límites de tasa o errores del servidor.
      if ((respuesta.status === 429 || respuesta.status >= 500) && intento < 4) {
        await new Promise((r) => setTimeout(r, 1000 * 2 ** intento));
        continue;
      }
      const cuerpo = await respuesta.text();
      throw new ErrorDrive(`Drive respondió ${respuesta.status}: ${cuerpo.slice(0, 300)}`, respuesta.status);
    }
  }

  /** Metadatos de un archivo o carpeta. */
  async obtener(id: string): Promise<{ id: string; name: string; mimeType: string }> {
    const r = await this.pedir(`/files/${encodeURIComponent(id)}`, { fields: "id,name,mimeType" });
    return r.json();
  }

  /** Recorre recursivamente la carpeta raíz y devuelve todos los archivos (no carpetas). */
  async *recorrer(raizId: string): AsyncGenerator<ArchivoDrive> {
    const pendientes: { id: string; ruta: string[] }[] = [{ id: raizId, ruta: [] }];
    while (pendientes.length > 0) {
      const carpeta = pendientes.shift()!;
      let pagina: string | undefined;
      do {
        const r = await this.pedir("/files", {
          q: `'${carpeta.id}' in parents and trashed = false`,
          fields: "nextPageToken,files(id,name,mimeType,md5Checksum,size,modifiedTime,webViewLink)",
          pageSize: "1000",
          includeItemsFromAllDrives: "true",
          ...(pagina ? { pageToken: pagina } : {}),
        });
        const datos = (await r.json()) as RespuestaLista;
        for (const f of datos.files) {
          if (f.mimeType === MIME_CARPETA) {
            pendientes.push({ id: f.id, ruta: [...carpeta.ruta, f.name] });
          } else {
            yield {
              id: f.id,
              nombre: f.name,
              mime: f.mimeType,
              md5: f.md5Checksum ?? null,
              tamanoBytes: f.size ? Number(f.size) : null,
              modificado: f.modifiedTime ?? null,
              url: f.webViewLink ?? null,
              ruta: carpeta.ruta,
            };
          }
        }
        pagina = datos.nextPageToken;
      } while (pagina);
    }
  }

  /**
   * Metadatos actuales de un archivo, con la ruta que se indique.
   * (Drive no le muestra las carpetas padre a una cuenta con acceso compartido,
   * así que la ruta sale del inventario.) null si es una carpeta.
   */
  async obtenerMetadatos(id: string, ruta: string[]): Promise<ArchivoDrive | null> {
    const campos = "id,name,mimeType,md5Checksum,size,modifiedTime,webViewLink";
    const f = (await (await this.pedir(`/files/${encodeURIComponent(id)}`, { fields: campos })).json()) as RespuestaLista["files"][number];
    if (f.mimeType === MIME_CARPETA) return null;
    return {
      id: f.id,
      nombre: f.name,
      mime: f.mimeType,
      md5: f.md5Checksum ?? null,
      tamanoBytes: f.size ? Number(f.size) : null,
      modificado: f.modifiedTime ?? null,
      url: f.webViewLink ?? null,
      ruta,
    };
  }

  /** Descarga el contenido de un archivo. */
  async descargar(id: string): Promise<Buffer> {
    const r = await this.pedir(`/files/${encodeURIComponent(id)}`, { alt: "media" });
    return Buffer.from(await r.arrayBuffer());
  }
}
