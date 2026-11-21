// Normalización y validación de NIT colombianos (y de identificadores
// tributarios extranjeros, que se guardan tal cual en mayúsculas).

const PESOS_DV = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];

export interface NitNormalizado {
  /** Colombia: solo dígitos, sin DV. Exterior: alfanumérico en mayúsculas. */
  numero: string;
  dv: string | null;
  extranjero: boolean;
}

/** Dígito de verificación según el algoritmo de la DIAN (módulo 11). */
export function calcularDv(numero: string): string {
  const digitos = numero.replace(/\D/g, "");
  let suma = 0;
  for (let i = 0; i < digitos.length; i++) {
    const digito = Number(digitos[digitos.length - 1 - i]);
    suma += digito * PESOS_DV[i];
  }
  const residuo = suma % 11;
  return String(residuo >= 2 ? 11 - residuo : residuo);
}

/**
 * Normaliza un NIT tal como aparece en una factura:
 * "900.123.456-7", "900123456-7", "NIT 900 123 456 7", "IE9692928F".
 * Devuelve null si no hay nada utilizable.
 */
export function normalizarNit(valor: string | null | undefined): NitNormalizado | null {
  if (!valor) return null;
  const limpio = valor
    .toUpperCase()
    .replace(/^\s*(NIT|C\.?\s?C\.?|RUT|VAT(\s*(NO|NUMBER))?|TAX\s*ID)\s*[:.#]?\s*/, "")
    .trim();
  if (!limpio) return null;

  // Identificador extranjero: contiene letras.
  if (/[A-Z]/.test(limpio)) {
    const alfanumerico = limpio.replace(/[^0-9A-Z]/g, "");
    return alfanumerico ? { numero: alfanumerico, dv: null, extranjero: true } : null;
  }

  // DV explícito separado por guion: 900123456-7
  const conGuion = limpio.match(/^([\d.\s]+)-\s*(\d)$/);
  if (conGuion) {
    const numero = conGuion[1].replace(/\D/g, "");
    return numero ? { numero, dv: conGuion[2], extranjero: false } : null;
  }

  const digitos = limpio.replace(/\D/g, "");
  if (!digitos) return null;

  // 10 dígitos que empiezan por 8 o 9 (NIT de persona jurídica con DV pegado).
  if (digitos.length === 10 && /^[89]/.test(digitos)) {
    const numero = digitos.slice(0, 9);
    const dv = digitos.slice(9);
    if (calcularDv(numero) === dv) {
      return { numero, dv, extranjero: false };
    }
  }

  // DV separado por espacio al final: "900 123 456 7"
  const partes = limpio.trim().split(/\s+/);
  if (partes.length > 1 && /^\d$/.test(partes[partes.length - 1])) {
    const numero = partes.slice(0, -1).join("").replace(/\D/g, "");
    const dv = partes[partes.length - 1];
    if (numero.length >= 6 && calcularDv(numero) === dv) {
      return { numero, dv, extranjero: false };
    }
  }

  return { numero: digitos, dv: null, extranjero: false };
}

export interface ResultadoValidacionNit {
  valido: boolean;
  motivo?: string;
}

/** Valida un NIT colombiano (6 a 10 dígitos y DV correcto si viene). Los extranjeros solo se validan por longitud. */
export function validarNit(valor: string | null | undefined): ResultadoValidacionNit {
  const nit = normalizarNit(valor);
  if (!nit) return { valido: false, motivo: "NIT vacío" };

  if (nit.extranjero) {
    return nit.numero.length >= 4 && nit.numero.length <= 20
      ? { valido: true }
      : { valido: false, motivo: "Identificador extranjero con longitud inválida" };
  }

  if (nit.numero.length < 6 || nit.numero.length > 10) {
    return { valido: false, motivo: "El NIT debe tener entre 6 y 10 dígitos" };
  }
  if (nit.dv !== null && calcularDv(nit.numero) !== nit.dv) {
    return { valido: false, motivo: `Dígito de verificación incorrecto (esperado ${calcularDv(nit.numero)})` };
  }
  return { valido: true };
}

/** Compara dos NIT ignorando formato y dígito de verificación. */
export function mismoNit(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizarNit(a);
  const nb = normalizarNit(b);
  return !!na && !!nb && na.numero === nb.numero;
}
