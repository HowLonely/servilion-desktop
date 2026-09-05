import {
  asciiText,
  dots,
  formatDate,
  formatDateTime,
  formatWeight,
  SEPARATOR,
  truncate,
} from "./text";
import { receiptScanCode } from "./zpl";

import type { PrinterConfig, ReceiptPrintJob, WeighPrintJob } from "../../shared/types";

/**
 * EPL2 — *Eltron Programming Language*, versión 2.
 *
 * Ojo con el nombre: **EPL no es Epson**. Es de Eltron, que Zebra compró, y por
 * eso vive en las etiqueteras de escritorio anteriores a ZPL (LP2844, TLP2844 y
 * la larga cola de equipos de segunda mano que siguen dando vueltas en planta).
 * Los dos nombres se confunden todo el tiempo justamente porque suenan igual.
 *
 * Está acá para no obligar a comprar una impresora nueva antes de poder usar el
 * sistema. Si el equipo habla ZPL, se usa ZPL: es más preciso y está probado.
 *
 * **El QR es lo dudoso de este lenguaje.** El comando `b ... Q` existe en EPL2
 * pero su soporte depende del firmware del modelo, y cuando falta la impresora
 * ignora la línea sin avisar. Por eso, igual que en ESC/POS, el código de
 * entrega va siempre también en texto grande: si el símbolo no sale, la entrega
 * se tipea y nadie se queda esperando.
 */

/** Alto de cada fuente EPL en puntos, a 203 dpi. Índice = número de fuente. */
const FONT_HEIGHT = { 1: 12, 2: 16, 3: 20, 4: 24, 5: 48 } as const;

type Font = keyof typeof FONT_HEIGHT;

/**
 * EPL no escala tipografía por tamaño: elige una de cinco fuentes y la
 * multiplica en horizontal y vertical por enteros. Acá se traduce el alto que
 * pide el layout al par (fuente, multiplicador) que más se le acerca sin
 * pasarse, para que los tres lenguajes se puedan describir con las mismas
 * medidas en milímetros.
 */
function fontFor(heightDots: number): { font: Font; multiplier: number } {
  let best: { font: Font; multiplier: number } = { font: 1, multiplier: 1 };
  let bestDelta = Number.POSITIVE_INFINITY;

  for (const font of [1, 2, 3, 4, 5] as Font[]) {
    for (let multiplier = 1; multiplier <= 6; multiplier += 1) {
      const delta = Math.abs(FONT_HEIGHT[font] * multiplier - heightDots);
      if (delta < bestDelta) {
        bestDelta = delta;
        best = { font, multiplier };
      }
    }
  }
  return best;
}

/** `A x,y,rot,font,hMul,vMul,reverse,"texto"` */
function text(x: number, y: number, heightDots: number, value: string): string {
  const { font, multiplier } = fontFor(heightDots);
  return `A${x},${y},0,${font},${multiplier},${multiplier},N,"${asciiText(value)}"`;
}

/** `B x,y,rot,tipo,narrow,wide,alto,HRI,"dato"`. Tipo `1` es Code 128 automático. */
function code128(x: number, y: number, heightDots: number, value: string): string {
  return `B${x},${y},0,1,2,4,${heightDots},N,"${asciiText(value)}"`;
}

/**
 * `b x,y,Q,m2,s<n>,e<L|M|Q|H>,"dato"` — símbolo QR, modelo 2.
 *
 * `s` es la escala del módulo, no el tamaño final: el símbolo crece con el
 * largo del dato. Se pide corrección M por lo mismo que en ESC/POS —esta
 * etiqueta no pasa por el lavado— y se deja en una sola línea porque los
 * modelos que no soportan 2D descartan el comando completo, no medio.
 */
function qr(x: number, y: number, scale: number, value: string): string {
  return `b${x},${y},Q,m2,s${Math.min(9, Math.max(1, scale))},eM,"${asciiText(value)}"`;
}

/** Cabecera de una etiqueta: limpiar buffer y fijar ancho y alto del troquel. */
function open(printer: PrinterConfig, heightMm: number): string[] {
  return [
    "N",
    `q${dots(printer.labelWidthMm, printer.dpi)}`,
    // El segundo valor es el gap entre etiquetas. 24 puntos (~3 mm) es el
    // troquel estándar del rollo; si el rollo real difiere, la impresora lo
    // corrige sola al calibrar con el botón de avance.
    `Q${dots(heightMm, printer.dpi)},24`,
  ];
}

