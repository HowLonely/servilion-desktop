import {
  asciiText,
  dots,
  formatDate,
  formatDateTime,
  formatWeight,
  SEPARATOR,
  truncate,
} from "./text";

import type { PrinterConfig, ReceiptPrintJob, WeighPrintJob } from "../../shared/types";

/**
 * ZPL — Zebra Programming Language.
 *
 * Es el lenguaje de facto de las **etiqueteras**: Zebra, TSC, Godex, Honeywell y
 * buena parte de la clonería lo hablan o lo emulan. Se manda crudo, sin pasar
 * por el driver ni por `webContents.print()`. En un adhesivo de 50 mm la
 * diferencia no es estética: el driver rasteriza a mapa de bits y el código de
 * barras sale con los módulos desalineados, así que la pistola falla a la
 * primera pasada. Emitiendo ZPL, el `^BC` lo dibuja el firmware de la impresora
 * con la geometría exacta que el lector espera.
 *
 * Es el lenguaje que la app asume por defecto, porque los adhesivos lavables por
 * prenda **solo** salen de una etiquetera: una impresora de boleta no pega nada.
 */

/**
 * Un adhesivo lavable: el código de la unidad, grande y en barras.
 *
 * Lleva el ref en texto legible porque en la mesa de empaque la etiqueta se lee
 * a ojo tan seguido como se pistolea, y la faena/empresa porque una prenda
 * suelta sobre la mesa no tiene otra forma de volver a su morral.
 */
function garmentLabel(job: WeighPrintJob, code: string, printer: PrinterConfig): string {
  const { dpi } = printer;
  const width = dots(printer.labelWidthMm, dpi);
  const height = dots(printer.labelHeightMm, dpi);
  const margin = dots(2, dpi);
  const origin = job.is_contractor
    ? [truncate(asciiText(job.faena), 18), truncate(asciiText(job.company_name), 18), "CONTRATISTA"].join(
        SEPARATOR,
      )
    : [truncate(asciiText(job.faena), 20), truncate(asciiText(job.company_name), 20)].join(SEPARATOR);

  return [
    "^XA",
    "^CI13", // juego de caracteres con los acentos latinos disponibles
    `^PW${width}`,
    `^LL${height}`,
    "^LH0,0",
    // Código de barras Code 128 con el código completo de la unidad. Es lo que
    // lee la pistola en empaque y lo único que no puede salir mal.
    `^FO${margin},${margin}^BY2,3,${dots(9, dpi)}^BCN,${dots(9, dpi)},N,N,N^FD${asciiText(code)}^FS`,
    // El mismo código en texto, para leerlo sin pistola.
    `^FO${margin},${margin + dots(11, dpi)}^A0N,${dots(4.5, dpi)},${dots(4.5, dpi)}^FD${asciiText(code)}^FS`,
    `^FO${margin},${margin + dots(16, dpi)}^A0N,${dots(2.6, dpi)},${dots(2.6, dpi)}^FD${truncate(origin, 46)}^FS`,
    "^XZ",
  ].join("\n");
}

/**
 * El ticket maestro: la única etiqueta que ve el digitalizador.
 *
 * Va al doble de alto que un adhesivo porque tiene que caber todo lo que el
 * digitador necesita sin ir a buscar nada al sistema, y porque no se pega a una
 * prenda: viaja suelta dentro del morral.
 */
function masterTicket(job: WeighPrintJob, printer: PrinterConfig): string {
  const { dpi } = printer;
  const width = dots(printer.labelWidthMm, dpi);
  const height = dots(printer.labelHeightMm * 2, dpi);
  const margin = dots(2, dpi);
  const line = (mm: number): number => margin + dots(mm, dpi);

  return [
    "^XA",
    "^CI13",
    `^PW${width}`,
    `^LL${height}`,
    "^LH0,0",
    `^FO${margin},${line(0)}^A0N,${dots(3, dpi)},${dots(3, dpi)}^FDPESAJE - DIGITALIZAR^FS`,
    `^FO${margin},${line(4)}^A0N,${dots(7, dpi)},${dots(7, dpi)}^FD${asciiText(job.reference)}^FS`,
    `^FO${margin},${line(13)}^BY2,3,${dots(10, dpi)}^BCN,${dots(10, dpi)},N,N,N^FD${asciiText(job.reference)}^FS`,
    `^FO${margin},${line(25)}^A0N,${dots(3.4, dpi)},${dots(3.4, dpi)}^FD${truncate(asciiText(job.client_name), 34)}^FS`,
    `^FO${margin},${line(29.5)}^A0N,${dots(3.4, dpi)},${dots(3.4, dpi)}^FD${truncate(asciiText(job.company_name), 34)}^FS`,
    `^FO${margin},${line(34)}^A0N,${dots(2.8, dpi)},${dots(2.8, dpi)}^FD${
      job.is_contractor ? "CONTRATISTA" : "MANDANTE"
    }${SEPARATOR}${truncate(asciiText(job.faena), 24)}^FS`,
    // Prendas y peso en cuerpo grande: son los dos números que el digitador
    // contrasta contra la OT física antes de tipear nada.
    `^FO${margin},${line(39)}^A0N,${dots(5, dpi)},${dots(5, dpi)}^FD${job.garment_count} PRENDAS  ${formatWeight(job.weight_kg)} KG^FS`,
    `^FO${margin},${line(46)}^A0N,${dots(2.6, dpi)},${dots(2.6, dpi)}^FD${formatDateTime(job.weighed_at)}${SEPARATOR}${truncate(
      asciiText(job.weighed_by_name),
      24,
    )}^FS`,
    "^XZ",
  ].join("\n");
}

