// Rutas de las páginas del módulo. Todo enlace interno sale de aquí, para que
// el módulo pueda montarse bajo otra ruta base al integrarlo en otro ERP.

export const BASE_CONTABILIDAD = "/contabilidad";

export const rutas = {
  inicio: BASE_CONTABILIDAD,
  documentos: `${BASE_CONTABILIDAD}/documentos`,
  /** Pestaña "Por revisar" de Documentos. */
  revision: `${BASE_CONTABILIDAD}/documentos?vista=revisar`,
  /** Pestaña "Todos" de Documentos. */
  todos: `${BASE_CONTABILIDAD}/documentos?vista=todos`,
  documento: (id: number) => `${BASE_CONTABILIDAD}/documentos/${id}`,
  reportes: `${BASE_CONTABILIDAD}/reportes`,
  /** Configuración general del ERP (fuera del módulo), sección de contabilidad. */
  configuracion: "/configuracion#contabilidad",
} as const;
