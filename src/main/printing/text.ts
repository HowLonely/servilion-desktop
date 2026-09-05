/**
 * Utilidades de texto y medida compartidas por los tres lenguajes de impresión.
 *
 * Viven aparte porque no dependen de ninguno: transliterar "PEÑÓN" a ASCII o
 * pasar milímetros a puntos del cabezal es lo mismo para ZPL, ESC/POS y EPL. Lo
 * que cambia entre lenguajes es cómo se dibuja, no qué dice.
 */

/** Milímetros a puntos del cabezal: 203 dpi son 8 puntos/mm; 300 dpi, ~11.8. */
export function dots(mm: number, dpi: number): number {
  return Math.round((mm * dpi) / 25.4);
}

/**
 * Deja el texto en ASCII imprimible.
 *
 * El payload viaja al puerto como bytes latin1, y la impresora lo lee con su
 * propia tabla de caracteres (CP850 o CP437 según el modelo): cualquier byte
 * sobre 127 se dibuja como otra cosa. Un "PEÑÓN" mandado tal cual sale con
 * símbolos raros, y el punto medio de "FAENA · EMPRESA" sale como un trozo de
 * recuadro. Por eso se translitera todo en vez de confiar en la tabla de la
 * impresora: "PENON" y "FAENA - EMPRESA" se leen perfecto en un adhesivo de
 * 50 mm y en un rollo de boleta de 80.
 *
 * Se quitan además los caracteres que los lenguajes interpretan: `^` y `~` en
 * ZPL, y las comillas dobles en EPL, que cierran el campo de texto antes de
 * tiempo. Se hace acá y no en cada lenguaje porque un dato que pasó por este
 * filtro es seguro para los tres, y así ninguno puede olvidarse de uno.
 */
export function asciiText(value: string): string {
  return value
    .normalize("NFD")
    // Rango de diacriticos combinantes: tras NFD, la tilde de "Penon" y el
    // acento de "Antofagasta" quedan como marca suelta y se descartan aqui.
    .replace(/[\u0300-\u036f]/g, "")
    // Separadores y comillas tipograficas que el catalogo trae pegados.
    .replace(/[\u00b7\u2022]/g, "-")
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\^~"]/g, " ")
    // Lo que quede fuera de ASCII imprimible no tiene traduccion fiable: se
    // descarta antes que imprimir un simbolo que confunda al operador.
    .replace(/[^\x20-\x7e]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Separador entre faena y empresa. ASCII, por lo mismo que `asciiText`. */
export const SEPARATOR = " - ";

/** Zona de la planta. Los tres lenguajes imprimen la misma hora que la app. */
const TIME_ZONE = "America/Santiago";

function parts(value: string, options: Intl.DateTimeFormatOptions): Record<string, string> {
  return new Intl.DateTimeFormat("es-CL", { timeZone: TIME_ZONE, ...options })
    .formatToParts(new Date(value))
    .reduce<Record<string, string>>((acc, part) => {
      acc[part.type] = part.value;
      return acc;
    }, {});
}

/**
 * Fecha y hora del pesaje, en 24 h.
 *
 * Mismo formato que usa la app (`lib/date.ts`): en el ticket se contrasta contra
 * la pantalla, así que no pueden verse distintos. Se arma con `formatToParts` en
 * vez de `toLocaleString` porque el locale chileno devuelve "11:04 a. m.", que
 * en un adhesivo ocupa el doble y se lee peor.
 */
export function formatDateTime(value: string): string {
  const p = parts(value, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${p.day}-${p.month}-${p.year} ${p.hour}:${p.minute}`;
}

/** Solo la fecha: la entrega tentativa es un día, no una hora. */
export function formatDate(value: string | null): string {
  if (!value) return "-";
  const p = parts(value, { day: "2-digit", month: "2-digit", year: "numeric" });
  return `${p.day}-${p.month}-${p.year}`;
}

/** Coma decimal: es como se escribe un peso en Chile y como lo muestra la app. */
export function formatWeight(kg: number): string {
  return String(kg).replace(".", ",");
}

export function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}.`;
}