/**
 * Arma el rollo completo de un pesaje: un adhesivo por prenda y el ticket
 * maestro al final.
 *
 * El maestro sale último a propósito: es el que queda arriba en la pila que cae
 * de la etiquetera, así que es lo primero que el operador toma para meterlo en
 * el morral.
 */
export function buildWeighZpl(job: WeighPrintJob, printer: PrinterConfig): string {
  const labels = job.labels.map((label) => garmentLabel(job, label.code, printer));
  return [...labels, masterTicket(job, printer)].join("\n");
}

/**
 * Qué código lleva el código de barras de la boleta.
 *
 * La boleta se pistolea tres veces sobre la misma mesa —abre el morral, lo
 * cierra y lo despacha (FLUJO_NEGOCIO.md §4, paso 6)—, así que tiene que traer
 * un código que la pistola lea. El backend acepta los tres de la guía
 * (`find_open_order`: OT, ref o código de control) y aquí se prefiere el de
 * control, que es el que el flujo llama "el código de la boleta".
 *
 * Se descarta si trae un guion: ese carácter es el separador que distingue una
 * etiqueta de prenda (`P1005-TOA`) de la boleta, y un código de control con
 * guion haría que el pistoleo marcara una prenda en vez de mover el morral. En
 * ese caso manda el ref, que por construcción no lo lleva.
 *
 * Lo usan los tres lenguajes, no solo este.
 */
export function receiptScanCode(job: ReceiptPrintJob): string {
  const control = asciiText(job.control_code);
  if (control && !control.includes("-")) return control;
  return asciiText(job.reference);
}

/**
 * La boleta que acompaña la ropa limpia de vuelta a faena (paso 6).
 *
 * Es un documento, no un adhesivo: se imprime sobre el mismo rollo pero con el
 * alto calculado a partir de cuántas prendas declara la guía, porque la lista
 * es lo único que crece. Va sin logo de la empresa —ver `ReceiptPrintJob`— y
 * sin nada que no se pueda leer a un brazo de distancia sobre una mesa.
 *
 * Lleva dos códigos y no uno porque sirven a dos puestos distintos: el de
 * barras es el que pistolea el empaque para cerrar y despachar el morral, y el
 * QR es el que lee la app de terreno al entregar en la habitación
 * (`qr_payload`, el RUT del trabajador). Confundirlos sería mandar al operador
 * de planta a escanear el código de la entrega.
 */