export function buildWeighEpl(job: WeighPrintJob, printer: PrinterConfig): string {
  const { dpi } = printer;
  const margin = dots(2, dpi);
  const at = (mm: number): number => margin + dots(mm, dpi);
  const origin = [truncate(asciiText(job.faena), 20), truncate(asciiText(job.company_name), 20)]
    .filter(Boolean)
    .join(SEPARATOR);

  const labels = job.labels.map((label) =>
    [
      ...open(printer, printer.labelHeightMm),
      code128(margin, at(0), dots(9, dpi), label.code),
      text(margin, at(11), dots(4.5, dpi), label.code),
      text(
        margin,
        at(16),
        dots(2.6, dpi),
        truncate(job.is_contractor ? `${origin}${SEPARATOR}CONTRATISTA` : origin, 46),
      ),
      "P1",
    ].join("\n"),
  );

  const master = [
    ...open(printer, printer.labelHeightMm * 2),
    text(margin, at(0), dots(3, dpi), "PESAJE - DIGITALIZAR"),
    text(margin, at(4), dots(7, dpi), job.reference),
    code128(margin, at(13), dots(10, dpi), job.reference),
    text(margin, at(25), dots(3.4, dpi), truncate(asciiText(job.client_name), 34)),
    text(margin, at(29.5), dots(3.4, dpi), truncate(asciiText(job.company_name), 34)),
    text(
      margin,
      at(34),
      dots(2.8, dpi),
      `${job.is_contractor ? "CONTRATISTA" : "MANDANTE"}${SEPARATOR}${truncate(asciiText(job.faena), 24)}`,
    ),
    text(margin, at(39), dots(5, dpi), `${job.garment_count} PRENDAS  ${formatWeight(job.weight_kg)} KG`),
    text(
      margin,
      at(46),
      dots(2.6, dpi),
      `${formatDateTime(job.weighed_at)}${SEPARATOR}${truncate(asciiText(job.weighed_by_name), 24)}`,
    ),
    "P1",
  ].join("\n");

  return [...labels, master].join("\n");
}

export function buildReceiptEpl(job: ReceiptPrintJob, printer: PrinterConfig): string {
  const { dpi } = printer;
  const margin = dots(3, dpi);
  const at = (mm: number): number => margin + dots(mm, dpi);
  // Mismo criterio que en ZPL: el alto se calcula desde dónde cae el pie, para
  // que el detalle nunca quede fuera de la etiqueta.
  const itemMm = 4.2;
  const itemsTopMm = 99;
  const footerMm = itemsTopMm + job.items.length * itemMm + 1;

  const scanCode = receiptScanCode(job);
  const destination =
    [asciiText(job.camp), asciiText(job.room)].filter(Boolean).join(SEPARATOR) || "SIN DESTINO";
  const origin = truncate(
    [truncate(asciiText(job.faena), 20), truncate(asciiText(job.company_name), 20)]
      .filter(Boolean)
      .join(SEPARATOR),
    job.is_contractor ? 32 : 46,
  );

  return [
    ...open(printer, footerMm + 6),
    text(margin, at(0), dots(3, dpi), "BOLETA - MORRAL LIMPIO"),
    text(margin, at(4), dots(8, dpi), asciiText(job.reference) || "S/REF"),
    code128(margin, at(14), dots(11, dpi), scanCode),
    text(margin, at(26.5), dots(2.6, dpi), `PISTOLEAR PARA CERRAR Y DESPACHAR${SEPARATOR}${scanCode}`),

    text(margin, at(32.5), dots(2.6, dpi), "TRABAJADOR"),
    text(margin, at(36), dots(4.6, dpi), truncate(asciiText(job.worker_name).toUpperCase(), 26) || "-"),
    text(
      margin,
      at(41.5),
      dots(2.8, dpi),
      [job.national_id || "Sin RUT", job.shift && `Turno ${job.shift}`]
        .filter(Boolean)
        .map((part) => asciiText(String(part)))
        .join(SEPARATOR),
    ),

    text(margin, at(46.5), dots(2.6, dpi), "ENTREGAR EN"),
    text(margin, at(50), dots(4.6, dpi), truncate(destination.toUpperCase(), 26)),

    qr(margin, at(59), Math.max(3, Math.round((5 * dpi) / 203)), job.qr_payload),
    text(margin + dots(24, dpi), at(61), dots(2.6, dpi), "CODIGO DE ENTREGA"),
    text(margin + dots(24, dpi), at(65), dots(4.6, dpi), asciiText(job.qr_payload) || "-"),
    text(margin + dots(24, dpi), at(71), dots(2.8, dpi), `ENTREGA ${formatDate(job.promised_at)}`),

    text(
      margin,
      at(83),
      dots(2.8, dpi),
      `OT ${asciiText(job.order_number ?? "") || "S/N"}${SEPARATOR}CONTROL ${asciiText(job.control_code) || "-"}`,
    ),
    text(
      margin,
      at(87.5),
      dots(4, dpi),
      `${job.garment_count} PRENDAS${job.weight_kg !== null ? `  ${formatWeight(job.weight_kg)} KG` : ""}`,
    ),

    text(margin, at(95), dots(2.6, dpi), "DETALLE DECLARADO"),
    ...job.items.map((item, index) =>
      text(
        margin,
        at(itemsTopMm + index * itemMm),
        dots(3.2, dpi),
        `${item.quantity} x ${truncate(asciiText(item.name).toUpperCase(), 30)}`,
      ),
    ),
    text(
      margin,
      at(footerMm),
      dots(2.6, dpi),
      job.is_contractor ? `${origin}${SEPARATOR}CONTRATISTA` : origin,
    ),
    "P1",
  ].join("\n");
}