export function buildReceiptZpl(job: ReceiptPrintJob, printer: PrinterConfig): string {
  const { dpi } = printer;
  const width = dots(printer.labelWidthMm, dpi);
  const margin = dots(3, dpi);
  const line = (mm: number): number => margin + dots(mm, dpi);
  // El cuerpo es fijo hasta el detalle; de ahí abajo crece una línea por prenda
  // declarada. El alto se calcula desde dónde cae el pie y no al revés, para
  // que agregar un bloque arriba no deje la última línea fuera de la etiqueta.
  const itemMm = 4.2;
  const itemsTopMm = 99;
  const footerMm = itemsTopMm + job.items.length * itemMm + 1;
  // El pie mide 2.6 mm de alto; el resto es el aire que separa una boleta de la
  // siguiente. El rollo es continuo en la práctica; con etiquetas troqueladas la
  // boleta ocupa las que haga falta, que es preferible a cortar el detalle.
  const height = margin + dots(footerMm + 6, dpi);
  const text = (mm: number, sizeMm: number, value: string): string =>
    `^FO${margin},${line(mm)}^A0N,${dots(sizeMm, dpi)},${dots(sizeMm, dpi)}^FD${value}^FS`;
  /** Regla horizontal: separa bloques sin gastar el alto de un espacio en blanco. */
  const rule = (mm: number): string =>
    `^FO${margin},${line(mm)}^GB${width - margin * 2},${Math.max(1, dots(0.3, dpi))},${Math.max(1, dots(0.3, dpi))}^FS`;

  const scanCode = receiptScanCode(job);
  const destination =
    [asciiText(job.camp), asciiText(job.room)].filter(Boolean).join(SEPARATOR) || "SIN DESTINO";
  // Faena y empresa se recortan; "CONTRATISTA" no. Es lo único de esta línea
  // que cambia una decisión —dice que el morral no es del mandante de la faena
  // aunque se lave y se facture bajo su cliente—, así que si algo no cabe se
  // corta el nombre, nunca la marca.
  const origin = truncate(
    [truncate(asciiText(job.faena), 20), truncate(asciiText(job.company_name), 20)]
      .filter(Boolean)
      .join(SEPARATOR),
    job.is_contractor ? 32 : 46,
  );
  const footer = job.is_contractor ? `${origin}${SEPARATOR}CONTRATISTA` : origin;

  return [
    "^XA",
    "^CI13",
    `^PW${width}`,
    `^LL${height}`,
    "^LH0,0",

    text(0, 3, "BOLETA - MORRAL LIMPIO"),
    // El ref manda en la cabecera: es lo que identifica el morral en la mesa,
    // tanto para el operador como para lo que ya está pegado a la ropa.
    text(4, 8, asciiText(job.reference) || "S/REF"),
    `^FO${margin},${line(14)}^BY2,3,${dots(11, dpi)}^BCN,${dots(11, dpi)},N,N,N^FD${scanCode}^FS`,
    text(26.5, 2.6, `PISTOLEAR PARA CERRAR Y DESPACHAR${SEPARATOR}${scanCode}`),
    rule(30.5),

    text(32.5, 2.6, "TRABAJADOR"),
    text(36, 4.6, truncate(asciiText(job.worker_name).toUpperCase(), 26) || "-"),
    text(41.5, 2.8, [job.national_id || "Sin RUT", job.shift && `Turno ${job.shift}`]
      .filter(Boolean)
      .map((part) => asciiText(String(part)))
      .join(SEPARATOR)),

    text(46.5, 2.6, "ENTREGAR EN"),
    text(50, 4.6, truncate(destination.toUpperCase(), 26)),
    rule(57),

    // Bloque de escaneo de la entrega, apartado del resto para que la app de
    // terreno lo lea sin que el código de barras del empaque le estorbe.
    `^FO${margin},${line(59)}^BQN,2,${Math.max(4, Math.round((5 * dpi) / 203))}^FDHA,${asciiText(
      job.qr_payload,
    )}^FS`,
    `^FO${margin + dots(24, dpi)},${line(61)}^A0N,${dots(2.6, dpi)},${dots(2.6, dpi)}^FDCODIGO DE ENTREGA^FS`,
    `^FO${margin + dots(24, dpi)},${line(65)}^A0N,${dots(4.6, dpi)},${dots(4.6, dpi)}^FD${
      asciiText(job.qr_payload) || "-"
    }^FS`,
    `^FO${margin + dots(24, dpi)},${line(71)}^A0N,${dots(2.8, dpi)},${dots(2.8, dpi)}^FDENTREGA ${formatDate(
      job.promised_at,
    )}^FS`,
    rule(81),

    // Fila administrativa: los códigos que se copian a mano en la guía de
    // transporte y el resumen que se contrasta contra el morral.
    text(83, 2.8, `OT ${asciiText(job.order_number ?? "") || "S/N"}${SEPARATOR}CONTROL ${
      asciiText(job.control_code) || "-"
    }`),
    text(87.5, 4, `${job.garment_count} PRENDAS${
      job.weight_kg !== null ? `  ${formatWeight(job.weight_kg)} KG` : ""
    }`),
    rule(93),

    text(95, 2.6, "DETALLE DECLARADO"),
    ...job.items.map((item, index) =>
      text(
        itemsTopMm + index * itemMm,
        3.2,
        `${item.quantity} x ${truncate(asciiText(item.name).toUpperCase(), 30)}`,
      ),
    ),
    text(footerMm, 2.6, footer),
    "^XZ",
  ].join("\n");
}
